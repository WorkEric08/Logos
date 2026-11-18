// Reverificação F-13, F-14, F-16
import { abrirApp, irPara, onde, voltar, texto, toast, foto } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
const out = (...a) => console.log(...a)
const { b, p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } }); p.setDefaultTimeout(15000)
// F-14
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
await p.getByRole('button', { name: 'Lembrete diário', exact: true }).click(); await p.waitForTimeout(1500)
const t14 = (await texto(p)).replace(/\n/g, ' | ')
out('F-14 opções de horário ainda aparecem?', /Manhã \(07:30\)/.test(t14), '| fala:', t14.slice(t14.lastIndexOf('Lembrete diário') + 15, t14.lastIndexOf('Lembrete diário') + 230))
// F-16 plano -> sair -> descartar
await p.getByRole('button', { name: 'Painel do dia e plano de estudo', exact: true }).click(); await p.waitForTimeout(1500)
await p.getByRole('button', { name: /Montar o plano/ }).click(); await p.waitForTimeout(1800)
await p.getByRole('button', { name: /Fazer as .* questões/ }).click(); await p.waitForSelector('.sheet')
await p.locator('.alt:not([disabled])').first().click(); await p.locator('.foot .btn.pri').click(); await p.locator('.btn', { hasText: 'Sair' }).click(); await p.waitForTimeout(400)
await irPara(p, 'Treinar'); await p.getByRole('button', { name: 'Descartar' }).click(); await p.waitForTimeout(500)
out('F-16 após Descartar: toast =', await toast(p), '| cartão some?', await p.locator('.treino-plano').count() === 0)
await p.locator('.toast button', { hasText: 'Desfazer' }).click(); await p.waitForTimeout(500); out('F-16 Desfazer devolve o plano?', await p.locator('.treino-plano').count() === 1)
// F-13 prévia
const prova = await pdfProva(b), gab = await pdfGabarito(b)
const arqs = async () => { await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab }) }
await irPara(p, 'Assistente'); await p.waitForTimeout(2500); await p.getByRole('button', { name: 'Mais sugestões' }).click().catch(() => {}); await p.waitForTimeout(1500)
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-espaco')
await p.fill('#as-espaco', 'E2'); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
await voltar(p); await p.waitForTimeout(400)
out('F-13 voltar na prévia: pergunta?', await p.locator('.dialogo').count(), '|', (await p.locator('.dialogo').innerText().catch(() => '')).replace(/\n/g, ' | '), '| onde', await onde(p))
await voltar(p); await p.waitForTimeout(300); out('F-13 voltar de novo fecha só o aviso:', await p.locator('.dialogo').count() === 0, await p.locator('.as-qs').count() === 1)
await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForTimeout(2500)
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
out('F-13 reimportar: aviso de já estão?', /já estão neste espaço/.test(await texto(p)))
out('erros', erros); await fechar()
