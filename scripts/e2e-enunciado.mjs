// C-10 — o enunciado das questões importadas sobrevive a FECHAR E REABRIR o app (antes a tabela sobrescrevia `Question.e`, o enunciado, com o id do espaço), e linhas
// antigas (sem enunciado) são avisadas. Importa uma prova de verdade (PDF gerado pelo Chrome), recarrega a página (= fechar e abrir) e confere o texto na questão.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-enunciado.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto, esperarMovimento } from './_ctx.mjs'
import { pdfGabarito, pdfProva } from './_pdf-prova.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark' })
const p = await ctx.newPage(); p.setDefaultTimeout(30000)
const erros = []; p.on('pageerror', (e) => erros.push(e.message))
const prova = await pdfProva(b), gab = await pdfGabarito(b)
await p.goto(base); await p.waitForSelector('.folders')

// ───── 1. importar uma prova num espaço criado pela pessoa ─────
await irPara(p, 'Assistente'); await p.waitForSelector('.as-pilula'); await p.waitForTimeout(800)
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-espaco')
await p.fill('#as-espaco', 'Espaço do enunciado'); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova })
await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab })
await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso', { timeout: 20000 })
const primeira = async () => { await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet'); return (await p.locator('.enun').innerText()).trim() }
const antes = await primeira()
ok('logo depois de importar a questão tem enunciado', antes.length > 10, antes.slice(0, 60))

// ───── 2. fechar e abrir o app (recarregar) ─────
await p.reload(); await p.waitForSelector('.folders')
const depois = await primeira()
ok('depois de FECHAR E ABRIR o app a questão importada continua com o enunciado inteiro', depois.length > 10 && /\w/.test(depois), depois.slice(0, 60))
ok('não aparece o aviso de "sem enunciado" nem o recado na questão', (await p.locator('.warnbox:has-text("perdeu o enunciado")').count()) === 0 && (await p.locator('.toast:has-text("sem enunciado")').count()) === 0)

// ───── 3. linha ANTIGA (uma questão que perdeu o enunciado: vazio na tabela v8) ─────
await p.locator('.btn.small-btn', { hasText: 'Sair' }).click().catch(() => {})
await p.evaluate(async () => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })
  const espaco = await new Promise((ok) => { const q = db.transaction('espacos').objectStore('espacos').getAll(); q.onsuccess = () => ok(q.result[0].id) })
  const tx = db.transaction('questoesE', 'readwrite')
  tx.objectStore('questoesE').put({ e: espaco, id: 'u-antiga-1', q: { id: 'u-antiga-1', y: 2020, s: 'antiga-2020', n: 1, m: 'Português', t: 'Geral', a: '', b: '', e: '', o: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, g: 'A', p: null, bp: null, f: 0, ol: 0 } })
  await new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = () => no(tx.error) }); db.close()
})
await p.reload(); await p.waitForSelector('.folders')
await p.waitForSelector('.toast', { timeout: 10000 }).catch(() => {})
ok('com uma questão de linha antiga, o app avisa ("Há questões importadas sem enunciado.")', /sem enunciado/.test(await p.locator('.toast').first().innerText().catch(() => '')), await p.locator('.toast').first().innerText().catch(() => '(sem aviso)'))
await irPara(p, 'Assistente'); await p.waitForSelector('.as-pilula'); await p.waitForTimeout(1500)
ok('o assistente explica e manda importar a prova de novo', /ficou sem enunciado|ficaram sem enunciado/.test(await p.locator('.as-chat').innerText()) && /importe a prova de novo/.test(await p.locator('.as-chat').innerText()))

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n'))
await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
