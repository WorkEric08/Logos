// Desfazer "criar espaço" depois de importar prova e treinar nele: o que some?
import { join } from 'node:path'
import { abrirApp, irPara, onde, voltar, texto, foto, toast } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
const out = (...a) => console.log(...a)
const { b, p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } })
const prova = await pdfProva(b), gab = await pdfGabarito(b)
p.setDefaultTimeout(15000)
const arqs = async () => { await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab }) }
// deixa um filtro de antes no Treinar (C-4)
await irPara(p, 'Treinar'); await p.locator('.chip', { hasText: 'Português' }).first().click(); await p.locator('.chip', { hasText: 'Errei por último' }).click()
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-espaco')
await p.fill('#as-espaco', 'Meu espaço'); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForSelector('#as-f-prova', { state: 'attached' })
out('espaço criado; subtítulo:', await p.locator('.top small').innerText())
await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click()
await p.waitForSelector('.as-qs', { timeout: 60000 })
await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForTimeout(3000)
// responde 2 questões do espaço novo
await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 2; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(100) }
await voltar(p)
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
const bt = (await p.getByRole('button').allInnerTexts()).filter((t) => /Desfazer/.test(t)); out('pílulas Desfazer na conversa:', bt)
if (bt.length) {
  await p.getByRole('button', { name: /Desfazer/ }).first().click(); await p.waitForTimeout(2500)
  out('após tocar Desfazer:', (await texto(p)).replace(/\n/g, ' | ').slice(-350), '| diálogo de confirmação?', await p.locator('.dialogo').count())
  await irPara(p, 'Treinar'); out('Treinar agora:', (await texto(p)).split('\n').slice(0, 2).join(' | '))
  await irPara(p, 'Início'); out('Início:', (await texto(p)).replace(/\n/g, ' | ').slice(0, 200))
}
out('erros', erros); await fechar()
