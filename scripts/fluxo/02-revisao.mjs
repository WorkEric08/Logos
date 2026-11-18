// Revisão pelo cartão-resposta (simulado e treino): como volta ao resultado; resposta em questão em branco na revisão
import { abrirApp, irPara, onde, voltar, texto } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({})
const stats = () => p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|'))
await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 69; i++) { if (i < 2) await p.locator('.alt:not([disabled])').first().click(); await p.locator('.foot .btn.pri').click() }
await p.locator('.foot .btn.pri').click(); await p.waitForSelector('.cartao')
const nota0 = (await p.locator('.score').innerText()).replace(/\n/g, ' ')
out('nota0', nota0)
await p.locator('.cell').nth(10).click(); await p.waitForSelector('.sheet')
out('revisão q11: botões foot', await p.locator('.foot .btn').allInnerTexts(), '| cnt', await p.locator('.cnt').innerText())
out('alts habilitadas na q em branco:', await p.locator('.alt:not([disabled])').count())
await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(200)
out('feedback:', (await p.locator('.fb').innerText().catch(() => 'nenhum')).replace(/\n/g, ' '))
// voltar ao resultado pelo sistema
await voltar(p); out('voltar → ', await onde(p))
out('nota após:', (await p.locator('.score').innerText()).replace(/\n/g, ' '), '| célula 11 classe:', await p.locator('.cell').nth(10).getAttribute('class'))
await p.locator('.foot .btn', { hasText: 'Início' }).click(); await p.waitForTimeout(300)
out('Início stats (vistas|acerto|rever):', await stats())
out('erros', erros)
await fechar()
