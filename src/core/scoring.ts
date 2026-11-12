import type { Question } from './types'
import { SUBJECT, SUBJECTS } from './subjects'

export interface SimuladoResult {
  points: number; basic: number; specific: number; zeroed: string[]
  passTotal: boolean; passBasic: boolean; passSpecific: boolean; approved: boolean
  bySubject: Record<string, { c: number; n: number }>
}

export const MIN_TOTAL = 50, MIN_BASIC = 16.25, MIN_SPECIFIC = 33.75

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
  let basic = 0, specific = 0
  const zeroed: string[] = []
  for (const m of SUBJECTS) {
    const c = bySubject[m.n]?.c ?? 0
    if (m.bl === 'B') basic += c * m.pt
    else specific += c * m.pt
    if (!c) zeroed.push(m.s)
  }
  const passTotal = points >= MIN_TOTAL, passBasic = basic >= MIN_BASIC, passSpecific = specific >= MIN_SPECIFIC
  return { points, basic, specific, zeroed, passTotal, passBasic, passSpecific, approved: passTotal && passBasic && passSpecific && !zeroed.length, bySubject }
}

export const SIMULADO_PLAN: [string, number][] = [
  ['Língua Portuguesa', 10], ['Língua Inglesa', 5], ['Matemática', 5], ['Atualidades do Mercado Financeiro', 5],
  ['Matemática Financeira', 5], ['Conhecimentos Bancários', 10], ['Conhecimentos de Informática', 15], ['Vendas e Negociação', 15],
]
