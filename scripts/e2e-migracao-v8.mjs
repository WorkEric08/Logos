// F6.2 — atualização REAL do banco local da v7 para a v8 (tabelas novas `questoesE`, `imagensE`, `pacotes`; chave composta), no navegador de verdade e com um IndexedDB v7 cheio:
// espaços, questões (uma sem o enunciado, do defeito antigo), imagens, material, progresso e cartões. Confere que NADA some, que as tabelas antigas ficam intactas e que o app abre.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-migracao-v8.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
const p = await ctx.newPage(); p.setDefaultTimeout(30000)
const erros = []; p.on('pageerror', (e) => erros.push(e.message))

// ───── 1. um banco v7 como o app antigo o deixava (feito numa página da MESMA origem que não é o app) ─────
await p.goto(base + 'icon.svg')
await p.evaluate(async () => {
  await new Promise((res) => { const r = indexedDB.deleteDatabase('treino-bb'); r.onsuccess = r.onerror = r.onblocked = () => res() })
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('treino-bb', 70) // Dexie guarda a versão 7 como 70
    r.onupgradeneeded = () => {
      const d = r.result, loja = (nome, chave, indices = []) => { const s = d.createObjectStore(nome, { keyPath: chave }); for (const [n, k] of indices) s.createIndex(n, k) }
      loja('prog', 'id'); loja('meta', 'key'); loja('decks', 'id'); loja('cards', 'id', [['b', 'b']]); loja('eventos', 'id', [['[dev+t]', ['dev', 't']]]); loja('sinc', 'id')
      loja('espacos', 'id'); loja('questoes', 'id', [['e', 'e']]); loja('imagens', 'id', [['e', 'e']]); loja('materiais', 'id', [['e', 'e']]); loja('trechos', 'id', [['m', 'm'], ['e', 'e']]); loja('conversa', 'id')
    }
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
  const q = (id, e, enun) => ({ id, y: 2026, s: 'dir-2026', n: 1, m: 'Civil', t: 'Geral', a: '', b: '', o: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, g: 'A', p: null, bp: null, f: 0, ol: 0, e, ...(enun ? { enun } : {}) })
  const tx = db.transaction(['espacos', 'questoes', 'imagens', 'materiais', 'trechos', 'prog', 'decks', 'cards'], 'readwrite')
  tx.objectStore('espacos').put({ id: 'e-dir', nome: 'Direito', criado: 5, fontes: { 'dir-2026': 'Direito 2026' }, bases: {}, materias: [], extras: [], bancos: [{ id: 'dir', nome: 'Direito' }], simulado: null })
  tx.objectStore('espacos').put({ id: 'e-civ', nome: 'Civil', criado: 6, fontes: {}, bases: {}, materias: [], extras: [], bancos: [], simulado: null })
  for (const [id, e, enun] of [['u1', 'e-dir', 'Enunciado inteiro 1'], ['u2', 'e-dir', 'Enunciado inteiro 2'], ['u3', 'e-dir', ''], ['u4', 'e-civ', 'Outro espaço']]) tx.objectStore('questoes').put(q(id, e, enun))
  tx.objectStore('imagens').put({ id: 'u1', e: 'e-dir', blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }) })
  tx.objectStore('materiais').put({ id: 'Mres', e: 'e-dir', nome: 'Resumo', tipo: 'texto', criado: 1, trechos: 2, caracteres: 20 })
  tx.objectStore('trechos').put({ id: 'Mres:0', m: 'Mres', e: 'e-dir', i: 0, t: 'primeiro trecho' }); tx.objectStore('trechos').put({ id: 'Mres:1', m: 'Mres', e: 'e-dir', i: 1, t: 'segundo trecho' })
  tx.objectStore('prog').put({ id: 'u1', n: 4, c: 3, ok: true, last: 'A', t: 77 })
  tx.objectStore('decks').put({ id: 'b1', nome: 'Siglas', criado: 1 })
  tx.objectStore('cards').put({ id: 'c1', b: 'b1', f: 'BCB', v: 'Banco Central', estado: 'novo', criado: 2, ult: 0, due: 0, ef: 2.5, iv: 0, lapsos: 0, reps: 0 })
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
  db.close()
})

// ───── 2. abrir o app (a atualização da v7 para a v8 acontece aqui) ─────
await p.goto(base); await p.waitForSelector('.folders')
await p.waitForTimeout(800)
const banco = await p.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const todos = (nome) => new Promise((res) => { const g = db.transaction(nome).objectStore(nome).getAll(); g.onsuccess = () => res(g.result) })
  const chaves = (nome) => new Promise((res) => { const g = db.transaction(nome).objectStore(nome).getAllKeys(); g.onsuccess = () => res(g.result) })
  const r = {
    versao: db.version, tabelas: [...db.objectStoreNames],
    questoesE: (await todos('questoesE')).map((x) => ({ e: x.e, id: x.id, enun: x.q.e })), chavesE: (await chaves('questoesE')).map((k) => k.join('|')),
    imagensE: (await chaves('imagensE')).map((k) => k.join('|')),
    velhas: { questoes: (await todos('questoes')).length, imagens: (await todos('imagens')).length, trechos: (await todos('trechos')).length, materiais: (await todos('materiais')).length, espacos: (await todos('espacos')).length },
    prog: await todos('prog'), cards: await todos('cards'), decks: await todos('decks'),
  }
  db.close(); return r
})
ok('o banco subiu para a v8 (versão 80 do IndexedDB) com as tabelas novas', banco.versao === 80 && ['questoesE', 'imagensE', 'pacotes'].every((t) => banco.tabelas.includes(t)), `v${banco.versao} ${banco.tabelas.join(',')}`)
ok('as 4 questões foram COPIADAS para a tabela nova (chave composta espaço+id), com o enunciado de cada uma', JSON.stringify(banco.chavesE.sort()) === JSON.stringify(['e-civ|u4', 'e-dir|u1', 'e-dir|u2', 'e-dir|u3']) && banco.questoesE.find((x) => x.id === 'u1').enun === 'Enunciado inteiro 1' && banco.questoesE.find((x) => x.id === 'u4').enun === 'Outro espaço', JSON.stringify(banco.chavesE))
ok('a imagem foi copiada', banco.imagensE.join() === 'e-dir|u1')
ok('as tabelas ANTIGAS ficam intactas (nada apagado): 4 questões, 1 imagem, 2 espaços, 1 material, 2 trechos', JSON.stringify(banco.velhas) === JSON.stringify({ questoes: 4, imagens: 1, trechos: 2, materiais: 1, espacos: 2 }), JSON.stringify(banco.velhas))
ok('progresso, baralho e cartão continuam iguais', banco.prog.length === 1 && banco.prog[0].n === 4 && banco.decks.length === 1 && banco.cards.length === 1)
ok('o aviso de questões sem enunciado aparece (a u3 vinha vazia)', /sem enunciado/.test(await p.locator('.toast').first().innerText().catch(() => '')))

// ───── 3. reabrir de novo não copia nem duplica ─────
await p.reload(); await p.waitForSelector('.folders'); await p.waitForTimeout(600)
const depois = await p.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => res(r.result) })
  const n = (nome) => new Promise((res) => { const g = db.transaction(nome).objectStore(nome).count(); g.onsuccess = () => res(g.result) })
  const r = { questoesE: await n('questoesE'), imagensE: await n('imagensE'), versao: db.version }; db.close(); return r
})
ok('reabrir o app não duplica nada (4 questões, 1 imagem, ainda v8)', depois.questoesE === 4 && depois.imagensE === 1 && depois.versao === 80, JSON.stringify(depois))

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n'))
await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
