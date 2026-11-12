// Captura as telas e os fluxos de Cards (celular 390×844 e 320×568, escuro e claro) para olhar com os olhos.
// Precisa do app em http://localhost:4173/. Uso: node scripts/capturar-cards.mjs [url] [sufixo]   -> docs/verificacao-capturas/cards-fluxo-*.png
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'
import { conjuntoPadrao, semearCards } from './_cards-seed.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const suf = process.argv[3] ?? ''
const b = await chromium.launch({ channel: 'chrome' })
for (const [w, h] of [[390, 844], [320, 568]]) for (const tema of ['dark', 'light']) {
  const ctx = await novoContexto(b, { viewport: { width: w, height: h }, colorScheme: tema, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const foto = (n) => p.screenshot({ path: `docs/verificacao-capturas/cards-fluxo-${n}-${w}-${tema}${suf}.png` })
  await p.goto(base); await p.waitForSelector('.folders')
  await irPara(p, 'Cards'); await p.waitForSelector('h1:has-text("Cards")'); await p.waitForTimeout(400)
  await foto('1-vazio')
  await semearCards(p, conjuntoPadrao()); await p.waitForSelector('.folders, .decks', { timeout: 5000 }).catch(() => {})
  await irPara(p, 'Cards'); await p.waitForSelector('.deck'); await p.waitForTimeout(400)
  await foto('2-baralhos')
  await p.click('text=Novo baralho'); await p.waitForTimeout(400); await foto('3-novo-baralho')
  await p.click('.fcnovo >> text=Cancelar'); await p.waitForTimeout(300)
  await p.locator('.deck', { hasText: 'Siglas do Sistema' }).getByRole('button', { name: /Abrir/ }).click(); await p.waitForTimeout(400)
  await foto('4-baralho')
  await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf'); await p.waitForTimeout(400); await foto('5-editor')
  await p.click('.btn >> text=Voltar'); await p.waitForTimeout(300)
  await p.click('.btn >> text=Estudar'); await p.waitForSelector('.fcface'); await p.waitForTimeout(400); await foto('6-estudo-frente')
  await p.click('text=Mostrar resposta'); await p.waitForTimeout(400); await foto('7-estudo-verso')
  await ctx.close()
}
await b.close()
console.log('capturas em docs/verificacao-capturas/cards-fluxo-*')
