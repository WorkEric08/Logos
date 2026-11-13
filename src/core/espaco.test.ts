import { describe, expect, it } from 'vitest'
import { espacoVazio, fontesDasQuestoes, idPorConteudo, juntarQuestoes, materiaNova, materiasDasQuestoes, nomeCurto, planoSimulado } from './espaco'
import type { Question, Subject } from './types'

const q = (id: string, m: string, s = 'x-2024'): Question => ({ id, y: 2024, s, n: 1, m, t: '', a: '', e: '', b: '', o: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, g: 'A', p: null, bp: null, f: 0, ol: 0 })
const conhecidas: Subject[] = [{ n: 'Língua Portuguesa', s: 'Português', q: 10, pt: 1.5, bl: 'B' }]

describe('matérias do espaço', () => {
  it('matéria que o app não conhecia entra com peso médio e sem pontos próprios', () => {
    expect(materiaNova('Direito Penal')).toMatchObject({ n: 'Direito Penal', q: 5, pt: 1, ed: false })
  })
  it('nome curto só encurta o que é longo', () => {
    expect(nomeCurto('Direito Penal')).toBe('Direito Penal'); expect(nomeCurto('Direito Constitucional Brasileiro Avançado').length).toBeLessThanOrEqual(22)
  })
  it('mantém as conhecidas na ordem e põe as novas por quantidade; matéria sem questão some', () => {
    const qs = [q('1', 'Direito'), q('2', 'Direito'), q('3', 'Língua Portuguesa'), q('4', 'Física')]
    expect(materiasDasQuestoes(qs, conhecidas).map((m) => m.n)).toEqual(['Língua Portuguesa', 'Direito', 'Física'])
    expect(materiasDasQuestoes([q('1', 'Física')], conhecidas).map((m) => m.n)).toEqual(['Física'])
  })
})

describe('plano do simulado simples', () => {
  const muitas = (m: string, n: number) => Array.from({ length: n }, (_, i) => q(`${m}${i}`, m))
  const mats = ['A', 'B', 'C'].map((n) => materiaNova(n))
  it('reparte na proporção e fecha a conta no total pedido', () => {
    const qs = [...muitas('A', 60), ...muitas('B', 30), ...muitas('C', 10)]
    const p = planoSimulado(qs, mats, 20)
    expect(p.reduce((a, [, n]) => a + n, 0)).toBe(20)
    expect(p.find(([m]) => m === 'A')![1]).toBeGreaterThan(p.find(([m]) => m === 'C')![1])
  })
  it('nunca pede mais do que existe e toda matéria presente aparece', () => {
    const qs = [...muitas('A', 3), ...muitas('B', 1)]
    const p = planoSimulado(qs, mats, 30)
    expect(p).toEqual([['A', 3], ['B', 1]])
  })
  it('sem questões, sem plano', () => { expect(planoSimulado([], mats)).toEqual([]) })
})

describe('ids por conteúdo', () => {
  const base = { enunciado: 'Quanto é 2 + 2?', alternativas: { A: '1', B: '2', C: '3', D: '4', E: '5' } }
  it('o mesmo texto dá o mesmo id, mesmo com espaço, acento ou maiúscula diferentes', () => {
    expect(idPorConteudo(base)).toBe(idPorConteudo({ ...base, enunciado: '  QUANTO é 2+2 ?  ' }))
  })
  it('texto diferente dá id diferente', () => {
    expect(idPorConteudo(base)).not.toBe(idPorConteudo({ ...base, alternativas: { ...base.alternativas, D: '5' } }))
  })
  it('começa com "u" (não colide com os ids do banco embutido)', () => { expect(idPorConteudo(base)).toMatch(/^u[0-9a-z]+$/) })
})

describe('juntar questões', () => {
  it('questão repetida (mesmo id) não duplica e conta como repetida', () => {
    const r = juntarQuestoes([q('a', 'X'), q('b', 'X')], [q('b', 'X'), q('c', 'X')])
    expect(r.questoes.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']); expect(r).toMatchObject({ adicionadas: 1, repetidas: 1 })
  })
})

describe('fontes e espaço vazio', () => {
  it('prova sem rótulo ganha o próprio código', () => { expect(fontesDasQuestoes([q('1', 'X', 'abc-2024')], { 'x-1': 'X 1' })).toEqual({ 'x-1': 'X 1', 'abc-2024': 'abc-2024' }) })
  it('espaço vazio não tem regras de simulado', () => { expect(espacoVazio('e1', 'Direito').simulado).toBeNull() })
})
