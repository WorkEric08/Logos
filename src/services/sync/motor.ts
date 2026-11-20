// Motor da sincronização: liga o banco local (services/db.ts) a uma "porta" para a nuvem. Não conhece o Firebase (a porta é quem conhece:
// services/sync/firestore.ts), então os testes usam uma porta de mentira.
// Regras que não podem regredir:
//  1. Só ENVIA depois de ter visto o estado REAL da nuvem (resposta do servidor, não só o cache do aparelho): senão um aparelho que abriu sem
//     internet com o cache vazio mandaria versões velhas por cima das novas.
//  2. Juntar é união: o item mais novo de cada chave vence; nada do que está no aparelho é apagado pelo motor (a exclusão vem só de lápide).
//  3. Eventos (respostas, simulados, zerar) são só acrescentados, um dono por registro; a única coisa apagada é o evento "zerar" que a pessoa desfez.
//  4. Falhar nunca derruba o app: o erro vira estado e o app segue offline.
import type { Evento } from '../../core/sync/eventos'
import { aEnviarItens, type ItemNuvem } from '../../core/sync/nuvem'
import { aoMudarLocal, aplicarCorpoBaixado, aplicarEventos, aplicarItens, bytesDosPacotes, contarPacotes, corpoParaSubir, gravarCursor, lerCursor, lerEventos, lerSinc, marcarPacoteEnviado, lerAvisoEspacos, marcarPacoteInvalido, marcarSyncAtivo, pacotesABaixar, pacotesParaSubir, semearSinc, valoresDe, type PacoteRow } from '../db'
import { tempoDe } from '../../core/sync/eventos'
import { chavePacote, confereCotas, lerCorpo, type Corpo } from '../../core/sync/espacos'

export interface MudancaItens { itens: ItemNuvem[]; doServidor: boolean }
export interface MudancaEventos { novos: Evento[]; removidos: string[]; doServidor: boolean }
/** Margem da leitura incremental: pede o que veio depois do cursor MENOS 7 dias (relógio atrasado de outro aparelho, alteração feita offline e enviada depois). Repetir é inofensivo: juntar é união. */
export const MARGEM_LEITURA_MS = 7 * 24 * 3_600_000
export interface Porta {
  /** `desde`: só o que tem `u` maior que isto (leitura incremental, F6.3a). Sem `desde`: a coleção inteira (primeira vez neste aparelho). */
  ouvirItens(aoMudar: (m: MudancaItens) => void, aoFalhar: (e: unknown) => void, desde?: number): () => void
  /** `desde`: só os eventos com `t` maior que isto. */
  ouvirEventos(aoMudar: (m: MudancaEventos) => void, aoFalhar: (e: unknown) => void, desde?: number): () => void
  enviarItens(itens: ItemNuvem[]): Promise<void>
  enviarEventos(eventos: Evento[]): Promise<void>
  apagarEvento(id: string): Promise<void>
  /** F6.3: sobe os corpos dos pacotes (o catálogo sobe DEPOIS, pelo `enviarItens`: ninguém vê catálogo sem corpo). */
  enviarCorpos(corpos: { pid: string; corpo: Corpo }[]): Promise<void>
  /** O documento do corpo como está na nuvem (sem conferir), ou `null` se não existe. Lido UM por vez, com `getDoc`: nunca ouvido ao vivo. */
  baixarCorpo(pid: string): Promise<unknown | null>
  /** Apaga os corpos (e só eles) de pacotes que viraram lápide. */
  apagarCorpos(pids: string[]): Promise<void>
}
export type EstadoSync = 'parado' | 'conectando' | 'ok' | 'erro'
export interface Efeitos {
  /** Chegou coisa nova da nuvem: a tela precisa recarregar estas partes do banco. */
  aoReceber(o: { progresso: boolean; cartoes: boolean; marcas: boolean; espacos: boolean }): void
  aoMudarEstado(e: EstadoSync, detalhe?: string): void
  /** O espaço ativo agora (a fila de download baixa primeiro os pacotes dele). */
  espacoAtivo?(): string | null
  /** Há espaço ou material daqui para subir e a pessoa ainda não viu o aviso do que sobe: nada de espaço sobe até ela responder (F6.5). */
  aoPrecisaAviso?(): void
  /** O andamento dos pacotes (para a tela: "7 de 12 pacotes"). */
  aoPacotes?(p: { total: number; baixar: number; subir: number; cota: number; bytesBaixar: number; bytesTotal: number }): void
}
export interface OpcoesSync {
  /** Atraso para juntar alterações antes de enviar (ms). */
  atrasoEnvioMs?: number
  /** Esperas entre tentativas quando baixar um pacote falha (ms): 1 min, 5 min, 30 min. */
  esperasDeNovo?: number[]
  /** Limites de tamanho por espaço e por conta (bytes); o padrão são os decididos pelo dono (25 MB e 100 MB). Os testes usam valores pequenos. */
  limites?: { espacoBytes: number; contaBytes: number }
}
export interface Sincronizacao { parar(): void; apagarEventoNaNuvem(id: string): void; sincronizarAgora(): Promise<void> }

export function iniciarSincronizacao(porta: Porta, ef: Efeitos, opcoes: number | OpcoesSync = 400): Sincronizacao {
  const o = typeof opcoes === 'number' ? { atrasoEnvioMs: opcoes } : opcoes
  const atrasoEnvioMs = o.atrasoEnvioMs ?? 400, esperasDeNovo = o.esperasDeNovo ?? [60_000, 300_000, 1_800_000]
  const remotoItens = new Map<string, { u: number; dev: string }>()
  const remotoEventos = new Map<string, { k: Evento['k']; t?: number }>()
  let itensVistos = false, eventosVistos = false, parou = false, falhou = false
  let fila: Promise<unknown> = Promise.resolve()
  const naFila = (f: () => Promise<void>) => { fila = fila.then(f).catch((e) => falha(e)); return fila as Promise<void> }
  const falha = (e: unknown) => {
    if (parou) return
    falhou = true
    console.warn('[sync] falhou; o app segue só no aparelho', e)
    ef.aoMudarEstado('erro', e instanceof Error ? e.message : String(e))
  }
  const estado = () => { if (!parou && !falhou) ef.aoMudarEstado(itensVistos && eventosVistos ? 'ok' : 'conectando') }
  const marcarPacoteCota = async (pid: string) => { const { atualizarEstadoPacote } = await import('../db'); await atualizarEstadoPacote(pid, 'cota') }

  async function empurrar() {
    if (parou || !itensVistos || !eventosVistos) return // regra 1
    let enviar = aEnviarItens(await lerSinc(), remotoItens)
    // F6.5: a 1ª vez que este aparelho vai subir espaço/material, a pessoa é avisada do que sobe e pode "Manter só aqui". Até responder, só cartões, marcações e progresso sobem.
    // (a LÁPIDE de espaço/pacote sempre passa: apagar algo que já está na conta não é "subir conteúdo", e o aviso é só sobre conteúdo)
    const segurar = (x: { id: string; x?: 1 }) => (x.id.startsWith('e:') || x.id.startsWith('p:')) && !x.x
    if (enviar.some(segurar) && !(await lerAvisoEspacos())) {
      enviar = enviar.filter((x) => !segurar(x))
      ef.aoPrecisaAviso?.()
    }
    // F6.3: pacotes com conteúdo daqui: o CORPO sobe antes do catálogo (quem vê o catálogo sempre acha o corpo). Se o catálogo já está na nuvem (outro aparelho subiu o mesmo pacote),
    // o corpo também está: só marca. Acima da cota por espaço/conta, o pacote fica "só neste aparelho" (estado 'cota') e não sobe.
    const subir = (await pacotesParaSubir()).filter((k) => enviar.some((x) => x.id === chavePacote(k.id)) || remotoItens.has(chavePacote(k.id)))
    if (subir.length) {
      const pendentes = new Set(enviar.map((x) => x.id)), tira = new Set<string>()
      const corpos: { pid: string; corpo: Corpo; k: PacoteRow }[] = []
      const usado = await bytesDosPacotes()
      let somaEspaco = { ...usado.porEspaco }, somaConta = usado.total
      for (const k of subir) {
        const chave = chavePacote(k.id), corpo = corpoParaSubir(k)
        if (!pendentes.has(chave)) { if (remotoItens.has(chave)) await marcarPacoteEnviado(k.id); continue } // o catálogo já está lá (ou nunca foi carimbado: lápide?): não há o que subir
        if (!corpo) { await marcarPacoteEnviado(k.id); continue }
        const c = confereCotas(somaEspaco[k.e] ?? 0, somaConta, k.b, o.limites)
        if (!c.ok) { await marcarPacoteCota(k.id); tira.add(chave); continue }
        somaEspaco = { ...somaEspaco, [k.e]: (somaEspaco[k.e] ?? 0) + k.b }; somaConta += k.b
        corpos.push({ pid: k.id, corpo, k })
      }
      if (corpos.length) {
        try { await porta.enviarCorpos(corpos.map(({ pid, corpo }) => ({ pid, corpo }))); for (const c of corpos) await marcarPacoteEnviado(c.pid) }
        catch (e) { for (const c of corpos) tira.add(chavePacote(c.pid)); falha(e) }
      }
      enviar = enviar.filter((x) => !tira.has(x.id))
    }
    if (enviar.length) {
      const itens = await valoresDe(enviar)
      for (const i of itens) remotoItens.set(i.key, { u: i.u, dev: i.dev }) // já está a caminho: não manda de novo antes de a nuvem confirmar
      porta.enviarItens(itens).catch((e) => { for (const i of itens) remotoItens.delete(i.key); falha(e) })
      const lapidesDePacote = itens.filter((i) => i.x && i.key.startsWith('p:')).map((i) => i.key.slice(2))
      if (lapidesDePacote.length) porta.apagarCorpos(lapidesDePacote).catch(falha) // o pacote apagado aqui também sai da nuvem (corpo; o catálogo fica como lápide)
    }
    const eventos = (await lerEventos()).filter((e) => { const r = remotoEventos.get(e.id); return !r || (e.k === 'b' && r.k === 'b' && e.t > (r.t ?? 0)) })
    if (eventos.length) {
      for (const e of eventos) remotoEventos.set(e.id, { k: e.k, t: e.k === 'b' || e.k === 'z' || e.k === 'r' ? e.t : undefined })
      porta.enviarEventos(eventos).catch((e) => { for (const x of eventos) remotoEventos.delete(x.id); falha(e) })
    }
  }

  // F6.3: baixa os corpos dos pacotes cujo catálogo chegou, UM por vez (o do espaço ativo primeiro). Cada pacote entra inteiro numa transação ou não entra.
  let baixando = false, tentativa = 0, timerDeNovo: ReturnType<typeof setTimeout> | undefined
  const avisarPacotes = async () => { try { ef.aoPacotes?.(await contarPacotes()) } catch { /* só informa */ } }
  async function baixar() {
    if (baixando || parou || !itensVistos) return
    baixando = true
    try {
      for (let volta = 0; volta < 1000 && !parou; volta++) {
        const todos = await pacotesABaixar()
        if (!todos.length) break
        const ativo = ef.espacoAtivo?.() ?? null
        todos.sort((a, b) => Number(b.e === ativo) - Number(a.e === ativo) || (a.parte ?? 0) - (b.parte ?? 0) || a.de - b.de)
        let fez = false
        for (const k of todos) {
          if (parou) break
          const cru = await porta.baixarCorpo(k.id)
          if (cru === null || cru === undefined) continue // o corpo ainda não está na nuvem: tenta de novo depois
          const lido = lerCorpo(k.id, cru)
          if (!lido.ok) { console.warn('[sync] pacote recusado', k.id, lido.erro); await marcarPacoteInvalido(k.id); fez = true; continue }
          if (await aplicarCorpoBaixado(k.id, lido)) { fez = true; ef.aoReceber({ progresso: false, cartoes: false, marcas: false, espacos: true }); await avisarPacotes() }
        }
        if (!fez) break
      }
      tentativa = 0
    } catch (e) {
      // falha de rede ou de permissão: tenta de novo mais tarde (1 min, 5 min, 30 min); o app segue funcionando com o que já chegou
      const espera = esperasDeNovo[Math.min(tentativa++, esperasDeNovo.length - 1)]
      clearTimeout(timerDeNovo); timerDeNovo = setTimeout(() => void baixar(), espera)
      console.warn('[sync] não baixou os pacotes agora; tentando de novo em', espera, 'ms', e)
    } finally { baixando = false }
    await avisarPacotes()
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const agendar = () => { clearTimeout(timer); timer = setTimeout(() => void naFila(empurrar), atrasoEnvioMs) }

  // Primeiro da fila, antes de qualquer resposta da nuvem: o que o aparelho já tinha (cartões, marcações…) ganha carimbo para poder subir; e a cura de eventos fica desligada (ver preparar.ts).
  void naFila(async () => { await marcarSyncAtivo(); await semearSinc(); ef.aoMudarEstado('conectando'); agendar() })

  let parar1 = () => {}, parar2 = () => {}
  const aoItens = (m: MudancaItens) => void naFila(async () => {
    for (const i of m.itens) remotoItens.set(i.key, { u: i.u, dev: i.dev })
    const mudou = await aplicarItens(m.itens)
    if (m.doServidor) { itensVistos = true; if (m.itens.length) await gravarCursor('itens', Math.max(...m.itens.map((i) => i.u))) }
    if (mudou.cartoes || mudou.marcas || mudou.espacos) ef.aoReceber({ progresso: false, ...mudou })
    estado(); await empurrar(); void baixar(); void avisarPacotes()
  })
  const aoEventos = (m: MudancaEventos) => void naFila(async () => {
    for (const e of m.novos) remotoEventos.set(e.id, { k: e.k, t: e.k === 'b' || e.k === 'z' || e.k === 'r' ? e.t : undefined })
    for (const id of m.removidos) remotoEventos.delete(id)
    const mudou = await aplicarEventos(m.novos, m.removidos)
    if (m.doServidor) { eventosVistos = true; if (m.novos.length) await gravarCursor('eventos', Math.max(...m.novos.map(tempoDe))) }
    if (mudou) ef.aoReceber({ progresso: true, cartoes: false, marcas: false, espacos: false })
    estado(); await empurrar()
  })
  // F6.3a: lê só o que é novo desde a última vez (cursor guardado), não a coleção inteira a cada abertura
  void (async () => {
    const [ci, ce] = await Promise.all([lerCursor('itens'), lerCursor('eventos')])
    if (parou) return
    parar1 = porta.ouvirItens(aoItens, falha, ci ? ci - MARGEM_LEITURA_MS : undefined)
    parar2 = porta.ouvirEventos(aoEventos, falha, ce ? ce - MARGEM_LEITURA_MS : undefined)
  })().catch(falha)
  aoMudarLocal(agendar)

  return {
    parar: () => { parou = true; clearTimeout(timer); clearTimeout(timerDeNovo); parar1(); parar2(); aoMudarLocal(null); ef.aoMudarEstado('parado') }, // (parar1/parar2 ainda vazios se parou antes de assinar: a assinatura confere `parou`)
    apagarEventoNaNuvem: (id) => { remotoEventos.delete(id); porta.apagarEvento(id).catch(falha) },
    sincronizarAgora: () => naFila(empurrar),
  }
}
