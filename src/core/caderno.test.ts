import { describe, expect, it } from 'vitest'
import { cadernoDoEspaco, dosErros, materiasFracas, montarCaderno, montarSemana, registrar, resumirCaderno, SEGUIDOS_PARA_SAIR, type Caderno } from './caderno'
import { baseDe, mesclarEventos, resposta, zerar, type Evento } from './sync/eventos'
import { HIST_VAZIO } from './historico'
import type { ProgressMap, Question } from './types'

const r = (q: string, ok: boolean, t: number) => resposta('d1', q, ok ? 'A' : 'B', ok, t)
const sequencia = (q: string, resultados: string): Evento[] => [...resultados].map((c, i) => r(q, c === 'c', 1000 + i * 10))
const q = (id: string, m: string, y = 2021): Question => ({ id, m, t: 'tema', y, s: 'bb-2021', n: 1, e: '', a: '', b: '', o: { A: '', B: '', C: '', D: '', E: '' }, g: 'A', p: null, bp: null, f: 0, ol: 0 } as Question)

describe('caderno de erros: entra ao errar, sai com 3 acertos seguidos', () => {
  it('acertar sem nunca ter errado não entra', () => { expect(montarCaderno(sequencia('q1', 'ccc'))).toEqual({}) })
  it('errar entra; acertos seguidos contam; o terceiro tira', () => {
    expect(montarCaderno(sequencia('q1', 'e'))).toEqual({ q1: { id: 'q1', erros: 1, seguidos: 0, ultimoErro: 1000 } })
    expect(montarCaderno(sequencia('q1', 'ec'))).toMatchObject({ q1: { erros: 1, seguidos: 1 } })
    expect(montarCaderno(sequencia('q1', 'ecc'))).toMatchObject({ q1: { seguidos: 2 } })
    expect(montarCaderno(sequencia('q1', 'eccc'))).toEqual({})
    expect(SEGUIDOS_PARA_SAIR).toBe(3)
  })
  it('errar de novo no meio zera os acertos seguidos e soma o erro', () => {
    expect(montarCaderno(sequencia('q1', 'eceec'))).toMatchObject({ q1: { erros: 3, seguidos: 1, ultimoErro: 1030 } })
    expect(montarCaderno(sequencia('q1', 'ecceccc'))).toEqual({}) // o erro zerou a contagem: só os 3 últimos seguidos tiram
  })
  it('depois de sair, errar de novo é um caderno novo (erros voltam a 1)', () => {
    expect(montarCaderno(sequencia('q1', 'eccce'))).toMatchObject({ q1: { erros: 1, seguidos: 0 } })
  })
  it('cada questão tem o seu caderno; a ordem dos eventos na lista não importa', () => {
    const ev = [...sequencia('a', 'ec'), ...sequencia('b', 'e'), ...sequencia('c', 'cc')]
    const c = montarCaderno(ev)
    expect(Object.keys(c).sort()).toEqual(['a', 'b'])
    expect(montarCaderno([...ev].reverse())).toEqual(c)
    expect(montarCaderno(mesclarEventos(ev, ev))).toEqual(c) // repetir os mesmos eventos (sincronização) não muda nada
  })
  it('"zerar progresso" apaga o que veio antes', () => {
    const ev = [...sequencia('a', 'e'), zerar('d1', 1500), r('b', false, 2000)]
    expect(Object.keys(montarCaderno(ev))).toEqual(['b'])
  })
  it('eventos de outro aparelho entram igual', () => {
    const outro = resposta('d2', 'a', 'B', false, 1005)
    expect(montarCaderno([...sequencia('a', 'c'), outro])).toMatchObject({ a: { erros: 1 } })
  })
  it('evento-base (o que havia antes da sincronização): só a última errada entra, com o total de erros', () => {
    const prog: ProgressMap = { x: { n: 5, c: 2, ok: false, t: 100 }, y: { n: 5, c: 4, ok: true, t: 100 } }
    expect(montarCaderno([baseDe('d1', 500, prog, HIST_VAZIO)])).toEqual({ x: { id: 'x', erros: 3, seguidos: 0, ultimoErro: 100 } })
  })
  it('registrar uma resposta de cada vez dá o mesmo que montar de uma vez', () => {
    const ev = sequencia('a', 'eceeccc').concat([r('b', false, 1005), r('b', true, 1015)])
    let c: Caderno = {}
    for (const e of ev) if (e.k === 'r') c = registrar(c, e.q, e.ok, e.t)
    expect(c).toEqual(montarCaderno(ev))
  })
})

describe('caderno do espaço, resumo e ordem de revisão', () => {
  const bank = [q('a', 'Matemática'), q('b', 'Matemática'), q('c', 'Português'), q('d', 'Português')]
  it('junta o progresso agregado (última errada) e só fica com as questões do espaço', () => {
    const prog: ProgressMap = { c: { n: 2, c: 1, ok: false, t: 50 }, fora: { n: 1, c: 0, ok: false, t: 60 } }
    const c = cadernoDoEspaco([...sequencia('a', 'e'), ...sequencia('outra-questao-de-outro-espaco', 'e')], prog, bank)
    expect(Object.keys(c).sort()).toEqual(['a', 'c'])
  })
  it('resume: quantas erraram na última, quantas estão se recuperando, e por matéria', () => {
    const c = montarCaderno([...sequencia('a', 'e'), ...sequencia('b', 'ec'), ...sequencia('c', 'e')])
    expect(resumirCaderno(c, bank)).toEqual({ total: 3, naUltima: 2, recuperando: 1, porMateria: [{ materia: 'Matemática', n: 2 }, { materia: 'Português', n: 1 }] })
  })
  it('revisão: mais erros primeiro; entre iguais, menos acertos seguidos; respeita o pool e o limite', () => {
    const c = montarCaderno([...sequencia('a', 'ee'), ...sequencia('b', 'e'), ...sequencia('c', 'ec'), ...sequencia('d', 'e')])
    expect(dosErros(c, bank, 10, () => 0.5).map((x) => x.id)).toEqual(['a', 'b', 'd', 'c'])
    expect(dosErros(c, bank, 2, () => 0.5).map((x) => x.id)).toEqual(['a', 'b'])
    expect(dosErros(c, bank.filter((x) => x.m === 'Português'), 10, () => 0.5).map((x) => x.id)).toEqual(['d', 'c'])
    expect(dosErros({}, bank, 5)).toEqual([])
  })
})

describe('matérias fracas', () => {
  const bank = [...Array.from({ length: 10 }, (_, i) => q('m' + i, 'Matemática')), ...Array.from({ length: 10 }, (_, i) => q('p' + i, 'Português')), ...Array.from({ length: 10 }, (_, i) => q('i' + i, 'Inglês'))]
  const resp = (pre: string, n: number, c: number): ProgressMap => Object.fromEntries(Array.from({ length: 10 }, (_, i) => [pre + i, { n: n / 10, c: c / 10, ok: true }]))
  it('só vale com pelo menos 8 respostas na matéria; abaixo da média da pessoa; da pior para a melhor', () => {
    const prog = { ...resp('m', 20, 6), ...resp('p', 20, 16), ...resp('i', 4, 0) } // Matemática 30 %, Português 80 %, Inglês só 4 respostas
    expect(materiasFracas(prog, bank).map((m) => m.materia)).toEqual(['Matemática'])
    expect(materiasFracas(prog, bank)[0].acerto).toBeCloseTo(0.3, 5); expect(materiasFracas(prog, bank)[0].n).toBe(20)
  })
  it('sem respostas, nada é fraco', () => { expect(materiasFracas({}, bank)).toEqual([]) })
})

describe('simulado da semana', () => {
  const bank = [...Array.from({ length: 30 }, (_, i) => q('m' + i, 'Matemática')), ...Array.from({ length: 30 }, (_, i) => q('p' + i, 'Português'))]
  const tf = {} as Record<string, number>
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647 })()
  it('mistura caderno de erros, matérias fracas e questões novas, sem repetir', () => {
    const prog: ProgressMap = {}
    for (let i = 0; i < 12; i++) prog['m' + i] = { n: 2, c: 0, ok: false, t: i } // Matemática: muitos erros
    for (let i = 0; i < 12; i++) prog['p' + i] = { n: 2, c: 2, ok: true, t: i }
    const caderno = cadernoDoEspaco([], prog, bank)
    const s = montarSemana(bank, prog, caderno, tf, 20, rng)
    expect(s.ids).toHaveLength(20); expect(new Set(s.ids).size).toBe(20)
    expect(s.partes.erros).toBe(8); expect(s.partes.fracas).toBe(6); expect(s.partes.novas + s.partes.outras).toBe(6)
    expect(s.materiasFracas).toEqual(['Matemática'])
    expect(s.partes.erros + s.partes.fracas + s.partes.novas + s.partes.outras).toBe(20)
  })
  it('sem erros nem matéria fraca, completa com questões novas', () => {
    const s = montarSemana(bank, {}, {}, tf, 10, rng)
    expect(s.ids).toHaveLength(10); expect(s.partes).toEqual({ erros: 0, fracas: 0, novas: 10, outras: 0 })
  })
  it('sem questão nova, completa com as outras; banco menor que o pedido usa todas', () => {
    const tudo: ProgressMap = Object.fromEntries(bank.map((x) => [x.id, { n: 1, c: 1, ok: true }]))
    expect(montarSemana(bank, tudo, {}, tf, 10, rng).partes).toMatchObject({ novas: 0, outras: 10 })
    expect(montarSemana(bank.slice(0, 5), {}, {}, tf, 20, rng).ids).toHaveLength(5)
  })
})
