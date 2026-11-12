// Treinar > Quantidade (2026-11-10): 10 · 20 · 30 · 40 · 50 · Todas. Tela larga (computador, tablet): UMA linha só, no mesmo espaço de antes ("Todas" um pouco mais
// larga, com o total embaixo do nome). Celular/app (coluna < 600 px): até DUAS linhas de 3 colunas, com botões de 44 px ou mais. Mede de 320 a 1920 px;
// escolher uma opção muda o botão "Começar · N questões".
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-quantidade.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto, esperarMovimento } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const erros = []

for (const [w, h] of [[320, 568], [360, 740], [390, 844], [412, 892], [768, 1024], [892, 412], [844, 390], [1100, 800], [1280, 800], [1440, 900], [1920, 1080]]) {
  const toque = w < 900
  const ctx = await novoContexto(b, { viewport: { width: w, height: h }, hasTouch: toque, isMobile: toque, colorScheme: 'dark' })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(`${w}px: ${e.message}`))
  await p.goto(base); await p.waitForSelector('.provas')
  if (toque) await p.locator('.rail-alca').click()
  await p.locator('.nav .rail-item', { hasText: 'Treinar' }).click(); await p.waitForSelector('.filters'); await esperarMovimento(p)
  const g = await p.evaluate(() => {
    const campo = [...document.querySelectorAll('.filters .field')].find((f) => /^Quantidade$/i.test(f.querySelector('.lb')?.textContent.trim() ?? ''))
    const grupo = campo.querySelector('.chips'), gr = grupo.getBoundingClientRect()
    const chips = [...grupo.querySelectorAll('.chip')].map((c) => { const r = c.getBoundingClientRect(); return { t: c.textContent.replace(/\s+/g, ' ').trim(), l: r.left, r: r.right, top: r.top, w: r.width, h: r.height, estouro: c.scrollWidth - c.clientWidth, linhas: c.querySelectorAll('small').length } })
    return { grupoL: gr.left, grupoR: gr.right, grupoH: gr.height, campoR: campo.getBoundingClientRect().right, campoW: campo.getBoundingClientRect().width, chips, lateral: document.documentElement.scrollWidth - innerWidth }
  })
  const rotulos = g.chips.map((c) => c.t.replace(/^Todas ?\d+$/, 'Todas'))
  ok(`${w}px: opções 10 · 20 · 30 · 40 · 50 · Todas`, JSON.stringify(rotulos) === JSON.stringify(['10', '20', '30', '40', '50', 'Todas']), g.chips.map((c) => c.t).join(' | '))
  // Duas linhas de 3 colunas quando o celular está em pé (< 600 px) ou o campo tem menos de 320 px (inclui o celular deitado); senão, UMA linha só.
  const estreita = w < 600 || g.campoW < 320 // celular em pé sempre usa duas linhas; nos demais vale a largura do próprio campo (< 320 px = duas linhas)
  const nums = g.chips.slice(0, 5), todas = g.chips[5]
  const linhas = [...new Set(g.chips.map((c) => Math.round(c.top)))].length
  ok(`${w}px: ocupa o mesmo espaço (a largura do grupo) sem sair dele, sem rolagem lateral`, g.chips.every((c) => c.estouro <= 0) && g.lateral <= 0 && Math.min(...g.chips.map((c) => c.l)) >= g.grupoL - 1 && Math.max(...g.chips.map((c) => c.r)) <= g.grupoR + 1, `grupo ${Math.round(g.grupoL)}–${Math.round(g.grupoR)}`)
  if (estreita) {
    ok(`${w}px (campo ${Math.round(g.campoW)}px, duas linhas): 10 20 30 / 40 50 Todas`, linhas === 2 && g.chips.slice(0, 3).every((c) => Math.abs(c.top - g.chips[0].top) <= 1) && g.chips.slice(3).every((c) => Math.abs(c.top - g.chips[3].top) <= 1) && g.chips[3].top > g.chips[0].top + 20, `${linhas} linhas, altura do grupo ${Math.round(g.grupoH)}px`)
    ok(`${w}px (celular/app): os 6 botões têm a mesma largura e "Todas 1168" cabe numa linha`, g.chips.every((c) => Math.abs(c.w - g.chips[0].w) <= 1) && /^Todas ?\d+$/.test(todas.t) && todas.h <= 46, `botão ${g.chips[0].w.toFixed(1)}×${g.chips[0].h.toFixed(1)}px`)
    ok(`${w}px (celular/app): alvo de toque de 44 px ou mais nos dois sentidos`, !toque || g.chips.every((c) => c.w >= 43.5 && c.h >= 43.5), `menor ${Math.min(...g.chips.map((c) => c.w)).toFixed(1)}×${Math.min(...g.chips.map((c) => c.h)).toFixed(1)}px`)
  } else {
    ok(`${w}px (tela larga): tudo numa linha só (nada quebra para baixo)`, linhas === 1 && g.grupoH <= g.chips[0].h + 1, `altura do grupo ${Math.round(g.grupoH)}px, chip ${Math.round(g.chips[0].h)}px`)
    ok(`${w}px (tela larga): os 5 números têm a mesma largura e "Todas" é um pouco maior, com o total embaixo`, nums.every((c) => Math.abs(c.w - nums[0].w) <= 1) && todas.w > nums[0].w && /^Todas ?\d+$/.test(todas.t) && todas.linhas === 1, `número ${nums[0].w.toFixed(1)}px, Todas ${todas.w.toFixed(1)}px`)
    ok(`${w}px (tela larga): botões de 44 px ou mais`, nums[0].w >= 43.5 && nums[0].h >= 43.5 || !toque, `${nums[0].w.toFixed(1)}×${nums[0].h.toFixed(1)}px`)
  }
  // escolher cada opção
  const campo = p.locator('.filters .field', { has: p.locator('.lb', { hasText: /^Quantidade$/ }) })
  const feitos = []
  for (const v of ['30', '50', '20', '10']) {
    await campo.locator('.chip', { hasText: new RegExp(`^${v}$`) }).click()
    const sel = await campo.locator('.chip[aria-pressed="true"]').allInnerTexts()
    const botao = await p.locator('.go .btn.pri, .side-in .btn.pri, .side .btn.pri').first().innerText()
    feitos.push(sel.length === 1 && sel[0].trim() === v && new RegExp(`Começar · ${v} questões`).test(botao))
  }
  ok(`${w}px: escolher 30, 50, 20 e 10 marca só a opção e o botão diz "Começar · N questões"`, feitos.every(Boolean), feitos.join(','))
  await campo.locator('.chip', { hasText: /^Todas/ }).click()
  const total = await campo.locator('.chip', { hasText: /^Todas/ }).locator('small').innerText()
  ok(`${w}px: "Todas" começa com o total disponível (${total})`, /Começar · \d+ questões/.test(await p.locator('.go .btn.pri, .side-in .btn.pri, .side .btn.pri').first().innerText()) && (await p.locator('.go .btn.pri, .side-in .btn.pri, .side .btn.pri').first().innerText()).includes(total.trim()))
  // matéria com 50 questões (Estatística): 5 opções (10 20 30 40 Todas) = 3 + 2 no celular, uma linha na tela larga
  await p.locator('.filters .chip', { hasText: /^Estatística/ }).first().click()
  const g5 = await p.evaluate(() => { const campo = [...document.querySelectorAll('.filters .field')].find((f) => /^Quantidade$/i.test(f.querySelector('.lb')?.textContent.trim() ?? '')); const cs = [...campo.querySelectorAll('.chip')].map((c) => c.getBoundingClientRect()); return { n: cs.length, linhas: [...new Set(cs.map((r) => Math.round(r.top)))].length, minW: Math.min(...cs.map((r) => r.width)), minH: Math.min(...cs.map((r) => r.height)) } })
  ok(`${w}px: com 5 opções (Estatística: 10 · 20 · 30 · 40 · Todas) ${estreita ? 'ficam 3 + 2' : 'continuam numa linha'}`, g5.n === 5 && g5.linhas === (estreita ? 2 : 1) && (!toque || (g5.minW >= 43.5 && g5.minH >= 43.5)), `${g5.n} opções, ${g5.linhas} linha(s), menor ${g5.minW.toFixed(1)}×${g5.minH.toFixed(1)}px`)
  await ctx.close()
}

ok('sem erros de página', erros.length === 0, erros.join(' | '))
await b.close()
console.log(out.join('\n'))
if (out.some((l) => l.startsWith('FALHOU'))) process.exit(1)
