import type { ProgressMap, Question } from './types'
import type { Marks } from './historico'

export interface Filters { mat: string; tema: string; ano: string; status: '' | 'novas' | 'erros' | 'marcadas'; qtd: number; ordem: 'peso' | 'aleatoria' | 'prova' }
export const DEFAULT_FILTERS: Filters = { mat: '', tema: '', ano: '', status: '', qtd: 10, ordem: 'peso' }

export function filterPool(bank: Question[], f: Filters, prog: ProgressMap, marks: Marks = {}): Question[] {
  return bank.filter(
    (q) =>
      (!f.mat || q.m === f.mat) &&
      (!f.tema || q.t === f.tema) &&
      (!f.ano || q.s === f.ano) &&
      (!f.status || (f.status === 'novas' && !prog[q.id]?.n) || (f.status === 'erros' && prog[q.id]?.ok === false) || (f.status === 'marcadas' && !!marks[q.id]?.r)),
  )
}

export function totals(list: Question[], prog: ProgressMap) {
  let n = 0, c = 0, seen = 0, wrong = 0
  for (const q of list) {
    const p = prog[q.id]
    if (p?.n) {
      seen++; n += p.n; c += p.c
      if (p.ok === false) wrong++
    }
  }
  return { n, c, seen, wrong, acc: n ? Math.round((100 * c) / n) : null }
}

export function recordAnswer(prog: ProgressMap, q: Question, letter: Question['g'], now: number): ProgressMap {
  const p = prog[q.id] ?? { n: 0, c: 0, ok: null }
  const ok = letter === q.g
  return { ...prog, [q.id]: { n: p.n + 1, c: p.c + (ok ? 1 : 0), ok, last: letter, t: now } }
}

/** Aceita o backup só se tiver cara de backup; devolve o progresso limpo. */
export function parseBackup(text: string): ProgressMap | null {
  try {
    const o = JSON.parse(text) as { prog?: ProgressMap }
    if (!o || typeof o.prog !== 'object' || o.prog === null) return null
    const out: ProgressMap = {}
    for (const [id, p] of Object.entries(o.prog)) {
      if (p && typeof p.n === 'number' && typeof p.c === 'number') out[id] = p
    }
    return out
  } catch {
    return null
  }
}

/** Quantidades que o Treinar oferece quando há bastante questão. */
export const QTD_PADRAO = [10, 20, 30, 40, 50]
/** Opções de quantidade que fazem sentido para um conjunto de `total` questões: só as MENORES que o total, e sempre "Todas" (0).
 *  Ex.: banco todo (194+) → 10, 20, 30, 40, 50, Todas; prova de 70 → o mesmo; prova de 35 → 10, 20, 30, Todas; prova de 5 → só Todas. */
export const opcoesQtd = (total: number): number[] => [...QTD_PADRAO.filter((v) => v < total), 0]
/** A quantidade que vale de fato: pedir 40 de um conjunto de 35 é pedir "todas". */
export const qtdEfetiva = (qtd: number, total: number): number => (qtd === 0 || qtd >= total ? 0 : qtd)
/** Questões de uma prova (ou do banco todo, com `prova` vazio): a base de onde os filtros do Treinar tiram suas contagens. */
export const baseDaProva = (bank: Question[], prova: string): Question[] => (prova ? bank.filter((q) => q.s === prova) : bank)

/** "Rever erros" começa uma sessão com no máximo 20 questões erradas. */
export const LIMITE_ERROS = 20
/** O texto do número nos botões "Rever erros": com mais erros que o limite diz quantas questões a sessão leva ("20 de 45"). */
export const rotuloErros = (n: number): string => (n > LIMITE_ERROS ? `${LIMITE_ERROS} de ${n}` : String(n))
