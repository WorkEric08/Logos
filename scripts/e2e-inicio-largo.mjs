// Cartões de matéria (2026-11-10): no MONITOR (>= 1180 px) ficam no Início, junto das pastas dos bancos, e saem do Desempenho;
// no CELULAR/tablet continuam só no Desempenho e o Início não os mostra. Tocar num cartão abre o Treinar filtrado pela matéria.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-inicio-largo.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const erros = []

async function tela(largura, altura, fn) {
  const ctx = await novoContexto(b, { viewport: { width: largura, height: altura }, hasTouch: largura < 900, isMobile: largura < 900 })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => erros.push(`${largura}px: ${e.message}`))
  await p.goto(base); await p.waitForSelector('.provas')
  await fn(p)
  await ctx.close()
}
const visiveis = (p, sel) => p.locator(sel).evaluateAll((l) => l.filter((e) => e.getClientRects().length > 0).length)
const semRolagemLateral = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
const nMaterias = await (async () => { const c = await novoContexto(b, { viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); await p.goto(base); await p.waitForSelector('.provas'); const n = await p.locator('.wide-only .folder').count(); await c.close(); return n })()

for (const [w, h] of [[1180, 800], [1440, 900], [1920, 1080]]) {
  await tela(w, h, async (p) => {
    const sec = await p.locator('.wide-only .sec', { hasText: 'Por matéria' }).count()
    ok(`${w}px: Início mostra “Por matéria” com os cartões`, sec === 1 && (await visiveis(p, '.wide-only .folder')) === nMaterias && nMaterias > 0, `${nMaterias} cartões`)
    ok(`${w}px: as 5 pastas dos bancos continuam no Início`, (await visiveis(p, '.provas .folder')) === 5, String(await visiveis(p, '.provas .folder')))
    const yMat = await p.locator('.wide-only .folder').first().evaluate((e) => e.getBoundingClientRect().top)
    const yBan = await p.locator('.provas .folder').first().evaluate((e) => e.getBoundingClientRect().top)
    const fimBan = await p.locator('.provas .folder').first().evaluate((e) => e.getBoundingClientRect().bottom)
    ok(`${w}px: pastas dos bancos no alto, à vista sem rolar, e as matérias logo abaixo`, yBan < yMat && fimBan <= h && yMat >= fimBan, `bancos ${Math.round(yBan)}–${Math.round(fimBan)}, matérias ${Math.round(yMat)}, tela ${h}`)
    ok(`${w}px: sem rolagem lateral`, await semRolagemLateral(p))
    await p.locator('.wide-only .folder').first().click()
    await p.waitForSelector('.filters')
    const mat = await p.locator('.filters .field', { has: p.locator('.lb', { hasText: /^Matéria$/ }) }).locator('.chip[aria-pressed="true"]').allInnerTexts()
    ok(`${w}px: tocar no cartão abre o Treinar filtrado pela matéria`, mat.length === 1 && !/^Todas/.test(mat[0]), mat.join('|'))
    await irPara(p, 'Desempenho'); await p.waitForSelector('.evo')
    ok(`${w}px: Desempenho NÃO repete os cartões de matéria`, (await visiveis(p, '.folders .folder')) === 0 && (await visiveis(p, '.evo')) > 0)
    const topo = await p.locator('.sec', { hasText: 'Evolução' }).first().evaluate((e) => e.getBoundingClientRect().top)
    ok(`${w}px: Desempenho sobe a Evolução (sem vazio no topo)`, topo < 140, `${Math.round(topo)} px`)
    ok(`${w}px: Desempenho sem rolagem lateral`, await semRolagemLateral(p))
  })
}

for (const [w, h] of [[1179, 800], [900, 800], [412, 880], [360, 780], [320, 568]]) {
  await tela(w, h, async (p) => {
    ok(`${w}px: Início NÃO mostra os cartões de matéria`, (await visiveis(p, '.wide-only .folder')) === 0 && (await visiveis(p, '.provas .folder')) === 5)
    ok(`${w}px: Início sem rolagem lateral`, await semRolagemLateral(p))
    await irPara(p, 'Desempenho'); await p.waitForSelector('.evo')
    ok(`${w}px: Desempenho continua com os cartões de matéria`, (await visiveis(p, '.narrow-only .folder')) === nMaterias, String(await visiveis(p, '.narrow-only .folder')))
    ok(`${w}px: Desempenho sem rolagem lateral`, await semRolagemLateral(p))
  })
}

ok('sem erros de página', erros.length === 0, erros.join(' | '))
await b.close()
console.log(out.join('\n'))
if (out.some((l) => l.startsWith('FALHOU'))) process.exit(1)
