import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetForTest, closeTopLayer, layerCount } from '../services/backStack'
import { useBackLayer } from './useBackLayer'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let raiz: Root, no: HTMLElement
beforeEach(() => { _resetForTest(); no = document.createElement('div'); document.body.appendChild(no); raiz = createRoot(no) })
afterEach(() => { act(() => raiz.unmount()); no.remove() })
const voltar = () => { let r = false; act(() => { r = closeTopLayer() }); return r }

describe('useBackLayer: o voltar tira a camada da pilha; ela volta enquanto a tela seguir ativa', () => {
  // como o Cards: uma camada só, ativa enquanto há sub-tela; o voltar desce um nível por vez
  function Pilha({ aoFechar }: { aoFechar: (nivel: number) => void }) {
    const [nivel, setNivel] = useState(3)
    useBackLayer(nivel > 1, () => { aoFechar(nivel); setNivel((n) => n - 1) })
    return null
  }
  it('3 níveis = 2 voltares seguidos funcionam, e o 3º cai fora (vai para o Início)', () => {
    const f = vi.fn()
    act(() => raiz.render(<Pilha aoFechar={f} />))
    expect(layerCount()).toBe(1)
    expect(voltar()).toBe(true); expect(layerCount()).toBe(1) // nível 3 → 2: a camada voltou
    expect(voltar()).toBe(true); expect(layerCount()).toBe(0) // nível 2 → 1: sem sub-tela, sem camada
    expect(voltar()).toBe(false) // aí o voltar cabe ao app (Início / "toque de novo para sair")
    expect(f.mock.calls.map((c) => c[0])).toEqual([3, 2])
  })
  it('tela que se desativa ao fechar (folha, aviso) não volta para a pilha', () => {
    function Folha() { const [aberta, setAberta] = useState(true); useBackLayer(aberta, () => setAberta(false)); return null }
    act(() => raiz.render(<Folha />))
    expect(voltar()).toBe(true); expect(layerCount()).toBe(0)
  })
  it('desmontar tira a camada', () => {
    act(() => raiz.render(<Pilha aoFechar={() => {}} />))
    expect(layerCount()).toBe(1)
    act(() => raiz.render(<div />))
    expect(layerCount()).toBe(0)
  })
})
