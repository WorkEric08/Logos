// Linhas v7 de questões importadas (sem `enun`, enunciado perdido pelo defeito C-10): como o app avisa e o que a pessoa vê
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { novoContexto, irPara, esperarMovimento } from '../_ctx.mjs'
import { restaurar } from './_idb.mjs'
import { texto, foto, BASE } from './_base.mjs'
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const out = (...a) => console.log(...a)
const v7 = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'fluxo', 'dados', 'banco-v7.json'), 'utf8'))
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce' })
const p = await ctx.newPage(); p.setDefaultTimeout(15000)
await p.goto(BASE + 'icon-192.png'); await restaurar(p, v7)
await p.goto(BASE); await p.waitForSelector('h1'); await p.waitForTimeout(800)
out('toast na abertura:', await p.locator('.toast').innerText().catch(() => null))
await irPara(p, 'Assistente'); await p.waitForTimeout(6000)
out('assistente fala algo sobre enunciado?', /enunciado/i.test(await texto(p)), '|', (await texto(p)).replace(/\n/g, ' | ').match(/[^|]*enunciado[^|]*/i)?.[0]?.slice(0, 200))
for (let i = 0; i < 3; i++) { const bt = p.getByRole('button', { name: 'Meus espaços de estudo', exact: true }); if (await bt.count()) { await bt.click(); break } await p.getByRole('button', { name: /Mais sugestões/ }).click().catch(() => {}); await p.waitForTimeout(600) }
await p.waitForTimeout(1200); await p.getByRole('button', { name: /Concurso X/ }).first().click(); await p.waitForTimeout(1800)
await irPara(p, 'Treinar'); await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet')
out('questão antiga: .enun =', JSON.stringify(await p.locator('.enun').innerText().catch(() => null)), '| recado:', (await p.locator('.warnbox, [role=status]').allInnerTexts()).join(' / ').slice(0, 300))
await foto(p, 'v7-sem-enunciado')
await b.close()
