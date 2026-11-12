import { describe, expect, it } from 'vitest'
import { aEnviar, alterado, apagado, mesclarVersionados, vence, vivos, type Versionado } from './versionados'

interface Cartao extends Versionado { f: string; v: string; ivl: number }
const c = (id: string, u: number, dev: string, f = 'frente', ivl = 0, x?: 1): Cartao => ({ id, u, dev, f, v: 'verso', ivl, ...(x ? { x } : {}) })

describe('a última alteração vence', () => {
  it('maior data vence; no empate vale o aparelho de id maior (igual nos dois lados)', () => {
    expect(vence(c('a', 2, 'pc'), c('a', 1, 'cel'))).toBe(true)
    expect(vence(c('a', 1, 'pc'), c('a', 2, 'cel'))).toBe(false)
    expect(vence(c('a', 5, 'pc'), c('a', 5, 'cel'))).toBe(true)
    expect(vence(c('a', 5, 'cel'), c('a', 5, 'pc'))).toBe(false)
  })
  it('a edição mais nova de cada cartão fica, e os cartões que só existem de um lado vêm todos', () => {
    const pc = [c('a', 10, 'pc', 'editado no PC'), c('b', 1, 'pc'), c('so-pc', 1, 'pc')]
    const cel = [c('a', 20, 'cel', 'editado no celular'), c('b', 1, 'cel'), c('so-cel', 1, 'cel')]
    const m = mesclarVersionados(pc, cel)
    expect(m.map((x) => x.id)).toEqual(['a', 'b', 'so-cel', 'so-pc'])
    expect(m.find((x) => x.id === 'a')?.f).toBe('editado no celular')
    expect(m.find((x) => x.id === 'b')?.dev).toBe('pc') // empate de data: o aparelho "pc" > "cel"
  })
  it('a ordem e as repetições não mudam nada (comutativa, associativa, idempotente)', () => {
    const A = [c('a', 3, 'pc'), c('b', 1, 'pc', 'b-pc')], B = [c('a', 5, 'cel'), c('b', 1, 'cel', 'b-cel'), c('c', 2, 'cel')], C = [c('a', 5, 'tab'), c('d', 9, 'tab')]
    const ref = mesclarVersionados(A, B, C)
    for (const o of [[B, A, C], [C, B, A], [A, C, B]]) expect(mesclarVersionados(...o)).toEqual(ref)
    expect(mesclarVersionados(mesclarVersionados(A, B), C)).toEqual(ref)
    expect(mesclarVersionados(A, B, C, A, B, C)).toEqual(ref)
  })
  it('apagar vira lápide e vence uma edição mais antiga: o cartão não volta; uma edição mais NOVA do outro aparelho vence a exclusão', () => {
    const original = c('a', 1, 'pc')
    const lapide = apagado(original, 10, 'pc')
    expect(vivos(mesclarVersionados([lapide], [alterado(original, { f: 'edição antiga' }, 5, 'cel')]))).toEqual([])
    expect(vivos(mesclarVersionados([lapide], [alterado(original, { f: 'edição nova' }, 20, 'cel')])).map((x) => x.f)).toEqual(['edição nova'])
  })
  it('estudar em dois aparelhos sem sincronizar: vale a revisão mais recente (a outra se perde, limite conhecido)', () => {
    const base = c('a', 1, 'pc', 'f', 0)
    const noPc = alterado(base, { ivl: 3 }, 100, 'pc'), noCel = alterado(base, { ivl: 7 }, 200, 'cel')
    expect(mesclarVersionados([noPc], [noCel])[0].ivl).toBe(7)
  })
  it('aEnviar: só o que o outro lado ainda não tem, ou tem mais antigo', () => {
    const remoto = new Map<string, Versionado>([['a', c('a', 10, 'pc')], ['b', c('b', 5, 'cel')]])
    const local = [c('a', 10, 'pc'), c('b', 9, 'pc'), c('novo', 1, 'pc'), c('antigo', 1, 'pc')]
    remoto.set('antigo', c('antigo', 3, 'cel'))
    expect(aEnviar(local, remoto).map((x) => x.id)).toEqual(['b', 'novo'])
  })
})
