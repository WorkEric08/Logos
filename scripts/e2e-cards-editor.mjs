// Editor de cartões no celular (2026-11-09): "Cartão salvo" some em 1,5 s sem mexer em nada; com o teclado aberto dá para rolar até o verso
// (o teclado só cobre; a altura dele vira --teclado e só aumenta o espaço de rolagem); criar vários cartões em sequência (continuando ou
// saindo) não acumula nada; o cartão é sempre do baralho em que a pessoa está (sem escolher outro baralho).
// Precisa do app em http://localhost:4173/. Uso: node scripts/e2e-cards-editor.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'
import { cartao, conjuntoPadrao, semearCards } from './_cards-seed.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const TECLADO = 300 // altura simulada do teclado (px)
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 390, height: 520 }, hasTouch: true, isMobile: true, colorScheme: 'dark' })
const p = await ctx.newPage()
const erros = []; p.on('pageerror', (e) => erros.push(e.message))
const cdp = await ctx.newCDPSession(p)
const teclado = (px) => p.evaluate((px) => document.documentElement.style.setProperty('--teclado', px + 'px'), px)
const rect = (sel) => p.locator(sel).evaluate((e) => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height) } })
const rolo = () => p.evaluate(() => { const s = document.querySelector('.scroll-y'); return { st: Math.round(s.scrollTop), max: s.scrollHeight - s.clientHeight } })
const arrastar = async (x, y0, y1) => { // o dedo sobe da posição y0 até y1 (rola a página para baixo)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / 12 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.waitForTimeout(450)
}

await p.goto(base); await p.waitForSelector('.folders')
await semearCards(p, conjuntoPadrao())
await irPara(p, 'Cards'); await p.waitForSelector('.deck')
await p.locator('.deck', { hasText: 'Siglas do Sistema' }).locator('.deck-abrir').evaluate((e) => e.click()); await p.waitForSelector('.fcacoes')
const antes = await p.locator('.fcrow').count()

// ---- sem escolher outro baralho ----
await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf'); await p.waitForTimeout(350)
ok('há 3 baralhos, mas o novo cartão não pergunta o baralho: só frente e verso (é do baralho aberto)', (await p.locator('.fcform .chip, .fcform [role=group], .fcform .lb').count()) === 0 && (await p.locator('.fcform textarea').count()) === 2 && !(await p.locator('body').innerText()).toLowerCase().includes('baralho do cartão'))

// ---- "Cartão salvo" some em 1,5 s e nada se mexe ----
const antesTudo = { cf: await rect('#cf'), cv: await rect('#cv'), foot: await rect('.foot.sticky'), form: await rect('.fcform') }
await p.fill('#cf', 'Primeira pergunta'); await p.fill('#cv', 'Primeira resposta')
const t0 = Date.now()
await p.click('text=Salvar e criar outro')
await p.waitForFunction(() => /Cartão salvo/.test(document.querySelector('.top small')?.textContent ?? ''), null, { timeout: 2000 })
const logo = { cf: await rect('#cf'), cv: await rect('#cv'), foot: await rect('.foot.sticky'), form: await rect('.fcform') }
ok('"Cartão salvo. Escreva o próximo." aparece logo depois de salvar', /Cartão salvo\. Escreva o próximo\./.test(await p.locator('.top small').innerText()))
await p.waitForFunction(() => !/Cartão salvo/.test(document.querySelector('.top small')?.textContent ?? ''), null, { timeout: 4000, polling: 20 })
const dur = Date.now() - t0
ok('a mensagem some em 1,5 s (medido entre 1,35 s e 1,8 s)', dur >= 1350 && dur <= 1800, `${dur} ms`)
const depois = { cf: await rect('#cf'), cv: await rect('#cv'), foot: await rect('.foot.sticky'), form: await rect('.fcform') }
ok('ao aparecer e ao sumir a mensagem, NADA se mexe: campos, formulário e botões do pé ficam no mesmo lugar', JSON.stringify(antesTudo) === JSON.stringify(logo) && JSON.stringify(logo) === JSON.stringify(depois), JSON.stringify({ antesTudo, logo, depois }))
ok('depois disso o subtítulo volta ao contador "1 cartão criado nesta sessão"', (await p.locator('.top small').innerText()) === '1 cartão criado nesta sessão')
ok('não sobra nenhum aviso solto na página', (await p.locator('.fcok').count()) === 0)

// ---- teclado aberto: dá para rolar até o verso ----
const semTeclado = await rolo()
const peAntes = await rect('.foot.sticky')
await teclado(TECLADO); await p.waitForTimeout(300)
ok('REGRA: com o teclado aberto os botões do pé NÃO sobem para cima dele (ficam onde estavam, por baixo)', JSON.stringify(await rect('.foot.sticky')) === JSON.stringify(peAntes), JSON.stringify({ antes: peAntes, depois: await rect('.foot.sticky') }))
const comTeclado = await rolo()
ok(`com o teclado (${TECLADO} px) o espaço de rolagem cresce no fim, sem mexer em nada que está na tela`, comTeclado.max - semTeclado.max >= TECLADO - 2 && comTeclado.st === semTeclado.st && JSON.stringify(await rect('#cf')) === JSON.stringify(depois.cf), `${semTeclado.max} → ${comTeclado.max}`)
const cobre = (await rect('#cv')).b > 520 - TECLADO
ok('(preparo) sem rolar, o verso fica atrás do teclado', cobre, JSON.stringify(await rect('#cv')))
await p.locator('#cf').focus()
await arrastar(200, 330, 60) // o dedo COMEÇA em cima do campo da pergunta (era aí que a rolagem "não descia")
const rolou = await rolo()
ok('arrastar com o dedo a partir do campo da pergunta rola a página para baixo', rolou.st > 100, `rolou ${rolou.st} px`)
await p.evaluate(() => { document.querySelector('.scroll-y').scrollTop = 0 }); await p.waitForTimeout(100)
const preciso = (await rect('#cv')).b - (520 - TECLADO) // quanto rolar para o verso caber acima do teclado
await p.evaluate((y) => { document.querySelector('.scroll-y').scrollTop = y }, preciso); await p.waitForTimeout(150)
const verso = await rect('#cv'), pe = await rect('.foot.sticky')
ok(`rolando ${preciso} px (o máximo é ${(await rolo()).max}) o campo do verso fica inteiro acima do teclado e dá para tocar nele`, preciso > 0 && preciso <= (await rolo()).max && verso.b <= 520 - TECLADO + 1 && verso.t >= 0, JSON.stringify(verso))
await p.locator('#cv').click(); await p.keyboard.type('Escrevi no verso')
ok('…e digitar no verso funciona', (await p.inputValue('#cv')) === 'Escrevi no verso')
await p.fill('#cv', '')
ok('com a página rolada até o verso, os botões do pé continuam por baixo do teclado (não subiram)', pe.t >= 520 - TECLADO - 1, JSON.stringify(pe))
await p.evaluate(() => { const s = document.querySelector('.scroll-y'); s.scrollTop = s.scrollHeight }); await p.waitForTimeout(150)
const peFim = await rect('.foot.sticky')
ok('só rolando até o fim do conteúdo os botões do pé aparecem, acima do teclado', peFim.b <= 520 - TECLADO + 1, JSON.stringify(peFim))
await p.evaluate((y) => { document.querySelector('.scroll-y').scrollTop = y }, 0)

// ---- vários cartões em sequência: continuando e saindo ----
await p.evaluate(() => { document.querySelector('.scroll-y').scrollTop = 0 })
const base0 = await rect('#cf')
let falhou = ''
for (let i = 1; i <= 6; i++) {
  await p.fill('#cf', `Seq ${i} pergunta`); await p.fill('#cv', `Seq ${i} resposta`)
  await p.click('text=Salvar e criar outro'); await p.waitForTimeout(150)
  const e = await p.evaluate(() => ({ cf: document.getElementById('cf').value, cv: document.getElementById('cv').value, foco: document.activeElement?.id, dom: document.querySelectorAll('.fcform textarea').length, avisos: document.querySelectorAll('.fcok, [role=status]').length }))
  const r = await rect('#cf'), sc = await rolo()
  if (e.cf !== '' || e.cv !== '' || e.foco !== 'cf' || e.dom !== 2 || r.t !== base0.t || sc.st !== 0) falhou += ` #${i} ${JSON.stringify({ ...e, topo: r.t, rolagem: sc.st })}`
  // com a mensagem na tela e com o teclado, o verso continua alcançável
  await p.evaluate(() => { const s = document.querySelector('.scroll-y'); s.scrollTop = s.scrollHeight }); await p.waitForTimeout(80)
  if ((await rect('#cv')).b > 520 - TECLADO + 1) falhou += ` #${i} verso inalcançável`
  await p.evaluate(() => { document.querySelector('.scroll-y').scrollTop = 0 })
}
ok('6 cartões em sequência ("Salvar e criar outro"): campos limpos, foco na pergunta, nada se desloca e o verso sempre alcançável com o teclado', falhou === '', falhou)
await p.waitForTimeout(1700)
ok('…e depois de 1,5 s o subtítulo é só o contador (7 criados nesta sessão)', (await p.locator('.top small').innerText()) === '7 cartões criados nesta sessão', await p.locator('.top small').innerText())
await p.fill('#cf', 'Último e sai'); await p.fill('#cv', 'Salvando e saindo')
await p.click('.foot >> text=Salvar >> nth=-1'); await p.waitForSelector('.fcacoes')
await teclado(0)
ok('"Salvar" (sem continuar) volta ao baralho com os 8 cartões novos na lista (1 + 6 + o último)', (await p.locator('.fcrow').count()) === antes + 8, `${antes} → ${await p.locator('.fcrow').count()}`)
// de novo, entrando e saindo várias vezes (salvando e saindo)
for (let i = 1; i <= 3; i++) {
  await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf'); await teclado(TECLADO)
  await p.fill('#cf', `Sai ${i}`); await p.fill('#cv', `Resp ${i}`); await p.click('.foot >> text=Salvar >> nth=-1'); await p.waitForSelector('.fcacoes'); await teclado(0)
}
ok('entrar, salvar e sair 3 vezes seguidas: 3 cartões a mais, sempre de volta ao baralho', (await p.locator('.fcrow').count()) === antes + 11 && (await p.locator('.fcacoes').count()) === 1)
await p.evaluate(() => history.back()); await p.waitForTimeout(250)
ok('e o voltar do aparelho depois disso leva à lista de baralhos (não ao Início)', (await p.locator('.deck').count()) >= 3 && (await p.locator('h1').innerText()) === 'Cards')

// ---- editar um cartão existente continua no mesmo baralho ----
await p.locator('.deck', { hasText: 'Siglas do Sistema' }).locator('.deck-abrir').evaluate((e) => e.click()); await p.waitForSelector('.fcacoes')
await p.locator('.fcedit').first().click(); await p.waitForSelector('#cf')
ok('editar um cartão: só frente e verso, sem escolher baralho', (await p.locator('.fcform textarea').count()) === 2 && (await p.locator('.fcform .chip').count()) === 0)

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
