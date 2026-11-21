// C-11: botão certo por tipo: espaço SÓ com provas (só "Importar a prova de novo"), SÓ com geradas (só "Gerar de novo"), misto (os dois); apagar o espaço afetado some da fala
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { novoContexto, irPara, esperarMovimento } from '../_ctx.mjs'
import { restaurar } from './_idb.mjs'
import { BASE } from './_base.mjs'
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const out = (...a) => console.log(...a)
const R = []; const ok = (n, c, x = '') => { const l = `${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`; R.push(l); console.log(l) }
const dump = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'fluxo', 'dados', 'banco-v7-dois.json'), 'utf8'))
const x = dump.stores.espacos.valores.find((e) => e.nome === 'Concurso X'), s = dump.stores.espacos.valores.find((e) => e.nome === 'Segundo')
// Concurso X: SÓ provas (tira as geradas); Segundo: SÓ geradas (tira as de prova); cria "Misto" com os dois
dump.stores.questoes.valores = dump.stores.questoes.valores.filter((q) => !(q.e === x.id && q.ger) && !(q.e === s.id && !q.ger))
const mistoId = 'e3mistoxxxx'; dump.stores.espacos.valores.push({ ...JSON.parse(JSON.stringify(x)), id: mistoId, nome: 'Misto' })
const base = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'fluxo', 'dados', 'banco-v7.json'), 'utf8')).stores.questoes.valores.filter((q) => q.e === x.id)
for (const q of base) dump.stores.questoes.valores.push({ ...JSON.parse(JSON.stringify(q)), id: q.id + 'm', e: mistoId })
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce' })
const p = await ctx.newPage(); p.setDefaultTimeout(20000)
await p.goto(BASE + 'icon-192.png'); await restaurar(p, dump); await p.goto(BASE); await p.waitForSelector('h1'); await esperarMovimento(p); await p.waitForTimeout(800)
const chat = async () => { await irPara(p, 'Assistente'); await p.waitForTimeout(1500); for (let i = 0; i < 4 && !(await p.locator('#as-msg').count()); i++) { await p.getByRole('button', { name: /^(Voltar|Cancelar)$|Mais sugestões/ }).first().click().catch(() => {}); await p.waitForTimeout(700) } }
const painel = async () => { await chat(); await p.fill('#as-msg', 'meus espaços'); await p.keyboard.press('Enter'); await p.waitForSelector('.as-esp li'); await p.waitForTimeout(900) }
await painel()
const linha = (n) => p.locator('.as-esp li', { hasText: n })
const bots = async (n) => (await linha(n).locator('button').allInnerTexts()).map((t) => t.trim()).filter((t) => /Importar|Gerar/.test(t))
const bx = await bots('Concurso X'), bs = await bots('Segundo'), bm = await bots('Misto')
out('Concurso X (só provas):', bx, '| Segundo (só geradas):', bs, '| Misto:', bm)
ok('espaço SÓ com provas: apenas "Importar a prova de novo"', bx.length === 1 && /Importar a prova de novo/.test(bx[0]), JSON.stringify(bx))
ok('espaço SÓ com geradas: apenas "Gerar de novo"', bs.length === 1 && /Gerar de novo/.test(bs[0]), JSON.stringify(bs))
ok('espaço misto: os dois botões', bm.length === 2, JSON.stringify(bm))
out('textos:', (await p.locator('.as-esp li').allInnerTexts()).map((t) => t.split('\n').join(' ').replace(/Só neste aparelho.*?\)\./, '')).join(' || '))
// apagar um afetado e conferir a fala
await linha('Misto').getByRole('button', { name: /Apagar o espaço Misto/ }).click(); await p.waitForTimeout(500); await p.locator('.dialogo .btn', { hasText: /Apagar/ }).last().click(); await p.waitForTimeout(1500)
await painel(); ok('apagar o espaço afetado: some da lista de afetados', (await linha('Misto').count()) === 0)
await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p); await irPara(p, 'Assistente'); await p.waitForTimeout(6000)
const fala = (await p.locator('.as-linha.a', { hasText: 'sem enunciado' }).allInnerTexts()).join(' ').split('\n').join(' | ')
ok('a fala depois de apagar cita só Concurso X e Segundo (sem o Misto)', /Concurso X/.test(fala) && /Segundo/.test(fala) && !/Misto/.test(fala), fala.slice(0, 260))
console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas de ' + R.length); await b.close()
