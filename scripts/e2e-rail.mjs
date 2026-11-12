// Navigation Rail do celular (SOBREPOSTA ao conteúdo, com aba retrátil e desfoque) e ausência de barras de rolagem, no navegador de verdade.
// Confere: repouso (só a aba), conteúdo que não se mexe ao abrir, barra de 76 px por cima, desfoque, escolher uma tela volta ao repouso,
// tocar no desfoque / na aba / arrastar / Esc / voltar fecham, animação de ~250 ms, temas, deitado, tablet, computador (trilho fixo).
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-rail.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const abrir = async (p) => { await p.goto(base); await p.waitForSelector('.folders') }
const rect = (p, sel) => p.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, r: r.right } })
// repouso = fora da tela (à esquerda ou à direita, conforme o lado da aba); aberta = encostada na borda do seu lado
const emRepouso = (p) => p.locator('.nav.rail').evaluate((e) => { const r = e.getBoundingClientRect(); return r.right <= 0.5 || r.left >= innerWidth - 0.5 })
const aberta = (p) => p.locator('.nav.rail').evaluate((e) => { const r = e.getBoundingClientRect(); return Math.abs(r.x) <= 0.5 || Math.abs(r.right - innerWidth) <= 0.5 })
const espera = (p, ms = 450) => p.waitForTimeout(ms)
const arrasta = async (p, de, dx, dy = 0, passos = 6) => {
  await p.mouse.move(de.x, de.y); await p.mouse.down()
  for (let i = 1; i <= passos; i++) await p.mouse.move(de.x + (dx * i) / passos, de.y + (dy * i) / passos)
  await p.mouse.up(); await espera(p)
}
const centro = (p, sel) => p.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })

// ================= celular 360×800 (escuro) =================
{
  const ctx = await novoContexto(b, { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
  await abrir(p)

  // ---- repouso ----
  const aba = await rect(p, '.rail-alca')
  const rep = await p.evaluate(() => ({ exp: document.querySelector('.rail-alca').getAttribute('aria-expanded'), inert: document.querySelector('.rail-itens').inert, veu: getComputedStyle(document.querySelector('.rail-veu')).visibility, nome: document.querySelector('.rail-nome').innerText, modo: getComputedStyle(document.querySelector('.rail-nome')).writingMode, mainInert: document.querySelector('main').inert }))
  const vis = await p.locator('.rail-alca-vis').evaluate((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e), nome = e.querySelector('.rail-nome').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), bg: cs.backgroundColor, svg: e.querySelectorAll('svg').length, nomeVisivel: nome.width > 2 || nome.height > 2 } })
  ok('em repouso a barra está fora da tela e só a aba aparece na borda esquerda: um quadrado com UMA seta, sem texto', (await emRepouso(p)) && aba.x <= 1 && aba.w >= 44 && aba.h >= 44 && vis.x === 0 && vis.w === 34 && vis.h === 34 && vis.svg === 1 && !vis.nomeVisivel, JSON.stringify(vis))
  ok('o quadrado da aba tem a cor da barra e o leitor de tela ainda ouve a tela atual', vis.bg === 'rgb(10, 14, 21)' && /início/i.test(rep.nome), JSON.stringify({ bg: vis.bg, nome: rep.nome }))
  ok('repouso: aba com aria-expanded=false, botões inacessíveis (inert), sem desfoque, conteúdo ativo', rep.exp === 'false' && rep.inert === true && rep.veu === 'hidden' && rep.mainInert === false)
  const antes = { page: await rect(p, '.page'), h1: await rect(p, '.top h1'), pad: await p.evaluate(() => getComputedStyle(document.querySelector('.scroll-y')).paddingLeft), conteudo: await rect(p, '.scroll-y') }
  ok('conteúdo ocupa a tela toda (360 px), com a margem normal de 16 px (a aba pode ficar por cima dele)', antes.conteudo.x === 0 && antes.conteudo.w === 360 && antes.pad === '16px', JSON.stringify({ x: antes.conteudo.x, w: antes.conteudo.w, pad: antes.pad }))
  await p.screenshot({ path: 'docs/verificacao-capturas/rail-360-repouso.png' })

  // ---- abrir: sobrepõe, desfoca, não mexe no conteúdo ----
  const t = await p.evaluate(() => new Promise((res) => {
    const nav = document.querySelector('.nav.rail'), t0 = performance.now(); document.querySelector('.rail-alca').click()
    const tick = () => { if (nav.getBoundingClientRect().x >= -0.5) res(performance.now() - t0); else if (performance.now() - t0 > 1500) res(-1); else requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  }))
  ok('tocar na aba abre a barra deslizando em ~250 ms', t >= 150 && t <= 420, `${Math.round(t)} ms`)
  await espera(p, 200)
  const nav = await rect(p, '.nav.rail')
  ok('aberta: barra de 76 px colada na esquerda, na altura toda', Math.abs(nav.w - 76) <= 1 && nav.x === 0 && Math.abs(nav.h - 800) <= 1, `${nav.w}×${nav.h}`)
  const depois = { page: await rect(p, '.page'), h1: await rect(p, '.top h1'), pad: await p.evaluate(() => getComputedStyle(document.querySelector('.scroll-y')).paddingLeft), conteudo: await rect(p, '.scroll-y') }
  ok('o conteúdo NÃO se adapta: mesma posição, largura e margens com a barra aberta', JSON.stringify(depois) === JSON.stringify(antes), JSON.stringify({ x: depois.page.x, w: depois.page.w }))
  const camada = await p.evaluate(() => ({ veu: (() => { const v = getComputedStyle(document.querySelector('.rail-veu')); return { vis: v.visibility, op: v.opacity, blur: v.backdropFilter || v.webkitBackdropFilter } })(), noBarra: document.elementFromPoint(32, 120)?.closest('.nav') !== null, noVeu: document.elementFromPoint(250, 300)?.classList.contains('rail-veu'), mainInert: document.querySelector('main').inert, exp: document.querySelector('.rail-alca').getAttribute('aria-expanded') }))
  ok('aberta: o conteúdo ganha desfoque (camada acima dele e abaixo da barra) e fica inacessível', camada.veu.vis === 'visible' && camada.veu.op === '1' && /blur\(/.test(camada.veu.blur) && camada.noBarra && camada.noVeu && camada.mainInert && camada.exp === 'true', JSON.stringify(camada.veu))
  const rotulos = await p.locator('.rail-item .rail-lb').allInnerTexts()
  const btns = await p.locator('.rail-item').evaluateAll((es) => es.map((e) => { const i = e.querySelector('.rail-ico').getBoundingClientRect(), r = e.getBoundingClientRect(); return { ico: [Math.round(i.width), Math.round(i.height)], w: Math.round(r.width), h: Math.round(r.height) } }))
  ok('5 destinos (Início, Treinar, Cards, Desempenho, Mais) com botões quadrados de 52 px e alvo ≥ 44 px', rotulos.join() === 'Início,Treinar,Cards,Desempenho,Mais' && btns.every((x) => x.ico[0] === 52 && x.ico[1] === 52 && x.w >= 44 && x.h >= 44), rotulos.join())
  const cortes = await p.locator('.rail-lb').evaluateAll((es) => es.map((e) => { const r = e.getBoundingClientRect(), n = e.closest('.nav').getBoundingClientRect(); return e.scrollWidth <= e.clientWidth + 1 && r.left >= n.left - 0.5 && r.right <= n.right + 0.5 }))
  ok('nenhum rótulo cortado (inclui "Desempenho")', cortes.every(Boolean))
  const cor = await p.evaluate(() => { const e = document.querySelector('.rail-item[aria-current="page"] .rail-ico'); return { bg: getComputedStyle(e).backgroundColor, ponto: getComputedStyle(e.closest('.rail-item'), '::after').content, atual: e.closest('.rail-item').innerText.trim() } })
  ok('item ativo (Início) em amarelo/laranja, com ponto e aria-current', cor.bg === 'rgb(240, 178, 60)' && cor.ponto !== 'none' && cor.atual === 'Início', JSON.stringify(cor))
  ok('a seta aponta para recolher (esquerda)', /matrix\(1/.test(await p.locator('.rail-seta .icon').evaluate((e) => getComputedStyle(e).transform)) || (await p.locator('.rail-seta .icon').evaluate((e) => getComputedStyle(e).transform)) === 'none')
  await p.screenshot({ path: 'docs/verificacao-capturas/rail-360-aberta-sobreposta.png' })

  // ---- escolher outra tela: navega e a barra volta ao repouso ----
  await p.click('.nav .rail-item >> text=Treinar'); await espera(p)
  const nav2 = await p.evaluate(() => ({ h1: document.querySelector('h1').innerText, rep: document.querySelector('.nav.rail').getBoundingClientRect().right <= 0.5, veu: getComputedStyle(document.querySelector('.rail-veu')).visibility, mainInert: document.querySelector('main').inert, nome: document.querySelector('.rail-nome').innerText, exp: document.querySelector('.rail-alca').getAttribute('aria-expanded') }))
  ok('tocar em Treinar vai para Treinar, a barra volta ao repouso, o desfoque some e o conteúdo volta ao normal', nav2.h1 === 'Treinar' && nav2.rep && nav2.veu === 'hidden' && !nav2.mainInert && /treinar/i.test(nav2.nome) && nav2.exp === 'false', JSON.stringify(nav2))
  const lay2 = await rect(p, '.scroll-y')
  ok('depois de trocar de tela o conteúdo continua com a mesma largura e margem', lay2.w === 360 && lay2.x === 0)

  // ---- outras formas de fechar ----
  await p.click('.rail-alca'); await espera(p)
  await p.mouse.click(260, 300); await espera(p)
  ok('tocar no desfoque fecha a barra e NÃO aciona nada do conteúdo (continua em Treinar)', (await emRepouso(p)) && (await p.locator('h1').innerText()) === 'Treinar')
  await p.click('.rail-alca'); await espera(p); await p.click('.rail-alca'); await espera(p)
  ok('tocar na aba com a barra aberta fecha', await emRepouso(p))
  await p.click('.rail-alca'); await espera(p); await p.keyboard.press('Escape'); await espera(p)
  ok('Esc fecha a barra aberta', await emRepouso(p))
  await p.click('.rail-alca'); await espera(p); await p.goBack(); await espera(p)
  ok('botão voltar com a barra aberta fecha só a barra (não sai da tela nem do app)', (await emRepouso(p)) && (await p.locator('h1').innerText()) === 'Treinar')
  await p.click('.rail-alca'); await espera(p)
  await abrir(p)
  ok('depois de recarregar a barra está em repouso (nunca começa aberta)', await emRepouso(p))

  // ---- arrastar (mouse) ----
  await arrasta(p, await centro(p, '.rail-alca'), 90)
  ok('arrastar a aba para a direita abre a barra', await aberta(p))
  await arrasta(p, { x: 32, y: 600 }, -90)
  ok('arrastar a barra para a esquerda fecha', await emRepouso(p))
  await arrasta(p, await centro(p, '.rail-alca'), 90)
  await arrasta(p, { x: 220, y: 300 }, -100)
  ok('arrastar o desfoque para a esquerda também fecha', await emRepouso(p))
  await arrasta(p, await centro(p, '.rail-alca'), 90)
  const itemC = await centro(p, '.rail-item >> nth=1')
  await arrasta(p, itemC, -80)
  ok('arrastar começando num botão fecha a barra e não aciona o botão', (await emRepouso(p)) && (await p.locator('h1').innerText()) === 'Início')

  // ---- arrastar com o DEDO (eventos de toque) ----
  const cdp = await ctx.newCDPSession(p)
  const dedo = async (de, dx) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: de.x, y: de.y }] })
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: de.x + (dx * i) / 8, y: de.y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await espera(p)
  }
  await dedo(await centro(p, '.rail-alca'), 90)
  ok('com o dedo: arrastar a aba para a direita abre', await aberta(p))
  await dedo({ x: 32, y: 500 }, -90)
  ok('com o dedo: arrastar a barra para a esquerda fecha', await emRepouso(p))

  // ---- deslizar em qualquer ponto da TELA (conteúdo) abre a barra, na direção do interior a partir do lado da aba ----
  const tela = async (de, dx, dy = 0) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: de.x, y: de.y }] })
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: de.x + (dx * i) / 8, y: de.y + (dy * i) / 8 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await espera(p)
  }
  await tela({ x: 200, y: 420 }, -120)
  ok('aba à esquerda: deslizar na tela PARA A ESQUERDA (rumo à borda) não faz nada', await emRepouso(p))
  await tela({ x: 120, y: 420 }, 20, 160)
  ok('deslizar na vertical (rolagem) não abre', await emRepouso(p))
  await tela({ x: 120, y: 420 }, 25)
  ok('deslize curto demais (25 px) não abre', await emRepouso(p))
  await tela({ x: 120, y: 420 }, 140)
  ok('aba à esquerda: deslizar na tela PARA A DIREITA abre a barra', await aberta(p))
  await tela({ x: 250, y: 420 }, 140)
  ok('aberta: deslizar no sentido DO MESMO lado (para dentro) não fecha', await aberta(p))
  await tela({ x: 250, y: 420 }, 20, 160)
  ok('aberta: deslizar na vertical não fecha', await aberta(p))
  await tela({ x: 250, y: 420 }, -140)
  ok('aberta: deslizar no sentido CONTRÁRIO ao que abriu (para a borda da aba), com o dedo sobre o desfoque, fecha', await emRepouso(p))
  await tela({ x: 120, y: 420 }, 140)
  ok('(de novo aberta pelo deslize)', await aberta(p))
  await dedo({ x: 32, y: 500 }, -90)
  ok('…e ela volta ao repouso arrastando para a borda', await emRepouso(p))
  await abrir(p)
  await irPara(p, 'Mais')
  const campo = p.locator('input:visible, textarea:visible').first()
  if (await campo.count()) {
    await campo.scrollIntoViewIfNeeded()
    const c = await centro(p, 'input:visible, textarea:visible')
    await tela({ x: Math.max(8, c.x - 60), y: c.y }, 150)
    ok('deslizar começando num campo de texto não abre a barra', await emRepouso(p))
  }
  await ctx.close()
}

// ---- aba à DIREITA: o deslize que abre é para a esquerda ----
{
  const ctx = await novoContexto(b, { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  await ctx.addInitScript(() => { try { localStorage.setItem('treino_rail_aba', JSON.stringify({ lado: 'dir', pos: 0.5 })) } catch { /* sem armazenamento */ } })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
  await abrir(p)
  const cdp = await ctx.newCDPSession(p)
  const tela = async (de, dx) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: de.x, y: de.y }] })
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: de.x + (dx * i) / 8, y: de.y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await espera(p)
  }
  ok('(aba à direita) a aba está mesmo à direita', (await p.locator('.nav.rail').getAttribute('data-lado')) === 'dir')
  await tela({ x: 150, y: 420 }, 130)
  ok('aba à direita: deslizar para a DIREITA (rumo à borda) não faz nada', await emRepouso(p))
  await tela({ x: 240, y: 420 }, -140)
  ok('aba à direita: deslizar na tela PARA A ESQUERDA abre a barra', await aberta(p))
  await tela({ x: 120, y: 420 }, -140)
  ok('aba à direita, aberta: deslizar para a ESQUERDA (mesmo sentido que abriu) não fecha', await aberta(p))
  await tela({ x: 120, y: 420 }, 140)
  ok('aba à direita, aberta: deslizar para a DIREITA (contrário ao que abriu) fecha', await emRepouso(p))
  await ctx.close()
}

// ================= reordenar os ícones da barra: segurar um ícone e arrastar =================
{
  const ctx = await novoContexto(b, { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
  await abrir(p)
  const cdp = await ctx.newCDPSession(p)
  const ordem = () => p.locator('.rail-item').evaluateAll((es) => es.map((e) => e.dataset.id).join())
  const guardada = () => p.evaluate(() => localStorage.getItem('treino_rail_ordem'))
  const ty = (i) => p.locator('.rail-item').nth(i).evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m42)
  const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  const abre = async () => { await p.click('.rail-alca'); await espera(p) }
  const PADRAO = 'inicio,treinar,cartoes,desempenho,mais'
  await abre()
  ok('ordem padrão dos ícones', (await ordem()) === PADRAO && (await guardada()) === null, await ordem())
  const r0 = await rect(p, '.rail-item >> nth=0'), r1 = await rect(p, '.rail-item >> nth=1'), passo = r1.y - r0.y
  const c0 = await centro(p, '.rail-item >> nth=0')

  // segura o 1º ícone e leva para baixo, passando por cima de dois: o meio do caminho (vizinhos abrem espaço)
  await toque('touchStart', c0.x, c0.y); await p.waitForTimeout(520)
  ok('segurar um ícone o "levanta" (arrastando)', (await p.locator('.rail-item[data-arrastando]').count()) === 1)
  for (let i = 1; i <= 8; i++) await toque('touchMove', c0.x, c0.y + (2.2 * passo * i) / 8)
  await p.waitForTimeout(350)
  const dy = await ty(0), t1 = await ty(1), t2 = await ty(2), t3 = await ty(3)
  ok('enquanto passa por cima, o ícone segue o dedo e os dois ícones cruzados sobem um lugar', Math.abs(dy - 2.2 * passo) < 3 && Math.abs(t1 + passo) < 2 && Math.abs(t2 + passo) < 2 && Math.abs(t3) < 1, JSON.stringify({ passo, dy, t1, t2, t3 }))
  ok('durante o arrasto a ordem do DOM ainda não mudou', (await ordem()) === PADRAO)
  await toque('touchEnd'); await p.waitForTimeout(500)
  ok('ao soltar o ícone fica no lugar escolhido (3ª posição)', (await ordem()) === 'treinar,cartoes,inicio,desempenho,mais', await ordem())
  const sobra = await p.evaluate(() => [...document.querySelectorAll('.rail-item')].map((e) => e.style.transform).filter(Boolean))
  ok('…sem transformações sobrando e sem trocar de tela nem fechar a barra', sobra.length === 0 && (await aberta(p)) && (await p.locator('h1').innerText()) === 'Início', JSON.stringify(sobra))
  ok('a ordem fica guardada', (await guardada()) === '["treinar","cartoes","inicio","desempenho","mais"]', await guardada())

  // um toque rápido continua escolhendo a tela; arrastar depressa para o lado continua fechando
  await p.click('.rail-item >> text=Cards'); await espera(p)
  ok('toque rápido num ícone ainda abre a tela e recolhe a barra', (await emRepouso(p)) && (await p.locator('h1').innerText()) === 'Cards')
  await abre()
  const cc = await centro(p, '.rail-item >> nth=2')
  await toque('touchStart', cc.x, cc.y)
  for (let i = 1; i <= 6; i++) await toque('touchMove', cc.x - 14 * i, cc.y)
  await toque('touchEnd'); await espera(p)
  ok('arrastar depressa para o lado a partir de um ícone fecha a barra e não reordena', (await emRepouso(p)) && (await ordem()) === 'treinar,cartoes,inicio,desempenho,mais')

  // arrastar o último para o topo
  await abre()
  const cu = await centro(p, '.rail-item >> nth=4')
  await toque('touchStart', cu.x, cu.y); await p.waitForTimeout(520)
  for (let i = 1; i <= 8; i++) await toque('touchMove', cu.x, cu.y - (9 * passo * i) / 8) // além do topo: não sai da lista
  await p.waitForTimeout(300)
  ok('o ícone arrastado não sai da lista (para no topo)', Math.abs((await ty(4)) + 4 * passo) < 2, String(await ty(4)))
  await toque('touchEnd'); await p.waitForTimeout(500)
  ok('último ícone levado ao topo', (await ordem()) === 'mais,treinar,cartoes,inicio,desempenho', await ordem())

  // largura e teclado
  const w = await p.locator('.nav.rail').evaluate((e) => e.getBoundingClientRect().width)
  ok('a barra aberta tem 76 px (antes 64)', Math.abs(w - 76) <= 1, String(w))
  await p.locator('.rail-item >> nth=0').focus(); await p.keyboard.press('Alt+ArrowDown'); await p.waitForTimeout(100)
  ok('teclado: Alt+↓ no ícone o desce um lugar e o foco continua nele', (await ordem()) === 'treinar,mais,cartoes,inicio,desempenho' && (await p.evaluate(() => document.activeElement?.dataset.id)) === 'mais', await ordem())
  ok('o leitor de tela é avisado da nova posição', /Mais movido para a posição 2 de 5/.test(await p.locator('[role=status]').innerText()))
  await p.keyboard.press('Escape'); await espera(p)

  // lembra depois de recarregar
  await abrir(p); await abre()
  ok('depois de recarregar a ordem continua a escolhida', (await ordem()) === 'treinar,mais,cartoes,inicio,desempenho', await ordem())
  // Esc durante o arrasto cancela
  const ce = await centro(p, '.rail-item >> nth=3')
  await toque('touchStart', ce.x, ce.y); await p.waitForTimeout(520)
  for (let i = 1; i <= 4; i++) await toque('touchMove', ce.x, ce.y - passo * i / 2)
  await p.keyboard.press('Escape'); await toque('touchEnd'); await p.waitForTimeout(400)
  ok('Esc no meio do arrasto cancela: a ordem não muda', (await ordem()) === 'treinar,mais,cartoes,inicio,desempenho' && (await p.locator('.rail-item[data-arrastando]').count()) === 0, await ordem())
  await p.keyboard.press('Escape'); await espera(p)
  await irPara(p, 'Mais')
  ok('Mais: não existe mais a seção "Ordem dos ícones da barra" nem a de backup', (await p.locator('h3', { hasText: 'Ordem dos ícones' }).count()) === 0 && (await p.locator('h3', { hasText: 'Backup' }).count()) === 0 && (await p.locator('h3', { hasText: 'Aba da barra de navegação' }).count()) === 1)
  await p.click('.card >> text=Voltar ao padrão'); await abre()
  ok('Mais › "Voltar ao padrão" (Aba da barra) também restaura a ordem dos ícones', (await ordem()) === PADRAO && (await guardada()) === '[]', await ordem())

  // ---- ícones em cima (padrão), no meio ou embaixo (Mais › Aba da barra de navegação) ----
  const folgas = () => p.evaluate(() => { const n = document.querySelector('.nav.rail').getBoundingClientRect(), its = [...document.querySelectorAll('.rail-item')], a = its[0].getBoundingClientRect(), z = its[its.length - 1].getBoundingClientRect(); return { cima: Math.round(a.top - n.top), baixo: Math.round(n.bottom - z.bottom) } })
  const iconesGuardado = () => p.evaluate(() => localStorage.getItem('treino_rail_icones'))
  await espera(p); await p.click('.rail-alca'); await espera(p) // volta a fechar
  await abre(); const fCima = await folgas()
  ok('padrão: os ícones ficam em cima (folga de cima pequena, a de baixo grande)', fCima.cima < 40 && fCima.baixo > 200 && [null, 'cima'].includes(await iconesGuardado()), JSON.stringify(fCima))
  await irPara(p, 'Mais')
  ok('Mais mostra as 3 opções dos ícones, com "Em cima" marcada por padrão', JSON.stringify(await p.locator('[aria-label="Onde ficam os ícones na barra"] .chip').allInnerTexts()) === '["Em cima","No meio","Embaixo"]' && (await p.locator('[aria-label="Onde ficam os ícones na barra"] .chip[aria-pressed=true]').innerText()) === 'Em cima')
  await p.click('[aria-label="Onde ficam os ícones na barra"] >> text=No meio'); await abre(); const fMeio = await folgas()
  ok('"No meio": os ícones ficam centralizados na barra (folgas iguais)', Math.abs(fMeio.cima - fMeio.baixo) <= 3 && fMeio.cima > 60, JSON.stringify(fMeio))
  await irPara(p, 'Mais'); await p.click('[aria-label="Onde ficam os ícones na barra"] >> text=Embaixo'); await abre(); const fBaixo = await folgas()
  ok('"Embaixo": os ícones ficam colados no pé da barra', fBaixo.baixo < 40 && fBaixo.cima > 200 && (await iconesGuardado()) === 'baixo', JSON.stringify(fBaixo))
  // arrastar um ícone continua funcionando com os ícones embaixo
  const ib = await rect(p, '.rail-item >> nth=4'), ib3 = await rect(p, '.rail-item >> nth=3'), passoB = ib.y - ib3.y, cb = await centro(p, '.rail-item >> nth=4')
  await toque('touchStart', cb.x, cb.y); await p.waitForTimeout(520)
  for (let i = 1; i <= 8; i++) await toque('touchMove', cb.x, cb.y - (1.2 * passoB * i) / 8)
  await toque('touchEnd'); await p.waitForTimeout(500)
  ok('com os ícones embaixo, segurar e arrastar ainda reordena', (await ordem()) === 'inicio,treinar,cartoes,mais,desempenho', await ordem())
  await abrir(p); await abre()
  ok('depois de recarregar, os ícones seguem embaixo', (await folgas()).baixo < 40)
  await irPara(p, 'Mais'); await p.click('.card >> text=Voltar ao padrão'); await abre(); const fPad = await folgas()
  ok('"Voltar ao padrão" devolve os ícones para cima', fPad.cima < 40 && (await iconesGuardado()) === 'cima', JSON.stringify(fPad))
  await ctx.close()
}

// ================= segurar a aba e arrastar: outra altura e o outro lado =================
{
  const ctx = await novoContexto(b, { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
  await abrir(p)
  const guardado = () => p.evaluate(() => JSON.parse(localStorage.getItem('treino_rail_aba') ?? 'null'))
  const lado = () => p.locator('.nav.rail').getAttribute('data-lado')
  // segura (mouse) por 480 ms, arrasta até `para` e solta (ou fica segurando, se soltar=false)
  const segura = async (de, para, { soltar = true, antes = 480 } = {}) => {
    await p.mouse.move(de.x, de.y); await p.mouse.down(); await p.waitForTimeout(antes)
    for (let i = 1; i <= 8; i++) await p.mouse.move(de.x + ((para.x - de.x) * i) / 8, de.y + ((para.y - de.y) * i) / 8)
    if (soltar) { await p.mouse.up(); await espera(p) }
  }
  const aba0 = await rect(p, '.rail-alca')
  ok('padrão: aba na esquerda, no meio da altura', (await lado()) === 'esq' && Math.abs(aba0.y + aba0.h / 2 - 400) <= 3 && aba0.x <= 1, JSON.stringify(aba0))

  // segurar sem arrastar: levanta a aba (e as guias das bordas aparecem)
  const c0 = await centro(p, '.rail-alca')
  await p.mouse.move(c0.x, c0.y); await p.mouse.down(); await p.waitForTimeout(480)
  const lev = await p.evaluate(() => ({ movendo: !!document.querySelector('.rail-alca[data-movendo]'), guias: document.querySelectorAll('.rail-guias i').length }))
  ok('segurar a aba por ~0,4 s a "levanta" e mostra as guias das duas bordas', lev.movendo && lev.guias === 2, JSON.stringify(lev))
  const est = await p.evaluate(() => { const g = getComputedStyle(document.querySelector('.rail-guias i')), v = getComputedStyle(document.querySelector('.rail-alca[data-movendo] .rail-alca-vis')); return { guiaCor: g.backgroundColor, guiaLarg: g.width, contorno: v.boxShadow } })
  ok('enquanto move: guias das bordas CINZA e FINAS (2 px) e contorno da aba cinza fino (nada amarelo)', est.guiaCor === 'rgb(102, 112, 133)' && est.guiaLarg === '2px' && est.contorno.includes('rgb(102, 112, 133) 0px 0px 0px 1px') && !/240, 178, 60/.test(est.contorno + est.guiaCor), JSON.stringify(est))
  await p.mouse.up(); await espera(p)
  ok('segurar e soltar no mesmo lugar não abre a barra (o clique do fim é ignorado) e não muda nada', (await emRepouso(p)) && (await lado()) === 'esq' && !(await p.locator('.rail-alca[data-movendo]').count()))

  // para a direita, no alto
  await segura(await centro(p, '.rail-alca'), { x: 330, y: 10 }, { soltar: false })
  ok('arrastando: a aba acompanha o dedo e muda de lado ao passar do meio da tela (a guia da direita acende)', (await lado()) === 'dir' && (await p.locator('.rail-guias i.dir[data-ativo]').count()) === 1)
  await p.mouse.up(); await espera(p)
  const aba1 = await rect(p, '.rail-alca')
  ok('solta na direita, encostada no alto', (await lado()) === 'dir' && aba1.x >= 320 && aba1.y >= 7 && aba1.y <= 10, JSON.stringify(aba1))
  ok('a posição fica guardada (lado e altura)', JSON.stringify(await guardado()) === '{"lado":"dir","pos":0}', JSON.stringify(await guardado()))
  const pad = await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.scroll-y')); return [c.paddingLeft, c.paddingRight] })
  ok('com a aba na direita o conteúdo NÃO muda: segue ocupando a tela toda, com 16 px dos dois lados', pad.join() === '16px,16px', pad.join())
  await p.screenshot({ path: 'docs/verificacao-capturas/rail-aba-direita-alto.png' })

  // a barra abre do lado da aba
  await p.click('.rail-alca'); await espera(p)
  const nv = await rect(p, '.nav.rail')
  const dir = await p.evaluate(() => ({ veu: getComputedStyle(document.querySelector('.rail-veu')).visibility, seta: getComputedStyle(document.querySelector('.rail-seta .icon')).transform, noBarra: document.elementFromPoint(330, 120)?.closest('.nav') !== null }))
  ok('aba na direita: a barra de 76 px abre da direita, por cima, com desfoque', Math.abs(nv.x - 284) <= 1 && Math.abs(nv.w - 76) <= 1 && dir.veu === 'visible' && dir.noBarra, JSON.stringify(nv))
  await p.click('.nav .rail-item >> text=Cards'); await espera(p)
  ok('escolher uma tela na barra da direita navega e devolve ao repouso (fora da tela, à direita)', (await p.locator('h1').innerText()) === 'Cards' && (await rect(p, '.nav.rail')).x >= 359)
  await arrasta(p, await centro(p, '.rail-alca'), -90)
  ok('arrastar a aba para dentro da tela (esquerda) abre a barra da direita', await p.locator('.nav.rail').evaluate((e) => Math.abs(e.getBoundingClientRect().right - 360) <= 0.5))
  await arrasta(p, { x: 330, y: 600 }, 90)
  ok('arrastar a barra para a borda (direita) fecha', (await rect(p, '.nav.rail')).x >= 359)
  await abrir(p)
  ok('depois de recarregar a aba continua na direita, no alto', (await lado()) === 'dir' && (await rect(p, '.rail-alca')).y <= 10)

  // para baixo, voltando à esquerda
  await segura(await centro(p, '.rail-alca'), { x: 20, y: 790 })
  const aba2 = await rect(p, '.rail-alca')
  ok('segurar e arrastar para o pé da tela e para a esquerda: fica embaixo, na esquerda', (await lado()) === 'esq' && Math.abs(aba2.y + aba2.h - 792) <= 3 && aba2.x <= 1 && JSON.stringify(await guardado()) === '{"lado":"esq","pos":1}', JSON.stringify(aba2))
  await p.screenshot({ path: 'docs/verificacao-capturas/rail-aba-esquerda-baixo.png' })

  // Esc durante o arrasto desfaz
  await p.mouse.move((await centro(p, '.rail-alca')).x, (await centro(p, '.rail-alca')).y); await p.mouse.down(); await p.waitForTimeout(480)
  await p.mouse.move(300, 100, { steps: 6 }); await p.keyboard.press('Escape'); await p.mouse.up(); await espera(p)
  ok('Esc durante o arrasto cancela: a aba volta para onde estava', (await lado()) === 'esq' && JSON.stringify(await guardado()) === '{"lado":"esq","pos":1}')

  // segurar menos que o tempo é só um toque
  const c1 = await centro(p, '.rail-alca')
  await p.mouse.move(c1.x, c1.y); await p.mouse.down(); await p.waitForTimeout(150); await p.mouse.up(); await espera(p)
  ok('toque curto continua abrindo a barra (não confunde com segurar)', await aberta(p))
  // com a barra aberta, segurar a aba fecha a barra e move
  const c2 = await centro(p, '.rail-alca')
  await segura(c2, { x: 300, y: 300 })
  ok('segurar a aba com a barra aberta fecha a barra e move a aba', (await emRepouso(p)) && (await lado()) === 'dir', `${await lado()}`)

  // dedo de verdade (toque): segurar e arrastar
  const cdp = await ctx.newCDPSession(p)
  const c3 = await centro(p, '.rail-alca')
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c3.x, y: c3.y }] })
  await p.waitForTimeout(520)
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c3.x - (c3.x - 25) * i / 8, y: c3.y + (700 - c3.y) * i / 8 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await espera(p)
  ok('com o dedo (toque): segurar e arrastar para a esquerda e para baixo move a aba', (await lado()) === 'esq' && (await rect(p, '.rail-alca')).y > 500, `${await lado()} y=${(await rect(p, '.rail-alca')).y}`)

  // teclado (Alt + setas)
  await p.focus('.rail-alca')
  await p.keyboard.press('Alt+ArrowRight'); await p.keyboard.press('Alt+ArrowUp'); await p.keyboard.press('Alt+ArrowUp')
  const g = await guardado()
  ok('teclado: Alt + setas troca de lado e sobe a aba, e o leitor de tela é avisado', g.lado === 'dir' && g.pos < 0.85 && /Aba movida na direita/.test(await p.locator('.sr-only[role=status]').innerText()), JSON.stringify(g) + ' ' + (await p.locator('.sr-only[role=status]').innerText()))

  // tela Mais: escolher sem arrastar
  await irPara(p, 'Mais')
  await p.click('.chip >> text=Esquerda'); await p.click('.chip >> text=Em cima')
  ok('Mais → Aba da barra: escolher "Esquerda" e "Em cima" move a aba', (await lado()) === 'esq' && JSON.stringify(await guardado()) === '{"lado":"esq","pos":0}' && (await p.locator('.card.so-celular [role=status]').innerText()).includes('na esquerda, no alto'))
  await p.click('text=Voltar ao padrão')
  ok('"Voltar ao padrão" devolve a aba à esquerda, no meio', (await lado()) === 'esq' && JSON.stringify(await guardado()) === '{"lado":"esq","pos":0.5}')
  await ctx.close()
}

// ================= segurar a aba não faz nada no computador =================
{
  const ctx = await novoContexto(b, { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
  const p = await ctx.newPage(); await abrir(p)
  ok('computador: sem aba (display:none) e o cartão "Aba da barra" não aparece em Mais', (await p.locator('.rail-alca').evaluate((e) => getComputedStyle(e).display)) === 'none')
  await irPara(p, 'Mais')
  ok('…nem a configuração da aba em Mais', !(await p.locator('.card.so-celular').isVisible()))
  await ctx.close()
}

// ================= tema claro: a barra é escura nos dois temas e o desfoque aparece =================
{
  const ctx = await novoContexto(b, { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, colorScheme: 'light' })
  const p = await ctx.newPage(); await abrir(p)
  await p.click('.rail-alca'); await espera(p)
  const c = await p.evaluate(() => ({ barra: getComputedStyle(document.querySelector('.nav.rail')).backgroundColor, folha: getComputedStyle(document.querySelector('.scroll-y')).backgroundColor, ativo: getComputedStyle(document.querySelector('.rail-item[aria-current] .rail-ico')).backgroundColor }))
  ok('tema claro: barra escura sobreposta, folha clara por baixo e destaque amarelo/laranja', c.barra === 'rgb(10, 14, 21)' && c.folha === 'rgb(240, 241, 245)' && c.ativo === 'rgb(240, 178, 60)', JSON.stringify(c))
  await p.screenshot({ path: 'docs/verificacao-capturas/rail-360-aberta-clara.png' })
  await ctx.close()
}

// ================= celular deitado 844×390 e tablet 768×1024 =================
{
  const ctx = await novoContexto(b, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  const p = await ctx.newPage(); await abrir(p)
  await p.click('.rail-alca'); await espera(p)
  const nav = await rect(p, '.nav.rail')
  ok('deitado: barra de 76 px por cima na altura toda e o conteúdo não se mexe', Math.abs(nav.w - 76) <= 1 && Math.abs(nav.h - 390) <= 1 && (await rect(p, '.scroll-y')).w === 844)
  await p.click('.nav .rail-item >> text=Mais'); await espera(p)
  ok('deitado: o último destino (Mais) é alcançável (a lista da barra rola) e a barra volta ao repouso', (await p.locator('h1').innerText()) === 'Mais' && (await emRepouso(p)))
  await p.screenshot({ path: 'docs/verificacao-capturas/rail-844x390.png' })
  await ctx.close()
}
{
  const ctx = await novoContexto(b, { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  const p = await ctx.newPage(); await abrir(p)
  ok('tablet (768 px): também em repouso com a aba', (await emRepouso(p)) && (await p.locator('.rail-alca').isVisible()))
  await ctx.close()
}

// ================= computador 1440×900: trilho fixo =================
{
  const ctx = await novoContexto(b, { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
  const p = await ctx.newPage(); await abrir(p)
  const d = await p.evaluate(() => ({ w: document.querySelector('.nav.rail').getBoundingClientRect().width, x: document.querySelector('.nav.rail').getBoundingClientRect().x, alca: getComputedStyle(document.querySelector('.rail-alca')).display, veu: getComputedStyle(document.querySelector('.rail-veu')).display, inert: document.querySelector('.rail-itens').inert, mainInert: document.querySelector('main').inert }))
  ok('computador: trilho fixo de 96 px, sem aba, sem desfoque e nada inacessível', d.w === 96 && d.x === 0 && d.alca === 'none' && d.veu === 'none' && !d.inert && !d.mainInert, JSON.stringify(d))
  await p.click('.nav .rail-item >> text=Cards'); await p.waitForSelector('h1:has-text("Cards")')
  ok('computador: navegar pelo trilho funciona e o ativo é destacado', (await p.locator('.rail-item[aria-current="page"]').innerText()).trim().toLowerCase() === 'cards')
  await ctx.close()
}

// ================= barras de rolagem: em lugar nenhum =================
for (const [w, h, mobile, nome] of [[1440, 900, false, 'computador'], [390, 844, true, 'celular']]) {
  const ctx = await novoContexto(b, { viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, colorScheme: 'dark' })
  const p = await ctx.newPage(); await abrir(p)
  // uma questão com texto-base (caixa que rola por dentro), tabelas (Desempenho) e a lista de matérias
  const procura = () => p.evaluate(() => {
    const ruins = []; let n = 0
    for (const e of document.querySelectorAll('*')) {
      const cs = getComputedStyle(e)
      if (!e.clientWidth || !e.clientHeight) continue
      const rola = /(auto|scroll)/.test(cs.overflowY + cs.overflowX)
      const faixaV = e.offsetWidth - e.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth)
      const faixaH = e.offsetHeight - e.clientHeight - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth)
      if (rola && e.scrollHeight > e.clientHeight + 1) n++
      if (rola && (faixaV > 0.5 || faixaH > 0.5 || cs.scrollbarWidth !== 'none')) ruins.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} faixa=${Math.round(faixaV)}/${Math.round(faixaH)} scrollbar-width=${cs.scrollbarWidth}`)
    }
    return { ruins: [...new Set(ruins)], n }
  })
  const telas = [['Início', null], ['Desempenho', null], ['Mais', null]]
  const achados = []; let rolantes = 0
  for (const [t] of telas) { await (mobile ? (async () => { await p.locator('.rail-alca').click(); await p.locator('.nav .rail-item', { hasText: t }).click() })() : p.click(`.nav .rail-item >> text=${t}`)); await espera(p, 250); const r = await procura(); achados.push(...r.ruins); rolantes += r.n }
  await (mobile ? (async () => { await p.locator('.rail-alca').click(); await p.locator('.nav .rail-item', { hasText: 'Treinar' }).click() })() : p.click('.nav .rail-item >> text=Treinar'))
  await p.locator('.chip', { hasText: /^Português\d+$/ }).first().click(); await p.click('text=Começar'); await p.waitForSelector('.sheet'); await espera(p, 250)
  { const r = await procura(); achados.push(...r.ruins); rolantes += r.n }
  ok(`${nome}: nenhuma barra de rolagem visível em lugar nenhum (nem na tela, nem nas caixas que rolam por dentro)`, achados.length === 0 && rolantes >= 3, `${rolantes} áreas que rolam examinadas; ${[...new Set(achados)].join(' | ') || 'nenhuma com barra'}`)
  await ctx.close()
}

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
