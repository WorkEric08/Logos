import { beforeEach, describe, expect, it, vi } from 'vitest'

// O plugin App do Capacitor é trocado por um simulado: aqui se testa a regra do botão voltar do Android, não o Java.
let disparar: () => void = () => {}
const exitApp = vi.fn()
const remove = vi.fn()
vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn(async (_n: string, cb: () => void) => { disparar = cb; return { remove } }), exitApp: () => exitApp() },
}))
import { _resetForTest, openLayer } from '../backStack'
import { bindNativeBack } from './voltar'

beforeEach(() => { vi.clearAllMocks(); _resetForTest(); vi.useFakeTimers({ now: 1_000_000 }) })

describe('botão voltar do Android', () => {
  it('fecha UMA camada por vez; sem camada vai ao início; no início avisa e só sai no 2º toque em até 2,5 s', () => {
    let tela = 'treinar'; const askExit = vi.fn(); const fechou: string[] = []
    bindNativeBack({ goHome: () => { if (tela === 'inicio') return false; tela = 'inicio'; return true }, askExit })
    openLayer(() => fechou.push('a')); openLayer(() => fechou.push('b'))
    disparar(); expect(fechou).toEqual(['b']); expect(exitApp).not.toHaveBeenCalled()
    disparar(); expect(fechou).toEqual(['b', 'a'])
    disparar(); expect(tela).toBe('inicio'); expect(askExit).not.toHaveBeenCalled() // voltou ao início, não saiu
    disparar(); expect(askExit).toHaveBeenCalledTimes(1); expect(exitApp).not.toHaveBeenCalled() // 1º toque no início: só avisa
    vi.advanceTimersByTime(1000); disparar(); expect(exitApp).toHaveBeenCalledTimes(1) // 2º toque dentro de 2,5 s: sai
  })
  it('passou de 2,5 s entre os toques: avisa de novo em vez de sair', () => {
    const askExit = vi.fn()
    bindNativeBack({ goHome: () => false, askExit })
    disparar(); vi.advanceTimersByTime(3000); disparar()
    expect(askExit).toHaveBeenCalledTimes(2); expect(exitApp).not.toHaveBeenCalled()
  })
  it('camada aberta nunca deixa sair, mesmo com toques seguidos', () => {
    bindNativeBack({ goHome: () => false, askExit: vi.fn() })
    openLayer(() => {}); disparar()
    expect(exitApp).not.toHaveBeenCalled()
  })
  it('desligar remove o ouvinte do plugin', async () => {
    const off = bindNativeBack({ goHome: () => false, askExit: vi.fn() })
    off(); await vi.runAllTimersAsync(); await Promise.resolve()
    expect(remove).toHaveBeenCalled()
  })
})
