// Base dos scripts de exploração de FLUXO (testador de fluxos). App em http://localhost:5391/ (npx vite --port 5391) ou 1º argumento.
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { irPara, novoContexto, esperarMovimento } from '../_ctx.mjs'

export { irPara, esperarMovimento }
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
export const BASE = process.env.FLUXO_URL ?? 'http://localhost:5391/'
export const CAP = join(process.cwd(), 'docs', 'fluxos', 'capturas')
mkdirSync(CAP, { recursive: true })

export const VIEWS = { cel390: { width: 390, height: 844 }, cel360: { width: 360, height: 780 } }

export async function abrirApp({ view = 'cel390', tema = 'dark', url = BASE, ctxExtra = {} } = {}) {
  const b = await chromium.launch({ channel: 'chrome' })
  const ctx = await novoContexto(b, { viewport: VIEWS[view], hasTouch: true, isMobile: true, colorScheme: tema, ...ctxExtra })
  const p = await ctx.newPage()
  const erros = []
  p.on('pageerror', (e) => erros.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()) })
  await p.goto(url)
  await p.waitForSelector('h1', { timeout: 15000 })
  await esperarMovimento(p)
  return { b, ctx, p, erros, fechar: () => b.close() }
}

export const voltar = async (p) => { await p.evaluate(() => history.back()); await p.waitForTimeout(260) }
export const onde = (p) => p.evaluate(() => {
  const h1 = document.querySelector('h1')?.textContent?.trim() ?? ''
  const q = (s) => !!document.querySelector(s)
  const cap = [q('.sheet') ? 'questão' : '', q('.dialogo') ? '+dialogo' : '', q('.fcface') ? 'estudo' : '', q('#cf') ? 'editor' : ''].filter(Boolean).join('')
  return cap || h1 || document.querySelector('.page')?.className
})
export const foto = (p, nome) => p.screenshot({ path: join(CAP, nome + '.png') })
export const texto = (p, sel = 'main') => p.locator(sel).first().innerText().then((t) => t.replace(/\n{2,}/g, '\n'))
export const toast = (p) => p.locator('.toast').first().innerText().catch(() => null)
export const historyLen = (p) => p.evaluate(() => history.length)
