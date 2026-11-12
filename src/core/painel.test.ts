import { describe, expect, it } from 'vitest'
import { PAINEL_MIN, PAINEL_RESERVA, larguraGuardada, limitarLargura, painelMax } from './painel'

describe('largura do painel da questão', () => {
  it('prende entre o mínimo e o que deixa espaço para a questão', () => {
    expect(limitarLargura(100, 1440)).toBe(PAINEL_MIN)
    expect(limitarLargura(600, 1440)).toBe(600)
    expect(limitarLargura(5000, 1440)).toBe(1440 - PAINEL_RESERVA) // 884: a questão mantém 460 px + o trilho
    expect(limitarLargura(5000, 1920)).toBe(1920 - PAINEL_RESERVA)
  })
  it('janela pequena demais para o máximo: vale o mínimo, nunca um valor menor', () => {
    expect(painelMax(800)).toBe(PAINEL_MIN)
    expect(limitarLargura(900, 800)).toBe(PAINEL_MIN)
  })
  it('valor quebrado ou não numérico não estraga a tela', () => {
    expect(limitarLargura(Number.NaN, 1440)).toBe(PAINEL_MIN)
    expect(limitarLargura(Infinity, 1440)).toBe(PAINEL_MIN)
    expect(limitarLargura(512.6, 1440)).toBe(513)
  })
  it('lê o que estava guardado: só números de verdade, a partir do mínimo', () => {
    expect(larguraGuardada('560')).toBe(560)
    expect(larguraGuardada(' 700 ')).toBe(700)
    expect(larguraGuardada(null)).toBeNull()
    expect(larguraGuardada('abc')).toBeNull()
    expect(larguraGuardada('-500')).toBeNull()
    expect(larguraGuardada('12')).toBeNull() // abaixo do mínimo
    expect(larguraGuardada('1e9')).toBeNull()
    expect(larguraGuardada('')).toBeNull()
  })
})
