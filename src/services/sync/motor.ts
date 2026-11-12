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
import { aoMudarLocal, aplicarEventos, aplicarItens, lerEventos, lerSinc, marcarSyncAtivo, semearSinc, valoresDe } from '../db'

export interface MudancaItens { itens: ItemNuvem[]; doServidor: boolean }
export interface MudancaEventos { novos: Evento[]; removidos: string[]; doServidor: boolean }
export interface Porta {
  ouvirItens(aoMudar: (m: MudancaItens) => void, aoFalhar: (e: unknown) => void): () => void
  ouvirEventos(aoMudar: (m: MudancaEventos) => void, aoFalhar: (e: unknown) => void): () => void
  enviarItens(itens: ItemNuvem[]): Promise<void>
  enviarEventos(eventos: Evento[]): Promise<void>
  apagarEvento(id: string): Promise<void>
}
export type EstadoSync = 'parado' | 'conectando' | 'ok' | 'erro'
export interface Efeitos {
  /** Chegou coisa nova da nuvem: a tela precisa recarregar estas partes do banco. */
  aoReceber(o: { progresso: boolean; cartoes: boolean; marcas: boolean }): void
  aoMudarEstado(e: EstadoSync, detalhe?: string): void
}
export interface Sincronizacao { parar(): void; apagarEventoNaNuvem(id: string): void; sincronizarAgora(): Promise<void> }

export function iniciarSincronizacao(porta: Porta, ef: Efeitos, atrasoEnvioMs = 400): Sincronizacao {
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

  async function empurrar() {
    if (parou || !itensVistos || !eventosVistos) return // regra 1
    const enviar = aEnviarItens(await lerSinc(), remotoItens)
    if (enviar.length) {
      const itens = await valoresDe(enviar)
      for (const i of itens) remotoItens.set(i.key, { u: i.u, dev: i.dev }) // já está a caminho: não manda de novo antes de a nuvem confirmar
      porta.enviarItens(itens).catch((e) => { for (const i of itens) remotoItens.delete(i.key); falha(e) })
    }
    const eventos = (await lerEventos()).filter((e) => { const r = remotoEventos.get(e.id); return !r || (e.k === 'b' && r.k === 'b' && e.t > (r.t ?? 0)) })
    if (eventos.length) {
      for (const e of eventos) remotoEventos.set(e.id, { k: e.k, t: e.k === 'b' || e.k === 'z' || e.k === 'r' ? e.t : undefined })
      porta.enviarEventos(eventos).catch((e) => { for (const x of eventos) remotoEventos.delete(x.id); falha(e) })
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const agendar = () => { clearTimeout(timer); timer = setTimeout(() => void naFila(empurrar), atrasoEnvioMs) }

  // Primeiro da fila, antes de qualquer resposta da nuvem: o que o aparelho já tinha (cartões, marcações…) ganha carimbo para poder subir; e a cura de eventos fica desligada (ver preparar.ts).
  void naFila(async () => { await marcarSyncAtivo(); await semearSinc(); ef.aoMudarEstado('conectando'); agendar() })

  const parar1 = porta.ouvirItens((m) => void naFila(async () => {
    for (const i of m.itens) remotoItens.set(i.key, { u: i.u, dev: i.dev })
    const mudou = await aplicarItens(m.itens)
    if (m.doServidor) itensVistos = true
    if (mudou.cartoes || mudou.marcas) ef.aoReceber({ progresso: false, ...mudou })
    estado(); await empurrar()
  }), falha)
  const parar2 = porta.ouvirEventos((m) => void naFila(async () => {
    for (const e of m.novos) remotoEventos.set(e.id, { k: e.k, t: e.k === 'b' || e.k === 'z' || e.k === 'r' ? e.t : undefined })
    for (const id of m.removidos) remotoEventos.delete(id)
    const mudou = await aplicarEventos(m.novos, m.removidos)
    if (m.doServidor) eventosVistos = true
    if (mudou) ef.aoReceber({ progresso: true, cartoes: false, marcas: false })
    estado(); await empurrar()
  }), falha)
  aoMudarLocal(agendar)

  return {
    parar: () => { parou = true; clearTimeout(timer); parar1(); parar2(); aoMudarLocal(null); ef.aoMudarEstado('parado') },
    apagarEventoNaNuvem: (id) => { remotoEventos.delete(id); porta.apagarEvento(id).catch(falha) },
    sincronizarAgora: () => naFila(empurrar),
  }
}
