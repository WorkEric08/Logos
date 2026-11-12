import { chromium } from 'playwright'
import { irPara, novoContexto, esperarMovimento } from './_ctx.mjs'
const base = 'http://localhost:4173/'
const b = await chromium.launch({ channel: 'chrome' })
const out = []; const ok = (n, c, x = '') => { out.push(`${c ? 'OK  ' : 'FALHA'} ${n} ${x}`) }
const ctx = await novoContexto(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const p = await ctx.newPage(); const errs = []; const dialogos = []
p.on('dialog', (d) => { dialogos.push(d.type()); void d.dismiss() })
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await p.goto(base); await p.waitForSelector('.stats')
ok('abre com 1168', (await p.textContent('.stats')).includes('1168'))
// voltar: abrir treino -> voltar fecha sessão
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
await p.goBack(); await p.waitForSelector('.stats')
ok('voltar fecha a sessão', true)
// rodapé da questão: o "Anterior" desativado (1ª questão) é SÓLIDO como o "Próxima": sem opacidade, sem transparência
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
const ant = await p.locator('.foot .btn >> text=Anterior').evaluate((e) => { const c = getComputedStyle(e); return { dis: e.disabled, op: c.opacity, bg: c.backgroundColor } })
ok('"Anterior" desativado é sólido (opacidade 1, fundo opaco)', ant.dis && ant.op === '1' && !/rgba\(.*,\s*0(\.\d+)?\)$/.test(ant.bg), JSON.stringify(ant))
await p.goBack(); await p.waitForSelector('.stats')
// aba -> voltar vai ao início
await irPara(p, 'Treinar'); await p.waitForSelector('text=nos filtros')
await p.goBack(); await p.waitForSelector('.stats')
ok('voltar de aba vai ao início', true)
// início: 1º voltar avisa
await p.goBack().catch(() => {}); await p.waitForTimeout(200)
const t = await p.locator('.toast').first().textContent().catch(() => '')
ok('1º voltar no início avisa', /voltar de novo/.test(t || ''), t)
// responder questão
await p.goto(base); await p.waitForSelector('.stats')
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.click('.alt >> nth=0'); await p.waitForSelector('.fb')
ok('feedback aparece', true)
await p.reload(); await p.waitForSelector('.stats')
ok('progresso persiste (IndexedDB)', !(await p.textContent('.stats')).startsWith('0 /'), (await p.textContent('.stats')).slice(0, 12))
// simulado
await p.click('text=Simulado de 70'); await p.waitForSelector('.sheet')
for (let i = 0; i < 69; i++) { await p.click('.alt >> nth=1'); await p.click('.foot .pri') }
await p.click('.alt >> nth=1'); await p.click('text=Entregar prova'); await p.waitForSelector('.score')
ok('simulado entrega com 70 células', (await p.locator('.cell').count()) === 70)
await p.click('.cell >> nth=3'); await p.waitForSelector('.fb'); ok('revisão mostra gabarito', true)
// zerar + desfazer
await p.goto(base); await p.waitForSelector('.stats')
await irPara(p, 'Mais'); await p.click('text=Zerar tudo'); await p.click('text=Sim, zerar')
await p.click('.toast >> text=Desfazer'); await irPara(p, 'Início')
ok('desfazer restaura', !(await p.textContent('.stats')).startsWith('0 /'))
// migração: progresso salvo com id antigo (2023-1) passa para o id novo, com aviso e cópia de segurança
{
  const c2 = await novoContexto(b, { viewport: { width: 390, height: 844 } })
  const seed = await c2.newPage(); await seed.goto(base + 'icon.svg')
  await seed.evaluate(() => new Promise((res, rej) => {
    const rq = indexedDB.open('treino-bb', 10)
    rq.onupgradeneeded = () => { const d = rq.result; d.createObjectStore('prog', { keyPath: 'id' }); d.createObjectStore('meta', { keyPath: 'key' }) }
    rq.onerror = () => rej(rq.error)
    rq.onsuccess = () => { const tx = rq.result.transaction('prog', 'readwrite'); tx.objectStore('prog').put({ id: '2023-1', n: 2, c: 1, ok: false, last: 'E', t: 1 }); tx.oncomplete = () => { rq.result.close(); res(true) } }
  }))
  await seed.close()
  const m = await c2.newPage(); await m.goto(base); await m.waitForSelector('.folders')
  const aviso = await m.locator('.toast').first().textContent().catch(() => '')
  ok('migração avisa uma vez', /Gabarito corrigido em 1 resposta/.test(aviso || ''), aviso)
  const dados = await m.evaluate(() => new Promise((res) => { const rq = indexedDB.open('treino-bb'); rq.onsuccess = () => { const g = rq.result.transaction('prog').objectStore('prog').getAll(); g.onsuccess = () => { rq.result.close(); res(g.result) } } }))
  ok('progresso foi para o id novo e o antigo sumiu', dados.length === 1 && dados[0].id === 'BB-2023-AC-POR-01', JSON.stringify(dados))
  ok('gabarito corrigido reavaliou a última resposta', dados[0].ok === false && dados[0].c === 0, JSON.stringify(dados[0]))
  ok('cópia de segurança do progresso antigo guardada', !!(await m.evaluate(() => localStorage.getItem('treino_progresso_antes_do_banco_novo'))))
  await c2.close()
}
// migração com FALHA ao gravar (erro de IndexedDB simulado): o app abre, o banco continua com os ids antigos, a cópia existe,
// e na abertura seguinte (sem o erro) a migração conclui sem contar nada em dobro
{
  const c4 = await novoContexto(b, { viewport: { width: 390, height: 844 } })
  const seed = await c4.newPage(); await seed.goto(base + 'icon.svg')
  await seed.evaluate(() => new Promise((res, rej) => {
    const rq = indexedDB.open('treino-bb', 10)
    rq.onupgradeneeded = () => { const d = rq.result; d.createObjectStore('prog', { keyPath: 'id' }); d.createObjectStore('meta', { keyPath: 'key' }) }
    rq.onerror = () => rej(rq.error)
    rq.onsuccess = () => { const tx = rq.result.transaction('prog', 'readwrite'); tx.objectStore('prog').put({ id: '2023-1', n: 2, c: 1, ok: false, last: 'E', t: 1 }); tx.objectStore('prog').put({ id: '2010-26', n: 1, c: 1, ok: true, last: 'A', t: 2 }); tx.oncomplete = () => { rq.result.close(); res(true) } }
  }))
  await seed.close()
  const lerIds = (pg) => pg.evaluate(() => new Promise((res) => { const rq = indexedDB.open('treino-bb'); rq.onsuccess = () => { const g = rq.result.transaction('prog').objectStore('prog').getAll(); g.onsuccess = () => { rq.result.close(); res(g.result.map((r) => r.id).sort()) } } }))
  await c4.addInitScript(() => { if (!sessionStorage.getItem('sem-sabotagem')) IDBObjectStore.prototype.clear = function () { throw new DOMException('disco cheio (simulado)', 'QuotaExceededError') } })
  const f = await c4.newPage(); await f.goto(base); await f.waitForSelector('.folders', { timeout: 15000 })
  const aviso = (await f.locator('.toast').first().textContent().catch(() => '')) ?? ''
  ok('falha ao gravar a migração: o app abre e avisa com clareza', /Não consegui atualizar o banco/.test(aviso), aviso)
  ok('falha ao gravar a migração: o progresso antigo continua intacto no banco', JSON.stringify(await lerIds(f)) === JSON.stringify(['2010-26', '2023-1']))
  ok('falha ao gravar a migração: a cópia de segurança existe e tem os 2 registros', (await f.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('treino_progresso_antes_do_banco_novo')).prog).length)) === 2)
  await f.evaluate(() => sessionStorage.setItem('sem-sabotagem', '1')); await f.reload(); await f.waitForSelector('.folders')
  const aviso2 = (await f.locator('.toast').first().textContent().catch(() => '')) ?? ''
  const ids2 = await lerIds(f)
  ok('na abertura seguinte (sem o erro) a migração conclui', /Gabarito corrigido em 1 resposta/.test(aviso2) && JSON.stringify(ids2) === JSON.stringify(['2010-26', 'BB-2023-AC-POR-01']), `${aviso2} | ${ids2.join(',')}`)
  await c4.close()
}
// "Provas" no Início: tocar numa prova abre o Treinar já filtrado por ela
{
  const c5 = await novoContexto(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const s5 = await c5.newPage()
  await s5.goto(base); await s5.waitForSelector('.folders')
  // Banco → Cargo → provas
  const trilha = () => s5.locator('.crumbs').innerText().then((t) => t.replace(/\s+/g, ' ').trim())
  const rotulos = () => s5.locator('.provas .provas-grupo').first().locator('.file .fname').allInnerTexts() // 1ª lista (Mais novas); as 3 ordens estão em scripts/e2e-treinar.mjs
  ok('Início: título só "Início", sem "Escriturário · Agente Comercial", alinhado à esquerda', (await s5.locator('h1').innerText()) === 'Início' && (await s5.locator('.top small').count()) === 0 && !(await s5.locator('body').innerText()).includes('Escriturário · Agente Comercial') && (await s5.locator('.top').evaluate((e) => getComputedStyle(e).textAlign)) !== 'right')
  const bancos = await s5.locator('.provas .folders .fnm').allInnerTexts()
  ok('provas: 1º nível lista os 5 bancos', JSON.stringify(bancos) === JSON.stringify(['Banco do Brasil', 'Caixa', 'BNB', 'Banco da Amazônia', 'Banese']), bancos.join(','))
  await s5.locator('.provas .folder', { hasText: 'Banco do Brasil' }).click()
  const cargos = await s5.locator('.provas .folders .fnm').allInnerTexts()
  ok('2º nível: cargos do banco (Agente Comercial e TI) e trilha', JSON.stringify(cargos) === JSON.stringify(['Agente Comercial', 'TI']) && (await trilha()) === 'Bancos › Banco do Brasil')
  await s5.locator('.provas .folder', { hasText: 'Agente Comercial' }).click()
  const novas = await rotulos()
  ok('3º nível: todas as provas de Agente Comercial do BB, da mais nova para a mais antiga', novas.length === 8 && novas[0].startsWith('BB 2023') && novas[novas.length - 1].startsWith('BB 2010') && (await trilha()) === 'Bancos › Banco do Brasil › Agente Comercial', novas.join(' | '))
  const antigas = await s5.locator('.provas .provas-grupo').nth(1).locator('.file .fname').allInnerTexts()
  ok('"Mais antigas" (2ª lista, com título e sem botão) é a mesma lista ao contrário', JSON.stringify(antigas) === JSON.stringify([...novas].reverse()) && (await s5.locator('.provas .provas-titulo').nth(1).evaluate((e) => e.textContent.trim())) === 'Mais antigas')
  await s5.goBack(); await s5.waitForTimeout(200)
  ok('voltar sobe um nível (Cargo), não sai do Início', (await trilha()) === 'Bancos › Banco do Brasil' && (await s5.locator('h1').innerText()) === 'Início')
  await s5.goBack(); await s5.waitForTimeout(200)
  ok('voltar de novo sobe para os Bancos', (await trilha()) === 'Bancos')
  await s5.locator('.provas .folder', { hasText: 'Caixa' }).click(); await s5.locator('.provas .folder:has(.fnm:text-is("TI"))').click()
  ok('TI da Caixa: só as provas de TI', (await rotulos()).length === 1 && /TI/.test((await rotulos())[0]), (await rotulos()).join('|'))
  await s5.locator('.crumbs button', { hasText: 'Bancos' }).click()
  await s5.locator('.provas .folder', { hasText: 'Banco do Brasil' }).click(); await s5.locator('.provas .folder', { hasText: 'Agente Comercial' }).click()
  await s5.locator('.file', { hasText: 'BB 2023' }).first().click(); await s5.waitForSelector('text=nos filtros')
  ok('tocar numa prova do Início abre o Treinar filtrado por ela', (await s5.locator('.chip[aria-pressed=true]', { hasText: /^BB 2023/ }).count()) === 1 && (await s5.textContent('.top small')).startsWith('70 questões'))
  ok('sem efeito de esticar nas pontas (overscroll-behavior: none na página e nas áreas rolantes)', await s5.evaluate(() => ['html', 'body', '.scroll-y'].every((q) => getComputedStyle(document.querySelector(q)).overscrollBehaviorY === 'none')))
  await c5.close()
}
// filtros do Treinar alinhados: cada grupo é uma grade de colunas iguais (mesmo x e mesma largura nas colunas)
for (const [w, mobile] of [[390, true], [1440, false]]) {
  const c6 = await novoContexto(b, { viewport: { width: w, height: 900 }, hasTouch: mobile, isMobile: mobile }); const s6 = await c6.newPage()
  await s6.goto(base); await s6.waitForSelector('.folders'); await irPara(s6, 'Treinar'); await s6.waitForSelector('.filters')
  await s6.locator('.filters .chip', { hasText: /^Estatística/ }).first().click()
  const grupos = await s6.locator('.filters .chips').evaluateAll((gs) => gs.map((g) => { const cs = [...g.querySelectorAll('.chip')].map((e) => e.getBoundingClientRect()); return { qtd: g.classList.contains('qtd'), n: cs.length, xs: [...new Set(cs.map((r) => Math.round(r.x)))].length, ws: [...new Set(cs.map((r) => Math.round(r.width)))].length, fora: cs.some((r) => r.right > g.getBoundingClientRect().right + 1) } }))
  ok(`Treinar a ${w} px: os filtros são grades — todos os botões de um grupo têm a mesma largura e ficam em poucas colunas (≤ ${mobile ? 4 : 6}; a Quantidade, de até 6, fica numa linha só por pedido), sem estourar`, grupos.length === 6 && grupos.every((g) => g.ws <= 2 && g.xs <= (g.qtd ? 6 : mobile ? 4 : 6) && !g.fora), JSON.stringify(grupos))
  await c6.close()
}
// questão com imagem (Estatística): imagem aparece, alternativas viram letras
{
  const c3 = await novoContexto(b, { viewport: { width: 390, height: 844 } })
  const s = await c3.newPage(); await s.goto(base); await s.waitForSelector('.folders')
  // Banco da Amazônia 2024, Estatística, ordem da prova: a 4ª questão (nº 39) é só imagem (página inteira)
  await irPara(s, 'Treinar'); await s.click('.chip >> text=Estatística'); await s.locator('.chip', { hasText: 'Banco da Amazônia 2024' }).first().click()
  await s.locator('.chip', { hasText: 'Ordem da prova' }).click(); await s.click('text=Começar')
  await s.waitForSelector('.sheet')
  for (let i = 0; i < 3; i++) await s.click('.foot .pri')
  await s.waitForSelector('.qimg')
  await s.waitForFunction(() => { const i = document.querySelector('.qimg'); return i && i.complete && i.naturalWidth > 100 }, null, { timeout: 10000 }).catch(() => {})
  ok('questão com imagem mostra a imagem carregada', await s.evaluate(() => { const i = document.querySelector('.qimg'); return !!i && i.complete && i.naturalWidth > 100 }))
  ok('alternativas só em letras', (await s.locator('.alts.letras .alt').count()) === 5 && (await s.locator('.alts.letras .alt .tx').count()) === 0)
  ok('página inteira tem link para ampliar', (await s.locator('.qfig a[target=_blank]').count()) === 1 && (await s.locator('.qfig figcaption').count()) === 1)
  await c3.close()
}
// overflow e corte em vários tamanhos / temas
for (const [w, h] of [[320, 568], [360, 740], [390, 844], [768, 1024], [1440, 900]]) {
  for (const tema of ['light', 'dark']) {
    const c = await novoContexto(b, { viewport: { width: w, height: h }, colorScheme: tema })
    const q = await c.newPage(); await q.goto(base); await q.waitForSelector('.folders')
    const res = []
    for (const tab of ['Início', 'Treinar', 'Desempenho', 'Mais']) {
      await irPara(q, `${tab}`); await esperarMovimento(q); res.push(await q.evaluate(() => document.documentElement.scrollWidth - innerWidth + (document.querySelector('.scroll-y').scrollWidth - document.querySelector('.scroll-y').clientWidth)))
    }
    await irPara(q, 'Início'); await irPara(q, 'Treinar'); await q.click('text=Começar'); await esperarMovimento(q); res.push(await q.evaluate(() => document.querySelector('.scroll-y').scrollWidth - document.querySelector('.scroll-y').clientWidth))
    ok(`sem rolagem lateral ${w}px ${tema}`, res.every((x) => x <= 0), res.join(','))
    await c.close()
  }
}
// offline
await p.goto(base); await p.waitForSelector('.stats'); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(3000)
await ctx.setOffline(true); await p.reload(); await p.waitForSelector('.stats')
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
ok('funciona offline', true)
ok('sem erros no console', errs.filter((e) => !/Failed to load resource/.test(e)).length === 0, errs.join(' | '))
ok('nenhum alert/confirm/prompt apareceu durante todo o teste', dialogos.length === 0, dialogos.join(','))
// Painel da direita: coluna só em tela larga
{
  const c = await novoContexto(b, { viewport: { width: 1100, height: 800 } }); const q = await c.newPage(); await q.goto(base); await q.waitForSelector('.folders')
  ok('painel: abaixo de 1180 px não existe a coluna (o painel fica no fluxo da página)', (await q.locator('.slot').isVisible()) === false)
  await c.close()
}
// Desempenho (onde ficam os cartões de matéria) em monitor grande: sem vazio entre o conteúdo e o painel, 6 cartões por linha, sem estourar
for (const [w, h, colunas] of [[1902, 911, 6], [2560, 1300, 6], [1440, 900, 3]]) {
  const c = await novoContexto(b, { viewport: { width: w, height: h } }); const q = await c.newPage()
  await q.goto(base); await q.waitForSelector('.folders'); await q.waitForSelector('.slot .side-in')
  if (w === 1440) ok('Início: as pastas dos 5 bancos (e, abaixo, “Por matéria” no monitor)', (await q.locator('text=Matérias · peso na prova').count()) === 0 &&JSON.stringify(await q.locator('.provas .folder .fnm').allInnerTexts()) === JSON.stringify(['Banco do Brasil', 'Caixa', 'BNB', 'Banco da Amazônia', 'Banese']))
  // 2026-11-10: no monitor os cartões de matéria moram no Início (abaixo das pastas dos bancos); o Desempenho não os repete (ver e2e-inicio-largo.mjs)
  const c0 = await q.evaluate(() => ({ cols: getComputedStyle(document.querySelector('.wide-only .folders')).gridTemplateColumns.split(' ').length, cartao: document.querySelector('.wide-only .folder').getBoundingClientRect().width, lateral: document.documentElement.scrollWidth - innerWidth }))
  ok(`Início a ${w} px: ${colunas} cartões de matéria por linha, cartão ≥ 200 px, sem rolagem lateral`, c0.cols === colunas && c0.cartao >= 200 && c0.lateral <= 0, JSON.stringify(c0))
  await irPara(q, 'Desempenho'); await q.waitForSelector('.slot .side-in')
  const m = await q.evaluate(() => {
    const col = document.querySelector('.col').getBoundingClientRect(), slot = document.querySelector('.slot').getBoundingClientRect()
    return { vazio: slot.x - col.right, lateral: document.documentElement.scrollWidth - innerWidth }
  })
  ok(`Desempenho a ${w} px: sem rolagem lateral`, m.lateral <= 0, JSON.stringify(m))
  ok(`Desempenho a ${w} px: sem vazio entre o conteúdo e o painel`, w >= 2560 ? m.vazio <= 100 : m.vazio <= 41, `${Math.round(m.vazio)} px`)
  if (w === 1440) ok('painel com largura fixa de 340 px e sem alça de redimensionar', Math.abs((await q.locator('.slot').evaluate((e) => e.getBoundingClientRect().width)) - 340) <= 1 && (await q.locator('.resizer, [role=separator]').count()) === 0)
  if (w === 2560) {
    for (const aba of ['Início', 'Treinar']) { // (Mais não tem painel lateral; Desempenho já foi medido acima)
      await irPara(q, `${aba}`); await q.waitForSelector('.slot .side-in')
      const t = await q.evaluate(() => ({ vazio: document.querySelector('.slot').getBoundingClientRect().x - document.querySelector('.col').getBoundingClientRect().right, lateral: document.documentElement.scrollWidth - innerWidth }))
      ok(`${aba} a 2560 px: usa a largura (sem vazio entre o conteúdo e o painel) e sem rolagem lateral`, t.vazio <= 100 && t.lateral <= 0, JSON.stringify(t))
    }
  }
  await c.close()
}
// O documento (a janela do navegador) nunca rola: só a área de conteúdo rola por dentro. Em Desempenho já houve rolagem dupla (tabela escondida solta na página).
for (const w of [390, 1000, 1440, 1920]) {
  const c = await novoContexto(b, { viewport: { width: w, height: 900 } }), q = await c.newPage()
  await q.goto(base); await q.waitForSelector('.folders')
  const sobra = {}
  for (const aba of ['Início', 'Treinar', 'Desempenho', 'Mais']) {
    await irPara(q, `${aba}`); await q.waitForTimeout(150)
    sobra[aba] = await q.evaluate(() => document.documentElement.scrollHeight - innerHeight)
  }
  ok(`a ${w} px a janela não rola em nenhuma aba (só o conteúdo)`, Object.values(sobra).every((v) => v <= 0), JSON.stringify(sobra))
  await c.close()
}
// PWA instalável: manifesto completo, ícones existem com o tamanho declarado, meta tags
{
  const c = await novoContexto(b, { viewport: { width: 390, height: 844 } }); const q = await c.newPage(); await q.goto(base); await q.waitForSelector('.folders')
  const href = await q.evaluate(() => document.querySelector('link[rel=manifest]')?.href)
  const man = await (await q.request.get(href)).json()
  ok('manifesto: nome, modo standalone, início, escopo e cores', man.name === 'Logos' && man.display === 'standalone' && !!man.start_url && !!man.scope && !!man.theme_color && !!man.background_color && man.lang === 'pt-BR', JSON.stringify({ n: man.name, d: man.display, s: man.start_url }))
  const tam = []
  for (const ic of man.icons) { const r = await q.request.get(new URL(ic.src, href).href); const buf = await r.body(); tam.push(`${ic.sizes}:${r.status()}:${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`) }
  ok('manifesto: ícones 192 e 512 existem e têm o tamanho declarado', man.icons.some((i) => i.sizes === '192x192') && man.icons.some((i) => i.sizes === '512x512') && tam.every((t) => { const [s, st, d] = t.split(':'); return st === '200' && d === s }), tam.join(' '))
  ok('meta: viewport, theme-color e descrição', await q.evaluate(() => !!document.querySelector('meta[name=viewport]') && !!document.querySelector('meta[name=theme-color]') && !!document.querySelector('meta[name=description]')))
  await c.close()
}
// tema sem piscar: a escolha salva (ou o tema do aparelho) vale já na primeira pintura, antes do app montar
for (const [salvo, aparelho, esperado] of [['dark', 'light', 'rgb(15, 19, 26)'], ['light', 'dark', 'rgb(240, 241, 245)'], [null, 'dark', 'rgb(15, 19, 26)'], [null, 'light', 'rgb(240, 241, 245)']]) {
  const c = await novoContexto(b, { viewport: { width: 390, height: 844 }, colorScheme: aparelho })
  await c.addInitScript((t) => { if (t) localStorage.setItem('treino_tema', t); window.__cores = new Set(); const f = () => { if (document.body) window.__cores.add(getComputedStyle(document.body).backgroundColor); requestAnimationFrame(f) }; f() }, salvo)
  const q = await c.newPage(); await q.goto(base, { waitUntil: 'domcontentloaded' })
  const logo = await q.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await q.waitForSelector('.folders'); await q.waitForTimeout(300)
  const cores = await q.evaluate(() => [...window.__cores])
  ok(`tema ${salvo ?? 'do aparelho'} com aparelho ${aparelho}: sem piscar`, logo === esperado && cores.length === 1 && cores[0] === esperado, `1ª pintura ${logo}; cores vistas até abrir: ${cores.join(' | ')}`)
  await c.close()
}
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0)
