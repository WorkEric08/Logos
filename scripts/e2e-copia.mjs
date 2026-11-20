// Cópia de segurança (2026-11-17): "Mais" › Cópia de segurança. Prova, no Chrome, o ciclo inteiro: não há o que salvar → há conteúdo só deste aparelho → salvar gera o arquivo
// (download) com tudo, inclusive a imagem → apagar → restaurar de volta (só acrescenta, a imagem volta com os mesmos bytes) → restaurar de novo não duplica → arquivo errado é recusado
// com mensagem. NÃO prova a folha de compartilhar do Android (no celular o arquivo vai por ela). Sobe o próprio servidor (porta 4320) e o encerra no fim.
// Uso: node scripts/e2e-copia.mjs
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { esperarMovimento, irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const PORTA = 4320, base = `http://localhost:${PORTA}/`
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)

const build = spawnSync('npx', ['vite', 'build'], { shell: true, stdio: 'ignore' })
if (build.status !== 0) { console.error('FALHOU: vite build'); process.exit(1) }
const servidor = spawn('npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort'], { shell: true, stdio: 'ignore' })
const encerra = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* já saiu */ } }
process.on('exit', encerra)
for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 500)) }

const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const ctx = await novoContexto(b, { viewport: { width: 360, height: 780 }, colorScheme: 'dark', acceptDownloads: true })
const p = await ctx.newPage()
p.on('pageerror', (e) => erros.push(e.message))
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
await p.goto(base); await p.waitForSelector('.folders')

const BYTES = [255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1]
/** Escreve direto no banco do app (o mesmo `treino-bb`), como se a pessoa tivesse importado uma prova e um material. */
const semear = () => p.evaluate(async (bytes) => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })
  const tx = db.transaction(['espacos', 'questoesE', 'imagensE', 'materiais', 'trechos'], 'readwrite')
  tx.objectStore('espacos').put({ id: 'esp-teste', nome: 'Concurso de teste', criado: 1700000000000, fontes: {}, bases: {}, materias: [], extras: [], bancos: [], simulado: null })
  for (const id of ['q-a', 'q-b']) tx.objectStore('questoesE').put({ e: 'esp-teste', id, q: { id, e: 'Enunciado ' + id, m: 'Português', s: 'teste-2026', y: 2026, n: 1, t: 'Geral', a: '', b: '', o: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, g: 'A', p: null, bp: null, f: 0, ol: 0 } })
  tx.objectStore('imagensE').put({ id: 'q-a', e: 'esp-teste', blob: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }) })
  tx.objectStore('materiais').put({ id: 'm-1', e: 'esp-teste', nome: 'Resumo.pdf', criado: 1700000000000 })
  tx.objectStore('trechos').put({ id: 't-1', m: 'm-1', e: 'esp-teste', texto: 'Um trecho do resumo.' })
  await new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = () => no(tx.error) })
  db.close()
}, BYTES)
const apagarTudo = () => p.evaluate(async () => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })
  const nomes = ['espacos', 'questoesE', 'imagensE', 'materiais', 'trechos', 'pacotes', 'sinc']
  const tx = db.transaction(nomes, 'readwrite'); for (const n of nomes) tx.objectStore(n).clear()
  await new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = () => no(tx.error) })
  db.close()
})
const contar = () => p.evaluate(async () => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })
  const nomes = ['espacos', 'questoesE', 'imagensE', 'materiais', 'trechos'], r = {}
  const tx = db.transaction(nomes)
  await Promise.all(nomes.map((n) => new Promise((ok) => { const q = tx.objectStore(n).count(); q.onsuccess = () => { r[n === 'questoesE' ? 'questoes' : n === 'imagensE' ? 'imagens' : n] = q.result; ok() } })))
  const img = await new Promise((ok) => { const q = tx.objectStore('imagensE').get(['esp-teste', 'q-a']); q.onsuccess = () => ok(q.result) })
  r.imagemBytes = img ? [...new Uint8Array(await img.blob.arrayBuffer())] : null; r.imagemTipo = img?.blob.type ?? null
  db.close(); return r
})
const abrirMais = async () => { await irPara(p, 'Mais'); await p.waitForSelector('.copia'); await esperarMovimento(p) }
const recarregar = async () => { await p.reload(); await p.waitForSelector('.folders'); await abrirMais() }
const texto = () => p.locator('.copia').innerText()

// ───── 1. nada para guardar ─────
await abrirMais()
ok('sem nada seu no aparelho: o cartão diz isso e "Salvar cópia" fica desligado', /ainda não há nada seu/.test(await texto()) && (await p.locator('.copia .btn', { hasText: 'Salvar cópia' }).isDisabled()))

// ───── 2. com conteúdo ─────
await semear(); await recarregar()
const t2 = await texto()
ok('com conteúdo: conta o que há ("1 espaço, 2 questões e 1 material") e diz que ainda não há cópia', /1 espaço, 2 questões e 1 material/.test(t2) && /ainda não salvou nenhuma cópia/.test(t2), t2.replace(/\s+/g, ' ').slice(0, 220))
ok('o cartão explica o que a conta Google guarda e o que fica só no aparelho', /conta Google/.test(t2) && /só neste aparelho/.test(t2))

// ───── 3. salvar ─────
const [baixou] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.locator('.copia .btn', { hasText: 'Salvar cópia' }).click()])
const arquivo = await baixou.createReadStream().then(async (s) => { const partes = []; for await (const c of s) partes.push(c); return Buffer.concat(partes) })
const j = JSON.parse(arquivo.toString('utf8'))
ok('baixa "logos-copia-AAAA-MM-DD.json"', /^logos-copia-\d{4}-\d{2}-\d{2}\.json$/.test(baixou.suggestedFilename()), baixou.suggestedFilename())
ok('o arquivo tem tudo: 1 espaço, 2 questões, 1 imagem, 1 material, 1 trecho', j.app === 'logos' && j.espacos.length === 1 && j.questoes.length === 2 && j.imagens.length === 1 && j.materiais.length === 1 && j.trechos.length === 1)
ok('a imagem vai como base64 dos mesmos bytes, com o tipo', j.imagens[0].tipo === 'image/jpeg' && Buffer.from(j.imagens[0].dados, 'base64').equals(Buffer.from(BYTES)))
await p.waitForFunction(() => /Cópia pronta/.test(document.querySelector('.copia')?.innerText ?? ''), null, { timeout: 5000 })
ok('a tela confirma ("Cópia pronta … Guarde o arquivo num lugar seguro")', /Cópia pronta.*Guarde o arquivo/s.test(await texto()))
await recarregar()
ok('depois de salvar, mostra a data da última cópia', /Última cópia: \d{1,2} de \w+ de \d{4}/.test(await texto()), (await texto()).replace(/\s+/g, ' ').slice(0, 200))

// ───── 4. apagar e restaurar ─────
await apagarTudo(); await recarregar()
const vazio = await contar()
ok('(preparo) o aparelho ficou sem nada', vazio.espacos === 0 && vazio.questoes === 0 && vazio.imagens === 0 && vazio.materiais === 0 && vazio.trechos === 0)
await p.setInputFiles('#copia-arquivo', { name: baixou.suggestedFilename(), mimeType: 'application/json', buffer: arquivo })
await p.waitForFunction(() => /Restaurei/.test(document.querySelector('.copia')?.innerText ?? ''), null, { timeout: 8000 })
ok('restaurar diz o que voltou e que o que já existia ficou como estava', /Restaurei 1 espaço, 2 questões e 1 material\. O que já existia aqui ficou como estava\./.test(await texto()), (await texto()).replace(/\s+/g, ' ').slice(0, 260))
const volta = await contar()
ok('o banco tem tudo de volta (espaço, questões, material, trecho, imagem)', volta.espacos === 1 && volta.questoes === 2 && volta.materiais === 1 && volta.trechos === 1 && volta.imagens === 1, JSON.stringify({ ...volta, imagemBytes: undefined }))
ok('a imagem voltou com os MESMOS bytes e o mesmo tipo', JSON.stringify(volta.imagemBytes) === JSON.stringify(BYTES) && volta.imagemTipo === 'image/jpeg')
ok('o cartão já conta o que voltou, sem recarregar a tela', /1 espaço, 2 questões e 1 material/.test(await texto()))

// ───── 5. restaurar de novo não duplica ─────
await p.setInputFiles('#copia-arquivo', { name: 'de-novo.json', mimeType: 'application/json', buffer: arquivo })
await p.waitForFunction(() => /Nada novo/.test(document.querySelector('.copia')?.innerText ?? ''), null, { timeout: 8000 })
const de2 = await contar()
ok('restaurar o mesmo arquivo de novo: "Nada novo" e nada duplicado', de2.espacos === 1 && de2.questoes === 2 && de2.materiais === 1 && de2.trechos === 1 && de2.imagens === 1)

// ───── 5b. C-8: o estudo (progresso, histórico, baralhos, cartões) vai na cópia e volta ─────
const noBanco = (fn, arg) => p.evaluate(async ([corpo, a]) => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })
  try { return await new Function('db', 'arg', 'return (async () => {' + corpo + '})()')(db, a) } finally { db.close() }
}, [fn, arg])
const feito = (tx) => 'await new Promise((ok, no) => { ' + tx + '.oncomplete = ok; ' + tx + '.onerror = () => no(' + tx + '.error) })'
const semearEstudo = () => noBanco(`
  const tx = db.transaction(['prog', 'meta', 'decks', 'cards'], 'readwrite')
  tx.objectStore('prog').put({ id: 'q-estudo-1', n: 3, c: 2, ok: true, last: 'A', t: 9 }); tx.objectStore('prog').put({ id: 'q-estudo-2', n: 1, c: 0, ok: false, last: 'B', t: 5 })
  tx.objectStore('meta').put({ key: 'hist', value: JSON.stringify({ dias: { '2026-11-17': { n: 10, c: 7 } }, sims: [{ t: 100, p: 55, b: 20, e: 35, c: 40, n: 70, ok: true }] }) })
  tx.objectStore('meta').put({ key: 'marks', value: JSON.stringify({ 'q-estudo-1': { r: true, a: 'rever o gabarito', t: 50 } }) })
  tx.objectStore('decks').put({ id: 'b-estudo', nome: 'Siglas do estudo', criado: 1 })
  for (const id of ['c-1', 'c-2']) tx.objectStore('cards').put({ id, b: 'b-estudo', f: 'Frente ' + id, v: 'Verso ' + id, estado: 'novo', criado: 2, ult: 0, due: 0, ef: 2.5, iv: 0, lapsos: 0, reps: 0 })
  ` + "" + feito('tx'))
const apagarEstudo = () => noBanco(`
  const tx = db.transaction(['prog', 'meta', 'decks', 'cards'], 'readwrite')
  tx.objectStore('prog').clear(); tx.objectStore('decks').clear(); tx.objectStore('cards').clear(); tx.objectStore('meta').delete('hist'); tx.objectStore('meta').delete('marks')
  ` + feito('tx'))
const contarEstudo = () => noBanco(`
  const tx = db.transaction(['prog', 'meta', 'decks', 'cards']), r = {}
  for (const n of ['prog', 'decks', 'cards']) await new Promise((ok) => { const q = tx.objectStore(n).count(); q.onsuccess = () => { r[n] = q.result; ok() } })
  const h = await new Promise((ok) => { const q = tx.objectStore('meta').get('hist'); q.onsuccess = () => ok(q.result) })
  r.hist = h ? JSON.parse(h.value) : null
  const m = await new Promise((ok) => { const q = tx.objectStore('meta').get('marks'); q.onsuccess = () => ok(q.result) })
  r.marks = m ? JSON.parse(m.value) : null
  return r`)
await semearEstudo(); await recarregar()
const tEstudo = await texto()
ok('com estudo: o cartão conta baralhos, cartões, progresso e simulados', /1 baralho, 2 cartões, progresso em 2 questões, 1 dia de estudo, 1 questão marcada ou anotada e 1 simulado/.test(tEstudo), tEstudo.replace(/\s+/g, ' ').slice(0, 300))
const [baixou2] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.locator('.copia .btn', { hasText: 'Salvar cópia' }).click()])
const arquivo2 = await baixou2.createReadStream().then(async (st) => { const partes = []; for await (const c of st) partes.push(c); return Buffer.concat(partes) })
const j2 = JSON.parse(arquivo2.toString('utf8'))
ok('o arquivo (versão 2) leva progresso, histórico, baralhos e cartões', j2.versao === 2 && Object.keys(j2.estudo.prog).length === 2 && j2.estudo.hist.sims.length === 1 && j2.estudo.baralhos.length === 1 && j2.estudo.cartoes.length === 2)
await apagarEstudo(); await recarregar()
const semEstudo = await contarEstudo()
ok('(preparo) o estudo foi apagado do aparelho', semEstudo.prog === 0 && semEstudo.decks === 0 && semEstudo.cards === 0 && !semEstudo.hist)
await p.setInputFiles('#copia-arquivo', { name: baixou2.suggestedFilename(), mimeType: 'application/json', buffer: arquivo2 })
await p.waitForFunction(() => /Restaurei/.test(document.querySelector('.copia')?.innerText ?? ''), null, { timeout: 8000 })
const tRest = await texto()
ok('restaurar diz o que voltou do estudo', /Restaurei 1 baralho, 2 cartões, progresso em 2 questões, 1 dia de estudo, 1 questão marcada ou anotada e 1 simulado/.test(tRest), tRest.replace(/\s+/g, ' ').slice(0, 320))
await p.waitForTimeout(600)
const voltaEstudo = await contarEstudo()
ok('o banco tem o estudo de volta (progresso, baralho, cartões e histórico)', voltaEstudo.prog === 2 && voltaEstudo.decks === 1 && voltaEstudo.cards === 2 && voltaEstudo.hist?.sims?.length === 1 && voltaEstudo.hist?.dias?.['2026-11-17']?.n === 10 && voltaEstudo.marks?.['q-estudo-1']?.a === 'rever o gabarito', JSON.stringify(voltaEstudo))
await recarregar()
const aposRecarga = await contarEstudo()
ok('depois de recarregar o app o estudo continua lá (não foi desfeito por ninguém)', aposRecarga.prog === 2 && aposRecarga.decks === 1 && aposRecarga.cards === 2)
await p.setInputFiles('#copia-arquivo', { name: 'de-novo-2.json', mimeType: 'application/json', buffer: arquivo2 })
await p.waitForFunction(() => /Nada novo/.test(document.querySelector('.copia')?.innerText ?? ''), null, { timeout: 8000 })
const de3 = await contarEstudo()
ok('restaurar o mesmo arquivo de novo: nada duplicado no estudo', de3.prog === 2 && de3.decks === 1 && de3.cards === 2 && de3.hist?.sims?.length === 1)

// ───── 5c. F-18: o Desfazer do aviso tira TUDO o que a restauração do estudo trouxe (progresso, cartões, marcações) ─────
await apagarEstudo(); await recarregar()
await p.setInputFiles('#copia-arquivo', { name: 'para-desfazer.json', mimeType: 'application/json', buffer: arquivo2 })
await p.waitForSelector('.toast >> text=Estudo restaurado.', { timeout: 8000 })
ok('o aviso "Estudo restaurado." tem Desfazer', (await p.locator('.toast', { hasText: 'Estudo restaurado.' }).getByRole('button', { name: 'Desfazer' }).count()) === 1)
await p.locator('.toast').getByRole('button', { name: 'Desfazer' }).click(); await p.waitForTimeout(900)
const desfeito = await contarEstudo()
ok('Desfazer tira progresso, histórico, baralho, cartões e marcações que a restauração trouxe', desfeito.prog === 0 && desfeito.decks === 0 && desfeito.cards === 0 && Object.keys(desfeito.marks ?? {}).length === 0 && (desfeito.hist?.sims?.length ?? 0) === 0, JSON.stringify(desfeito))
await p.setInputFiles('#copia-arquivo', { name: 'de-novo-3.json', mimeType: 'application/json', buffer: arquivo2 })
await p.waitForFunction(() => /Restaurei/.test(document.querySelector('.copia')?.innerText ?? ''), null, { timeout: 8000 })

// ───── 6. arquivo errado ─────
await p.setInputFiles('#copia-arquivo', { name: 'outro.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') })
await p.waitForFunction(() => /não é uma cópia do Logos/.test(document.querySelector('.copia [role=alert]')?.innerText ?? ''), null, { timeout: 5000 })
ok('arquivo que não é cópia: recusado com mensagem clara e nada muda', (await contar()).questoes === 2)
await p.setInputFiles('#copia-arquivo', { name: 'quebrado.json', mimeType: 'application/json', buffer: Buffer.from('isto nao e json') })
await p.waitForFunction(() => /não consegui ler/i.test(document.querySelector('.copia [role=alert]')?.innerText ?? ''), null, { timeout: 5000 })
ok('arquivo ilegível: também recusado com mensagem', true)

// ───── 7. a tela no celular pequeno ─────
await p.setViewportSize({ width: 320, height: 568 }); await esperarMovimento(p)
const m = await p.evaluate(() => {
  const card = document.querySelector('.copia'), cr = card.getBoundingClientRect()
  const filhos = [...card.querySelectorAll('button, p, h3')].map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || '').slice(0, 24), l: r.left, r: r.right, h: r.height, corte: e.scrollWidth > e.clientWidth + 1, botao: e.tagName === 'BUTTON' } })
  return { card: { l: cr.left, r: cr.right }, filhos, pagina: document.documentElement.scrollWidth > innerWidth }
})
ok('320 px: nada sai do cartão nem da tela e nenhum texto é cortado', !m.pagina && m.filhos.every((f) => f.l >= m.card.l - 0.5 && f.r <= m.card.r + 0.5 && !f.corte), JSON.stringify(m.filhos.filter((f) => f.corte || f.r > m.card.r + 0.5)))
ok('320 px: todo botão tem pelo menos 44 px de altura', m.filhos.filter((f) => f.botao).every((f) => f.h >= 44 - 0.5), JSON.stringify(m.filhos.filter((f) => f.botao).map((f) => f.h)))
await p.locator('.copia').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'docs/verificacao-capturas/copia-320.png' })

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
