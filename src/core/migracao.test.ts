import { describe, expect, it } from 'vitest'
import bank from '../data/bank.json'
import idMap from '../data/id-map.json'
import { migrarProgresso, type MapaIds } from './migracao'
import { totals } from './filters'
import type { Letter, ProgressMap, Question } from './types'

const MAPA = idMap as unknown as MapaIds
const NOVO = bank.q as unknown as Question[]
const NOVO_POR_ID = Object.fromEntries(NOVO.map((q) => [q.id, q]))
// Banco antigo guardado em backup/ (lido pelo Vite, sem tipos do Node).
const ANTIGO = (Object.values(import.meta.glob('../../backup/bank.antigo-2026-11-06.json', { eager: true, import: 'default' }))[0] as { q: { id: string; g: Letter }[] }).q
const LETRAS: Letter[] = ['A', 'B', 'C', 'D', 'E']
const outraLetra = (g: Letter, k: number): Letter => LETRAS.filter((l) => l !== g)[k % 4]

/** Progresso sintético sobre TODAS as 478 questões antigas, coerente com o gabarito ANTIGO: nunca vista, só certa, só errada e mistas. */
function progressoSintetico(): ProgressMap {
  const p: ProgressMap = {}
  ANTIGO.forEach((o, i) => {
    const t = 1000 + i
    switch (i % 5) {
      case 1: p[o.id] = { n: 1, c: 1, ok: true, last: o.g, t }; break // só certa
      case 2: p[o.id] = { n: 2, c: 0, ok: false, last: outraLetra(o.g, i), t }; break // só errada
      case 3: p[o.id] = { n: 3, c: 2, ok: true, last: o.g, t }; break // mista, acertou por último
      case 4: p[o.id] = { n: 4, c: 1, ok: false, last: outraLetra(o.g, i), t }; break // mista, errou por último
      default: break // 0: nunca vista
    }
  })
  return p
}

describe('migração do progresso (todas as 478 questões antigas)', () => {
  const antes = progressoSintetico()
  const m = migrarProgresso(antes, MAPA)
  const trocas = MAPA.trocas

  it('o banco antigo guardado tem 478 questões e o mapa cobre cada uma (mapeada ou mantida)', () => {
    expect(ANTIGO).toHaveLength(478)
    for (const o of ANTIGO) expect(Boolean(MAPA.ids[o.id] || NOVO_POR_ID[o.id])).toBe(true)
  })
  it('não perde nem duplica registros: mesmo número de questões vistas e mesmo total de tentativas', () => {
    expect(Object.keys(m.prog)).toHaveLength(Object.keys(antes).length)
    const soma = (p: ProgressMap) => Object.values(p).reduce((a, x) => a + x.n, 0)
    expect(soma(m.prog)).toBe(soma(antes))
    for (const id of Object.keys(m.prog)) expect(NOVO_POR_ID[id]).toBeTruthy() // todo id resultante existe no banco novo
    expect(totals(NOVO, m.prog).seen).toBe(Object.keys(antes).length)
  })
  it('onde o gabarito não mudou, o registro passa idêntico para o id novo', () => {
    let n = 0
    for (const [velho, p] of Object.entries(antes)) {
      if (trocas[velho]) continue
      expect(m.prog[MAPA.ids[velho] ?? velho]).toEqual(p); n++
    }
    expect(n).toBeGreaterThan(200)
  })
  it('onde o gabarito mudou, só a última resposta é reavaliada (ok e c); n, last e t ficam', () => {
    let reavaliadas = 0
    for (const [velho, [de, para]] of Object.entries(trocas)) {
      const p = antes[velho]; if (!p) continue
      const novo = m.prog[MAPA.ids[velho]]
      expect(novo.n).toBe(p.n); expect(novo.last).toBe(p.last); expect(novo.t).toBe(p.t)
      expect(novo.ok).toBe(p.last === para)
      const esperadoC = Math.min(p.n, Math.max(0, p.c - (p.last === de ? 1 : 0) + (p.last === para ? 1 : 0)))
      expect(novo.c).toBe(esperadoC); reavaliadas++
    }
    expect(reavaliadas).toBe(m.corrigidas)
    expect(m.corrigidas).toBeGreaterThan(20)
  })
  it('a diferença de acertos entre antes e depois vem só das questões com gabarito corrigido', () => {
    const certas = (p: ProgressMap) => Object.values(p).reduce((a, x) => a + x.c, 0)
    const idsTroca = new Set(Object.keys(trocas).filter((i) => antes[i]))
    const semTroca = (p: ProgressMap, mapear: boolean) => Object.entries(p).filter(([id]) => !(mapear ? new Set([...idsTroca].map((i) => MAPA.ids[i])).has(id) : idsTroca.has(id))).reduce((a, [, x]) => a + x.c, 0)
    expect(semTroca(m.prog, true)).toBe(semTroca(antes, false))
    expect(certas(m.prog)).not.toBe(certas(antes)) // e existe diferença real nas corrigidas
  })
  it('é repetível: rodar a migração de novo não muda nada', () => {
    const de_novo = migrarProgresso(m.prog, MAPA)
    expect(de_novo.movidas).toBe(0)
    expect(de_novo.corrigidas).toBe(0)
    expect(de_novo.prog).toEqual(m.prog)
  })
  it('não altera o objeto de entrada (a cópia de segurança continua verdadeira)', () => {
    const copia = JSON.stringify(antes)
    migrarProgresso(antes, MAPA)
    expect(JSON.stringify(antes)).toBe(copia)
  })
})

describe('casos de borda da migração', () => {
  it('id que não está no mapa (nem no banco) é preservado como estava: nada se perde', () => {
    const p: ProgressMap = { 'id-que-nao-existe': { n: 2, c: 1, ok: true, last: 'B', t: 5 } }
    const m = migrarProgresso(p, MAPA)
    expect(m.prog).toEqual(p); expect(m.movidas).toBe(0)
  })
  it('as 10 antigas sem par mantêm o id e o progresso', () => {
    const ant = NOVO.filter((q) => q.ant)
    expect(ant).toHaveLength(10)
    const p: ProgressMap = Object.fromEntries(ant.map((q, i) => [q.id, { n: i + 1, c: 1, ok: true, last: q.g, t: i }]))
    const m = migrarProgresso(p, MAPA)
    expect(m.prog).toEqual(p); expect(m.movidas).toBe(0)
  })
  it('regra do dois-para-um: soma n e c; ok, last e t vêm da tentativa mais recente (empate: a que chega por último)', () => {
    const mapa: MapaIds = { ids: { a: 'N', b: 'N' }, trocas: {} }
    const r1 = migrarProgresso({ a: { n: 2, c: 1, ok: true, last: 'A', t: 10 }, b: { n: 1, c: 0, ok: false, last: 'B', t: 20 } }, mapa)
    expect(r1.prog).toEqual({ N: { n: 3, c: 1, ok: false, last: 'B', t: 20 } })
    const r2 = migrarProgresso({ a: { n: 2, c: 1, ok: true, last: 'A', t: 30 }, b: { n: 1, c: 0, ok: false, last: 'B', t: 20 } }, mapa)
    expect(r2.prog.N).toEqual({ n: 3, c: 1, ok: true, last: 'A', t: 30 })
    expect(r1.movidas).toBe(2)
  })
  it('se o id novo já tinha progresso (resposta dada depois da atualização), soma sem perder nada', () => {
    const mapa: MapaIds = { ids: { velho: 'novo' }, trocas: {} }
    const r = migrarProgresso({ velho: { n: 2, c: 2, ok: true, last: 'C', t: 1 }, novo: { n: 1, c: 0, ok: false, last: 'D', t: 9 } }, mapa)
    expect(r.prog.novo).toEqual({ n: 3, c: 2, ok: false, last: 'D', t: 9 })
  })
  it('sem a última resposta (last) não há o que reavaliar: o registro passa como está', () => {
    const mapa: MapaIds = { ids: { velho: 'novo' }, trocas: { velho: ['A', 'B'] } }
    const r = migrarProgresso({ velho: { n: 2, c: 1, ok: true } }, mapa)
    expect(r.prog.novo).toEqual({ n: 2, c: 1, ok: true }); expect(r.corrigidas).toBe(0)
  })
  it('o contador de acertos nunca fica negativo nem passa do total de tentativas', () => {
    const mapa: MapaIds = { ids: { x: 'X', y: 'Y' }, trocas: { x: ['A', 'B'], y: ['A', 'B'] } }
    const r = migrarProgresso({ x: { n: 1, c: 0, ok: false, last: 'A' }, y: { n: 1, c: 1, ok: false, last: 'B' } }, mapa)
    expect(r.prog.X.c).toBe(0); expect(r.prog.Y.c).toBe(1)
  })
})
