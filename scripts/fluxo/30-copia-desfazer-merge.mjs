// F-18: Desfazer da restauração num aparelho que JÁ tinha estudo: o que era do aparelho fica
import { abrirApp, irPara, voltar, texto, toast } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } }); p.setDefaultTimeout(10000)
await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 3; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(60); await p.locator('.foot .btn.pri').click() }
await voltar(p); await p.waitForTimeout(300)
await irPara(p, 'Cards'); await p.locator('text=Criar o primeiro baralho').click(); await p.fill('#nb', 'Do C'); await p.click('text=Criar baralho'); await p.waitForTimeout(600)
const est = async () => { await irPara(p, 'Início'); const st = await p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|')); await irPara(p, 'Cards'); await p.waitForTimeout(300); const b = await p.locator('.deck').allInnerTexts().then((a) => a.map((t) => t.split('\n')[0])); return `${st} / ${JSON.stringify(b)}` }
out('antes:', await est())
await irPara(p, 'Mais'); await p.setInputFiles('#copia-arquivo', 'scripts/fluxo/dados/copia-nova.json'); await p.waitForTimeout(1200)
await p.locator('.toast button', { hasText: 'Desfazer' }).click(); await p.waitForTimeout(1200)
out('depois de restaurar + Desfazer:', await est())
out('erros', erros); await fechar()
