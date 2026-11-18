// Importar prova e "Treinar agora" (C-4), reimportar sem duplicar, trocar espaço, estado dos filtros e do progresso entre espaços
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
out('após adicionar:', (await texto(p)).replace(/\n/g, ' | ').slice(-380))
const ta = p.getByRole('button', { name: /Treinar agora/ }); out('Treinar agora existe?', await ta.count())
await ta.click(); await p.waitForTimeout(800)
out('Treinar agora →', await onde(p), '| filtros:', (await p.locator('.chip[aria-pressed=true]').allInnerTexts()).join(' / '), '|', await p.locator('.btn.pri', { hasText: 'Começar' }).innerText())
await foto(p, 'importar-treinar-agora')
await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 3; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(100) }
out('treino no espaço novo; foot:', await p.locator('.foot .btn').allInnerTexts())
for (let i = 0; i < 20 && await p.locator('.sheet').count(); i++) { await p.locator('.alt:not([disabled])').first().click({ timeout: 800 }).catch(() => {}); await p.locator('.foot .btn.pri').click().catch(() => {}); await p.waitForTimeout(100) }
out('resultado foot:', await p.locator('.foot .btn').allInnerTexts())
await p.locator('.foot .btn', { hasText: 'Início' }).click(); await p.waitForTimeout(500)
out('Início do espaço novo:', (await texto(p)).replace(/\n/g, ' | ').slice(0, 330))
// reimportar a mesma prova
await irPara(p, 'Assistente'); await p.waitForTimeout(1200)
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-f-prova', { state: 'attached' }).catch(() => out('sem seletor de arquivo', 'texto:', 0))
await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForTimeout(6000)
out('reimportar:', (await texto(p)).replace(/\n/g, ' | ').slice(-700)); await foto(p, 'importar-reimportar')
out('botões:', (await p.getByRole('button').allInnerTexts()).slice(-6))
out('erros', erros)
await fechar()
