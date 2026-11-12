// Prova que o vigia de teclado FALHA quando o comportamento antigo volta (botão some, tela sobe, botão pisca). Uso: node scripts/_prova-helper.mjs
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'
import { semMudar, vigiar } from './_teclado.mjs'
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
await p.goto('http://localhost:4173/'); await p.waitForSelector('.folders'); await irPara(p, 'Cards'); await p.waitForSelector('h1:has-text("Cards")')
const css = (c) => p.addStyleTag({ content: c })
// 1) botão do pé some com o teclado (antigo)
const a = await semMudar(p, () => p.evaluate(() => { document.querySelector('.side.go').style.display = 'none' }))
console.log('botão some      ->', a.length ? 'detectado' : 'NÃO detectado', a.slice(0, 1).join())
await p.evaluate(() => { document.querySelector('.side.go').style.display = '' })
// 2) a tela sobe (janela encolhida)
const c = await semMudar(p, () => p.evaluate(() => { document.querySelector('.scroll-y').style.paddingBottom = '300px'; document.querySelector('.side.go').style.transform = 'translateY(-300px)' }))
console.log('botão sobe      ->', c.length ? 'detectado' : 'NÃO detectado', c.slice(0, 1).join())
await p.evaluate(() => { document.querySelector('.side.go').style.transform = '' })
// 3) marca de teclado
const d = await semMudar(p, () => p.evaluate(() => document.documentElement.classList.add('kb-open')))
console.log('marca kb-open   ->', d.length ? 'detectado' : 'NÃO detectado', d.slice(0, 1).join())
await p.evaluate(() => document.documentElement.classList.remove('kb-open'))
// 4) botão que aparece rápido e some
const v = await vigiar(p, '.side.go .btn', () => p.evaluate(() => { const e = document.querySelector('.side.go'); e.style.display = 'none'; setTimeout(() => { e.style.display = '' }, 200) }))
console.log('botão pisca     ->', v.ausente > 0 ? `detectado (${v.ausente} quadros ausente)` : 'NÃO detectado')
await b.close()
