import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetForTest, bindBack, closeTopLayer, handleBack, openLayer } from './backStack'

describe('voltar', () => {
  beforeEach(() => _resetForTest())
  it('fecha uma camada por vez, na ordem', () => {
    const log: string[] = []
    openLayer(() => log.push('a')); openLayer(() => log.push('b'))
    expect(closeTopLayer()).toBe(true); expect(log).toEqual(['b'])
    expect(closeTopLayer()).toBe(true); expect(closeTopLayer()).toBe(false)
  })
  it('sem camada: vai ao início; no início, avisa e só sai no 2º toque dentro de 2,5 s', () => {
    let home = false; const askExit = vi.fn()
    const off = bindBack({ goHome: () => { const was = !home; home = true; return was }, askExit })
    expect(handleBack(1000)).toBe('home')
    expect(handleBack(2000)).toBe('warn'); expect(askExit).toHaveBeenCalledTimes(1)
    expect(handleBack(3000)).toBe('exit')
    expect(handleBack(10000)).toBe('warn')
    expect(handleBack(13000)).toBe('warn')
    off()
  })
  it('camada aberta nunca deixa sair', () => {
    bindBack({ goHome: () => false, askExit: () => {} })
    openLayer(() => {})
    expect(handleBack(1)).toBe('layer')
  })
})

describe('voltar no APK (sem histórico do navegador)', () => {
  it('com os ganchos do nativo, abrir camadas não empurra entradas no histórico e a regra do voltar é a mesma', async () => {
    const { attachBackHooks, detachBackHooks } = await import('./backStack')
    _resetForTest()
    const antes = history.length
    let home = false; const askExit = vi.fn()
    attachBackHooks({ goHome: () => { const was = !home; home = true; return was }, askExit })
    openLayer(() => {}); openLayer(() => {})
    expect(history.length).toBe(antes) // nada no histórico: o Android entrega o voltar por evento
    expect(handleBack(1000)).toBe('layer'); expect(handleBack(1100)).toBe('layer')
    expect(handleBack(1200)).toBe('home'); expect(handleBack(1300)).toBe('warn'); expect(askExit).toHaveBeenCalledTimes(1)
    expect(handleBack(2000)).toBe('exit') // 2º toque dentro de 2,5 s
    detachBackHooks()
  })
})
