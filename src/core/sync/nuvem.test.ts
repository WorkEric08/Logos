import { describe, expect, it } from 'vitest'
import { aAplicarItens, aEnviarItens, chaveBaralho, chaveCartao, chaveDeDoc, docId, itemValido, maisNovo, tipoDe } from './nuvem'

describe('chaves', () => {
  it('reconhece o tipo de cada chave', () => {
    expect(tipoDe(chaveBaralho('x1'))).toEqual({ tipo: 'baralho', id: 'x1' })
    expect(tipoDe(chaveCartao('x2'))).toEqual({ tipo: 'cartao', id: 'x2' })
    expect(tipoDe('m:2018-6')).toEqual({ tipo: 'marca', id: '2018-6' })
    expect(tipoDe('fc')?.tipo).toBe('ajustes'); expect(tipoDe('fch')?.tipo).toBe('histCards')
    expect(tipoDe('zz:1')).toBeNull(); expect(tipoDe('c:')).toBeNull()
  })
  it('id de documento não tem barra e volta ao original', () => { expect(docId('m:a/b')).toBe('m:a|b'); expect(chaveDeDoc(docId('m:a/b'))).toBe('m:a/b') })
})

describe('quem vence', () => {
  it('maior u vence; igual não conta como mais novo', () => {
    expect(maisNovo({ id: 'k', u: 2, dev: 'a' }, { id: 'k', u: 1, dev: 'z' })).toBe(true)
    expect(maisNovo({ id: 'k', u: 1, dev: 'a' }, { id: 'k', u: 2, dev: 'z' })).toBe(false)
    expect(maisNovo({ id: 'k', u: 1, dev: 'a' }, { id: 'k', u: 1, dev: 'a' })).toBe(false)
  })
  it('empate de u: o aparelho de id maior vence, igual nos dois lados', () => {
    expect(maisNovo({ id: 'k', u: 1, dev: 'b' }, { id: 'k', u: 1, dev: 'a' })).toBe(true)
    expect(maisNovo({ id: 'k', u: 1, dev: 'a' }, { id: 'k', u: 1, dev: 'b' })).toBe(false)
  })
})

describe('planejar envio e aplicação', () => {
  const locais = [{ id: 'c:1', u: 5, dev: 'a' }, { id: 'c:2', u: 1, dev: 'a' }, { id: 'c:3', u: 9, dev: 'a', x: 1 as const }]
  it('envia o que a nuvem não tem ou tem mais antigo (lápide também)', () => {
    const remotos = new Map([['c:1', { u: 4, dev: 'b' }], ['c:2', { u: 7, dev: 'b' }]])
    expect(aEnviarItens(locais, remotos).map((s) => s.id)).toEqual(['c:1', 'c:3'])
  })
  it('aplica o que o local não tem ou tem mais antigo', () => {
    const remotos = [{ key: 'c:1', u: 4, dev: 'b' }, { key: 'c:2', u: 7, dev: 'b' }, { key: 'c:9', u: 1, dev: 'b' }]
    const loc = new Map(locais.map((l) => [l.id, l]))
    expect(aAplicarItens(remotos, loc).map((r) => r.key)).toEqual(['c:2', 'c:9'])
  })
  it('depois de aplicar, não há mais nada a enviar nem a aplicar (converge)', () => {
    const remoto = { key: 'c:2', u: 7, dev: 'b' }
    const loc = new Map(locais.map((l) => [l.id, { u: l.u, dev: l.dev }])); loc.set('c:2', { u: remoto.u, dev: remoto.dev })
    expect(aAplicarItens([remoto], loc)).toEqual([])
    expect(aEnviarItens([{ id: 'c:2', u: 7, dev: 'b' }], new Map([['c:2', { u: 7, dev: 'b' }]]))).toEqual([])
  })
})

describe('itemValido', () => {
  it('aceita valor ou lápide; recusa lixo', () => {
    expect(itemValido('c:1', { u: 1, dev: 'a', v: { f: 'x' } })?.v).toEqual({ f: 'x' })
    expect(itemValido('c:1', { u: 1, dev: 'a', x: 1 })).toEqual({ key: 'c:1', u: 1, dev: 'a', x: 1 })
    expect(itemValido('c:1', { u: 'um', dev: 'a', v: {} })).toBeNull()
    expect(itemValido('c:1', { u: 1, dev: 'a' })).toBeNull()
    expect(itemValido('c:1', { u: 1, dev: 'a', v: 'texto' })).toBeNull()
    expect(itemValido('lixo', { u: 1, dev: 'a', v: {} })).toBeNull()
    expect(itemValido('c:1', null)).toBeNull()
  })
})

import { eventoValido } from './nuvem'
describe('eventoValido', () => {
  it('aceita resposta, simulado, zerar e base bem formados', () => {
    expect(eventoValido('r:a:1:q', { k: 'r', id: 'r:a:1:q', dev: 'a', q: 'q', l: 'B', ok: true, t: 1 })).not.toBeNull()
    expect(eventoValido('z:a:1', { k: 'z', id: 'z:a:1', dev: 'a', t: 1 })).not.toBeNull()
    expect(eventoValido('s:a:1', { k: 's', id: 's:a:1', dev: 'a', sim: { t: 1, p: 50, b: 1, e: 1, c: 2, n: 3, ok: true } })).not.toBeNull()
    const b = eventoValido('b:a', { k: 'b', id: 'b:a', dev: 'a', t: 1, prog: { q1: { n: 1, c: 1, ok: true }, q2: 'lixo' }, dias: { '2026-01-01': { n: 1, c: 1 }, x: null }, sims: [{ lixo: 1 }] })
    expect(b && b.k === 'b' && Object.keys(b.prog)).toEqual(['q1']); expect(b && b.k === 'b' && Object.keys(b.dias)).toEqual(['2026-01-01']); expect(b && b.k === 'b' && b.sims).toEqual([])
  })
  it('recusa lixo e id que não bate', () => {
    expect(eventoValido('r:a:1:q', { k: 'r', id: 'outro', dev: 'a', q: 'q', l: 'B', ok: true, t: 1 })).toBeNull()
    expect(eventoValido('r:a:1:q', { k: 'r', id: 'r:a:1:q', dev: 'a', q: 'q', l: 'Z', ok: true, t: 1 })).toBeNull()
    expect(eventoValido('z:a:1', { k: 'z', id: 'z:a:1', dev: 'a', t: 'x' })).toBeNull()
    expect(eventoValido('x', { k: '?', id: 'x', dev: 'a' })).toBeNull(); expect(eventoValido('x', 5)).toBeNull()
  })
})
