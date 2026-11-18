import { describe, expect, it } from 'vitest'
import bank from '../data/bank.json'
import idMap from '../data/id-map.json'
import type { Question } from './types'
import { pick, themeFrequency, weight } from './weights'
import { scoreSimulado, SIMULADO_PLAN } from './scoring'
import { filterPool, DEFAULT_FILTERS, baseDaProva, LIMITE_ERROS, opcoesQtd, rotuloErros, parseBackup, qtdEfetiva, recordAnswer } from './filters'
import { migrarProgresso, type MapaIds } from './migracao'
import { SOURCES } from './subjects'

const Q = bank.q as unknown as Question[]
// Arquivos lidos pelo Vite (sem tipos do Node): o banco antigo guardado e a lista das imagens copiadas.
const ANTIGO = Object.values(import.meta.glob('../../backup/bank.antigo-2026-11-06.json', { eager: true, import: 'default' }))[0] as { q: { id: string }[] }
const IMAGENS = new Set(Object.keys(import.meta.glob('../../public/q/*.png')).map((p) => p.split('/').pop()))
const tf = themeFrequency(Q)
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length] }

describe('banco', () => {
  it('tem 1168 questões únicas, com gabarito dentro das alternativas (ou só na imagem)', () => {
    expect(Q).toHaveLength(1168)
    expect(new Set(Q.map((q) => q.id)).size).toBe(1168)
    for (const q of Q) {
      expect(Object.keys(q.o)).toContain(q.g)
      if (!q.ia) for (const l of Object.keys(q.o)) expect((q.o as Record<string, string>)[l]).toBeTruthy()
    }
  })
  it('toda prova tem rótulo e toda imagem citada existe em public/q', () => {
    for (const q of Q) {
      expect(SOURCES[q.s]).toBeTruthy()
      if (q.img) expect(IMAGENS.has(q.img)).toBe(true)
      if (q.ia) expect(q.img).toBeTruthy()
    }
  })
  it('mapa de ids: nenhuma questão antiga some, e as trocas de gabarito batem com o banco', () => {
    const antigo = ANTIGO.q
    const ids = new Set(Q.map((q) => q.id))
    const mapa = idMap as unknown as MapaIds
    expect(antigo).toHaveLength(478)
    for (const o of antigo) expect(mapa.ids[o.id] ? ids.has(mapa.ids[o.id]) : ids.has(o.id)).toBe(true)
    expect(new Set(Object.values(mapa.ids)).size).toBe(Object.keys(mapa.ids).length)
    for (const [id, [de, para]] of Object.entries(mapa.trocas)) {
      expect(de).not.toBe(para)
      expect(Q.find((q) => q.id === mapa.ids[id])!.g).toBe(para)
    }
  })
  it('bases citadas existem', () => {
    for (const q of Q) if (q.b) expect((bank.bases as Record<string, string>)[q.b]).toBeTruthy()
  })
})

describe('peso', () => {
  const base = Q.find((q) => !q.ol && q.m === 'Língua Portuguesa')!
  it('erro pesa mais que não vista, e acerto pesa menos', () => {
    const w0 = weight(base, tf, {})
    expect(weight(base, tf, { [base.id]: { n: 1, c: 0, ok: false } })).toBeGreaterThan(w0)
    expect(weight(base, tf, { [base.id]: { n: 1, c: 1, ok: true } })).toBeLessThan(w0)
  })
  it('prova antiga pesa menos; Informática antiga ainda menos', () => {
    const old = Q.find((q) => q.ol && q.m === 'Língua Portuguesa')!
    const oldInfo = Q.find((q) => q.ol && q.m === 'Conhecimentos de Informática')
    expect(weight({ ...base, ol: 1 }, tf, {})).toBeLessThan(weight(base, tf, {}))
    expect(old).toBeTruthy()
    if (oldInfo) expect(weight({ ...oldInfo }, tf, {})).toBeLessThan(weight({ ...oldInfo, ol: 0 }, tf, {}))
  })
  it('pick não repete e respeita n', () => {
    const r = pick(Q, 30, tf, {}, seq([0.1, 0.9, 0.5, 0.3, 0.7]))
    expect(r).toHaveLength(30)
    expect(new Set(r.map((q) => q.id)).size).toBe(30)
  })
  it('pick com pool menor devolve o que há', () => {
    expect(pick(Q.slice(0, 3), 10, tf, {})).toHaveLength(3)
  })
})

describe('simulado', () => {
  it('plano soma 70 e existe questão suficiente em cada matéria', () => {
    expect(SIMULADO_PLAN.reduce((a, [, n]) => a + n, 0)).toBe(70)
    for (const [m, n] of SIMULADO_PLAN) expect(Q.filter((q) => q.m === m).length).toBeGreaterThanOrEqual(n)
  })
  it('gabarito perfeito dá 100 pontos e aprova; tudo errado zera e reprova', () => {
    const qs = SIMULADO_PLAN.flatMap(([m, n]) => Q.filter((q) => q.m === m).slice(0, n))
    const perfect = scoreSimulado(qs, Object.fromEntries(qs.map((q) => [q.id, q.g])))
    expect(perfect.points).toBeCloseTo(100)
    expect(perfect.basic).toBeCloseTo(32.5)
    expect(perfect.specific).toBeCloseTo(67.5)
    expect(perfect.approved).toBe(true)
    const none = scoreSimulado(qs, {})
    expect(none.points).toBe(0)
    expect(none.approved).toBe(false)
    expect(none.zeroed).toHaveLength(8)
  })
  it('nota zero em uma matéria elimina mesmo com total alto', () => {
    const qs = SIMULADO_PLAN.flatMap(([m, n]) => Q.filter((q) => q.m === m).slice(0, n))
    const ans = Object.fromEntries(qs.filter((q) => q.m !== 'Língua Inglesa').map((q) => [q.id, q.g]))
    const r = scoreSimulado(qs, ans)
    expect(r.points).toBeCloseTo(95)
    expect(r.zeroed).toEqual(['Inglês'])
    expect(r.approved).toBe(false)
  })
})

describe('filtros e progresso', () => {
  it('filtra por prova e por situação', () => {
    expect(filterPool(Q, { ...DEFAULT_FILTERS, ano: 'bb-2010' }, {})).toHaveLength(Q.filter((q) => q.s === 'bb-2010').length)
    expect(Q.filter((q) => q.s === 'bb-2010').length).toBeGreaterThan(60)
    const q0 = Q[0]
    const prog = recordAnswer({}, q0, q0.g === 'A' ? 'B' : 'A', 1)
    expect(filterPool(Q, { ...DEFAULT_FILTERS, status: 'erros' }, prog)).toEqual([q0])
    expect(filterPool(Q, { ...DEFAULT_FILTERS, status: 'novas' }, prog)).toHaveLength(Q.length - 1)
  })
  it('recordAnswer acumula sem mutar', () => {
    const q = Q[1], a = {}
    const b = recordAnswer(a, q, q.g, 5)
    expect(a).toEqual({})
    expect(recordAnswer(b, q, q.g, 6)[q.id]).toMatchObject({ n: 2, c: 2, ok: true })
  })
  it('backup inválido é recusado', () => {
    expect(parseBackup('lixo')).toBeNull()
    expect(parseBackup('{"prog":null}')).toBeNull()
    expect(parseBackup('{"prog":{"a":{"n":1,"c":1,"ok":true},"b":5}}')).toEqual({ a: { n: 1, c: 1, ok: true } })
  })
})

describe('migração do progresso para o banco novo', () => {
  const mapa: MapaIds = { ids: { '2018-6': 'BB-2018-AC-ING-06', '2018-1': 'BB-2018-AC-POR-01' }, trocas: { '2018-1': ['D', 'C'] } }
  it('move o progresso para o id novo, mantém o resto e é repetível', () => {
    const prog = { '2018-6': { n: 2, c: 1, ok: false, last: 'A' as const, t: 5 }, 'xyz': { n: 1, c: 1, ok: true } }
    const m = migrarProgresso(prog, mapa)
    expect(m.prog).toEqual({ 'BB-2018-AC-ING-06': prog['2018-6'], xyz: prog.xyz })
    expect(m.movidas).toBe(1)
    expect(migrarProgresso(m.prog, mapa).movidas).toBe(0)
    expect(migrarProgresso(m.prog, mapa).prog).toEqual(m.prog)
  })
  it('reavalia a última resposta onde o gabarito foi corrigido', () => {
    // marcou D; o gabarito antigo (errado) era D, o certo é C: deixa de contar como certa
    const m = migrarProgresso({ '2018-1': { n: 3, c: 2, ok: true, last: 'D' } }, mapa)
    expect(m.prog['BB-2018-AC-POR-01']).toMatchObject({ n: 3, c: 1, ok: false })
    expect(m.corrigidas).toBe(1)
    // marcou C: errava pelo gabarito antigo, agora acerta
    const k = migrarProgresso({ '2018-1': { n: 1, c: 0, ok: false, last: 'C' } }, mapa)
    expect(k.prog['BB-2018-AC-POR-01']).toMatchObject({ n: 1, c: 1, ok: true })
  })
  it('junta se o id novo já tinha progresso', () => {
    const m = migrarProgresso({ '2018-6': { n: 1, c: 1, ok: true, last: 'B', t: 1 }, 'BB-2018-AC-ING-06': { n: 2, c: 0, ok: false, last: 'C', t: 9 } }, mapa)
    expect(m.prog['BB-2018-AC-ING-06']).toEqual({ n: 3, c: 1, ok: false, last: 'C', t: 9 })
  })
})

describe('filtros adaptados à prova (Treinar)', () => {
  it('as opções de quantidade seguem o tamanho do conjunto: só as menores que ele, mais "Todas"', () => {
    expect(opcoesQtd(194)).toEqual([10, 20, 30, 40, 50, 0])
    expect(opcoesQtd(70)).toEqual([10, 20, 30, 40, 50, 0])
    expect(opcoesQtd(51)).toEqual([10, 20, 30, 40, 50, 0])
    expect(opcoesQtd(50)).toEqual([10, 20, 30, 40, 0]) // 50 de 50 é "todas"
    expect(opcoesQtd(41)).toEqual([10, 20, 30, 40, 0])
    expect(opcoesQtd(40)).toEqual([10, 20, 30, 0]) // 40 de 40 é "todas"
    expect(opcoesQtd(35)).toEqual([10, 20, 30, 0])
    expect(opcoesQtd(10)).toEqual([0])
    expect(opcoesQtd(5)).toEqual([0])
    expect(opcoesQtd(0)).toEqual([0])
  })
  it('pedir mais do que existe vale como "Todas"; o resto fica como pedido', () => {
    expect(qtdEfetiva(40, 35)).toBe(0); expect(qtdEfetiva(10, 5)).toBe(0); expect(qtdEfetiva(0, 70)).toBe(0)
    expect(qtdEfetiva(20, 70)).toBe(20); expect(qtdEfetiva(10, 11)).toBe(10)
  })
  it('a base de uma prova traz só as questões dela; sem prova, o banco todo', () => {
    const q = (id: string, s: string) => ({ id, s }) as unknown as Question
    const banco = [q('a', 'p1'), q('b', 'p2'), q('c', 'p1')]
    expect(baseDaProva(banco, 'p1').map((x) => x.id)).toEqual(['a', 'c'])
    expect(baseDaProva(banco, '')).toHaveLength(3)
  })
})

describe('rótulo de "Rever erros"', () => {
  it('diz quantas questões a sessão leva quando há mais erros que o limite', () => {
    expect(LIMITE_ERROS).toBe(20)
    expect(rotuloErros(0)).toBe('0'); expect(rotuloErros(7)).toBe('7'); expect(rotuloErros(20)).toBe('20')
    expect(rotuloErros(45)).toBe('20 de 45')
  })
})
