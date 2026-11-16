import { create } from 'zustand'
import bank from '../data/bank.json'
import type { Letter, ProgressMap, Question } from '../core/types'
import { DEFAULT_FILTERS, baseDaProva, filterPool, recordAnswer, type Filters } from '../core/filters'
import { pick, shuffle, themeFrequency } from '../core/weights'
import { SIMULADO_PLAN, scoreSimulado } from '../core/scoring'
import { HIST_VAZIO, alternarMarca, registrarResposta, registrarSimulado, salvarNota, type Hist, type Marks } from '../core/historico'
import { decorrido, iniciarCron, pausarCron, retomarCron, type Cron } from '../core/cronometro'
import { AVISOS } from '../core/avisos'
import { migrarProgresso, type MapaIds } from '../core/migracao'
import idMap from '../data/id-map.json'
import { desfazerZerar, gravarResposta, gravarSimulado, gravarZerar, loadAll, refazerEventosDoAparelho, replaceAll, saveHist, saveMarks, saveOne, saveTema } from '../services/db'
import { prepararSincronizacao } from '../services/sync/preparar'
import { baseDe, resposta, simulado, zerar } from '../core/sync/eventos'
import { apagarEventoNaNuvem } from '../services/sync/ponte'

// As questões que o app mostra são as do ESPAÇO ATIVO. São "let" de propósito: trocar de espaço reatribui (definirBanco) e quem importa vê o valor novo.
// Começam com o Banco do Brasil, o espaço embutido.
export const BB_BANK = bank.q as unknown as Question[]
export const BB_BASES = bank.bases as Record<string, string>
export let BANK = BB_BANK
export let BASES = BB_BASES
export let BY_ID = Object.fromEntries(BANK.map((q) => [q.id, q])) as Record<string, Question>
export let TF = themeFrequency(BANK)
export function definirBanco(questoes: Question[], bases: Record<string, string>) {
  BANK = questoes; BASES = bases
  BY_ID = Object.fromEntries(questoes.map((q) => [q.id, q])) as Record<string, Question>
  TF = themeFrequency(questoes)
}
export const ID_MAP = idMap as unknown as MapaIds

export type Tab = 'inicio' | 'treinar' | 'cartoes' | 'assistente' | 'desempenho' | 'mais'
export interface Session {
  ids: string[]; i: number; ans: Record<string, Letter>
  sim: boolean; done: boolean; review: boolean; counted: boolean
  cron: Cron // cronômetro escondido do simulado (não aparece na prova; o tempo vai para o resultado e o histórico)
  dur?: number // segundos gastos, definido ao entregar o simulado
}
/** Quer sair da prova do simulado em andamento: espera a resposta de “tem certeza?”. `destino` = aba para onde ir se confirmar. */
export interface Saida { destino: Tab }
export interface ToastMsg { id: number; text: string; action?: { label: string; run: () => void } }

interface State {
  ready: boolean; prog: ProgressMap; tema: string; hist: Hist; marks: Marks
  /** Sobe a cada troca de espaço de estudo: as telas recomeçam lendo as questões e as matérias do espaço novo. */
  versao: number
  tab: Tab; filters: Filters; session: Session | null; toast: ToastMsg | null; saida: Saida | null
  /** Sobe a cada toque num ícone da barra: a tela daquele ícone recomeça do início (sub-telas fechadas, rolagem no topo). */
  reinicio: number
  load: () => Promise<void>
  setTab: (t: Tab) => void
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void
  setMatFilter: (m: string) => void
  startFromFilters: () => void
  startByWeight: () => void
  startSimulado: () => void
  startErrors: () => void
  /** Começa uma sessão com estas questões (ex.: simulado de uma matéria montado pelo assistente). */
  startCustom: (ids: string[], sim: boolean) => void
  leave: () => void
  /** Tocar num ícone da barra: vai para a aba e a mostra desde o início (mesmo já estando nela). Simulado em andamento pergunta antes. */
  irPara: (t: Tab) => void
  sair: () => void
  confirmarSaida: () => void
  cancelarSaida: () => void
  /** O relógio do simulado só corre com o app à vista. */
  pausarCron: () => void
  retomarCron: () => void
  answer: (l: Letter) => void
  go: (delta: number) => void
  jump: (i: number) => void
  finish: () => void
  backToResult: () => void
  restore: (p: ProgressMap, extra?: { hist?: Hist | null; marks?: Marks | null }) => Promise<void>
  toggleMark: (id: string) => void
  setNote: (id: string, text: string) => void
  flushMarks: () => void
  resetAll: () => Promise<void>
  /** A nuvem trouxe coisa nova (outro aparelho): relê do banco local o que mudou. */
  recarregar: (o: { progresso: boolean; marcas: boolean }) => Promise<void>
  setTema: (t: string) => void
  showToast: (text: string, action?: ToastMsg['action']) => void
  clearToast: () => void
}

let toastId = 0
let marksTimer: ReturnType<typeof setTimeout> | undefined
/** Id deste aparelho para o registro de eventos de sincronização. Vazio = a preparação falhou: o app segue só com o progresso de sempre (sem eventos). */
let aparelho = ''
const newSession = (ids: string[], sim = false): Session => ({ ids, i: 0, ans: {}, sim, done: false, review: false, counted: false, cron: iniciarCron(Date.now()) })

export const useApp = create<State>((set, get) => {
  const begin = (ids: string[], sim = false) => {
    if (!ids.length) { get().showToast(AVISOS.semQuestoes); return }
    set({ session: newSession(ids, sim), saida: null })
  }
  const commit = (id: string, letter: Letter) => {
    const q = BY_ID[id]
    const now = Date.now()
    const prog = recordAnswer(get().prog, q, letter, now)
    const hist = registrarResposta(get().hist, letter === q.g, now)
    set({ prog, hist })
    // o evento vai na MESMA transação do progresso e do histórico (services/db.ts): os dois nunca se afastam
    if (aparelho) void gravarResposta(id, prog[id], hist, resposta(aparelho, id, letter, letter === q.g, now))
    else { void saveOne(id, prog[id]); void saveHist(hist) }
  }
  const preparar = async (prog: ProgressMap, hist: Hist) => {
    try { aparelho = await prepararSincronizacao(prog, hist) } catch (e) { aparelho = ''; console.warn('[sync] não preparou a sincronização; o app segue sem ela', e) }
  }
  return {
    ready: false, versao: 0, prog: {}, tema: 'auto', hist: HIST_VAZIO, marks: {}, tab: 'inicio', filters: DEFAULT_FILTERS, session: null, toast: null, saida: null, reinicio: 0,
    load: async () => {
      const { prog, tema, hist = HIST_VAZIO, marks = {} } = await loadAll()
      // Banco novo: os ids antigos (ex.: 2018-6) passam para os novos. Antes de gravar, guarda uma cópia do progresso antigo.
      const m = migrarProgresso(prog, ID_MAP)
      if (m.movidas) {
        try { localStorage.setItem('treino_progresso_antes_do_banco_novo', JSON.stringify({ v: 1, prog })) } catch { /* sem armazenamento: segue, o progresso antigo ainda está no IndexedDB até o replaceAll */ }
        let gravou = true
        try { await replaceAll(m.prog) } catch { gravou = false } // transação única: se falhar, o IndexedDB fica como estava (ids antigos intactos)
        // Só abre a tela depois de gravar (uma resposta nova não pode ser apagada pela troca). Se a gravação falhou, a memória fica igual
        // ao banco (ids antigos): assim, na próxima abertura, a migração soma uma só vez, sem contar o progresso em dobro.
        if (gravou) await preparar(m.prog, hist) // (se a troca de ids falhou, nada de eventos agora: a próxima abertura refaz tudo)
        set({ prog: gravou ? m.prog : prog, tema, hist, marks, ready: true })
        get().showToast(gravou
          ? AVISOS.bancoAtualizado(m.corrigidas)
          : AVISOS.bancoFalhou) // o progresso antigo continua guardado e a atualização é tentada de novo ao abrir
        return
      }
      await preparar(prog, hist)
      set({ prog, tema, hist, marks, ready: true })
    },
    setTab: (tab) => set({ tab, session: null, saida: null }),
    setFilter: (k, v) => set((s) => {
      const filters = { ...s.filters, [k]: v }
      if (k === 'ano') { // trocar de prova: matéria e tema que a nova prova não tem saem do filtro (senão o treino ficaria vazio)
        const base = baseDaProva(BANK, filters.ano)
        if (filters.mat && !base.some((q) => q.m === filters.mat)) { filters.mat = ''; filters.tema = '' }
        else if (filters.tema && !base.some((q) => q.m === filters.mat && q.t === filters.tema)) filters.tema = ''
      }
      return { filters }
    }),
    setMatFilter: (m) => set((s) => ({ filters: { ...s.filters, mat: m, tema: '' } })),
    startFromFilters: () => {
      const { filters: f, prog, marks } = get()
      const pool = filterPool(BANK, f, prog, marks)
      const n = f.qtd === 0 ? pool.length : Math.min(f.qtd, pool.length)
      const list = f.ordem === 'peso' ? pick(pool, n, TF, prog)
        : f.ordem === 'prova' ? pool.slice().sort((a, b) => a.y - b.y || a.n - b.n).slice(0, n)
        : shuffle(pool).slice(0, n)
      begin(list.map((q) => q.id))
    },
    startByWeight: () => begin(pick(BANK, 10, TF, get().prog).map((q) => q.id)),
    startSimulado: () => {
      const { prog } = get()
      const ids = SIMULADO_PLAN.flatMap(([m, n]) =>
        pick(BANK.filter((q) => q.m === m && !q.ger), n, TF, prog).sort((a, b) => a.y - b.y || a.n - b.n).map((q) => q.id)) // o simulado do edital só tem questão de prova: nunca as geradas
      begin(ids, true)
    },
    startCustom: (ids, sim) => begin(ids, sim),
    startErrors: () => begin(shuffle(BANK.filter((q) => get().prog[q.id]?.ok === false)).slice(0, 20).map((q) => q.id)),
    leave: () => set({ session: null, tab: 'inicio', saida: null }),
    irPara: (t) => {
      const s = get().session
      if (s?.sim && !s.done) set({ saida: { destino: t } }) // simulado em andamento: pergunta antes de encerrar
      else { set((x) => ({ reinicio: x.reinicio + 1 })); get().setTab(t) }
    },
    sair: () => get().irPara('inicio'),
    confirmarSaida: () => { const q = get().saida; if (q) get().setTab(q.destino) },
    cancelarSaida: () => set({ saida: null }),
    pausarCron: () => { const s = get().session; if (s?.sim && !s.done) set({ session: { ...s, cron: pausarCron(s.cron, Date.now()) } }) },
    retomarCron: () => { const s = get().session; if (s?.sim && !s.done) set({ session: { ...s, cron: retomarCron(s.cron, Date.now()) } }) },
    answer: (l) => {
      const s = get().session; if (!s) return
      const id = s.ids[s.i]
      if (s.sim && !s.done) { set({ session: { ...s, ans: { ...s.ans, [id]: l } } }); return }
      if (s.ans[id]) return
      commit(id, l)
      set({ session: { ...s, ans: { ...s.ans, [id]: l } } })
    },
    go: (d) => { const s = get().session; if (s) set({ session: { ...s, i: s.i + d } }) },
    jump: (i) => { const s = get().session; if (s) set({ session: { ...s, i, review: true } }) },
    finish: () => {
      const s = get().session; if (!s) return
      let dur: number | undefined
      if (s.sim && !s.counted) {
        dur = Math.round(decorrido(s.cron, Date.now()) / 1000)
        for (const id of s.ids) if (s.ans[id]) commit(id, s.ans[id])
        const L = s.ids.map((id) => BY_ID[id]), r = scoreSimulado(L, s.ans)
        const sim = { t: Date.now(), p: Math.round(r.points * 100) / 100, b: r.basic, e: r.specific, c: L.filter((q) => s.ans[q.id] === q.g).length, n: L.length, ok: r.approved, d: dur }
        const hist = registrarSimulado(get().hist, sim)
        set({ hist }); if (aparelho) void gravarSimulado(hist, simulado(aparelho, sim)); else void saveHist(hist)
      }
      set({ session: { ...s, counted: true, done: true, review: false, cron: pausarCron(s.cron, Date.now()), ...(dur !== undefined ? { dur } : {}) } })
    },
    backToResult: () => { const s = get().session; if (s) set({ session: { ...s, review: false } }) },
    restore: async (p0, extra) => {
      const p = migrarProgresso(p0, ID_MAP).prog
      const { prog: before, hist: histAntes, marks: marksAntes } = get()
      const hist = extra?.hist ?? histAntes, marks = extra?.marks ?? marksAntes // backup antigo (só progresso): mantém o histórico e as anotações de agora
      set({ prog: p, hist, marks }); await replaceAll(p)
      if (extra?.hist) await saveHist(hist)
      if (extra?.marks) await saveMarks(marks)
      if (aparelho) await refazerEventosDoAparelho(aparelho, baseDe(aparelho, Date.now(), p, hist)) // os eventos deste aparelho viram uma base do que foi restaurado
      get().showToast(AVISOS.progressoRestaurado, { label: 'Desfazer', run: () => {
        set({ prog: before, hist: histAntes, marks: marksAntes }); void replaceAll(before)
        if (extra?.hist) void saveHist(histAntes)
        if (extra?.marks) void saveMarks(marksAntes)
        if (aparelho) void refazerEventosDoAparelho(aparelho, baseDe(aparelho, Date.now(), before, histAntes))
      } })
    },
    // "Zerar" apaga o progresso e a evolução; as marcações e anotações são trabalho seu e ficam.
    resetAll: async () => {
      const { prog: before, hist: histAntes } = get()
      set({ prog: {}, hist: HIST_VAZIO })
      if (aparelho) {
        // o zerar é um evento (vale para todos os aparelhos); nada é apagado, então desfazer é só apagar o evento e refazer o progresso a partir dos eventos
        const z = zerar(aparelho, Date.now())
        await gravarZerar(z)
        get().showToast(AVISOS.progressoZerado, { label: 'Desfazer', run: () => { apagarEventoNaNuvem(z.id); void desfazerZerar(z.id).then((d) => set({ prog: d.prog, hist: d.hist })) } })
        return
      }
      await replaceAll({}); await saveHist(HIST_VAZIO)
      get().showToast(AVISOS.progressoZerado, { label: 'Desfazer', run: () => { set({ prog: before, hist: histAntes }); void replaceAll(before); void saveHist(histAntes) } })
    },
    recarregar: async (o) => {
      if (o.marcas && marksTimer) { clearTimeout(marksTimer); marksTimer = undefined; await saveMarks(get().marks) } // anotação ainda por gravar sai antes de reler (a mais nova vence)
      const r = await loadAll()
      set({ ...(o.progresso ? { prog: r.prog, hist: r.hist } : {}), ...(o.marcas ? { marks: r.marks } : {}) })
    },
    toggleMark: (id) => { const marks = alternarMarca(get().marks, id, Date.now()); set({ marks }); void saveMarks(marks) },
    // A anotação é gravada meio segundo depois da última tecla (e ao sair do campo), não a cada letra.
    setNote: (id, text) => {
      set({ marks: salvarNota(get().marks, id, text, Date.now()) })
      clearTimeout(marksTimer); marksTimer = setTimeout(() => void saveMarks(get().marks), 500)
    },
    flushMarks: () => { clearTimeout(marksTimer); marksTimer = undefined; void saveMarks(get().marks) },
    setTema: (t) => {
      set({ tema: t }); void saveTema(t)
      try { localStorage.setItem('treino_tema', t) } catch { /* sem armazenamento: só não espelha */ }
      document.documentElement.dataset.tema = t
    },
    showToast: (text, action) => set({ toast: { id: ++toastId, text, action } }),
    clearToast: () => set({ toast: null }),
  }
})
