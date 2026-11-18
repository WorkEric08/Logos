// C-8 / F-17 / F-18: restaurar a cópia nova (com marcações e anotações) e o Desfazer do aviso "Estudo restaurado."
import { abrirApp, irPara, voltar, texto, toast } from './_base.mjs'
const out = (...a) => console.log(...a)
const ARQ = process.argv[2] ?? 'scripts/fluxo/dados/copia-nova.json'
const { p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } }); p.setDefaultTimeout(10000)
const est = async () => {
  await irPara(p, 'Início'); const st = await p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|'))
  await irPara(p, 'Cards'); await p.waitForTimeout(300); const cards = (await texto(p)).split('\n').slice(0, 2).join(' ')
  await irPara(p, 'Treinar'); const marc = (await p.locator('.chip', { hasText: 'Marcadas' }).innerText()).replace(/\D/g, '')
  return `${st} / ${cards} / marcadas ${marc}`
}
out('antes:', await est())
await irPara(p, 'Mais'); await p.setInputFiles('#copia-arquivo', ARQ); await p.waitForTimeout(1500)
out('toast:', (await toast(p))?.split('\n').join(' / '))
out('mensagem:', (await p.locator('.card.copia [role=status]').allInnerTexts()).slice(-1)[0])
out('depois de restaurar:', await est())
// anotação voltou?
await p.locator('.chip', { hasText: 'Marcadas' }).click(); const c = p.locator('.btn.pri', { hasText: 'Começar' })
if (!(await c.isDisabled())) { await c.click(); await p.waitForSelector('.sheet'); out('anotação restaurada:', await p.locator('textarea').inputValue().catch(async () => (await p.locator('.nota summary').innerText())), '| marcada:', await p.locator('.marcar').getAttribute('aria-pressed')); await voltar(p); await p.waitForTimeout(300) }
await irPara(p, 'Mais'); await p.setInputFiles('#copia-arquivo', ARQ); await p.waitForTimeout(1200)
out('2ª restauração:', (await p.locator('.card.copia [role=status]').allInnerTexts()).slice(-1)[0], '| toast:', await toast(p))
await irPara(p, 'Mais'); await p.waitForTimeout(100)
// desfaz a 1ª: precisa do toast; refaz do zero
await p.reload(); await p.waitForSelector('h1'); 
out('--- Desfazer: aparelho vazio de novo (novo contexto) ---')
await fechar()
const b = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } }); const q = b.p; q.setDefaultTimeout(10000)
await irPara(q, 'Mais'); await q.setInputFiles('#copia-arquivo', ARQ); await q.waitForTimeout(1200)
out('toast:', (await toast(q))?.split('\n').join(' / '))
await q.locator('.toast button', { hasText: 'Desfazer' }).click(); await q.waitForTimeout(1200)
await irPara(q, 'Início'); const st = await q.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|'))
await irPara(q, 'Cards'); await q.waitForTimeout(300); const cards = (await texto(q)).split('\n').slice(0, 2).join(' ')
await irPara(q, 'Treinar'); const marc = (await q.locator('.chip', { hasText: 'Marcadas' }).innerText()).replace(/\D/g, '')
out('depois de Desfazer:', `${st} / ${cards} / marcadas ${marc}`)
out('erros', erros, b.erros); await b.fechar()
