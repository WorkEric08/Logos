// C-11: aviso de "questões sem enunciado" POR ESPAÇO (Meus espaços e fala do assistente), botão "Importar a prova de novo"/"Gerar de novo" por espaço afetado, número some quando o espaço é consertado.
// Banco: scripts/fluxo/dados/banco-v7-dois.json (gerado por 52-fixture-dois-espacos-sem-enunciado.mjs): "Concurso X" e "Segundo", cada um com 8 da prova + 9 geradas SEM enunciado, mais "Meu BB".
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { novoContexto, irPara, esperarMovimento } from '../_ctx.mjs'
import { despejar, restaurar } from './_idb.mjs'
import { texto, voltar, foto, BASE } from './_base.mjs'
import { textoCortado } from '../varrer-texto-cortado.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const out = (...a) => console.log(...a)
const R = []; const ok = (n, c, x = '') => { const l = `${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`; R.push(l); console.log(l) }
const dump = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'fluxo', 'dados', 'banco-v7-dois.json'), 'utf8'))
const b = await chromium.launch({ channel: 'chrome' })
const prova = await pdfProva(b), gab = await pdfGabarito(b)
const MAIS = ['Selic: taxa básica de juros da economia brasileira, definida pelo Copom a cada reunião.', 'Copom: comitê do Banco Central que define a meta da taxa Selic.', 'CMN: conselho monetário nacional, órgão que edita as normas gerais do sistema financeiro.', 'CVM: autarquia que fiscaliza e regula o mercado de valores mobiliários.', 'BNDES: banco público de fomento que financia projetos de longo prazo de empresas.', 'Febraban: federação que reúne e representa os bancos brasileiros.', 'IPCA: índice oficial de preços ao consumidor, medido pelo IBGE todos os meses.', 'Poupança: aplicação de baixo risco com rendimento mensal definido em lei.'].join('\n\n')

async function abrir(view = { width: 390, height: 844 }, tema = 'dark') {
  const ctx = await novoContexto(b, { viewport: view, hasTouch: true, isMobile: true, colorScheme: tema, reducedMotion: 'reduce' })
  const p = await ctx.newPage(); p.setDefaultTimeout(20000)
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR|status of 404/.test(m.text())) erros.push('console: ' + m.text()) })
  await p.goto(BASE + 'icon-192.png'); await restaurar(p, dump)
  await p.goto(BASE); await p.waitForSelector('h1'); await esperarMovimento(p); await p.waitForTimeout(800)
  return { ctx, p, erros }
}
const chat = async (p) => { await irPara(p, 'Assistente'); await p.waitForTimeout(1500); for (let i = 0; i < 4 && !(await p.locator('#as-msg').count()); i++) { await p.getByRole('button', { name: /^(Voltar|Cancelar)$|Mais sugestões/ }).first().click().catch(() => {}); await p.waitForTimeout(700) } }
const dizer = async (p, t) => { await chat(p); await p.fill('#as-msg', t); await p.keyboard.press('Enter'); await p.waitForTimeout(1300) }
const painel = async (p) => { await dizer(p, 'meus espaços'); await p.waitForSelector('.as-esp li'); await p.waitForTimeout(800); return p.locator('.as-esp li').allInnerTexts().then((a) => a.map((t) => t.split('\n').join(' '))) }
const subt = (p) => p.locator('.top small').first().innerText().catch(() => '')
const enunciadosDe = async (p, nome) => { await painel(p); await p.getByRole('button', { name: new RegExp(nome) }).first().click(); await p.waitForTimeout(1200); await irPara(p, 'Treinar'); await p.locator('.chip', { hasText: 'Ordem da prova' }).click(); const n = parseInt((await p.locator('.btn.pri', { hasText: 'Começar' }).innerText()).replace(/\D/g, '')); await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet'); const v = []; for (let i = 0; i < n; i++) { v.push((await p.locator('.enun').innerText().catch(() => '')).trim()); if (i < n - 1) await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(40) } await voltar(p); await p.waitForTimeout(300); return v }

const { p, ctx, erros } = await abrir()
out('toast na abertura:', await p.locator('.toast').innerText().then((t) => t.split('\n').join(' / ')).catch(() => null))
// 1) a fala do assistente e a lista por espaço
await irPara(p, 'Assistente'); await p.waitForTimeout(6000)
const balao = async () => (await p.locator('.as-linha.a', { hasText: 'sem enunciado' }).allInnerTexts()).join(' // ').split('\n').join(' | ')
const fala = [await balao()]
out('fala(s) sobre enunciado:', fala.map((f) => f.trim().slice(0, 260)))
ok('a fala nomeia os DOIS espaços com o número de cada um (17 em Concurso X e 17 em Segundo)', /Concurso X/.test(fala.join(' ')) && /Segundo/.test(fala.join(' ')) && (fala.join(' ').match(/17/g) ?? []).length >= 2, fala.join(' ').slice(0, 300))
const linhas = await painel(p); out('Meus espaços:'); for (const l of linhas) out('  -', l)
const lX = linhas.find((l) => /Concurso X/.test(l)) ?? '', lS = linhas.find((l) => /Segundo/.test(l)) ?? '', lB = linhas.find((l) => /Meu BB/.test(l)) ?? ''
ok('Meus espaços: "Concurso X" mostra o número de questões sem enunciado (17)', /17/.test(lX) && /enunciado/i.test(lX), lX)
ok('Meus espaços: "Segundo" idem', /17/.test(lS) && /enunciado/i.test(lS), lS)
ok('Meus espaços: "Meu BB" e o BB embutido NÃO mostram contador', !/sem enunciado/i.test(lB) && !/sem enunciado/i.test(linhas.find((l) => /Banco do Brasil e outros/.test(l)) ?? ''))
const botoes = await p.getByRole('button').allInnerTexts(); out('botões no painel:', botoes.filter((t) => /novo|Gerar|Importar/i.test(t)))
await foto(p, 'c11-meus-espacos')

// 2) botão do "Concurso X": leva ao fluxo certo, no espaço certo
const btnsX = p.locator('.as-esp li', { hasText: 'Concurso X' }).getByRole('button', { name: /Importar a prova de novo|Importar de novo/ })
ok('"Concurso X" tem o botão "Importar a prova de novo"', (await btnsX.count()) >= 1)
const gerarX = p.locator('.as-esp li', { hasText: 'Concurso X' }).getByRole('button', { name: /Gerar de novo/ })
out('"Concurso X" tem "Gerar de novo"?', await gerarX.count())
if (await btnsX.count()) {
  await btnsX.first().click(); await p.waitForTimeout(1800)
  ok('o botão abre o fluxo de importar prova (escolher os PDFs)', (await p.locator('#as-f-prova').count()) === 1)
  ok('…no espaço CERTO (subtítulo "Espaço: Concurso X")', /Concurso X/.test(await subt(p)), await subt(p))
  await voltar(p); await p.waitForTimeout(500); out('voltar do aparelho no fluxo de importar →', (await p.locator('#as-f-prova').count()) === 0 ? 'fechou o painel' : 'painel continua', '| onde:', await p.locator('h1').innerText())
  await btnsX.first().click().catch(async () => { await painel(p); await p.locator('.as-esp li', { hasText: 'Concurso X' }).getByRole('button', { name: /Importar a prova de novo|Importar de novo/ }).first().click() }); await p.waitForTimeout(1500)
  await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab })
  await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 }); await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso'); await p.waitForTimeout(1500)
  const l2 = await painel(p); const x2 = l2.find((l) => /Concurso X/.test(l)) ?? '', s2 = l2.find((l) => /Segundo/.test(l)) ?? ''
  out('depois de reimportar a prova no Concurso X:'); out('  - X:', x2); out('  - S:', s2)
  ok('Concurso X: o contador caiu para 9 (restam as geradas)', /\b9\b/.test(x2) && /enunciado/i.test(x2), x2)
  ok('Segundo: continua com 17 (reimportar conserta só aquele espaço)', /17/.test(s2) && /enunciado/i.test(s2), s2)
  const enX = await enunciadosDe(p, 'Concurso X'); ok('Concurso X: as 8 da prova têm enunciado inteiro', enX.slice(0, 8).every((t) => t.length > 15), enX.map((t) => t.length).join(','))
}
// 3) "Gerar de novo" no Concurso X (precisa do material do espaço)
await painel(p)
const gerar = p.locator('.as-esp li', { hasText: 'Concurso X' }).getByRole('button', { name: /Gerar de novo/ })
if (await gerar.count()) {
  await gerar.first().click(); await p.waitForTimeout(2000)
  out('depois de "Gerar de novo": subtítulo', await subt(p), '| botões:', (await p.getByRole('button').allInnerTexts()).slice(-5))
  ok('"Gerar de novo" abre o fluxo de gerar questões no espaço certo', /Concurso X/.test(await subt(p)))
  const gl = p.getByRole('button', { name: /Glossario|Gerar questões deste material/ }).first(); if (await gl.count()) { await gl.click(); await p.waitForTimeout(3500) }
  const add = p.getByRole('button', { name: /Adicionar/ }).first(); if (await add.count()) { await add.click(); await p.waitForTimeout(3000) } else out('(não cheguei à prévia das geradas; botões:', (await p.getByRole('button').allInnerTexts()).slice(-6), ')')
  const l3 = await painel(p); const x3 = l3.find((l) => /Concurso X/.test(l)) ?? '', s3 = l3.find((l) => /Segundo/.test(l)) ?? ''
  out('  - X:', x3); out('  - S:', s3)
  ok('Concurso X: o número SOME quando o espaço está consertado', !/sem enunciado/i.test(x3), x3)
  ok('Segundo continua marcado (17)', /17/.test(s3) && /enunciado/i.test(s3), s3)
} else out('(sem botão "Gerar de novo" no Concurso X depois de reimportar a prova)')
// 4) fala do assistente depois: só o Segundo
await irPara(p, 'Início'); await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p); await irPara(p, 'Assistente'); await p.waitForTimeout(6000)
const fala1 = await balao()
ok('depois de recarregar, a fala cita só o "Segundo"', /Segundo/.test(fala1) && !/Concurso X/.test(fala1), fala1.slice(-300))
ok('sem erros de script', erros.length === 0, erros.join(' | ').slice(0, 300))
await ctx.close()

// 5) visual 320/360/390 claro/escuro: Meus espaços com contador/botões
for (const [vn, view] of Object.entries({ 320: { width: 320, height: 568 }, 360: { width: 360, height: 780 }, 390: { width: 390, height: 844 } })) for (const tema of ['dark', 'light']) {
  const X = await abrir(view, tema); await painel(X.p)
  const c = await textoCortado(X.p, 'main').catch((e) => ['ERRO ' + e.message]); const h = await X.p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  ok(`${vn}/${tema}: Meus espaços (contador e botões) sem texto cortado nem rolagem lateral`, c.length === 0 && !h, JSON.stringify(c).slice(0, 250))
  const bts = await X.p.locator('.as-esp button').evaluateAll((bs) => bs.map((x) => ({ t: x.textContent.trim().slice(0, 30), h: Math.round(x.getBoundingClientRect().height) })))
  ok(`${vn}/${tema}: botões do painel >= 36 px de altura`, bts.every((x) => x.h >= 36), JSON.stringify(bts.filter((x) => x.h < 36)))
  await foto(X.p, `c11-espacos-${vn}-${tema}`); await X.ctx.close()
}
console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas de ' + R.length); await b.close()
