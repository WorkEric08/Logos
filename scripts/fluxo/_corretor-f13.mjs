import { abrirApp, irPara, voltar } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
const out = []; const ok = (n, c, x = '') => out.push(`${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`)
const { b, p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } })
const prova = await pdfProva(b), gab = await pdfGabarito(b)
p.setDefaultTimeout(20000)
const arqs = async () => { await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab }) }
await irPara(p, 'Assistente'); await p.waitForTimeout(1200)
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-espaco')
await p.fill('#as-espaco', 'Meu espaço'); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
ok('1ª leitura: sem aviso de "já estão"', !/já est/.test(await p.locator('.as-painel .note[role=status]').first().innerText()))
// voltar do aparelho na prévia: pergunta antes de descartar
await voltar(p); await p.waitForTimeout(400)
ok('voltar na prévia abre "Descartar esta prévia?"', (await p.locator('.dialogo h2').innerText().catch(() => '')) === 'Descartar esta prévia?')
await voltar(p); await p.waitForTimeout(300)
ok('voltar de novo fecha só o aviso e a prévia continua', (await p.locator('.dialogo').count()) === 0 && (await p.locator('.as-qs').count()) === 1)
await voltar(p); await p.waitForTimeout(300); await p.getByRole('button', { name: 'Descartar', exact: true }).click(); await p.waitForTimeout(500)
ok('Descartar volta às sugestões (continua no Assistente)', (await p.locator('.as-qs').count()) === 0 && (await p.locator('.as-pilula').count()) > 0)
// importa de verdade e reimporta
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForTimeout(3000)
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
const nota = await p.locator('.as-painel .note[role=status]').first().innerText()
ok('reimportar: a prévia diz quantas já estão neste espaço', /já (está|estão) neste espaço/.test(nota), nota)
ok('sem erros de script', erros.length === 0, erros.join('|'))
console.log(out.join('\n')); await fechar()
