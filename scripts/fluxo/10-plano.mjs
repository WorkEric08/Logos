// Plano de estudo do assistente: montar, sair no meio, voltar, Treinar mostra o treino guardado, terminar; treino do assistente → Sair
import { abrirApp, irPara, onde, voltar, texto, foto, toast } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({})
const bot = async () => (await p.locator('main button, .foot button').allInnerTexts()).filter(Boolean)
// sem cartões: baralho com 3 cartões
await irPara(p, 'Cards'); await p.click('text=Criar o primeiro baralho'); await p.fill('#nb', 'B'); await p.click('text=Criar baralho'); await p.waitForTimeout(700)
await p.click('.btn >> text=Novo cartão'); for (const i of [1, 2, 3]) { await p.fill('#cf', 'P' + i); await p.fill('#cv', 'R' + i); await p.click('text=Salvar e criar outro'); await p.waitForTimeout(400); if (i === 3) await voltar(p) }
await irPara(p, 'Assistente'); await p.waitForTimeout(5200)
await p.getByRole('button', { name: 'Painel do dia e plano de estudo', exact: true }).click(); await p.waitForTimeout(2500)
await p.getByRole('button', { name: /Montar o plano/ }).click(); await p.waitForTimeout(3500)
out('após montar plano:', await onde(p), '|', (await texto(p)).replace(/\n/g, ' | ').slice(-500)); await foto(p, 'plano-montado')
out('botões:', (await bot()).slice(-6))
await p.getByRole('button', { name: /Começar pelos cartões/ }).click(); await p.waitForTimeout(1500)
out('após Começar pelos cartões:', await onde(p), await bot())
await voltar(p); out('voltar do estudo (do plano) →', await onde(p))
await irPara(p, 'Assistente'); await p.waitForTimeout(2500)
out('assistente ao voltar:', (await texto(p)).replace(/\n/g, ' | ').slice(-420))
// terminar cartões: Mostrar resposta + nota
await p.getByRole('button', { name: /Começar pelos cartões|Continuar/ }).first().click().catch(() => out('(sem botão de continuar cartões)')); await p.waitForTimeout(1200)
out('estudo de novo:', await onde(p), await bot())
await foto(p, 'plano-estudo')
for (let i = 0; i < 8 && await p.locator('.fcface').count(); i++) {
  await p.getByRole('button', { name: 'Mostrar resposta' }).click().catch(() => {}); await p.waitForTimeout(250)
  const g = await p.locator('main button, .foot button').allInnerTexts(); if (i === 0) out('botões da resposta:', g)
  await p.locator('button', { hasText: /^(Bom|Fácil)/ }).first().click().catch(() => {}); await p.waitForTimeout(350)
}
await p.waitForTimeout(1500)
out('após cartões do plano:', await onde(p), await p.locator('.cnt').innerText().catch(() => ''), await toast(p))
if (await p.locator('.sheet').count()) {
  await p.locator('.alt:not([disabled])').first().click(); await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(300)
  await p.locator('.btn', { hasText: 'Sair' }).click(); await p.waitForTimeout(500)
  out('Sair do treino do plano →', await onde(p))
  await irPara(p, 'Treinar'); out('Treinar mostra treino guardado:', (await texto(p)).replace(/\n/g, ' | ').slice(0, 260)); await foto(p, 'plano-guardado-treinar')
  const ret = p.locator('button', { hasText: /Continuar|Voltar ao treino|Retomar/ }).first(); out('botão retomar:', await ret.count() ? await ret.innerText() : 'nenhum')
}
out('erros', erros)
await fechar()
