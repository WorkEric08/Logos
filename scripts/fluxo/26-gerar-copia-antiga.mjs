// Gera uma cópia no formato ATUAL do dev server e, à mão (a cópia antiga v1 = sem "estudo", versao 1: formato do commit HEAD), vira scripts/fluxo/dados/copia-antiga.json. Para testar a restauração de cópia antiga (C-8)
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { abrirApp, irPara, texto } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
import { TEXTO_RESUMO } from '../_pdf-prova.mjs'
const { b, p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce', acceptDownloads: true } }); p.setDefaultTimeout(15000)
const prova = await pdfProva(b), gab = await pdfGabarito(b)
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-espaco')
await p.fill('#as-espaco', 'Antigo'); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova })
await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab })
await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForTimeout(2500)
await irPara(p, 'Mais'); await p.waitForTimeout(600)
const dl = p.waitForEvent('download')
await p.getByRole('button', { name: 'Salvar cópia' }).click()
const d = await dl; await d.saveAs(join(process.cwd(), 'scripts', 'fluxo', 'dados', 'copia-antiga.json'))
console.log('salvo', d.suggestedFilename(), (await p.locator('.card.copia [role=status]').allInnerTexts()).join(' / ')); console.log('erros', erros); await fechar()
