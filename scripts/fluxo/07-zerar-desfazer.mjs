// Zerar progresso com dados e Desfazer (e Desfazer depois de responder mais, e depois de recarregar)
import { abrirApp, irPara, voltar, toast, esperarMovimento } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({})
const stats = () => p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|'))
const treino = async (n) => { await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet'); for (let i = 0; i < n; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(80); await p.locator('.foot .btn.pri').click() } ; await voltar(p) }
await treino(4); out('antes:', await stats())
await irPara(p, 'Mais'); await p.locator('.btn.warn', { hasText: 'Zerar tudo' }).click(); await p.locator('text=Sim, zerar').click(); await p.waitForTimeout(500)
await irPara(p, 'Início'); out('após zerar:', await stats())
await treino(2); out('após 2 respostas novas:', await stats())
await p.locator('.toast button', { hasText: 'Desfazer' }).click().catch(() => out('(toast Desfazer já sumiu)')) // pode já ter sumido
await p.waitForTimeout(600); out('após Desfazer:', await stats())
// zerar de novo e desfazer na hora
await irPara(p, 'Mais'); await p.locator('.btn.warn', { hasText: 'Zerar tudo' }).click(); await p.locator('text=Sim, zerar').click(); await p.waitForTimeout(400)
await p.locator('.toast button', { hasText: 'Desfazer' }).click(); await p.waitForTimeout(700)
await irPara(p, 'Início'); out('zerar+desfazer imediato:', await stats())
await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p); out('após recarregar:', await stats())
out('erros', erros); await fechar()
