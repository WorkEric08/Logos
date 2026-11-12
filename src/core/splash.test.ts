import { describe, expect, it } from 'vitest'
import { CAIXA, CENTRO, DURACAO, LINHAS, POS, outBack, outCubic, quadro, unidade } from './splash'

describe('abertura animada: linha do tempo', () => {
  it('easings: começam em 0 e terminam em 1', () => {
    expect(outCubic(0)).toBe(0); expect(outCubic(1)).toBe(1)
    expect(outBack(0)).toBeCloseTo(1 + 2.3 * -1 + 1.3, 10); expect(outBack(1)).toBe(1)
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => outBack(i / 100)))).toBeGreaterThan(1) // passa um pouco do alvo e volta
  })
  it('0,00–0,40 s: o arquivo da frente nasce a 60 %, aparece nos primeiros ~0,13 s e termina em 100 %', () => {
    const q0 = quadro(0)
    expect(q0.frente.escala).toBeCloseTo(0.6 + 0.4 * outBack(0), 10); expect(q0.frente.opacidade).toBe(0)
    expect(quadro(0.4 / 3).frente.opacidade).toBeCloseTo(1, 10)
    expect(quadro(0.4).frente.escala).toBeCloseTo(1, 10)
    expect(quadro(0.4).frente.opacidade).toBe(1)
  })
  it('o do meio só existe a partir de 0,35 s, nasce empilhado atrás do da frente e chega ao lugar em 0,95 s', () => {
    expect(quadro(0.34).meio.visivel).toBe(false); expect(quadro(0.35).meio.visivel).toBe(true)
    expect(quadro(0.35).meio.dx).toBeCloseTo(POS.frente.x - POS.meio.x, 10); expect(quadro(0.35).meio.dy).toBeCloseTo(POS.frente.y - POS.meio.y, 10)
    expect(quadro(0.95).meio.dx).toBeCloseTo(0, 10); expect(quadro(0.95).meio.dy).toBeCloseTo(0, 10)
  })
  it('o de trás só existe a partir de 0,50 s e chega ao lugar em 1,10 s', () => {
    expect(quadro(0.49).tras.visivel).toBe(false); expect(quadro(0.5).tras.visivel).toBe(true)
    expect(quadro(0.5).tras.dx).toBeCloseTo(POS.frente.x - POS.tras.x, 10)
    expect(quadro(1.1).tras.dx).toBeCloseTo(0, 10); expect(quadro(1.1).tras.dy).toBeCloseTo(0, 10)
  })
  it('linhas de texto: começam em 1,00 / 1,12 / 1,24 s, cada uma leva 0,30 s, e terminam em 1,54 s', () => {
    expect(quadro(0.99).linhas).toEqual([0, 0, 0])
    expect(quadro(1.0).linhas).toEqual([0, 0, 0])
    expect(quadro(1.15).linhas[0]).toBeCloseTo(0.9, 1) // 1ª já quase toda; 2ª e 3ª ainda começando
    expect(quadro(1.15).linhas[1]).toBeGreaterThan(0); expect(quadro(1.15).linhas[1]).toBeLessThan(quadro(1.15).linhas[0])
    expect(quadro(1.2).linhas[2]).toBe(0)
    expect(quadro(1.3).linhas[0]).toBe(1); expect(quadro(1.54).linhas).toEqual([1, 1, 1])
    for (const t of [0.5, 1.05, 1.2, 1.4]) quadro(t).linhas.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) })
  })
  it('de 1,5 s a 2,0 s tudo parado no estado final: sem pulso e sem mudar de tamanho', () => {
    const final = quadro(DURACAO)
    for (const t of [1.55, 1.7, 1.9, 2, 5]) expect(quadro(t)).toEqual(final)
    expect(final.frente).toEqual({ escala: 1, opacidade: 1 })
    expect(final.meio).toEqual({ visivel: true, dx: 0, dy: 0 }); expect(final.tras).toEqual({ visivel: true, dx: 0, dy: 0 })
    expect(final.linhas).toEqual([1, 1, 1])
  })
  it('a escala do arquivo da frente nunca passa de ~1,1 (o quique é curto)', () => {
    for (let t = 0; t <= 2; t += 0.01) expect(quadro(t).frente.escala).toBeLessThan(1.1)
  })
})

describe('abertura animada: medidas', () => {
  it('unidade: 1u = min(largura/168,75 ; altura/300); em 1080×1920 vale 6,4 px', () => {
    expect(unidade(1080, 1920)).toBeCloseTo(6.4, 10)
    expect(unidade(1920, 300)).toBe(1) // limitada pela altura
  })
  it('a composição tem 100 × 84u, as linhas cabem dentro do arquivo e o centro descontado a deixa centralizada', () => {
    expect(CAIXA.x1 - CAIXA.x0).toBe(100); expect(CAIXA.y1 - CAIXA.y0).toBe(84)
    for (const l of LINHAS) expect(9 + l.w).toBeLessThan(48)
    expect(CENTRO).toEqual({ x: 0.75, y: 6.75 })
    expect(((CAIXA.x0 - CENTRO.x) + (CAIXA.x1 - CENTRO.x)) / 2).toBe(0); expect(((CAIXA.y0 - CENTRO.y) + (CAIXA.y1 - CENTRO.y)) / 2).toBe(0)
  })
  it('em qualquer tela a composição (100 × 84u) cabe com folga e fica proporcional (360×800, 390×844, 412×915, 768×1024)', () => {
    for (const [w, h] of [[360, 800], [390, 844], [412, 915], [768, 1024], [1280, 720]]) {
      const u = unidade(w, h)
      expect(100 * u).toBeLessThanOrEqual(w * 0.6 + 0.01); expect(84 * u).toBeLessThanOrEqual(h * 0.3)
    }
  })
})
