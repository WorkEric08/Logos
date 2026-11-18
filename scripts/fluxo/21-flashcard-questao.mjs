// Flashcard da questão: 2º toque, depois excluir o cartão e criar de novo; flashcard de questão marcada/anotada leva a anotação
import { abrirApp, irPara, onde, voltar, texto, toast } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({}); p.setDefaultTimeout(10000)
await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet')
await p.locator('.nota summary').click(); await p.fill('textarea', 'lembrar disto'); await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(300)
await p.locator('.criarcard').click(); await p.waitForTimeout(1200); out('1º toque:', await toast(p))
await p.waitForTimeout(3500)
await p.locator('.criarcard').click(); await p.waitForTimeout(1200); out('2º toque:', await toast(p))
await irPara(p, 'Cards'); await p.waitForTimeout(500)
await p.locator('.deck-abrir').first().evaluate((e) => e.click()); await p.waitForTimeout(600)
out('baralho:', (await texto(p)).replace(/\n/g, ' | ').slice(0, 500))
out('erros', erros); await fechar()
