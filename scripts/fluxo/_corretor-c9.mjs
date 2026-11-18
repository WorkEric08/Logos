import { abrirApp, irPara } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
const out = []; const ok = (n, c, x = '') => out.push(`${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`)
const { b, p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } })
const prova = await pdfProva(b), gab = await pdfGabarito(b)
p.setDefaultTimeout(20000)
const arqs = async () => { await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab }) }
const importar = async () => { await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-f-prova', { state: 'attached' }); await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 }); await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso', { timeout: 20000 }) }
await irPara(p, 'Assistente'); await p.waitForTimeout(1200)
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-espaco')
await p.fill('#as-espaco', 'Espaço C9'); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso', { timeout: 20000 })
const pil = () => p.getByRole('button').allInnerTexts().then((l) => l.filter((t) => /Desfazer/.test(t)))
ok('depois de importar a prova há "Desfazer: importar a prova" (e não o de criar o espaço)', (await pil()).join('|') === 'Desfazer: importar a prova', (await pil()).join('|'))
await p.getByRole('button', { name: /Desfazer: importar a prova/ }).click(); await p.waitForTimeout(1500)
ok('desfazer diz "Desfiz: importar a prova"', /Desfiz: importar a prova/.test(await p.locator('.as-chat').innerText()))
await irPara(p, 'Início'); await p.waitForTimeout(400)
ok('o espaço ficou sem as questões (estado vazio) mas continua existindo', /Este espaço ainda não tem questões/.test(await p.locator('main').innerText()) && /Espaço C9/.test(await p.locator('main').innerText()))
await irPara(p, 'Assistente'); await p.waitForTimeout(800); await importar()
ok('dá para importar de novo depois de desfazer', true)
// estudar uma questão e tentar desfazer: recusa
await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet')
await p.locator('.alt:not([disabled])').first().click(); await p.locator('.btn.small-btn', { hasText: 'Sair' }).click(); await p.waitForTimeout(400)
await irPara(p, 'Assistente'); await p.waitForTimeout(1200)
ok('depois de começar um treino com as questões, o "Desfazer: importar a prova" some', (await pil()).length === 0, (await pil()).join('|'))
ok('sem erros de script', erros.length === 0, erros.join('|'))
console.log(out.join('\n')); await fechar()
