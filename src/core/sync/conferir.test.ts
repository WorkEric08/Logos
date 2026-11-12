import { describe, expect, it } from 'vitest'
import { HIST_VAZIO, type Hist } from '../historico'
import type { ProgressMap } from '../types'
import { conferir } from './conferir'

const hist = (dias: Hist['dias'] = {}, sims: Hist['sims'] = []): Hist => ({ dias, sims })

describe('conferir: o derivado dos eventos contra o que o app guarda', () => {
  it('iguais (mesmo com campo indefinido ou chaves em outra ordem) não dão diferença', () => {
    const a: ProgressMap = { q1: { n: 2, c: 1, ok: true, last: 'A', t: 5 } }
    const b: ProgressMap = { q1: { t: 5, last: 'A', ok: true, c: 1, n: 2, ...({ extra: undefined } as object) } }
    expect(conferir({ prog: a, hist: HIST_VAZIO }, { prog: b, hist: HIST_VAZIO })).toEqual([])
    expect(conferir({ prog: {}, hist: hist({ '2026-11-01': { n: 1, c: 1 } }) }, { prog: {}, hist: hist({ '2026-11-01': { c: 1, n: 1 } }) })).toEqual([])
  })
  it('acha questão a mais, a menos e com contagem diferente', () => {
    const d = conferir({ prog: { q1: { n: 2, c: 1, ok: true }, q2: { n: 1, c: 0, ok: false } }, hist: HIST_VAZIO }, { prog: { q1: { n: 3, c: 1, ok: true }, q3: { n: 1, c: 1, ok: true } }, hist: HIST_VAZIO })
    expect(d.map((x) => x.chave).sort()).toEqual(['q1', 'q2', 'q3'])
  })
  it('acha dia e simulado diferentes', () => {
    const s = { t: 1, p: 60, b: 20, e: 40, c: 42, n: 70, ok: true }
    expect(conferir({ prog: {}, hist: hist({ '2026-11-01': { n: 1, c: 1 } }) }, { prog: {}, hist: hist({ '2026-11-01': { n: 2, c: 1 } }) })[0]).toMatchObject({ onde: 'dia', chave: '2026-11-01' })
    expect(conferir({ prog: {}, hist: hist({}, [s]) }, { prog: {}, hist: hist({}, []) })[0]).toMatchObject({ onde: 'simulados' })
  })
})
