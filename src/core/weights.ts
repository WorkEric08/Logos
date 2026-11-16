import type { ProgressMap, Question } from './types'
import { SUBJECT } from './subjects'

export type Rng = () => number

/** Quantas vezes cada tema caiu nas provas (2018 vale metade; provas antigas, um quarto). */
export function themeFrequency(bank: Question[]): Record<string, number> {
  const tf: Record<string, number> = {}
  for (const q of bank) {
    const k = `${q.m}|${q.t}`
    tf[k] = (tf[k] ?? 0) + (q.ol ? 0.25 : q.y === 2018 ? 0.5 : 1)
  }
  return tf
}

/** Peso da matéria no sorteio: o do edital do BB; fora do edital, os pesos de EXTRA_SUBJECTS; matéria desconhecida, 5. */
export const subjectWeight = (m: string) => SUBJECT[m]?.q ?? 5

/** Fator da questão DENTRO da matéria: (1 + frequência do tema) × situação (não vista 1,5 · errada 2,6 · certa 0,45) × idade (antiga 0,6; Vendas/Informática antigas 0,3). */
export function questionFactor(q: Question, tf: Record<string, number>, prog: ProgressMap): number {
  const f = tf[`${q.m}|${q.t}`] ?? 1
  const p = prog[q.id]
  const st = !p || !p.n ? 1.5 : p.ok === false ? 2.6 : 0.45
  const oldSubject = q.m === 'Vendas e Negociação' || q.m === 'Conhecimentos de Informática'
  const age = q.ol ? (oldSubject ? 0.3 : 0.6) : 1
  const gerada = q.ger ? 0.5 : 1 // gerada do material da pessoa: entra, mas pesa metade de uma questão de prova real
  return (1 + f) * st * age * gerada
}

/** Peso "de uma etapa só" (matéria × fator). Não é mais o que o sorteio usa; fica para comparação e testes. */
export const weight = (q: Question, tf: Record<string, number>, prog: ProgressMap) => subjectWeight(q.m) * questionFactor(q, tf, prog)

/**
 * Sorteio em duas etapas, sem repetir questão:
 *  1. sorteia a MATÉRIA pelo peso dela, só entre as matérias que ainda têm questão no pool (a que acabou sai e o peso se redistribui);
 *  2. sorteia a QUESTÃO dentro da matéria pelo fator da questão.
 * O pool já vem filtrado (matéria, prova, situação): o sorteio só enxerga o que está nele.
 * O gerador entra por parâmetro para o teste ser determinístico.
 */
export function pick(pool: Question[], n: number, tf: Record<string, number>, prog: ProgressMap, rng: Rng = Math.random): Question[] {
  const grupos = new Map<string, { q: Question; w: number }[]>()
  for (const q of pool) {
    let g = grupos.get(q.m)
    if (!g) grupos.set(q.m, (g = []))
    g.push({ q, w: questionFactor(q, tf, prog) })
  }
  const out: Question[] = []
  while (out.length < n && grupos.size) {
    let total = 0
    for (const m of grupos.keys()) total += subjectWeight(m)
    let r = rng() * total
    let materia = ''
    for (const m of grupos.keys()) {
      materia = m
      r -= subjectWeight(m)
      if (r <= 0) break
    }
    const lista = grupos.get(materia)!
    let soma = 0
    for (const x of lista) soma += x.w
    let s = rng() * soma
    let i = 0
    for (; i < lista.length - 1; i++) {
      s -= lista[i].w
      if (s <= 0) break
    }
    out.push(lista.splice(i, 1)[0].q)
    if (!lista.length) grupos.delete(materia)
  }
  return out
}

export function shuffle<T>(a: T[], rng: Rng = Math.random): T[] {
  const r = a.slice()
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}
