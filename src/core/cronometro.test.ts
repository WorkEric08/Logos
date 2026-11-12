import { describe, expect, it } from 'vitest'
import { decorrido, formatarDuracao, iniciarCron, pausarCron, retomarCron } from './cronometro'

describe('cronômetro do simulado', () => {
  it('conta o tempo desde o início', () => {
    expect(decorrido(iniciarCron(1000), 61_000)).toBe(60_000)
  })
  it('pausado não conta; retomar volta a contar sem perder o que já correu', () => {
    let c = iniciarCron(0)
    c = pausarCron(c, 10_000) // 10 s
    expect(decorrido(c, 500_000)).toBe(10_000) // tela bloqueada por muito tempo: não conta
    c = retomarCron(c, 500_000)
    expect(decorrido(c, 505_000)).toBe(15_000)
  })
  it('pausar ou retomar duas vezes seguidas não muda nada', () => {
    const c = pausarCron(iniciarCron(0), 5000)
    expect(pausarCron(c, 9000)).toBe(c)
    const r = retomarCron(c, 9000)
    expect(retomarCron(r, 9500)).toBe(r)
  })
  it('relógio que anda para trás não gera tempo negativo', () => {
    expect(decorrido(iniciarCron(5000), 1000)).toBe(0)
    expect(pausarCron(iniciarCron(5000), 1000).acum).toBe(0)
  })
  it('formata a duração', () => {
    expect(formatarDuracao(0)).toBe('0 s')
    expect(formatarDuracao(45)).toBe('45 s')
    expect(formatarDuracao(725)).toBe('12 min 05 s')
    expect(formatarDuracao(3909)).toBe('1 h 05 min 09 s')
    expect(formatarDuracao(-3)).toBe('0 s')
  })
})
