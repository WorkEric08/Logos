// Painel "Questão original" / "Página da prova" da tela da questão, em tela larga (2026-11-10): a borda esquerda dele é uma alça que se
// ARRASTA para a esquerda para alargar o painel; a questão e as alternativas se adaptam ao espaço que sobra e as imagens do painel crescem
// junto. Limites: no mínimo 320 px; a questão sempre com 460 px + trilho de 96 px. A largura fica guardada. Teclado: ← → Home End; duplo clique = padrão.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-painel-questao.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const erros = []

const abrirQuestao = async (p) => { await p.goto(base); await p.waitForSelector('.provas'); await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet'); await p.waitForSelector('.slot .pgside') }
const medir = (p) => p.evaluate(() => {
  const r = (s) => document.querySelector(s)?.getBoundingClientRect()
  const slot = r('.slot'), sheet = r('.sheet'), main = r('.scroll-y')
  const img = document.querySelector('.slot .pg img, .slot .qimg'), s = document.querySelector('.sheet')
  const alts = [...document.querySelectorAll('.alt')].map((a) => a.getBoundingClientRect())
  const pega = r('.painel-pega')
  return {
    slot: Math.round(slot.width), main: Math.round(main.width), sheet: Math.round(sheet.width), img: img ? Math.round(img.getBoundingClientRect().width) : 0,
    estouro: s.scrollWidth - s.clientWidth, lateral: document.documentElement.scrollWidth - innerWidth,
    altsFora: alts.filter((a) => a.right > sheet.right + 1 || a.left < sheet.left - 1).length,
    pegaX: pega ? Math.round(pega.left + pega.width / 2) : null, pegaY: pega ? Math.round(pega.top + pega.height / 2) : null, pegaVisivel: !!pega && pega.width > 0 && getComputedStyle(document.querySelector('.painel-alca')).display !== 'none',
    css: getComputedStyle(document.documentElement).getPropertyValue('--painel-w').trim(),
  }
})
async function arrastar(p, de, para) {
  await p.mouse.move(de.x, de.y); await p.mouse.down()
  const passos = 8
  for (let i = 1; i <= passos; i++) await p.mouse.move(de.x + ((para - de.x) * i) / passos, de.y)
  await p.mouse.up()
}

for (const [w, h] of [[1440, 900], [1920, 1080], [1280, 800]]) {
  const ctx = await novoContexto(b, { viewport: { width: w, height: h }, colorScheme: 'dark' })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(`${w}px: ${e.message}`))
  await abrirQuestao(p)
  const maxW = w - 556
  const m0 = await medir(p)
  ok(`${w}px: a alça aparece na borda esquerda do painel`, m0.pegaVisivel && Math.abs(m0.pegaX - (w - m0.slot)) <= 2, `alça x=${m0.pegaX}, borda do painel x=${w - m0.slot}`)
  ok(`${w}px: largura padrão (sem arrastar) é a de sempre`, Math.abs(m0.slot - Math.min(560, Math.round(w * 0.36))) <= 1, `${m0.slot} px`)

  // arrasta 150 px para a esquerda
  await arrastar(p, { x: m0.pegaX, y: m0.pegaY }, m0.pegaX - 150)
  const m1 = await medir(p)
  ok(`${w}px: arrastar 150 px para a esquerda alarga o painel em 150 px`, Math.abs(m1.slot - (m0.slot + 150)) <= 2, `${m0.slot} → ${m1.slot}`)
  ok(`${w}px: a questão encolhe junto (enunciado e alternativas se adaptam, nada vaza)`, m1.sheet < m0.sheet - 140 && m1.estouro <= 0 && m1.altsFora === 0 && m1.lateral <= 0, `folha ${m0.sheet} → ${m1.sheet}, alternativas fora: ${m1.altsFora}`)
  ok(`${w}px: a imagem do painel cresce com ele`, m1.img > m0.img + 120, `${m0.img} → ${m1.img} px`)
  ok(`${w}px: a alça acompanha a borda`, Math.abs(m1.pegaX - (w - m1.slot)) <= 2)

  // além do máximo: para no limite e a questão mantém espaço
  await arrastar(p, { x: m1.pegaX, y: m1.pegaY }, 5)
  const m2 = await medir(p)
  ok(`${w}px: no máximo o painel pára em ${maxW} px, e a questão mantém espaço (folha ≥ 360 px)`, m2.slot === maxW && m2.sheet >= 360 && m2.estouro <= 0 && m2.altsFora === 0 && m2.lateral <= 0, `painel ${m2.slot}, folha ${m2.sheet}`)
  // além do mínimo
  await arrastar(p, { x: m2.pegaX, y: m2.pegaY }, w - 5)
  const m3 = await medir(p)
  ok(`${w}px: no mínimo o painel pára em 320 px`, m3.slot === 320 && m3.lateral <= 0, `${m3.slot} px`)
  // largura fica guardada para a próxima questão e para a próxima abertura
  await arrastar(p, { x: m3.pegaX, y: m3.pegaY }, w - 600)
  const m4 = await medir(p)
  await p.locator('.alt').first().click(); await p.waitForSelector('.fb'); await p.click('.foot .pri'); await p.waitForTimeout(150)
  const m5 = await medir(p)
  ok(`${w}px: a largura continua na questão seguinte`, m5.slot === m4.slot, `${m4.slot} → ${m5.slot}`)
  await abrirQuestao(p)
  const m6 = await medir(p)
  ok(`${w}px: depois de recarregar o app a largura é a mesma`, m6.slot === m4.slot && m6.css === `${m4.slot}px`, `${m4.slot} → ${m6.slot} (${m6.css})`)
  // teclado
  await p.locator('.painel-pega').focus()
  await p.keyboard.press('ArrowLeft'); const k1 = await medir(p)
  ok(`${w}px: seta ← alarga 24 px`, k1.slot === Math.min(maxW, m6.slot + 24), `${m6.slot} → ${k1.slot}`)
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); const k2 = await medir(p)
  ok(`${w}px: seta → estreita 24 px`, k2.slot === k1.slot - 48, `${k1.slot} → ${k2.slot}`)
  await p.keyboard.press('Home'); ok(`${w}px: Home vai ao mínimo`, (await medir(p)).slot === 320)
  await p.keyboard.press('End'); ok(`${w}px: End vai ao máximo`, (await medir(p)).slot === maxW)
  await p.waitForTimeout(150) // o valor lido pelo leitor de tela se atualiza um quadro depois da mudança
  const aria = await p.locator('.painel-pega').evaluate((e) => ({ r: e.getAttribute('role'), n: +e.getAttribute('aria-valuenow'), mn: +e.getAttribute('aria-valuemin'), mx: +e.getAttribute('aria-valuemax') }))
  ok(`${w}px: leitor de tela: separador com valor atual, mínimo e máximo`, aria.r === 'separator' && aria.n === maxW && aria.mn === 320 && aria.mx === maxW, JSON.stringify(aria))
  // duplo clique volta ao padrão
  await p.locator('.painel-pega').dblclick()
  const m7 = await medir(p)
  ok(`${w}px: duplo clique volta ao tamanho padrão`, Math.abs(m7.slot - Math.min(560, Math.round(w * 0.36))) <= 1 && m7.css === '', `${m7.slot} px`)
  // janela estreita depois de alargar: o CSS prende ao que cabe
  await arrastar(p, { x: m7.pegaX, y: m7.pegaY }, 5)
  await p.setViewportSize({ width: 1200, height: h }); await p.waitForTimeout(150)
  const m8 = await medir(p)
  ok(`${w}px: ao diminuir a janela para 1200 px o painel cabe (≤ ${1200 - 556}) e nada vaza`, m8.slot <= 1200 - 556 && m8.slot >= 320 && m8.lateral <= 0 && m8.estouro <= 0, `${m8.slot} px`)
  await ctx.close()
}

// fora da tela larga e fora da tela da questão: nenhuma alça
{
  const ctx = await novoContexto(b, { viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage()
  await p.goto(base); await p.waitForSelector('.provas')
  ok('Início (1440 px): sem alça de redimensionar', (await p.locator('.painel-pega, [role=separator]').count()) === 0)
  await p.setViewportSize({ width: 1100, height: 800 }); await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
  ok('questão a 1100 px (sem painel lateral): sem alça visível', (await p.locator('.painel-pega:visible').count()) === 0)
  await ctx.close()
  const cel = await novoContexto(b, { viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true }); const q = await cel.newPage()
  await q.goto(base); await q.waitForSelector('.provas'); await q.locator('.rail-alca').click(); await q.locator('.nav .rail-item', { hasText: 'Treinar' }).click(); await q.click('text=Começar'); await q.waitForSelector('.sheet')
  ok('celular: sem alça e a página da prova continua abaixo da questão', (await q.locator('.painel-pega:visible').count()) === 0 && (await q.locator('.side .pg, .side .qfig, .qfig').count()) > 0)
  await cel.close()
}

ok('sem erros de página', erros.length === 0, erros.join(' | '))
await b.close()
console.log(out.join('\n'))
if (out.some((l) => l.startsWith('FALHOU'))) process.exit(1)
