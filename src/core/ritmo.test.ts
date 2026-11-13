import { describe, expect, it } from 'vitest'
import { atrasoDeFala, DURACAO_SAIDA, valorContagem } from './ritmo'

describe('ritmo da conversa', () => {
  it('"digitar" leva mais tempo para falas maiores, entre 450 e 1.400 ms', () => {
    expect(atrasoDeFala('Oi')).toBe(450); expect(atrasoDeFala('x'.repeat(40))).toBe(800); expect(atrasoDeFala('x'.repeat(2000))).toBe(1400)
    expect(atrasoDeFala('x'.repeat(60))).toBeGreaterThan(atrasoDeFala('x'.repeat(30)))
  })
  it('a saída é mais curta que a fala mais curta', () => { expect(DURACAO_SAIDA).toBeLessThan(atrasoDeFala('')) })
  it('a contagem começa em 0, só sobe e chega exatamente ao alvo', () => {
    expect(valorContagem(0, 8)).toBe(0); expect(valorContagem(1, 8)).toBe(8); expect(valorContagem(2, 8)).toBe(8)
    let ant = -1
    for (let i = 0; i <= 20; i++) { const v = valorContagem(i / 20, 70); expect(v).toBeGreaterThanOrEqual(ant); expect(v).toBeLessThanOrEqual(70); ant = v }
    expect(valorContagem(0.5, 70)).toBeGreaterThan(35) // freia no final: na metade do tempo já passou de metade
  })
  it('alvo zero ou negativo não quebra', () => { expect(valorContagem(0.5, 0)).toBe(0); expect(valorContagem(0.5, -3)).toBe(-3) })
})
