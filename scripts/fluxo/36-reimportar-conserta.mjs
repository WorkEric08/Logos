// Banco v7 com questões sem enunciado (C-10): "importe a prova de novo" conserta de fato? (mesmos ids por conteúdo) E as geradas: como consertar?
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { novoContexto, irPara } from '../_ctx.mjs'
import { restaurar } from './_idb.mjs'
import { texto, foto, voltar, BASE } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const out = (...a) => console.log(...a)
const v7 = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'fluxo', 'dados', 'banco-v7.json'), 'utf8'))
const b = await chromium.launch({ channel: 'chrome' })
const prova = await pdfProva(b), gab = await pdfGabarito(b)
const ctx = await novoContexto(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce' })
const p = await ctx.newPage(); p.setDefaultTimeout(20000)
await p.goto(BASE + 'icon-192.png'); await restaurar(p, v7)
await p.goto(BASE); await p.waitForSelector('h1'); await p.waitForTimeout(800)
const painel = async () => { await irPara(p, 'Assistente'); await p.waitForTimeout(1500); for (let i = 0; i < 3; i++) { const bt = p.getByRole('button', { name: 'Meus espaços de estudo', exact: true }); if (await bt.count()) { await bt.click(); break } await p.getByRole('button', { name: /Mais sugestões/ }).click().catch(() => {}); await p.waitForTimeout(600) } await p.waitForTimeout(1000) }
const lerTodas = async () => { await irPara(p, 'Treinar'); await p.locator('.chip', { hasText: 'Ordem da prova' }).click(); const n = parseInt((await p.locator('.btn.pri', { hasText: 'Começar' }).innerText()).replace(/\D/g, '')); await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet'); const v = []; for (let i = 0; i < n; i++) { v.push((await p.locator('.enun').innerText().catch(() => '')).trim()); if (i < n - 1) await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(50) } await voltar(p); await p.waitForTimeout(300); return v }
await painel(); await p.getByRole('button', { name: /Concurso X/ }).first().click(); await p.waitForTimeout(1800)
const antes = await lerTodas(); out('antes: enunciados vazios', antes.filter((t) => !t).length, 'de', antes.length)
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
for (let i = 0; i < 4 && !(await p.locator('#as-msg').count()); i++) { await p.getByRole('button', { name: /^(Voltar|Cancelar)$|Mais sugestões/ }).first().click().catch(() => {}); await p.waitForTimeout(800) }
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab })
await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
out('prévia:', (await p.locator('.as-qs, [role=status].note').allInnerTexts()).join(' ').replace(/\s+/g, ' ').match(/[^.]*já estão[^.]*\./)?.[0])
await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForTimeout(2500)
out('após adicionar:', (await texto(p)).replace(/\n/g, ' | ').match(/[^|]*(entraram|entrou|já estav|recuper|consert)[^|]*/i)?.[0])
const depois = await lerTodas(); out('depois de reimportar: enunciados vazios', depois.filter((t) => !t).length, 'de', depois.length)
out('as 8 da prova ficaram inteiras?', depois.slice(0, 8).every((t) => t.length > 15) ? 'sim' : 'NÃO', '| geradas ainda vazias:', depois.slice(8).filter((t) => !t).length)
await foto(p, 'reimportar-conserta')
// geradas: gerar de novo do mesmo material conserta?
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
for (let i = 0; i < 4 && !(await p.getByRole('button', { name: 'Gerar questões do meu material', exact: true }).count()); i++) { await p.getByRole('button', { name: /^(Voltar|Cancelar)$|Mais sugestões/ }).first().click().catch(() => {}); await p.waitForTimeout(800) }
await p.getByRole('button', { name: 'Gerar questões do meu material', exact: true }).click(); await p.waitForTimeout(2000)
const gl = p.getByRole('button', { name: /Glossario/ }); if (await gl.count()) { await gl.first().click(); await p.waitForTimeout(3500) }
out('prévia das geradas:', (await texto(p)).replace(/\n/g, ' | ').match(/[^|]*já estão[^|]*/)?.[0], '| botões', (await p.getByRole('button').allInnerTexts()).slice(-3))
await p.getByRole('button', { name: /Adicionar/ }).first().click().catch(() => out('sem botão Adicionar')); await p.waitForTimeout(2500)
const d2 = await lerTodas(); out('depois de gerar de novo: vazias', d2.filter((t) => !t).length, 'de', d2.length)
await b.close()
