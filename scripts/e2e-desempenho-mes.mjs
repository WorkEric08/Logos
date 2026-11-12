// Desempenho (2026-11-10): o gráfico cobre o MÊS ATUAL INTEIRO (dia 1 ao último, com os dias que ainda não chegaram vazios), ocupa a largura
// toda, e os simulados vêm ABAIXO dele em duas colunas alternadas (1º à esquerda, 2º à direita, 3º à esquerda...). No celular, lista única.
// O histórico é gravado direto no IndexedDB (5 simulados + respostas em alguns dias do mês), sem fazer 5 simulados de verdade.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-desempenho-mes.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const erros = []

async function semear(p) {
  await p.evaluate(async () => {
    const p2 = (n) => String(n).padStart(2, '0'), agora = new Date(), y = agora.getFullYear(), m = agora.getMonth()
    const dias = {}
    for (const d of [1, 2, agora.getDate()]) dias[`${y}-${p2(m + 1)}-${p2(d)}`] = { n: 10 + d, c: 6 }
    dias[`${m === 0 ? y - 1 : y}-${p2(m === 0 ? 12 : m)}-28`] = { n: 99, c: 50 } // mês anterior: NÃO conta no gráfico
    const sims = [1, 2, 3, 4, 5].map((i) => ({ t: Date.now() - (6 - i) * 3600e3, p: 40 + i * 5, b: 20, e: 20 + i, c: 30 + i, n: 70, ok: i % 2 === 0, d: 1800 + i * 60 }))
    const db = await new Promise((res, rej) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    await new Promise((res, rej) => { const t = db.transaction('meta', 'readwrite'); t.objectStore('meta').put({ key: 'hist', value: JSON.stringify({ dias, sims }) }); t.oncomplete = res; t.onerror = () => rej(t.error) })
    db.close()
  })
}

for (const [w, h, colunas] of [[1920, 1080, 2], [1440, 900, 2], [1100, 800, 2], [900, 800, 2], [600, 800, 1], [412, 880, 1], [360, 780, 1], [320, 568, 1]]) {
  const ctx = await novoContexto(b, { viewport: { width: w, height: h }, hasTouch: w < 900, isMobile: w < 900 })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => erros.push(`${w}px: ${e.message}`))
  await p.goto(base); await p.waitForSelector('.provas')
  await semear(p); await p.reload(); await p.waitForSelector('.provas')
  await irPara(p, 'Desempenho'); await p.waitForSelector('.bars')
  const hoje = new Date(), total = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  const barras = await p.locator('.bcol').count()
  ok(`${w}px: o gráfico tem uma barra por dia do mês (${total})`, barras === total, `${barras} barras`)
  ok(`${w}px: barra de hoje (dia ${hoje.getDate()}) marcada e dias futuros vazios`, (await p.locator('.bcol.hoje .blb').textContent()) === String(hoje.getDate()) && (await p.locator('.bcol.futuro').count()) === total - hoje.getDate())
  const tot = await p.locator('table.sr-only tbody tr td:nth-child(2)').allInnerTexts()
  ok(`${w}px: só o mês atual entra na conta (o dia 28 do mês passado não)`, tot.length === total && tot.every((t) => +t < 99), tot.slice(0, 3).join(','))
  ok(`${w}px: título é o mês atual`, /\d{4}$/.test((await p.locator('.evo .card h3').first().textContent()).trim()), await p.locator('.evo .card h3').first().textContent())
  const g = await p.evaluate(() => {
    const evo = document.querySelector('.evo').getBoundingClientRect(), bars = document.querySelector('.bars').getBoundingClientRect()
    const cards = [...document.querySelectorAll('.evo > .card')].map((c) => c.getBoundingClientRect())
    const lis = [...document.querySelectorAll('.simlist li')].map((l) => { const r = l.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) } })
    const bc = [...document.querySelectorAll('.bcol')].map((e) => e.getBoundingClientRect())
    return { evoW: evo.width, barsW: bars.width, cartaoGraf: cards[0], cartaoSim: cards[1], lis, larguraMin: Math.min(...bc.map((r) => r.width)), lateral: document.documentElement.scrollWidth - innerWidth }
  })
  ok(`${w}px: o gráfico ocupa a largura toda da coluna`, g.cartaoGraf.width >= g.evoW - 1, `${Math.round(g.cartaoGraf.width)} de ${Math.round(g.evoW)}`)
  ok(`${w}px: o cartão dos Simulados fica ABAIXO do gráfico`, g.cartaoSim.top >= g.cartaoGraf.bottom - 1 && Math.abs(g.cartaoSim.left - g.cartaoGraf.left) < 2, `gráfico até ${Math.round(g.cartaoGraf.bottom)}, simulados de ${Math.round(g.cartaoSim.top)}`)
  ok(`${w}px: 5 simulados na lista`, g.lis.length === 5)
  const esq = Math.min(...g.lis.map((l) => l.x))
  const lados = g.lis.map((l) => (l.x - esq < 8 ? 'E' : 'D'))
  const esperado = colunas === 2 ? ['E', 'D', 'E', 'D', 'E'] : ['E', 'E', 'E', 'E', 'E']
  ok(`${w}px: ${colunas === 2 ? '1º à esquerda, 2º à direita, 3º à esquerda…' : 'uma coluna, na mesma ordem'}`, JSON.stringify(lados) === JSON.stringify(esperado), lados.join(''))
  if (colunas === 2) {
    ok(`${w}px: 1º e 2º na mesma linha, 3º e 4º na seguinte (abaixo)`, g.lis[0].y === g.lis[1].y && g.lis[2].y > g.lis[0].y && g.lis[2].y === g.lis[3].y && g.lis[4].y > g.lis[2].y, g.lis.map((l) => l.y).join(','))
  } else {
    ok(`${w}px: um simulado abaixo do outro`, g.lis.every((l, i) => i === 0 || l.y > g.lis[i - 1].y))
  }
  ok(`${w}px: barras com largura útil (≥ 5 px) e sem rolagem lateral`, g.larguraMin >= 5 && g.lateral <= 0, `menor barra ${g.larguraMin.toFixed(1)} px`)
  const rotulos = await p.locator('.blb').evaluateAll((l) => l.filter((e) => getComputedStyle(e).visibility !== 'hidden').map((e) => e.textContent))
  ok(`${w}px: números dos dias ${w < 1100 ? 'espaçados (1, 5, 10…)' : 'todos à vista'}`, rotulos.includes('1') && rotulos.includes('5') && (w >= 1100 ? rotulos.length === total : rotulos.length < total && rotulos.length >= 6), rotulos.join(' '))
  const colide = await p.evaluate(() => { const r = [...document.querySelectorAll('.blb')].filter((e) => getComputedStyle(e).visibility !== 'hidden').map((e) => { const t = document.createRange(); t.selectNodeContents(e); return t.getBoundingClientRect() }); let c = 0; for (let i = 1; i < r.length; i++) if (r[i].left < r[i - 1].right - 0.5) c++; return c })
  ok(`${w}px: números dos dias não se sobrepõem`, colide === 0, `${colide} sobreposições`)
  if (w === 1440 || w === 412) await p.screenshot({ path: `docs/verificacao-capturas/desempenho-mes-${w}.png` })
  await ctx.close()
}

ok('sem erros de página', erros.length === 0, erros.join(' | '))
await b.close()
console.log(out.join('\n'))
if (out.some((l) => l.startsWith('FALHOU'))) process.exit(1)
