// Fluxos de sessão: treino rápido / Treinar / simulado — sair no meio, voltar, trocar de aba, retomar, terminar, reiniciar
import { abrirApp, irPara, onde, voltar, toast, foto, texto, historyLen } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({})
const estado = () => p.evaluate(() => {
  const t = [...document.querySelectorAll('.stat b')].map((e) => e.textContent)
  return t.join('|')
})
const responder = async (n) => { for (let i = 0; i < n; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(80); if (i < n - 1) await p.locator('.foot .btn.pri').click() } }

out('--- A. Treino rápido, responde 2, voltar do sistema')
await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet')
out('cnt', await p.locator('.cnt').innerText(), 'hist', await historyLen(p))
await responder(2)
await voltar(p)
out('onde após voltar:', await onde(p), '| stats:', await estado())
out('Rever erros tile:', await p.locator('.tile', { hasText: 'Rever erros' }).innerText().then((t) => t.replace(/\n/g, ' ')))

out('--- B. Treino → Sair (botão da tela) → destino')
await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet')
await p.locator('.btn', { hasText: 'Sair' }).click(); await p.waitForTimeout(300)
out('onde após Sair:', await onde(p))

out('--- C. Treinar com filtro Português/qtd 10 → Começar → Sair')
await irPara(p, 'Treinar')
await p.locator('.chip', { hasText: 'Português' }).first().click()
await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet')
await p.locator('.btn', { hasText: 'Sair' }).click(); await p.waitForTimeout(300)
out('onde após Sair (veio de Treinar):', await onde(p))
await irPara(p, 'Treinar'); out('filtro Português ainda marcado?', await p.locator('.chip[aria-pressed=true]', { hasText: 'Português' }).count())

out('--- D. Treino terminar: 10 q via Treinar (qtd 10), Ver resultado, botões do resultado')
await p.locator('.chip', { hasText: 'Todas' }).first().click() // limpa matéria
await p.locator('.chip', { hasText: 'Português' }).first().click()
await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet')
const n = parseInt((await p.locator('.cnt').innerText()).split('/')[1])
for (let i = 0; i < n; i++) { await p.locator('.alt:not([disabled])').first().click().catch(() => {}); await p.waitForTimeout(40); await p.locator('.foot .btn.pri').click() }
await p.waitForTimeout(400)
out('após terminar:', await onde(p), '|', (await texto(p)).slice(0, 160).replace(/\n/g, ' | '))
out('botões do foot:', await p.locator('.foot .btn').allInnerTexts())
await p.locator('.foot .btn.pri').click(); await p.waitForSelector('.sheet')
out('"Mais 10 por peso" respeita matéria Português? matérias:', await p.locator('.tag.m').allInnerTexts())
await voltar(p)

out('--- E. Simulado: voltar, Sair, trocar de aba pela barra')
await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet')
await responder(3)
await irPara(p, 'Cards').catch((e) => out('irPara err', e.message.slice(0, 100)))
out('após tocar aba Cards: dialogo?', await p.locator('.dialogo').count(), 'onde', await onde(p))
out('texto diálogo:', (await p.locator('.dialogo').innerText().catch(() => '')).replace(/\n/g, ' | '))
await foto(p, 'sim-aviso-aba')
await p.getByRole('button', { name: /Continuar/ }).click(); await p.waitForTimeout(300)
out('Continuar: onde', await onde(p), '| cnt', await p.locator('.cnt').innerText())

out('--- F. Simulado → Entregar prova com poucas respondidas (aviso?)')
// avança até o fim
for (let i = 0; i < 70; i++) { const b = p.locator('.foot .btn.pri'); const t = await b.innerText(); if (/Entregar/.test(t)) break; await b.click() }
out('botão final:', await p.locator('.foot .btn.pri').innerText())
await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(500)
out('após Entregar:', await onde(p), '| dialogo?', await p.locator('.dialogo').count(), '|', (await texto(p)).slice(0, 200).replace(/\n/g, ' | '))
await foto(p, 'sim-resultado')
out('Rever erros agora:', await p.evaluate(() => 0))
// revisão: responder questão em branco
await p.locator('.cell:not(.ok):not(.err)').first().click(); await p.waitForSelector('.sheet')
out('revisão de questão em branco: alternativas habilitadas?', await p.locator('.alt:not([disabled])').count())
await p.locator('.alt:not([disabled])').first().click().catch(() => {})
await p.waitForTimeout(200)
out('respondeu em revisão; fb?', await p.locator('.fb').count())
await p.locator('.foot .btn', { hasText: 'Voltar ao resultado' }).click().catch(async () => { await p.locator('.foot .btn.pri').click() })
await p.waitForTimeout(300)
out('cartão-resposta: células em branco agora', await p.locator('.cell:not(.ok):not(.err)').count(), 'nota', (await p.locator('.score').innerText().catch(() => '')).replace(/\n/g, ' '))
await p.locator('.foot .btn', { hasText: 'Início' }).click(); await p.waitForTimeout(300)
out('stats final', await estado(), '| toast', await toast(p))
out('erros de script:', erros)
await fechar()
