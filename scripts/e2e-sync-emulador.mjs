// F6.0 — a sincronização que JÁ existe (cartões, progresso, exclusão, offline, zerar/desfazer) com DOIS "aparelhos" (dois contextos de navegador) e o Firebase de MENTIRA
// (emuladores de Auth e Firestore, sem tocar no projeto real). Sobe os emuladores se não estiverem no ar. Precisa do app em http://localhost:4173/ (npx vite preview --port 4173).
// Uso: node scripts/e2e-sync-emulador.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto, esperarMovimento } from './_ctx.mjs'
import { garantirEmuladores, limparEmuladores, lerColecao, novoAparelho, uidDoAparelho } from './_emulador.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const emu = await garantirEmuladores()
await limparEmuladores()
const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const abrir = async (email) => {
  const ctx = await novoAparelho(b, novoContexto, { email })
  const p = await ctx.newPage(); p.setDefaultTimeout(20000)
  p.on('pageerror', (e) => erros.push(e.message))
  await p.goto(base); await p.waitForSelector('.folders')
  return { ctx, p }
}
const esperar = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 250)) } return false }
const entrar = async (p) => {
  await irPara(p, 'Mais'); await p.waitForSelector('.conta')
  await p.getByRole('button', { name: 'Entrar com Google' }).click()
  await p.waitForSelector('[data-testid=conta-email]')
  await esperar(async () => /Sincronizado/.test(await p.locator('[data-testid=conta-situacao]').innerText()))
}
const vistas = async (p) => { await irPara(p, 'Início'); await p.waitForSelector('.stats'); return Number((await p.locator('.stats .stat b').first().innerText()).trim()) }
const baralhos = async (p) => { await irPara(p, 'Cards'); await p.waitForSelector('h1:has-text("Cards")'); await esperarMovimento(p); return (await p.locator('main').innerText()).replace(/\s+/g, ' ') }

const A = await abrir('alice@teste.com'), B = await abrir('alice@teste.com')
await entrar(A.p); await entrar(B.p)
ok('os dois aparelhos entram na mesma conta (emulador) e ficam "Sincronizado"', /alice@teste.com/.test(await A.p.locator('[data-testid=conta-email]').innerText()) && /Sincronizado/.test(await B.p.locator('[data-testid=conta-situacao]').innerText()))

// a tela da conta (Mais) com a sincronização ligada, em 320 px: nada cortado, botões de 44 px (F6.5)
await A.p.setViewportSize({ width: 320, height: 568 }); await irPara(A.p, 'Mais'); await A.p.waitForSelector('[data-testid=conta-pacotes]')
const cc = await A.p.evaluate(() => { const card = document.querySelector('.conta'), cr = card.getBoundingClientRect(); const f = [...card.querySelectorAll('button, p, h3, span')].map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height, corte: e.scrollWidth > e.clientWidth + 1, botao: e.tagName === 'BUTTON' } }); return { dentro: f.every((x) => x.l >= cr.left - 0.5 && x.r <= cr.right + 0.5 && !x.corte), botoes: f.filter((x) => x.botao).every((x) => x.h >= 44 - 0.5), pagina: document.documentElement.scrollWidth > innerWidth } })
ok('320 px: a tela da conta com o andamento dos pacotes e "Sincronizar tudo de novo" não corta texto nem estoura, botões ≥ 44 px', cc.dentro && cc.botoes && !cc.pagina, JSON.stringify(cc))
await A.p.setViewportSize({ width: 390, height: 844 })

// 1. cartão criado no A aparece no B
await irPara(A.p, 'Cards'); await A.p.waitForSelector('h1:has-text("Cards")')
await A.p.click('text=Criar o primeiro baralho'); await A.p.fill('#nb', 'Siglas'); await A.p.click('text=Criar baralho'); await A.p.waitForSelector('.fcacoes')
await A.p.click('.btn >> text=Novo cartão'); await A.p.waitForSelector('#cf'); await A.p.fill('#cf', 'BCB'); await A.p.fill('#cv', 'Banco Central do Brasil')
await A.p.click('.foot >> text=Salvar >> nth=-1'); await A.p.waitForSelector('.fcacoes')
ok('baralho e cartão criados no A aparecem no B', await esperar(async () => /Siglas/.test(await baralhos(B.p))))
const uid = await uidDoAparelho(A.p)
ok('(nuvem) o emulador guarda o baralho e o cartão em users/<uid>/itens', !!uid && (await esperar(async () => (await lerColecao(`users/${uid}/itens`)).length >= 2)))

// 2. resposta do A chega ao B
await irPara(A.p, 'Início'); await A.p.waitForSelector('.folders'); await A.p.locator('.tile', { hasText: 'Treino rápido' }).click(); await A.p.waitForSelector('.sheet')
for (let i = 0; i < 3; i++) { await A.p.locator('.alt:not([disabled])').first().click(); await A.p.locator('.foot .btn.pri').click(); await A.p.waitForTimeout(150) }
await A.p.click('.btn >> text=Sair'); await A.p.waitForSelector('.folders')
ok('3 respostas dadas no A chegam ao B (3 questões vistas)', await esperar(async () => (await vistas(B.p)) === 3), 'vistas no B: ' + (await vistas(B.p)))

// 3. apagar baralho no A apaga no B
await irPara(A.p, 'Cards'); await A.p.waitForSelector('.deck'); await A.p.locator('.deck-abrir').first().evaluate((e) => e.click()); await A.p.waitForSelector('.fcacoes')
await A.p.click('text=Excluir este baralho'); await A.p.click('text=Sim, excluir'); await A.p.waitForSelector('h1')
ok('baralho apagado no A some do B', await esperar(async () => !/Siglas/.test(await baralhos(B.p))))

// 4. B offline estuda e volta
await irPara(A.p, 'Cards'); await A.p.waitForSelector('h1:has-text("Cards")')
await A.p.getByRole('button', { name: /Novo baralho|Criar o primeiro baralho/ }).first().click(); await A.p.fill('#nb', 'Offline'); await A.p.click('text=Criar baralho'); await A.p.waitForSelector('.fcacoes')
await esperar(async () => /Offline/.test(await baralhos(B.p)))
await B.ctx.setOffline(true)
await irPara(B.p, 'Cards'); await B.p.waitForSelector('.deck'); await B.p.locator('.deck-abrir').first().evaluate((e) => e.click()); await B.p.waitForSelector('.fcacoes')
await B.p.click('.btn >> text=Novo cartão'); await B.p.waitForSelector('#cf'); await B.p.fill('#cf', 'Feito offline'); await B.p.fill('#cv', 'chega depois'); await B.p.click('.foot >> text=Salvar >> nth=-1'); await B.p.waitForSelector('.fcacoes')
await B.ctx.setOffline(false)
await irPara(A.p, 'Cards'); await A.p.waitForSelector('.deck'); await A.p.locator('.deck-abrir').first().evaluate((e) => e.click()); await A.p.waitForSelector('.fcacoes')
ok('cartão criado no B sem internet chega ao A quando a internet volta', await esperar(async () => /Feito offline/.test(await A.p.locator('main').innerText()), 30000))

// 5. zerar e desfazer
await irPara(B.p, 'Mais'); await B.p.click('text=Zerar tudo'); await B.p.click('text=Sim, zerar')
ok('"Zerar tudo" no B zera também o A', await esperar(async () => (await vistas(A.p)) === 0), 'vistas no A: ' + (await vistas(A.p)))
await irPara(B.p, 'Início'); await B.p.waitForSelector('.stats')
await B.p.locator('.toast').getByRole('button', { name: 'Desfazer' }).click().catch(() => {})
ok('"Desfazer" do zerar devolve o progresso nos dois', await esperar(async () => (await vistas(A.p)) === 3 && (await vistas(B.p)) === 3), `A ${await vistas(A.p)} · B ${await vistas(B.p)}`)

// 6. F6.3a — leitura incremental: um aparelho que volta NÃO lê a conta inteira de novo
const DIA = 86_400_000, agora = Date.now()
const POST = (col, id, campos) => fetch(`http://127.0.0.1:8080/v1/projects/logos-f9d33/databases/(default)/documents/users/${uid}/${col}?documentId=${encodeURIComponent(id)}`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: campos }) })
const I = (n) => ({ integerValue: String(Math.round(n)) })
for (let i = 0; i < 100; i++) { const u = agora - (100 - i) * DIA; await POST('itens', 'm:qvelha' + i, { u: I(u), dev: { stringValue: 'dAntigo' }, v: { mapValue: { fields: { r: { booleanValue: true }, t: I(u) } } } }) }
const lidos = async (p) => p.evaluate(() => ({ ...(globalThis.__logosLeituras ?? {}) }))
const C = await abrir('alice@teste.com'); await entrar(C.p)
const primeira = await lidos(C.p)
ok('a primeira vez num aparelho novo lê tudo (≥ 100 itens da conta)', (primeira.itens ?? 0) >= 100, JSON.stringify(primeira))
// reabre como depois de 30+ min sem conexão: o cache do Firestore já não vale (o caso que cobraria a conta inteira de novo)
await C.p.evaluate(async () => { for (const d of await indexedDB.databases()) if (d.name?.startsWith('firestore/')) indexedDB.deleteDatabase(d.name) })
await C.p.reload(); await C.p.waitForSelector('.folders'); await C.p.waitForTimeout(3000)
const segunda = await lidos(C.p)
ok('na abertura seguinte, mesmo com o cache do Firestore vazio, lê só a janela recente (menos de 25 itens, não os 100+ da conta)', (segunda.itens ?? 0) < 25 && (segunda.itens ?? 0) > 0, JSON.stringify(segunda))
await irPara(C.p, 'Início'); await esperar(async () => (await vistas(C.p)) === 3) // o que já estava na conta continua certo depois de reabrir
ok('depois de reabrir, o progresso (3 vistas) continua igual, vindo do que o aparelho já guardava', (await vistas(C.p)) === 3)

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n'))
await b.close(); emu.parar()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
