import { describe, expect, it } from 'vitest'
import bank from '../data/bank.json'
import type { Question } from './types'
import { ALL_SUBJECTS, EXTRA_SUBJECTS, SUBJECT, SUBJECTS } from './subjects'
import { pick, questionFactor, subjectWeight, themeFrequency, weight } from './weights'

const Q = bank.q as unknown as Question[]
const TF = themeFrequency(Q)
/** Gerador pseudoaleatório com semente (Park–Miller): o teste é determinístico. */
const semente = (s: number) => () => (s = (s * 16807) % 2147483647) / 2147483647

describe('fatores do sorteio (fórmula)', () => {
  const ref = Q.find((q) => !q.ol && q.m === 'Língua Portuguesa' && q.y !== 2018)!
  const esperado = (q: Question, st: number) => {
    const age = q.ol ? (q.m === 'Vendas e Negociação' || q.m === 'Conhecimentos de Informática' ? 0.3 : 0.6) : 1
    return (1 + (TF[`${q.m}|${q.t}`] ?? 1)) * st * age
  }
  it('fator da questão = (1 + frequência do tema) × situação × idade, com os valores combinados', () => {
    expect(questionFactor(ref, TF, {})).toBeCloseTo(esperado(ref, 1.5)) // não vista 1,5
    expect(questionFactor(ref, TF, { [ref.id]: { n: 1, c: 0, ok: false } })).toBeCloseTo(esperado(ref, 2.6)) // errada 2,6
    expect(questionFactor(ref, TF, { [ref.id]: { n: 1, c: 1, ok: true } })).toBeCloseTo(esperado(ref, 0.45)) // certa 0,45
    expect(weight(ref, TF, {})).toBeCloseTo(SUBJECT[ref.m].q * esperado(ref, 1.5)) // o peso de uma etapa só continua = matéria × fator
  })
  it('prova antiga pesa 0,6; Vendas e Informática antigas pesam 0,3', () => {
    const a = { ...ref, ol: 1 as const }
    expect(questionFactor(a, TF, {}) / questionFactor({ ...ref, ol: 0 }, TF, {})).toBeCloseTo(0.6)
    for (const m of ['Vendas e Negociação', 'Conhecimentos de Informática']) {
      const q = Q.find((x) => x.m === m && !x.ol)!
      expect(questionFactor({ ...q, ol: 1 }, TF, {}) / questionFactor({ ...q, ol: 0 }, TF, {})).toBeCloseTo(0.3)
    }
  })
  it('frequência do tema: prova antiga conta 1/4, 2018 conta 1/2, as demais 1', () => {
    const q = (y: number, ol: 0 | 1) => ({ ...Q[0], y, ol, m: 'X', t: 'Y' }) as Question
    expect(themeFrequency([q(2023, 0), q(2018, 0), q(2012, 1)])['X|Y']).toBeCloseTo(1.75)
  })
  it('pesos das matérias: edital 15/15/10/10/5/5/5/5 e fora do edital 3/2/2/2', () => {
    expect(Object.fromEntries(SUBJECTS.map((m) => [m.n, m.q]))).toEqual({ 'Vendas e Negociação': 15, 'Conhecimentos de Informática': 15, 'Língua Portuguesa': 10, 'Conhecimentos Bancários': 10, 'Matemática Financeira': 5, 'Matemática': 5, 'Língua Inglesa': 5, 'Atualidades do Mercado Financeiro': 5 })
    expect(Object.fromEntries(EXTRA_SUBJECTS.map((m) => [m.n, m.q]))).toEqual({ 'Estatística': 3, 'Ética': 2, 'Legislação': 2, 'Conhecimentos Digitais': 2 })
    expect(EXTRA_SUBJECTS.every((m) => m.pt === 0 && m.ed === false)).toBe(true)
    expect(subjectWeight('matéria que não existe')).toBe(5) // padrão antigo
    // toda matéria do banco está cadastrada (senão o sorteio usaria o peso padrão 5 sem avisar)
    expect([...new Set(Q.map((q) => q.m))].filter((m) => !SUBJECT[m])).toEqual([])
    expect(ALL_SUBJECTS).toHaveLength(12)
  })
})

describe('sorteio em duas etapas (matéria pelo peso, depois a questão)', () => {
  it('não repete questão, respeita n e devolve o que houver quando o pool é menor', () => {
    const r = pick(Q, 30, TF, {}, semente(3))
    expect(r).toHaveLength(30); expect(new Set(r.map((q) => q.id)).size).toBe(30)
    expect(pick(Q.slice(0, 3), 10, TF, {})).toHaveLength(3)
    expect(pick([], 10, TF, {})).toEqual([])
  })
  it('matéria que acaba sai do sorteio e o resto continua até esgotar o pool (sem travar)', () => {
    const vendas = Q.filter((q) => q.m === 'Vendas e Negociação').slice(0, 1)
    const port = Q.filter((q) => q.m === 'Língua Portuguesa').slice(0, 5)
    const r = pick([...vendas, ...port], 6, TF, {}, semente(9))
    expect(r.map((q) => q.id).sort()).toEqual([...vendas, ...port].map((q) => q.id).sort())
  })
  it('com pool de poucas matérias (filtro por prova), o peso se redistribui entre as que sobraram', () => {
    // Vendas (15) e Inglês (5) só: esperado 75% / 25% das sorteadas
    const pool = [...Q.filter((q) => q.m === 'Vendas e Negociação').slice(0, 40), ...Q.filter((q) => q.m === 'Língua Inglesa').slice(0, 40)]
    const rng = semente(11); let vendas = 0, total = 0
    for (let i = 0; i < 5000; i++) for (const q of pick(pool, 4, TF, {}, rng)) { total++; if (q.m === 'Vendas e Negociação') vendas++ }
    expect(Math.abs(vendas / total - 0.75)).toBeLessThan(0.01)
  })
  it('só enxerga o pool recebido: com filtro por matéria, só sai aquela matéria', () => {
    const pool = Q.filter((q) => q.m === 'Estatística')
    for (const q of pick(pool, 10, TF, {}, semente(5))) expect(q.m).toBe('Estatística')
  })
  it('dentro de uma matéria a chance de cada questão segue o fator (tema, situação, idade)', () => {
    const pool = Q.filter((q) => q.m === 'Língua Portuguesa').slice(0, 30)
    const prog = { [pool[0].id]: { n: 1, c: 0, ok: false as const }, [pool[1].id]: { n: 1, c: 1, ok: true as const } } // errada (2,6) e certa (0,45)
    const f = pool.map((q) => questionFactor(q, TF, prog)), soma = f.reduce((a, b) => a + b, 0)
    const rng = semente(21), vezes = pool.map(() => 0), N = 40_000
    for (let i = 0; i < N; i++) vezes[pool.indexOf(pick(pool, 1, TF, prog, rng)[0])]++
    for (let i = 0; i < pool.length; i++) expect(Math.abs(vezes[i] / N - f[i] / soma)).toBeLessThan(0.01)
    expect(vezes[0]).toBeGreaterThan(vezes[1] * 4) // a errada sai muito mais que a certa
  })
})

describe('10.000 treinos "por peso" de 10 questões: esperado pelo edital × obtido', () => {
  const rng = semente(20261106)
  const N = 10_000, total = N * 10
  const obtido: Record<string, number> = {}
  for (let i = 0; i < N; i++) for (const q of pick(Q, 10, TF, {}, rng)) obtido[q.m] = (obtido[q.m] ?? 0) + 1
  const somaPesos = ALL_SUBJECTS.reduce((a, m) => a + m.q, 0)
  const tabela = ALL_SUBJECTS.map((m) => ({
    materia: m.n, peso: m.q,
    'esperado %': +((100 * m.q) / somaPesos).toFixed(1), 'obtido %': +((100 * (obtido[m.n] ?? 0)) / total).toFixed(1),
    'no banco %': +((100 * Q.filter((q) => q.m === m.n).length) / Q.length).toFixed(1),
  }))
  if (import.meta.env.VITE_TABELA) console.table(tabela)
  it('a soma fecha em 100.000 questões e toda matéria aparece', () => {
    expect(Object.values(obtido).reduce((a, b) => a + b, 0)).toBe(total)
    for (const m of ALL_SUBJECTS) expect(obtido[m.n]).toBeGreaterThan(0)
  })
  it('cada matéria sai perto do que o peso do edital manda (diferença < 0,5 ponto percentual)', () => {
    for (const t of tabela) expect(Math.abs(t['obtido %'] - t['esperado %'])).toBeLessThan(0.5)
  })
  it('Informática (peso 15) sai mais que Português (peso 10), e as matérias fora do edital saem pouco', () => {
    const o = (m: string) => tabela.find((t) => t.materia === m)!['obtido %']
    expect(o('Conhecimentos de Informática')).toBeGreaterThan(o('Língua Portuguesa'))
    const fora = EXTRA_SUBJECTS.reduce((a, m) => a + o(m.n), 0)
    expect(fora).toBeGreaterThan(10); expect(fora).toBeLessThan(13) // pesos 3+2+2+2 de 79 = 11,4%
  })
})
