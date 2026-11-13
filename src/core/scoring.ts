import type { Question } from './types'
import { SUBJECT, SUBJECTS } from './subjects'
import type { RegrasSimulado } from './espaco'

export interface SimuladoResult {
  points: number; basic: number; specific: number; zeroed: string[]
  passTotal: boolean; passBasic: boolean; passSpecific: boolean; approved: boolean
  bySubject: Record<string, { c: number; n: number }>
}

export const MIN_TOTAL = 50, MIN_BASIC = 16.25, MIN_SPECIFIC = 33.75

/** Regras do simulado do espaço ativo. As do BB (edital 2022/001) são as do espaço embutido; espaço sem regras faz um simulado simples (só conta os acertos). */
export const REGRAS_BB: RegrasSimulado = {
  plano: [
    ['Língua Portuguesa', 10], ['Língua Inglesa', 5], ['Matemática', 5], ['Atualidades do Mercado Financeiro', 5],
    ['Matemática Financeira', 5], ['Conhecimentos Bancários', 10], ['Conhecimentos de Informática', 15], ['Vendas e Negociação', 15],
  ],
  minTotal: MIN_TOTAL, minBasico: MIN_BASIC, minEspecifico: MIN_SPECIFIC, pontosTotal: 100,
}
export let REGRAS: RegrasSimulado | null = REGRAS_BB
/** O plano do simulado do espaço ativo: o das regras, ou o proporcional que o espaço montou (store/espacos.ts). */
export let SIMULADO_PLAN: [string, number][] = REGRAS_BB.plano
export function definirRegras(regras: RegrasSimulado | null, plano: [string, number][]) { REGRAS = regras; SIMULADO_PLAN = plano }

export function scoreSimulado(qs: Question[], ans: Record<string, string>): SimuladoResult {
  const bySubject: Record<string, { c: number; n: number }> = {}
  let points = 0
  for (const q of qs) {
    const b = (bySubject[q.m] ??= { c: 0, n: 0 })
    b.n++
    if (ans[q.id] === q.g) {
      b.c++
      points += SUBJECT[q.m]?.pt ?? 1
    }
  }
  if (!REGRAS) { // espaço sem regras de edital: a nota é a contagem de acertos; "passou" = metade ou mais
    const c = qs.filter((q) => ans[q.id] === q.g).length
    const passou = qs.length > 0 && c * 2 >= qs.length
    return { points: c, basic: 0, specific: 0, zeroed: [], passTotal: passou, passBasic: true, passSpecific: true, approved: passou, bySubject }
  }
  let basic = 0, specific = 0
  const zeroed: string[] = []
  for (const m of SUBJECTS) {
    const c = bySubject[m.n]?.c ?? 0
    if (m.bl === 'B') basic += c * m.pt
    else specific += c * m.pt
    if (!c) zeroed.push(m.s)
  }
  const passTotal = points >= REGRAS.minTotal, passBasic = basic >= REGRAS.minBasico, passSpecific = specific >= REGRAS.minEspecifico
  return { points, basic, specific, zeroed, passTotal, passBasic, passSpecific, approved: passTotal && passBasic && passSpecific && !zeroed.length, bySubject }
}

