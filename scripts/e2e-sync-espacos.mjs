// F6.3 — espaços, questões e materiais pela conta Google com DOIS "aparelhos" e o Firebase de MENTIRA (emuladores, sem tocar no projeto real):
// o A cria um espaço, importa uma prova de verdade (PDF gerado pelo Chrome) e guarda um material; o B entra na mesma conta e RECEBE tudo (espaço, questões com enunciado inteiro, material);
// desfazer a importação no A tira as questões no B (e importar de novo as devolve: a edição mais nova vence a lápide); apagar o espaço no A apaga no B.
// Precisa do app em http://localhost:4173/ (npx vite preview --port 4173). Uso: node scripts/e2e-sync-espacos.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'
import { garantirEmuladores, limparEmuladores, lerColecao, novoAparelho, uidDoAparelho } from './_emulador.mjs'
import { pdfGabarito, pdfProva } from './_pdf-prova.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const emu = await garantirEmuladores()
await limparEmuladores()
const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const EMAIL = 'espacos@teste.com'
const abrir = async () => {
  const ctx = await novoAparelho(b, novoContexto, { email: EMAIL })
  const p = await ctx.newPage(); p.setDefaultTimeout(30000)
  p.on('pageerror', (e) => erros.push(e.message))
  await p.goto(base); await p.waitForSelector('.folders')
  return { ctx, p }
}
const esperar = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true } catch { /* tenta de novo */ } await new Promise((r) => setTimeout(r, 300)) } return false }
const entrar = async (p) => {
  await irPara(p, 'Mais'); await p.waitForSelector('.conta')
  await p.getByRole('button', { name: 'Entrar com Google' }).click(); await p.waitForSelector('[data-testid=conta-email]')
  await esperar(async () => /Sincronizado/.test(await p.locator('[data-testid=conta-situacao]').innerText()))
}
/** Lê o que o app do aparelho tem no IndexedDB (o mesmo banco que ele usa). */
const banco = (p) => p.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const todos = (n) => new Promise((res) => { if (!db.objectStoreNames.contains(n)) return res([]); const g = db.transaction(n).objectStore(n).getAll(); g.onsuccess = () => res(g.result) })
  const r = { espacos: (await todos('espacos')).map((e) => e.nome), questoes: (await todos('questoesE')).map((q) => q.q.e), materiais: (await todos('materiais')).map((m) => m.nome), trechos: (await todos('trechos')).length, pacotes: (await todos('pacotes')).map((k) => k.estado + ':' + k.k) }
  db.close(); return r
})
const chavesItens = async (uid) => (await lerColecao('users/' + uid + '/itens')).map((d) => decodeURIComponent(d.name.split('/itens/')[1]))
const falar = async (p, texto) => { await irPara(p, 'Assistente'); await p.waitForSelector('#as-msg', { timeout: 15000 }).catch(async (e) => { console.log('DIAG #as-msg ausente; diálogo:', await p.locator('.dialogo').allInnerTexts(), '| etapa/painel:', (await p.locator('.as-corpo').innerText().catch(() => '')).slice(0, 200)); throw e }); await p.waitForTimeout(600); await p.fill('#as-msg', texto); await p.keyboard.press('Enter') }
const prova = await pdfProva(b), gab = await pdfGabarito(b)
/** Importa a prova pela interface (num espaço que já está ativo). */
const importar = async (p) => {
  await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova })
  await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab })
  await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
  await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso', { timeout: 20000 })
}

const A = await abrir(); await entrar(A.p)

// ───── A: cria um espaço e importa uma prova ─────
await irPara(A.p, 'Assistente'); await A.p.waitForSelector('.as-pilula'); await A.p.waitForTimeout(800)
await A.p.fill('#as-msg', 'importar prova'); await A.p.keyboard.press('Enter'); await A.p.waitForSelector('#as-espaco')
await A.p.fill('#as-espaco', 'Espaço da nuvem'); await A.p.getByRole('button', { name: 'Criar vazio' }).click(); await A.p.waitForSelector('#as-f-prova', { state: 'attached' })
// a 1ª vez que o aparelho vai subir um espaço aparece o aviso do que sobe (F6.5): nada de espaço sobe até responder
await A.p.waitForSelector('.dialogo')
ok('(A) a 1ª subida de espaço mostra o aviso "O que sobe para a sua conta" com "Manter só aqui" em foco', /O que sobe para a sua conta/.test(await A.p.locator('.dialogo h2').innerText()) && (await A.p.evaluate(() => document.activeElement?.textContent)) === 'Manter só aqui')
ok('(nuvem) enquanto o aviso não é respondido NADA de espaço sobe', !(await chavesItens(await uidDoAparelho(A.p))).some((k) => k.startsWith('e:') || k.startsWith('p:')))
await A.p.getByRole('button', { name: 'Enviar para a conta' }).click(); await A.p.waitForTimeout(500)
await importar(A.p)
const doA = await banco(A.p)
ok('(A) a prova entrou: 8 questões com enunciado', doA.questoes.length === 8 && doA.questoes.every((e) => e.length > 10), String(doA.questoes.length))
const uid = await uidDoAparelho(A.p)
ok('(nuvem) o emulador recebeu o espaço, o catálogo e o CORPO da prova', !!uid && await esperar(async () => (await lerColecao(`users/${uid}/corpo`)).length >= 1 && (await lerColecao(`users/${uid}/itens`)).some((d) => /p(%3A|:)q-/.test(d.name))))

// as telas: andamento em Mais e selo do espaço em Meus espaços
await irPara(A.p, 'Mais'); await A.p.waitForSelector('[data-testid=conta-pacotes-texto]')
ok('(A) Mais › Conta mostra "Espaços e materiais: 1 pacote na sua conta"', await esperar(async () => /1 pacote na sua conta/.test(await A.p.locator('[data-testid=conta-pacotes-texto]').innerText())), await A.p.locator('[data-testid=conta-pacotes-texto]').innerText())
await falar(A.p, 'meus espaços'); await A.p.waitForSelector('.as-esp')
ok('(A) Meus espaços: o selo diz "Na conta · 1 pacote" e já não oferece "Só neste aparelho" (para tirar, apagar)', await esperar(async () => /Na conta · 1 pacote/.test(await A.p.locator('[data-testid=selo-espaco]').first().innerText())) && (await A.p.getByRole('button', { name: /Só neste aparelho: Espaço da nuvem/ }).count()) === 0)

await A.p.getByRole('button', { name: 'Voltar', exact: true }).click(); await A.p.waitForTimeout(500) // fecha o painel de espaços

// ───── B: outro aparelho, mesma conta ─────
const B = await abrir(); await entrar(B.p)
ok('(B) recebe o espaço e as 8 questões, com o enunciado inteiro (baixou o pacote)', await esperar(async () => { const d = await banco(B.p); return d.espacos.includes('Espaço da nuvem') && d.questoes.length === 8 && d.questoes.every((e) => e.length > 10) }), JSON.stringify((await banco(B.p)).pacotes))
ok('(B) o pacote fica "ok" (nada pendente)', await esperar(async () => (await banco(B.p)).pacotes.every((k) => k.startsWith('ok:'))))
await falar(B.p, 'trocar para o espaço Espaço da nuvem')
ok('(B) consegue trocar para o espaço e treinar com o enunciado inteiro', await (async () => {
  await esperar(async () => /Troquei para o espaço/.test(await B.p.locator('.as-chat').innerText()))
  await irPara(B.p, 'Início'); await B.p.locator('.tile', { hasText: 'Treino rápido' }).click(); await B.p.waitForSelector('.sheet')
  return (await B.p.locator('.enun').innerText()).trim().length > 10
})())
await B.p.locator('.btn.small-btn', { hasText: 'Sair' }).click().catch(() => {})

// ───── A desfaz a importação: some no B; importar de novo devolve (a edição mais nova vence a lápide) ─────
await irPara(A.p, 'Assistente'); await A.p.waitForTimeout(800)
const desfazer = A.p.getByRole('button', { name: /Desfazer: importar a prova/ })
const veioDesfazer = await esperar(async () => (await desfazer.count()) > 0, 8000)
if (veioDesfazer) { await desfazer.first().click(); await A.p.waitForTimeout(1500) }
ok('(A) desfazer a importação tira as questões daqui', veioDesfazer && (await banco(A.p)).questoes.length === 0)
ok('(B) as questões da importação desfeita somem também (lápide do pacote)', veioDesfazer && await esperar(async () => (await banco(B.p)).questoes.length === 0))
ok('(nuvem) o corpo do pacote desfeito saiu da nuvem', await esperar(async () => (await lerColecao(`users/${uid}/corpo`)).length === 0))
await falar(A.p, 'importar prova'); await A.p.waitForSelector('#as-f-prova', { state: 'attached' }); await importar(A.p)
ok('(B) importar de novo no A devolve as 8 questões ao B (o mais novo vence a lápide)', await esperar(async () => (await banco(B.p)).questoes.length === 8), String((await banco(B.p)).questoes.length))

// ───── A guarda um material: chega ao B ─────
await irPara(A.p, 'Assistente'); await A.p.waitForSelector('.as-pilula'); await A.p.waitForTimeout(800)
await A.p.locator('.as-pilula[data-sug="mais"]').click().catch(() => {}); await A.p.waitForTimeout(700)
await A.p.locator('.as-pilula[data-acao="materiais"]').click(); await A.p.getByRole('button', { name: 'Guardar um material' }).click()
await A.p.waitForSelector('#as-f-material', { state: 'attached' })
await A.p.setInputFiles('#as-f-material', { name: 'Resumo juros.txt', mimeType: 'text/plain', buffer: Buffer.from('A taxa Selic é a taxa básica de juros da economia brasileira, definida pelo Copom.\n\nO Copom se reúne a cada 45 dias para decidir a meta da Selic.', 'utf8') })
await esperar(async () => (await banco(A.p)).materiais.length === 1)
ok('(B) recebe o material e os trechos', await esperar(async () => { const d = await banco(B.p); return d.materiais.includes('Resumo juros') && d.trechos >= 1 }))

// ───── A apaga o espaço: some no B ─────
await falar(A.p, 'meus espaços'); await A.p.waitForSelector('.as-esp', { timeout: 10000 }).catch(() => {})
const lixeira = A.p.getByRole('button', { name: /Apagar o espaço Espaço da nuvem/ })
if (await lixeira.count()) { await lixeira.first().click(); await A.p.locator('.dialogo .btn.warn').click() }
await A.p.waitForTimeout(1200)
ok('(A) apagar o espaço tira o espaço daqui', !(await banco(A.p)).espacos.includes('Espaço da nuvem'))
ok('(B) o espaço apagado no A some também (a lápide chega), com questões, material e pacotes', await esperar(async () => { const d = await banco(B.p); return !d.espacos.includes('Espaço da nuvem') && d.questoes.length === 0 && d.materiais.length === 0 && d.pacotes.length === 0 }), JSON.stringify(await banco(B.p)))
ok('(B) o app do B continua funcionando depois disso (volta ao Banco do Brasil)', await (async () => { await irPara(B.p, 'Início'); await B.p.waitForSelector('.folders, .provas'); return (await B.p.locator('main').innerText()).length > 20 })())

// ───── outra conta: "Manter só aqui" deixa o espaço só no aparelho ─────
const outra = async () => { const ctx = await novoAparelho(b, novoContexto, { email: 'privado@teste.com' }); const p = await ctx.newPage(); p.setDefaultTimeout(30000); p.on('pageerror', (e) => erros.push(e.message)); await p.goto(base); await p.waitForSelector('.folders'); return { ctx, p } }
const C = await outra(); await entrar(C.p)
await irPara(C.p, 'Assistente'); await C.p.waitForSelector('.as-pilula'); await C.p.waitForTimeout(800)
await C.p.fill('#as-msg', 'importar prova'); await C.p.keyboard.press('Enter'); await C.p.waitForSelector('#as-espaco')
await C.p.setViewportSize({ width: 320, height: 568 }) // o aviso também tem de caber em 320 px
await C.p.fill('#as-espaco', 'Segredo'); await C.p.getByRole('button', { name: 'Criar vazio' }).click(); await C.p.waitForSelector('.dialogo')
const cx = await C.p.evaluate(() => { const r = document.querySelector('.dialogo').getBoundingClientRect(), bs = [...document.querySelectorAll('.dialogo .btn')].map((e) => e.getBoundingClientRect()); return { dentro: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, botoes: bs.every((x) => x.height >= 44 && x.left >= 0 && x.right <= innerWidth && x.bottom <= innerHeight), lateral: document.documentElement.scrollWidth - innerWidth } })
ok('(C) 320×568: o aviso da 1ª subida cabe na tela, com os dois botões ≥ 44 px à vista e sem rolagem lateral', cx.dentro && cx.botoes && cx.lateral <= 0, JSON.stringify(cx))
await C.p.getByRole('button', { name: 'Manter só aqui' }).click(); await C.p.waitForTimeout(1500)
const uidC = async () => uidDoAparelho(C.p)
const uC = await uidC()
const chavesC = uC ? await chavesItens(uC) : []
ok('(C) "Manter só aqui": o espaço fica no aparelho marcado como só daqui e NADA dele sobe', (await banco(C.p)).espacos.includes('Segredo') && !chavesC.some((k) => k.startsWith('e:') || k.startsWith('p:')), 'chaves de C na nuvem: ' + JSON.stringify(chavesC) + ' | espaços de C: ' + JSON.stringify((await banco(C.p)).espacos))
await C.p.getByRole('button', { name: 'Voltar', exact: true }).first().click(); await C.p.waitForTimeout(700) // sai do painel de importar
await falar(C.p, 'meus espaços'); await C.p.waitForSelector('.as-esp')
ok('(C) Meus espaços: o selo diz "Só neste aparelho" e dá para enviar depois', await esperar(async () => /Só neste aparelho: nada dele vai para a conta/.test(await C.p.locator('[data-testid=selo-espaco]').first().innerText())) && (await C.p.getByRole('button', { name: /Só neste aparelho: Segredo/ }).getAttribute('aria-pressed')) === 'true')
await C.p.getByRole('button', { name: /Só neste aparelho: Segredo/ }).click()
ok('(C) desligar "Só neste aparelho" envia o espaço para a conta', await esperar(async () => { const u = await uidC(); return !!u && (await chavesItens(u)).some((k) => k.startsWith('e:')) }))

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n'))
await b.close(); emu.parar()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
