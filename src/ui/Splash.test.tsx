import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { Splash } from './Splash'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement, root: Root, onFinish: Mock<() => void>
const mover = (reduzido: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: reduzido && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
}
const monta = async (ready: boolean) => { await act(async () => { root.render(<Splash ready={ready} onFinish={onFinish} />) }) }
const passa = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms) }) }

beforeEach(() => {
  vi.useFakeTimers(); mover(false)
  onFinish = vi.fn<() => void>(); host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  document.documentElement.classList.add('splash')
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); document.documentElement.classList.remove('splash') })

describe('abertura animada: quando entra no app', () => {
  it('troca o preto provisório do index.html pela abertura de verdade, no mesmo quadro', async () => {
    await monta(true)
    expect(document.documentElement.classList.contains('splash')).toBe(false)
    expect(host.querySelector('.splash')).not.toBeNull()
  })
  it('app já carregado: só sai quando os 2 s acabam (fade de 150 ms) — nem um instante antes', async () => {
    await monta(true)
    await passa(1990); expect(host.querySelector('.splash.saindo')).toBeNull(); expect(onFinish).not.toHaveBeenCalled()
    await passa(20); expect(host.querySelector('.splash.saindo')).not.toBeNull(); expect(onFinish).not.toHaveBeenCalled() // fade começou
    await passa(160); expect(onFinish).toHaveBeenCalledTimes(1)
  })
  it('app ainda carregando: o último quadro fica parado e a saída só vem depois do carregamento', async () => {
    await monta(false)
    await passa(5000); expect(onFinish).not.toHaveBeenCalled(); expect(host.querySelector('.splash.saindo')).toBeNull()
    await monta(true) // terminou de carregar
    expect(host.querySelector('.splash.saindo')).not.toBeNull()
    await passa(160); expect(onFinish).toHaveBeenCalledTimes(1)
  })
  it('passou de 6 s sem abrir: avisa e oferece "Tentar de novo"; ao abrir, o aviso não impede a saída', async () => {
    await monta(false)
    await passa(5900); expect(host.textContent).not.toContain('Tentar de novo')
    await passa(200); expect(host.textContent).toContain('Tentar de novo'); expect(host.textContent).toContain('demorando mais que o normal')
    await monta(true); await passa(160); expect(onFinish).toHaveBeenCalledTimes(1)
  })
  it('movimento reduzido: mostra direto o estado final por 0,5 s e entra', async () => {
    mover(true)
    await monta(true)
    const largura = (i: number) => host.querySelectorAll('rect')[i].getAttribute('width')
    expect([largura(0), largura(1), largura(2)]).toEqual(['30', '30', '18']) // linhas já completas, sem animação
    await passa(490); expect(host.querySelector('.splash.saindo')).toBeNull()
    await passa(20); expect(host.querySelector('.splash.saindo')).not.toBeNull()
    await passa(160); expect(onFinish).toHaveBeenCalledTimes(1)
  })
  it('chama onFinish uma vez só, mesmo que ready mude várias vezes', async () => {
    await monta(true); await monta(true); await passa(3000); await monta(true); await passa(1000)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
