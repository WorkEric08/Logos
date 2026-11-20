// Espaços de estudo: o do Banco do Brasil vem embutido; os outros a pessoa cria e enche importando arquivos (services/importar). Aqui ficam a lista, o espaço
// ativo e a TROCA: ativar um espaço reatribui as questões, matérias, provas e regras do simulado que o app lê (ligações vivas em store/app.ts, core/subjects.ts,
// core/scoring.ts e core/provas.ts) e sobe `versao` para as telas recomeçarem. O banco do aparelho (`treino-bb`) e o progresso não são tocados.
import { create } from 'zustand'
import { DEFAULT_FILTERS } from '../core/filters'
import { BANCOS_BB, definirBancos } from '../core/provas'
import { REGRAS_BB, definirRegras } from '../core/scoring'
import { BB_EXTRA, BB_SOURCES, BB_SUBJECTS, definirMaterias } from '../core/subjects'
import { ID_ESPACO_BB, espacoVazio, juntarQuestoes, materiasDasQuestoes, planoSimulado, type Banco, type Espaco } from '../core/espaco'
import type { Question, Subject } from '../core/types'
import { apagarEspaco, gravarEspacoAtivoId, lerEspaco, lerEspacoAtivoId, listarEspacos, removerQuestoesDoEspaco, salvarEspaco, contarSemEnunciado, pacotesDoEspaco, definirEspacoLocal, type EspacoRow } from '../services/db'
import { AVISOS } from '../core/avisos'
import { BB_BANK, BB_BASES, definirBanco, useApp } from './app'

/** O que a lista de espaços mostra sobre a conta Google (F6.5): quantos pacotes (provas/materiais) o espaço tem, quantos faltam baixar ou subir, quantos ficaram acima do limite. */
export interface SeloEspaco { total: number; baixar: number; subir: number; cota: number; invalido: number; bytes: number }
export interface ResumoEspaco { id: string; nome: string; n: number; embutido?: boolean; /** "Só neste aparelho": nada dele sobe. */ local?: boolean; selo?: SeloEspaco }

/** O espaço do Banco do Brasil, montado do que vem no app. */
export const espacoBB = (): Espaco => ({
  id: ID_ESPACO_BB, nome: 'Banco do Brasil e outros bancos', questoes: BB_BANK, bases: BB_BASES, fontes: BB_SOURCES, materias: BB_SUBJECTS, extras: BB_EXTRA,
  simulado: REGRAS_BB, bancos: BANCOS_BB, embutido: true,
})

const unicos = <T extends { id?: string; n?: string }>(l: T[], chave: (x: T) => string) => [...new Map(l.map((x) => [chave(x), x])).values()]

/** Monta o espaço que o app usa a partir do que está gravado (e, se pedido, junta as questões embutidas do BB). */
export function montarEspaco(row: EspacoRow, proprias: Question[]): Espaco {
  const base = row.usaBB ? espacoBB() : espacoVazio(row.id, row.nome)
  const questoes = juntarQuestoes(base.questoes, proprias).questoes
  const conhecidas: Subject[] = [...base.materias, ...base.extras, ...row.materias, ...row.extras]
  const todas = materiasDasQuestoes(questoes, unicos(conhecidas, (m) => m.n))
  const bancos: Banco[] = unicos([...base.bancos, ...row.bancos], (b) => b.id)
  return {
    id: row.id, nome: row.nome, questoes, bases: { ...base.bases, ...row.bases }, fontes: { ...base.fontes, ...row.fontes },
    materias: todas.filter((m) => m.ed !== false), extras: todas.filter((m) => m.ed === false), simulado: row.usaBB ? base.simulado : null, bancos,
  }
}

let atual: Espaco = espacoBB()
export const espacoAtual = () => atual

/** Troca o que o app lê pelo espaço `e` (sem tocar no banco do aparelho). */
export function aplicarEspaco(e: Espaco) {
  definirMaterias(e.materias, e.extras, e.fontes)
  definirRegras(e.simulado, e.simulado?.plano ?? planoSimulado(e.questoes, [...e.materias, ...e.extras], 30))
  definirBancos(e.bancos)
  definirBanco(e.questoes, e.bases)
  atual = e
}

interface State {
  lista: ResumoEspaco[]
  ativo: string
  pronto: boolean
  /** Questões importadas que ficaram sem enunciado por um defeito antigo (C-10): importar a prova de novo conserta. */
  semEnunciado: number
  /** Na abertura: lê qual espaço estava ativo e o aplica (antes de a tela abrir). Nunca falha para fora: erro = fica no Banco do Brasil. */
  iniciar: () => Promise<void>
  ativar: (id: string) => Promise<boolean>
  /** Atualiza só os selos da lista (andamento dos pacotes), sem mexer no espaço ativo. */
  atualizarSelos: () => Promise<void>
  /** "Só neste aparelho" de um espaço (F6.5). Devolve false se o espaço já está na conta (aí só apagando). */
  definirLocal: (id: string, local: boolean) => Promise<boolean>
  /** Chegou coisa da nuvem (F6): relê a lista e, se o espaço ativo mudou (questões novas, ou foi apagado em outro aparelho), reaplica. Não mexe no meio de um treino/simulado:
   *  nesse caso espera a sessão acabar. */
  recarregar: () => Promise<void>
  /** Cria um espaço vazio (ou com as questões do BB embutidas) e o ativa. */
  criar: (nome: string, usaBB: boolean) => Promise<string>
  renomear: (id: string, nome: string) => Promise<void>
  apagar: (id: string) => Promise<void>
  /** Junta questões importadas ao espaço ativo (só espaço criado pela pessoa) e o reaplica. Devolve quantas entraram e quantas já existiam. */
  adicionar: (novas: Question[], extra?: { fontes?: Record<string, string>; bases?: Record<string, string>; bancos?: Banco[] }) => Promise<{ adicionadas: number; repetidas: number; ids: string[]; antes: EspacoRow }>
  /** Desfaz uma importação (C-9): tira do espaço SÓ as questões que ela trouxe (`ids`) e devolve a linha do espaço ao que era (`antes`). O resto do espaço não muda. */
  retirar: (espacoId: string, ids: string[], antes: EspacoRow) => Promise<void>
}

const novoId = () => 'e' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')
const limpaNome = (n: string) => n.trim().replace(/\s+/g, ' ').slice(0, 40)

export function seloDe(pacotes: readonly { estado: string; b: number }[]): SeloEspaco {
  const conta = (e: string) => pacotes.filter((k) => k.estado === e).length
  return { total: pacotes.length, baixar: conta('baixar'), subir: conta('subir'), cota: conta('cota'), invalido: conta('invalido'), bytes: pacotes.reduce((a, k) => a + k.b, 0) }
}
async function recarregarLista(): Promise<ResumoEspaco[]> {
  const meus = await listarEspacos()
  const itens: ResumoEspaco[] = []
  for (const r of meus.sort((a, b) => a.criado - b.criado)) itens.push({ id: r.id, nome: r.nome, n: r.n + (r.usaBB ? BB_BANK.length : 0), ...(r.local ? { local: true } : {}), selo: seloDe(await pacotesDoEspaco(r.id)) })
  return [{ id: ID_ESPACO_BB, nome: espacoBB().nome, n: BB_BANK.length, embutido: true }, ...itens]
}

export const useEspacos = create<State>((set, get) => {
  const trocar = (e: Espaco) => {
    aplicarEspaco(e)
    set({ ativo: e.id })
    // as telas recomeçam: filtros, sessão e aba do espaço anterior não valem no novo
    useApp.setState((s) => ({ versao: s.versao + 1, filters: DEFAULT_FILTERS, session: null, saida: null, tab: s.tab === 'assistente' ? s.tab : 'inicio' })) // quem troca de espaço pelo chat continua no chat
  }
  // O que chegou da nuvem muda o espaço ativo: nunca no meio de um treino ou simulado (nada mexe numa questão em andamento); espera a sessão acabar.
  let pendente = false
  const reaplicarAtivo = async () => {
    const id = get().ativo
    if (id === ID_ESPACO_BB) return
    const d = await lerEspaco(id)
    if (!d) { trocar(espacoBB()); await gravarEspacoAtivoId(ID_ESPACO_BB); set({ lista: await recarregarLista() }); return } // o espaço foi apagado em outro aparelho
    const novo = montarEspaco(d.row, d.questoes)
    if (novo.questoes.length === atual.questoes.length && novo.nome === atual.nome && Object.keys(novo.fontes).length === Object.keys(atual.fontes).length) return // nada mudou para quem usa
    aplicarEspaco(novo); useApp.setState((s) => ({ versao: s.versao + 1 }))
  }
  useApp.subscribe((s, p) => { if (p.session && !s.session && pendente) { pendente = false; void reaplicarAtivo() } })
  return {
    lista: [{ id: ID_ESPACO_BB, nome: espacoBB().nome, n: BB_BANK.length, embutido: true }], ativo: ID_ESPACO_BB, pronto: false, semEnunciado: 0,
    iniciar: async () => {
      try {
        set({ lista: await recarregarLista() })
        const id = await lerEspacoAtivoId()
        if (id && id !== ID_ESPACO_BB) {
          const d = await lerEspaco(id)
          if (d) { aplicarEspaco(montarEspaco(d.row, d.questoes)); set({ ativo: id }) }
        }
      } catch (e) { console.warn('[espaços] não abriu o espaço ativo; fica no Banco do Brasil', e) }
      set({ pronto: true })
      try { // linhas antigas, gravadas quando o enunciado se perdia: avisa uma vez por abertura e o assistente explica
        const c = await contarSemEnunciado(); set({ semEnunciado: c.total })
        if (c.total > 0) useApp.getState().showToast(AVISOS.semEnunciado)
      } catch { /* sem banco: sem aviso */ }
    },
    ativar: async (id) => {
      if (id === get().ativo) return true
      if (id === ID_ESPACO_BB) { trocar(espacoBB()); await gravarEspacoAtivoId(id); return true }
      const d = await lerEspaco(id)
      if (!d) return false
      trocar(montarEspaco(d.row, d.questoes))
      await gravarEspacoAtivoId(id)
      return true
    },
    atualizarSelos: async () => { try { set({ lista: await recarregarLista() }) } catch { /* só informa */ } },
    definirLocal: async (id, local) => { const r = await definirEspacoLocal(id, local); set({ lista: await recarregarLista() }); return r },
    recarregar: async () => {
      set({ lista: await recarregarLista() })
      if (useApp.getState().session) { pendente = true; return }
      await reaplicarAtivo()
    },
    criar: async (nome, usaBB) => {
      const id = novoId()
      const row: EspacoRow = { id, nome: limpaNome(nome) || 'Meu espaço', criado: Date.now(), fontes: {}, bases: {}, materias: [], extras: [], bancos: [], simulado: null, ...(usaBB ? { usaBB: true } : {}) }
      await salvarEspaco(row, [])
      set({ lista: await recarregarLista() })
      await get().ativar(id)
      return id
    },
    renomear: async (id, nome) => {
      const d = await lerEspaco(id)
      const limpo = limpaNome(nome)
      if (!d || !limpo) return
      await salvarEspaco({ ...d.row, nome: limpo }, [])
      set({ lista: await recarregarLista() })
      if (get().ativo === id) atual = { ...atual, nome: limpo }
    },
    apagar: async (id) => {
      if (id === ID_ESPACO_BB) return
      const eraAtivo = get().ativo === id
      await apagarEspaco(id)
      if (eraAtivo) { trocar(espacoBB()); await gravarEspacoAtivoId(ID_ESPACO_BB) }
      set({ lista: await recarregarLista() })
    },
    adicionar: async (novas, extra = {}) => {
      const id = get().ativo
      const d = id === ID_ESPACO_BB ? null : await lerEspaco(id)
      if (!d) throw new Error('Escolha ou crie um espaço seu antes de importar (o espaço do Banco do Brasil não recebe arquivos).')
      const juntas = juntarQuestoes(d.questoes, novas)
      const fontes = { ...d.row.fontes, ...extra.fontes }
      for (const q of novas) if (!(q.s in fontes) && !(q.s in atual.fontes)) fontes[q.s] = q.s
      const row: EspacoRow = {
        ...d.row, fontes, bases: { ...d.row.bases, ...extra.bases },
        bancos: unicos([...d.row.bancos, ...(extra.bancos ?? [])], (b) => b.id),
        materias: materiasDasQuestoes(juntas.questoes, [...d.row.materias, ...d.row.extras]),
      }
      await salvarEspaco(row, novas)
      trocar(montarEspaco(row, juntas.questoes))
      set({ lista: await recarregarLista() })
      const jaTinha = new Set(d.questoes.map((q) => q.id))
      return { adicionadas: juntas.adicionadas, repetidas: juntas.repetidas, ids: [...new Set(novas.map((q) => q.id))].filter((qid) => !jaTinha.has(qid)), antes: d.row }
    },
    retirar: async (espacoId, ids, antes) => {
      await removerQuestoesDoEspaco(ids, antes)
      if (get().ativo === espacoId) { const d = await lerEspaco(espacoId); if (d) trocar(montarEspaco(d.row, d.questoes)) }
      set({ lista: await recarregarLista() })
    },
  }
})
