// Mais: tema (persistência após recarregar), zerar + desfazer, cancelar, voltar com confirmação aberta; Desempenho com dados; Lembrete/Cópia no navegador
import { abrirApp, irPara, onde, voltar, texto, foto, toast, esperarMovimento } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({ tema: 'dark' })
const stats = () => p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|'))
// gera dados: treino rápido, 4 respostas
await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 4; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(80); await p.locator('.foot .btn.pri').click() }
await voltar(p); out('stats antes:', await stats())
await irPara(p, 'Mais'); await p.waitForTimeout(400)
out('Mais botões:', (await p.locator('main button').allInnerTexts()).filter(Boolean).join(' / '))
await foto(p, 'mais-topo')
// tema
await p.getByRole('button', { name: 'Claro', exact: true }).click(); await p.waitForTimeout(300)
out('tema aplicado:', await p.evaluate(() => document.documentElement.dataset.tema))
await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p)
out('após recarregar tema:', await p.evaluate(() => document.documentElement.dataset.tema), '| aba após recarregar:', await onde(p))
// zerar
await irPara(p, 'Mais'); await p.locator('.btn.warn', { hasText: 'Zerar tudo' }).click(); await p.waitForTimeout(300)
out('confirmação zerar:', (await p.locator('[role=alert]').innerText()).slice(0, 80))
await voltar(p); out('voltar com a confirmação aberta →', await onde(p))
await irPara(p, 'Mais'); out('confirmação ainda aberta ao voltar à aba?', await p.locator('text=Sim, zerar').count())
await p.locator('.btn.warn', { hasText: 'Zerar tudo' }).click(); await p.locator('text=Sim, zerar').click(); await p.waitForTimeout(500)
out('toast zerar:', await toast(p))
await irPara(p, 'Início'); out('stats após zerar:', await stats(), '| rever erros:', await p.locator('.tile', { hasText: 'Rever erros' }).innerText().then((t) => t.replace(/\n/g, ' ')))
await irPara(p, 'Mais'); out('Desfazer ainda visível depois de trocar de aba?', await toast(p))
await irPara(p, 'Início')
// desfazer
await irPara(p, 'Mais'); await p.locator('.btn.warn', { hasText: 'Zerar tudo' }).click(); await p.locator('text=Sim, zerar').click(); await p.waitForTimeout(400)
await p.locator('.toast button').click().catch((e) => out('sem botão desfazer', e.message.slice(0, 60))); await p.waitForTimeout(600)
await irPara(p, 'Início'); out('stats após Desfazer:', await stats())
await irPara(p, 'Desempenho'); await foto(p, 'desempenho-dados'); out('Desempenho:', (await texto(p)).replace(/\n/g, ' | ').slice(0, 200))
out('erros', erros)
await fechar()
