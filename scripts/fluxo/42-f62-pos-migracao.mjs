// F6.2 depois da migração (banco v7 -> v8): tabelas novas coerentes; apagar espaço não ressuscita pelas tabelas antigas; importar/desfazer/recarregar; cópia de segurança v2 e v1 (restaurar nele e exportar dele)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { novoContexto, irPara, esperarMovimento } from '../_ctx.mjs'
import { despejar, restaurar } from './_idb.mjs'
import { texto, voltar, BASE } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const out = (...a) => console.log(...a)
const R = []; const ok = (n, c, x = '') => { const l = `${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`; R.push(l); console.log(l) }
const D = (n) => join(process.cwd(), 'scripts', 'fluxo', 'dados', n)
const v7 = JSON.parse(readFileSync(D('banco-v7.json'), 'utf8'))
const b = await chromium.launch({ channel: 'chrome' })
const prova = await pdfProva(b), gab = await pdfGabarito(b)
const ctx = await novoContexto(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce', acceptDownloads: true })
const p = await ctx.newPage(); p.setDefaultTimeout(20000)
const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR|status of 404/.test(m.text())) erros.push('console: ' + m.text()) })
await p.goto(BASE + 'icon-192.png'); await restaurar(p, v7)
await p.goto(BASE); await p.waitForSelector('h1'); await esperarMovimento(p); await p.waitForTimeout(800)
const chat = async () => { await irPara(p, 'Assistente'); await p.waitForTimeout(1200); for (let i = 0; i < 4 && !(await p.locator('#as-msg').count()); i++) { await p.getByRole('button', { name: /^(Voltar|Cancelar)$|Mais sugestões/ }).first().click().catch(() => {}); await p.waitForTimeout(700) } }
const dizer = async (t) => { await chat(); await p.fill('#as-msg', t); await p.keyboard.press('Enter'); await p.waitForTimeout(1300) }
const painel = async () => { await dizer('meus espaços'); await p.waitForTimeout(600); return (await p.locator('.as-esp').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')) }
const ativar = async (nome) => { await painel(); await p.getByRole('button', { name: new RegExp(nome) }).first().click(); await p.waitForTimeout(1500) }
const treinarN = async () => { await irPara(p, 'Treinar'); return parseInt((await p.locator('.top small').first().innerText()).replace(/\D/g, '') || '0') }
const stats = async () => { await irPara(p, 'Início'); return p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|')) }

// 1. tabelas novas coerentes com as antigas
let d = await despejar(p)
const qe = d.stores.questoesE?.valores ?? [], ie = d.stores.imagensE?.valores ?? []
ok('questoesE tem as 17 questões (cópia das antigas)', qe.length === v7.stores.questoes.valores.length, String(qe.length))
ok('questoesE: cada [e+id] antigo existe', v7.stores.questoes.valores.every((r) => qe.some((x) => x.id === r.id && x.e === r.e)))
ok('imagensE tem a imagem recortada, com o mesmo blob', ie.length === v7.stores.imagens.valores.length && JSON.stringify(ie[0]?.blob) === JSON.stringify(v7.stores.imagens.valores[0].blob))
ok('as tabelas antigas continuam intactas (questoes e imagens)', d.stores.questoes.valores.length === 17 && d.stores.imagens.valores.length === 1)
await ativar('Banco do Brasil'); const antes = await stats(); out('estatísticas depois da migração:', antes)
const esp0 = await painel(); out('espaços:', esp0.join(' || '))

// 2. apagar um espaço e recarregar: não ressuscita
await p.getByRole('button', { name: /Apagar o espaço Concurso X/ }).click(); await p.waitForTimeout(500); await p.locator('.dialogo .btn', { hasText: /Apagar/ }).last().click(); await p.waitForTimeout(1500)
d = await despejar(p)
ok('apagar "Concurso X": sai de espacos, questoesE, materiais e trechos', !d.stores.espacos.valores.some((e) => e.nome === 'Concurso X') && !d.stores.questoesE.valores.some((x) => x.e === qe[0].e) && d.stores.materiais.valores.length === 0 && d.stores.trechos.valores.length === 0, JSON.stringify({ espacos: d.stores.espacos.valores.length, questoesE: d.stores.questoesE.valores.length, mat: d.stores.materiais.valores.length }))
out('tabela ANTIGA questoes depois de apagar:', d.stores.questoes.valores.length, '(se > 0 há lixo órfão, mas o que importa é não ressuscitar)')
await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p); await p.waitForTimeout(800)
const esp1 = await painel(); ok('depois de recarregar o espaço apagado NÃO volta', !esp1.some((t) => /Concurso X/.test(t)), esp1.join(' || '))
await ativar('Banco do Brasil'); ok('"Meu BB" continua e o progresso (respostas) do BB segue igual', esp1.some((t) => /Meu BB/.test(t)) && (await stats()) === antes, `${antes} -> ${await stats()}`)

// 3. importar uma prova nova no Meu BB, recarregar, desfazer
await ativar('Meu BB')
await dizer('importar prova'); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab })
await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 }); await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso')
const nMais = await treinarN(); ok('Meu BB: 1168 + 8 questões', nMais === 1176, String(nMais))
await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p); await p.waitForTimeout(800); await ativar('Meu BB')
ok('depois de recarregar continua 1176', (await treinarN()) === 1176)
await chat(); await p.getByRole('button', { name: /Desfazer: importar a prova/ }).click().catch(() => out('(sem pílula de desfazer depois de recarregar: esperado)')); await p.waitForTimeout(1500)

// 4. cópia de segurança: v1 (antiga) e v2 restauradas nele; e exportar dele
await irPara(p, 'Mais'); await p.setInputFiles('#copia-arquivo', D('copia-antiga.json')); await p.waitForTimeout(2000)
out('restaurar cópia v1:', (await p.locator('.card.copia [role=status],.card.copia [role=alert]').allInnerTexts()).slice(-1)[0])
ok('cópia v1 aceita no banco v8', /Restaurei|Nada novo/.test((await p.locator('.card.copia [role=status],.card.copia [role=alert]').allInnerTexts()).slice(-1)[0] ?? ''))
await p.setInputFiles('#copia-arquivo', D('copia-nova.json')); await p.waitForTimeout(2000)
out('restaurar cópia v2:', (await p.locator('.card.copia [role=status],.card.copia [role=alert]').allInnerTexts()).slice(-1)[0])
ok('cópia v2 aceita no banco v8', /Restaurei|Nada novo/.test((await p.locator('.card.copia [role=status],.card.copia [role=alert]').allInnerTexts()).slice(-1)[0] ?? ''))
await p.setInputFiles('#copia-arquivo', D('copia-c10.json')); await p.waitForTimeout(2000); out('restaurar cópia c10 (v2 com enunciados):', (await p.locator('.card.copia [role=status],.card.copia [role=alert]').allInnerTexts()).slice(-1)[0])
const dl = p.waitForEvent('download'); await p.getByRole('button', { name: 'Salvar cópia' }).click(); const dd = await dl; await dd.saveAs(D('copia-v8.json'))
const cj = JSON.parse(readFileSync(D('copia-v8.json'), 'utf8')); out('cópia exportada do v8: versao', cj.versao, '| espaços', cj.espacos.length, 'questões', cj.questoes.length, 'imagens', cj.imagens.length, 'materiais', cj.materiais.length)
ok('cópia exportada do v8 mantém formato v2 (versao 2) e traz espaços/questões', cj.versao === 2 && cj.espacos.length >= 1 && cj.questoes.length >= 8)
ok('questões exportadas têm enunciado (campo enun)', cj.questoes.filter((q) => q.enun !== undefined || (q.q && q.q.e)).length > 0)
ok('sem erros de script', erros.length === 0, erros.join(' | ').slice(0, 300))
console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas de ' + R.length); await b.close()
