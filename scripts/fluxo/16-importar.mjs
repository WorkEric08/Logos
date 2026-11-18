// Importar prova (PDF gerado pelo Chrome): criar espaço, ler, voltar no meio da leitura/prévia, entrar, "Treinar agora" (C-4), reimportar (sem duplicar), trocar de espaço, filtros
import { createRequire } from 'node:module'
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
await voltar(p); await p.waitForTimeout(600); out('voltar DURANTE a leitura →', await onde(p))
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
out('ao voltar ao assistente após interromper:', (await texto(p)).replace(/\n/g, ' | ').slice(-300))
// de novo, deixa terminar
if (!(await p.locator('.as-qs').count())) {
  if (!(await p.locator('#as-f-prova').count())) { await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500) }
  await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click().catch(() => {})
}
await p.waitForSelector('.as-qs', { timeout: 60000 }); out('prévia pronta:', await p.locator('.as-q').count(), 'questões')
await foto(p, 'importar-previa')
await voltar(p); await p.waitForTimeout(600); out('voltar na prévia →', await onde(p), '| prévia ainda?', await p.locator('.as-qs').count())
await irPara(p, 'Assistente'); await p.waitForTimeout(1200)
out('assistente após cancelar prévia:', (await p.getByRole('button').allInnerTexts()).slice(-5))
await fechar()
