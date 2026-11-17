import { describe, expect, it } from 'vitest'
import { ABA_PADRAO, ALTURA_ABA, ICONES_PADRAO, MARGEM_ABA, SETA_PADRAO, descreverAba, ladoDoToque, limparAba, limparIcones, limparSeta, limitesTopo, moverPorTecla, posDoToque, topoDaAba } from './aba'

describe('posição da aba da barra de navegação', () => {
  it('dados do armazenamento: aceita o válido, corta pos fora de 0–1 e cai no padrão com lixo', () => {
    expect(limparAba({ lado: 'dir', pos: 0.2 })).toEqual({ lado: 'dir', pos: 0.2 })
    expect(limparAba({ lado: 'dir', pos: 7 })).toEqual({ lado: 'dir', pos: 1 })
    expect(limparAba({ lado: 'dir', pos: -3 })).toEqual({ lado: 'dir', pos: 0 })
    expect(limparAba({ lado: 'cima', pos: 'x' })).toEqual(ABA_PADRAO)
    for (const lixo of [null, undefined, 5, 'dir', []]) expect(limparAba(lixo)).toEqual(ABA_PADRAO)
  })
  it('o dedo escolhe o lado pela metade da tela em que está', () => {
    expect(ladoDoToque(10, 360)).toBe('esq'); expect(ladoDoToque(179.9, 360)).toBe('esq')
    expect(ladoDoToque(180, 360)).toBe('dir'); expect(ladoDoToque(350, 360)).toBe('dir')
  })
  it('altura: o centro da aba acompanha o dedo e nunca passa dos limites (alto e pé, com áreas seguras)', () => {
    const { min, max } = limitesTopo(800, 24, 16)
    expect(min).toBe(24 + MARGEM_ABA); expect(max).toBe(800 - 16 - MARGEM_ABA - ALTURA_ABA)
    expect(posDoToque(0, 800, 24, 16)).toBe(0) // dedo acima do alto: encosta no alto
    expect(posDoToque(5000, 800, 24, 16)).toBe(1) // dedo abaixo do pé: encosta no pé
    expect(posDoToque(400, 800)).toBeCloseTo(0.5, 2) // meio da tela = meio dos limites (sem áreas seguras)
    const y = 300, pos = posDoToque(y, 800, 24, 16)
    expect(topoDaAba(pos, 800, 24, 16) + ALTURA_ABA / 2).toBeCloseTo(y, 5) // ida e volta: o centro fica no dedo
  })
  it('tela baixa demais: a aba fica no alto em vez de dar conta errada', () => {
    expect(posDoToque(100, 50)).toBe(0); expect(topoDaAba(0.7, 50)).toBe(MARGEM_ABA)
  })
  it('teclado: Alt+← → trocam de lado; ↑ ↓ andam de 10 em 10 % sem passar de 0–1', () => {
    let p = ABA_PADRAO
    p = moverPorTecla(p, 'ArrowRight'); expect(p.lado).toBe('dir')
    p = moverPorTecla(p, 'ArrowUp'); expect(p.pos).toBe(0.4)
    for (let i = 0; i < 12; i++) p = moverPorTecla(p, 'ArrowUp'); expect(p.pos).toBe(0)
    for (let i = 0; i < 15; i++) p = moverPorTecla(p, 'ArrowDown'); expect(p.pos).toBe(1)
    expect(moverPorTecla(p, 'ArrowLeft').lado).toBe('esq'); expect(moverPorTecla(p, 'a')).toBe(p)
  })
  it('descrição para o leitor de tela', () => {
    expect(descreverAba({ lado: 'esq', pos: 0.5 })).toBe('na esquerda, no meio')
    expect(descreverAba({ lado: 'dir', pos: 0 })).toBe('na direita, no alto')
    expect(descreverAba({ lado: 'dir', pos: 1 })).toBe('na direita, no pé da tela')
    expect(descreverAba({ lado: 'esq', pos: 0.2 })).toBe('na esquerda, na parte de cima')
    expect(descreverAba({ lado: 'esq', pos: 0.8 })).toBe('na esquerda, na parte de baixo')
  })
})

describe('alinhamento dos ícones da barra', () => {
  it('só aceita cima, meio e baixo; o resto volta ao padrão (cima)', () => {
    expect(ICONES_PADRAO).toBe('cima')
    expect(limparIcones('meio')).toBe('meio'); expect(limparIcones('baixo')).toBe('baixo'); expect(limparIcones('cima')).toBe('cima')
    for (const x of [null, undefined, '', 'topo', 3, {}]) expect(limparIcones(x)).toBe('cima')
  })
})

describe('seta da aba (mostrar ou ocultar)', () => {
  it('de fábrica a seta aparece', () => { expect(SETA_PADRAO).toBe(true); expect(limparSeta(null)).toBe(true); expect(limparSeta(undefined)).toBe(true) })
  it("só '0' (o que se grava ao ocultar) esconde; qualquer outra coisa estranha volta a mostrar", () => {
    expect(limparSeta('0')).toBe(false); expect(limparSeta(false)).toBe(false)
    for (const x of ['1', '', 'nao', 0, 1, {}, true]) expect(limparSeta(x)).toBe(true)
  })
})
