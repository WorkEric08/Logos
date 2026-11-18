// Simulado: todas as formas de sair no meio (Sair, voltar, aba) e o que sobra; recarregar no meio; Resultado → aba/voltar; novo simulado
import { abrirApp, irPara, onde, voltar, texto, toast, esperarMovimento } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({})
p.setDefaultTimeout(10000)
const stats = () => p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|'))
const iniciar = async () => { await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet') }
const resp = async (n) => { for (let i = 0; i < n; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(60) } }
await iniciar(); await resp(5)
await p.locator('.btn', { hasText: 'Sair' }).click(); await p.waitForTimeout(300); out('Sair → dialogo', await p.locator('.dialogo').count())
await p.keyboard.press('Escape'); await p.waitForTimeout(300); out('Esc fecha só o aviso:', await p.locator('.dialogo').count() === 0 && await p.locator('.sheet').count() === 1, p.url())
await irPara(p, 'Cards'); await p.getByRole('button', { name: 'Encerrar', exact: true }).click(); await p.waitForTimeout(500)
out('Encerrar via aba Cards →', await onde(p), '| stats (nada deve ter entrado):', await (async () => { await irPara(p, 'Início'); return stats() })())
// voltar → Encerrar
await iniciar(); await resp(2); await voltar(p); await p.getByRole('button', { name: 'Encerrar', exact: true }).click(); await p.waitForTimeout(500)
out('Encerrar via voltar →', await onde(p))
// toque na área fora do diálogo
await iniciar(); await voltar(p); await p.mouse.click(10, 10); await p.waitForTimeout(300); out('toque fora do aviso:', 'dialogo', await p.locator('.dialogo').count(), await onde(p))
await voltar(p).catch(() => {}); await p.waitForTimeout(300)
await p.getByRole('button', { name: 'Encerrar', exact: true }).click().catch(() => {}); await p.waitForTimeout(400)
// recarregar no meio
await iniciar(); await resp(3); await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p)
out('recarregar no meio do simulado →', await onde(p), '| stats', await stats(), '| toast', await toast(p))
// entregar completo, voltar do Resultado, abas
await iniciar(); for (let i = 0; i < 70; i++) { if (i < 40) await p.locator('.alt:not([disabled])').first().click(); await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(30) }
await p.waitForSelector('.cartao'); out('Resultado: foot', await p.locator('.foot .btn').allInnerTexts(), '| tempo mostra', /Tempo gasto/.test(await texto(p)))
await voltar(p); out('voltar do Resultado →', await onde(p), '| dialogo', await p.locator('.dialogo').count())
await irPara(p, 'Desempenho'); out('Desempenho simulados:', await p.locator('.simlist li').count(), (await p.locator('.simlist').innerText().catch(() => '')).replace(/\n/g, ' '))
out('erros', erros); await fechar()
