import { describe, expect, it } from 'vitest'
import { alvoDoArrasto, deslocamentoDoVizinho, descreverMovimento, limitarDy, limparOrdem, moverIndice, ordenarItens } from './ordemRail'

const P = ['inicio', 'treinar', 'desempenho', 'cartoes', 'mais']

describe('limparOrdem', () => {
  it('aceita uma ordem válida', () => { expect(limparOrdem(['mais', 'inicio', 'treinar', 'desempenho', 'cartoes'], P)).toEqual(['mais', 'inicio', 'treinar', 'desempenho', 'cartoes']) })
  it('ids que sumiram saem, repetidos saem, os que faltam entram no fim na ordem padrão', () => {
    expect(limparOrdem(['treinar', 'xis', 'treinar', 'mais'], P)).toEqual(['treinar', 'mais', 'inicio', 'desempenho', 'cartoes'])
  })
  it('lixo (null, texto, números) volta ao padrão', () => {
    for (const x of [null, undefined, 'abc', 5, {}, [1, 2]]) expect(limparOrdem(x, P)).toEqual(P)
  })
})

describe('ordenarItens', () => {
  const itens = P.map((id) => ({ id, rotulo: id }))
  it('segue a ordem guardada', () => { expect(ordenarItens(itens, ['cartoes', 'inicio']).map((i) => i.id)).toEqual(['cartoes', 'inicio', 'treinar', 'desempenho', 'mais']) })
  it('ordem vazia = padrão', () => { expect(ordenarItens(itens, []).map((i) => i.id)).toEqual(P) })
})

describe('moverIndice', () => {
  it('para baixo e para cima', () => {
    expect(moverIndice(P, 0, 2)).toEqual(['treinar', 'desempenho', 'inicio', 'cartoes', 'mais'])
    expect(moverIndice(P, 4, 1)).toEqual(['inicio', 'mais', 'treinar', 'desempenho', 'cartoes'])
  })
  it('mesmo lugar, índice inválido e limites', () => {
    expect(moverIndice(P, 2, 2)).toEqual(P); expect(moverIndice(P, 9, 0)).toEqual(P); expect(moverIndice(P, 0, 99)[4]).toBe('inicio')
  })
  it('não altera a original', () => { const c = [...P]; moverIndice(P, 0, 4); expect(P).toEqual(c) })
})

describe('arrasto', () => {
  it('limitarDy: o item não sai da lista (5 itens, passo 80, no 2º)', () => {
    expect(limitarDy(-500, 1, 80, 5)).toBe(-80); expect(limitarDy(500, 1, 80, 5)).toBe(240); expect(limitarDy(30, 1, 80, 5)).toBe(30)
  })
  it('alvoDoArrasto: troca ao passar da metade do passo', () => {
    expect(alvoDoArrasto(1, 39, 80, 5)).toBe(1); expect(alvoDoArrasto(1, 41, 80, 5)).toBe(2)
    expect(alvoDoArrasto(1, -41, 80, 5)).toBe(0); expect(alvoDoArrasto(1, 9999, 80, 5)).toBe(4); expect(alvoDoArrasto(1, -9999, 80, 5)).toBe(0)
    expect(alvoDoArrasto(2, 100, 0, 5)).toBe(2)
  })
  it('deslocamentoDoVizinho: abre espaço só para quem o item cruzou', () => {
    // item 1 indo para 3: os itens 2 e 3 sobem; 0 e 4 ficam
    expect([0, 2, 3, 4].map((i) => deslocamentoDoVizinho(i, 1, 3, 80))).toEqual([0, -80, -80, 0])
    // item 3 indo para 1: os itens 1 e 2 descem
    expect([0, 1, 2, 4].map((i) => deslocamentoDoVizinho(i, 3, 1, 80))).toEqual([0, 80, 80, 0])
    expect([0, 1, 2, 3].map((i) => deslocamentoDoVizinho(i, 2, 2, 80))).toEqual([0, 0, 0, 0])
  })
})

describe('descreverMovimento', () => { it('diz a posição', () => { expect(descreverMovimento('Cards', 0, 5)).toBe('Cards movido para a posição 1 de 5') }) })
