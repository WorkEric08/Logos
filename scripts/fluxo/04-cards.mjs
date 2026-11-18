// Cards: criar baralho, cartão, estudar, sair no meio, flashcard de questão duplicado, excluir
import { abrirApp, irPara, onde, voltar, texto, foto, toast } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({})
const botoes = async () => (await p.locator('main button, .foot button').allInnerTexts()).filter(Boolean)
await irPara(p, 'Cards')
await p.click('text=Criar o primeiro baralho'); out('form novo baralho:', await botoes())
await voltar(p); out('voltar do form →', await onde(p)); await irPara(p, 'Cards')
await p.click('text=Criar o primeiro baralho'); await p.fill('#nb', 'Teste'); await p.click('text=Criar baralho'); await p.waitForSelector('.fcacoes'); await p.waitForTimeout(600)
out('baralho vazio botões:', await botoes(), '|', (await texto(p)).replace(/\n/g, ' | ').slice(0, 300))
await foto(p, 'cards-baralho-vazio')
// estudar sem cartões?
const est = p.locator('.btn', { hasText: 'Estudar' })
out('Estudar habilitado no vazio?', await est.count() ? await est.first().isEnabled() : 'sem botão')
await p.click('.btn >> text=Novo cartão'); await p.fill('#cf', 'P1'); await p.fill('#cv', 'R1'); await p.click('.foot >> text=Salvar >> nth=-1'); await p.waitForTimeout(800)
out('após salvar:', await onde(p), await toast(p))
await p.click('.btn >> text=Novo cartão'); await p.fill('#cf', 'P2'); await p.fill('#cv', 'R2'); await p.click('text=Salvar e criar outro'); await p.waitForTimeout(300)
out('após salvar e criar outro: campos vazios?', await p.inputValue('#cf') === '', await toast(p))
await voltar(p); out('voltar →', await onde(p))
out('lista de cartões:', (await texto(p)).replace(/\n/g, ' | ').slice(0, 400))
// estudar, sair no meio
await p.click('.btn >> text=Estudar'); await p.waitForSelector('.fcface'); out('estudo:', (await texto(p)).replace(/\n/g, ' | ').slice(0, 200), await botoes())
await foto(p, 'cards-estudo')
await voltar(p); out('voltar do estudo →', await onde(p))
await p.click('.btn >> text=Estudar'); await p.waitForSelector('.fcface'); out('reabrir estudo retoma?', (await texto(p)).replace(/\n/g, ' | ').slice(0, 120))
// terminar o estudo
for (let i = 0; i < 6; i++) {
  const b = await botoes(); out(' passo', i, b)
  const mostrar = p.locator('button', { hasText: /Mostrar|Virar|resposta/i }).first()
  if (await mostrar.count()) await mostrar.click().catch(() => {})
  await p.waitForTimeout(150)
  const nota = p.locator('button', { hasText: /^(Bom|Fácil|Facil|Good|Acertei)/i }).first()
  if (await nota.count()) await nota.click().catch(() => {})
  await p.waitForTimeout(200)
}
out('fim do estudo:', await onde(p), '|', (await texto(p)).replace(/\n/g, ' | ').slice(0, 300), await botoes())
await foto(p, 'cards-fim-estudo')
out('erros', erros)
await fechar()
