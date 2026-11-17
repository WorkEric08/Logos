// Abertura animada (splash) no navegador de verdade, SEM a chave de teste que a pula.
// Confere: preto na 1ª pintura (mesmo com tema claro), duração de ~2 s + fade, composição centralizada e proporcional em 360×800,
// 390×844, 412×915, 768×1024 (e 1280×720), quadros da animação (folha de capturas), movimento reduzido e que o app abre depois.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-splash.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const erros = []
/** As três linhas de texto da abertura estão inteiras (30, 30 e 18)? Com tolerância: a largura é animada e o último quadro pode ficar em 17,99999 (e não em 18 exato). */
const linhasCheias = (l) => l.length === 3 && [30, 30, 18].every((v, i) => Math.abs(l[i] - v) < 0.01)

// ---- 1. preto já na 1ª pintura (com o código do app atrasado de propósito), mesmo com tema claro; e o tempo total ----
// Obs.: o seletor é `div.splash` porque a classe `splash` também fica (por instantes) no <html>.
const pagina2 = await b.newPage()
const pixelCentro = async (buf) => pagina2.evaluate(async (b64) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode()
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0)
  const pts = [[0.5, 0.2], [0.1, 0.5], [0.9, 0.9], [0.5, 0.5]] // cantos e meio: nenhum pode ser claro
  return pts.map(([fx, fy]) => [...x.getImageData(Math.floor(im.width * fx), Math.floor(im.height * fy), 1, 1).data.slice(0, 3)])
}, buf.toString('base64'))
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', isMobile: true, hasTouch: true })
  await ctx.addInitScript(() => { try { localStorage.setItem('treino_tema', 'light') } catch { /* nada */ } })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
  await p.route('**/assets/*.js', async (rota) => { await new Promise((r) => setTimeout(r, 1500)); await rota.continue() }) // o app demora 1,5 s a chegar
  const ida = p.goto(base, { waitUntil: 'commit' })
  await p.waitForSelector('html', { state: 'attached' }); await p.waitForTimeout(800)
  const pixels = await pixelCentro(await p.screenshot())
  ok('1ª pintura (app ainda não chegou, tema claro salvo): tela toda preta', pixels.every(([r, g, bl]) => r === 0 && g === 0 && bl === 0), JSON.stringify(pixels))
  await ida
  await p.waitForSelector('div.splash', { state: 'attached' })
  const t0 = Date.now()
  await p.waitForSelector('div.splash', { state: 'detached', timeout: 6000 })
  const dur = (Date.now() - t0) / 1000
  ok('a abertura dura ~2 s + 150 ms de fade quando o app já carregou', dur >= 1.9 && dur <= 2.4, `${dur.toFixed(2)} s (medido do aparecer ao sumir)`)
  await p.waitForSelector('.folders')
  ok('o preto provisório sai quando a abertura assume (sem sobrar tela preta)', await p.evaluate(() => !document.documentElement.classList.contains('splash')))
  ok('depois da abertura o app abre na tela inicial, sem sobrar nada por cima', (await p.locator('div.splash').count()) === 0 && (await p.locator('.provas .folders').isVisible()))
  await ctx.close()
}

// ---- 2. geometria: centralizada e proporcional (estado final, entre 1,54 s e 2,0 s) ----
const medir = () => {
  const r = (e) => e.getBoundingClientRect()
  const g = [...document.querySelectorAll('.splash svg > g > g')].map(r) // trás, meio, frente
  const x0 = Math.min(...g.map((a) => a.left)), x1 = Math.max(...g.map((a) => a.right)), y0 = Math.min(...g.map((a) => a.top)), y1 = Math.max(...g.map((a) => a.bottom))
  const linhas = [...document.querySelectorAll('.splash rect')].map((e) => +e.getAttribute('width'))
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, wTela: innerWidth, hTela: innerHeight, linhas, frente: g[2].width }
}
for (const [w, h] of [[360, 800], [390, 844], [412, 915], [768, 1024], [1280, 720]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900, colorScheme: 'dark' })
  const p = await ctx.newPage()
  await p.goto(base, { waitUntil: 'commit' })
  await p.waitForFunction(() => { const r = [...document.querySelectorAll('.splash rect')]; return r.length === 3 && +r[2].getAttribute('width') >= 17.99999 }, null, { polling: 30, timeout: 5000 })
  const m = await p.evaluate(medir)
  const u = Math.min(w / 168.75, h / 300)
  const dx = Math.abs(m.cx - w / 2), dy = Math.abs(m.cy - h / 2)
  ok(`${w}×${h}: composição centralizada (erro ≤ 1 px)`, dx <= 1 && dy <= 1, `centro off ${dx.toFixed(2)}, ${dy.toFixed(2)} px`)
  ok(`${w}×${h}: proporcional (100×84 u com u = ${u.toFixed(3)} px; ±1 px)`, Math.abs(m.w - 100 * u) <= 1.5 && Math.abs(m.h - 84 * u) <= 1.5, `${m.w.toFixed(1)}×${m.h.toFixed(1)} px (esperado ${(100 * u).toFixed(1)}×${(84 * u).toFixed(1)})`)
  ok(`${w}×${h}: linhas de texto completas (30, 30, 18) e arquivo da frente em 100 %`, linhasCheias(m.linhas) && Math.abs(m.frente - 48 * u) <= 0.5, `${m.linhas.join()} / frente ${m.frente.toFixed(1)} px`)
  ok(`${w}×${h}: cabe na tela com folga (≤ 60 % da largura, ≤ 30 % da altura)`, m.w <= w * 0.6 + 1 && m.h <= h * 0.3 + 1)
  await ctx.close()
}

// ---- 3. quadros da animação (folha de capturas) ----
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark', deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.goto(base, { waitUntil: 'commit' }); await p.waitForSelector('div.splash', { state: 'attached' })
  const t0 = Date.now(), tempos = [0.1, 0.25, 0.5, 0.8, 1.1, 1.3, 1.6, 1.9]
  for (const t of tempos) { await p.waitForTimeout(Math.max(0, t * 1000 - (Date.now() - t0))); await p.screenshot({ path: `docs/verificacao-capturas/splash-t${String(Math.round(t * 100)).padStart(3, '0')}.png` }) }
  const visiveis = await p.evaluate(() => [...document.querySelectorAll('.splash svg > g > g')].map((g) => getComputedStyle(g).visibility))
  ok('quadros salvos em docs/verificacao-capturas/splash-t*.png; no fim os 3 arquivos estão visíveis', visiveis.every((v) => v === 'visible'), visiveis.join())
  await ctx.close()
}

// ---- 4. movimento reduzido: direto o estado final por ~0,5 s e entra ----
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(base, { waitUntil: 'commit' }); await p.waitForSelector('div.splash', { state: 'attached' })
  const t0 = Date.now()
  const linhas = await p.evaluate(() => [...document.querySelectorAll('div.splash rect')].map((e) => +e.getAttribute('width')))
  await p.waitForSelector('div.splash', { state: 'detached', timeout: 4000 })
  const dur = (Date.now() - t0) / 1000
  ok('movimento reduzido: estado final desde o 1º quadro e entra em ~0,5 s (+ fade)', linhasCheias(linhas) && dur >= 0.4 && dur <= 1.2, `linhas ${linhas.join()}, ${dur.toFixed(2)} s`)
  await ctx.close()
}

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
