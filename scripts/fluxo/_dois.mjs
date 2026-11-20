// Dois "aparelhos" (dois contextos de navegador) ligados ao emulador do Firebase (NUNCA o real) com uma conta falsa de e-mail ÚNICO por teste (não apaga os dados de ninguém).
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { novoContexto, irPara, esperarMovimento } from '../_ctx.mjs'
import { novoAparelho } from '../_emulador.mjs'
import { BASE } from './_base.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
export const out = (...a) => console.log(...a)
export const R = []
export const ok = (n, c, x = '') => { const l = `${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`; R.push(l); console.log(l) }
export const fim = () => console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas de ' + R.length)
export const emailUnico = (p = 'tester') => `${p}-${Date.now().toString(36)}@teste.com`
export const esperar = async (fn, ms = 25000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true } catch { /* tenta de novo */ } await new Promise((r) => setTimeout(r, 300)) } return false }

export async function lancar() { return chromium.launch({ channel: 'chrome' }) }
/** Abre um aparelho novo (IndexedDB vazio) apontado para o emulador, com a conta falsa `email`. Ainda NÃO entra na conta. */
export async function aparelho(b, email, { view = { width: 390, height: 844 }, tema = 'dark', reduced = true } = {}) {
  const ctx = await novoAparelho(b, novoContexto, { email, viewport: view, colorScheme: tema, ...(reduced ? { reducedMotion: 'reduce' } : {}) })
  const p = await ctx.newPage(); p.setDefaultTimeout(20000)
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR|status of 404|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()) })
  await p.goto(BASE); await p.waitForSelector('h1', { timeout: 30000 }); await esperarMovimento(p)
  return { ctx, p, erros }
}
export async function entrar(p) {
  await irPara(p, 'Mais'); await p.waitForSelector('.conta')
  await p.getByRole('button', { name: 'Entrar com Google' }).click()
  await p.waitForSelector('[data-testid=conta-email]')
  await esperar(async () => /Sincronizado/.test(await p.locator('[data-testid=conta-situacao]').innerText()))
}
/** Abre "Meus espaços de estudo" no Assistente e devolve os textos das linhas. */
export async function painelEspacos(p) {
  await irPara(p, 'Assistente'); await p.waitForTimeout(1200)
  for (let i = 0; i < 4; i++) {
    const bt = p.getByRole('button', { name: 'Meus espaços de estudo', exact: true }); if (await bt.count()) { await bt.click(); break }
    await p.getByRole('button', { name: /^(Voltar|Cancelar)$|Mais sugestões/ }).first().click().catch(() => {}); await p.waitForTimeout(700)
  }
  await p.waitForSelector('.as-esp li').catch(() => {}); await p.waitForTimeout(1200)
  return p.locator('.as-esp').allInnerTexts().catch(() => [])
}
export const linhasEspacos = async (p) => (await painelEspacos(p)).map((t) => t.replace(/\s+/g, ' '))
export const vistas = async (p) => { await irPara(p, 'Início'); await p.waitForSelector('.stat'); return (await p.locator('.stat b').first().innerText()).trim() }
