// F6.5 visual: aviso da 1ª subida, Meus espaços (selos e chip), Mais > Conta e sincronização, em 320x568, 360x780, 390x844, claro e escuro: texto cortado, rolagem lateral, botões do aviso >= 44 px
import { irPara } from '../_ctx.mjs'
import { foto } from './_base.mjs'
import { textoCortado } from '../varrer-texto-cortado.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
import { aparelho, entrar, fim, lancar, ok, out, emailUnico, painelEspacos } from './_dois.mjs'
import { arquivos, avisoDeSubida, chat, dizer, importarProva } from './_espacos.mjs'
const b = await lancar(); const pdfs = arquivos(await pdfProva(b), await pdfGabarito(b))
const VIEWS = { '320': { width: 320, height: 568 }, '360': { width: 360, height: 780 }, '390': { width: 390, height: 844 } }
for (const [vn, view] of Object.entries(VIEWS)) for (const tema of ['dark', 'light']) {
  const tag = `${vn}-${tema}`
  const X = await aparelho(b, emailUnico('vis' + vn), { view, tema }); await entrar(X.p)
  const hscroll = () => X.p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  const confere = async (nome, raiz = 'main') => { const c = await textoCortado(X.p, raiz).catch((e) => ['ERRO ' + e.message]); ok(`${tag} ${nome}: sem texto cortado nem rolagem lateral`, c.length === 0 && !(await hscroll()), JSON.stringify(c).slice(0, 250)) }
  await dizer(X.p, 'meus espaços'); await X.p.getByRole('button', { name: 'Novo espaço', exact: true }).click(); await X.p.waitForSelector('#as-espaco'); await X.p.fill('#as-espaco', 'Visual'); await X.p.getByRole('button', { name: 'Criar vazio' }).click(); await X.p.waitForTimeout(2000)
  const d = X.p.locator('.dialogo', { hasText: 'O que sobe para a sua conta' })
  ok(`${tag} aviso aparece`, (await d.count()) === 1)
  if (await d.count()) {
    await confere('aviso', '.dialogo')
    const caixas = await d.locator('button').evaluateAll((bs) => bs.map((x) => { const r = x.getBoundingClientRect(); return { t: x.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) } }))
    ok(`${tag} aviso: botões >= 44 px de altura e visíveis`, caixas.length === 2 && caixas.every((c) => c.h >= 44 && c.w > 60), JSON.stringify(caixas))
    const dentro = await d.evaluate((x) => { const r = x.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight })
    ok(`${tag} aviso cabe inteiro na tela`, dentro)
    await foto(X.p, `f65-aviso-${tag}`)
    await d.getByRole('button', { name: 'Enviar para a conta' }).click(); await X.p.waitForTimeout(800)
  }
  await importarProva(X.p, pdfs); await X.p.waitForTimeout(3000)
  await painelEspacos(X.p); await confere('Meus espaços (com selos)'); await foto(X.p, `f65-espacos-${tag}`)
  await irPara(X.p, 'Mais'); await X.p.waitForSelector('.conta'); await X.p.waitForTimeout(1200); await confere('Mais › Conta e sincronização'); await foto(X.p, `f65-mais-${tag}`)
  const bts = await X.p.locator('.conta button').evaluateAll((bs) => bs.map((x) => ({ t: x.textContent.trim(), h: Math.round(x.getBoundingClientRect().height) })))
  ok(`${tag} Mais: botões da conta >= 44 px`, bts.every((c) => c.h >= 44), JSON.stringify(bts))
  ok(`${tag} sem erros de script`, X.erros.length === 0, X.erros.join(' | ').slice(0, 200))
  await X.ctx.close()
}
fim(); await b.close()
