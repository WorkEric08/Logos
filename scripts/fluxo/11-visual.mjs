// 360x780 e 390x844, claro e escuro: texto cortado e rolagem horizontal em todas as abas e telas de sessão
import { abrirApp, irPara, voltar, foto, onde } from './_base.mjs'
import { textoCortado } from '../varrer-texto-cortado.mjs'
const out = (...a) => console.log(...a)
for (const view of ['cel360', 'cel390']) for (const tema of ['light', 'dark']) {
  const { p, erros, fechar } = await abrirApp({ view, tema })
  const checa = async (nome) => {
    await p.waitForTimeout(400)
    const c = await textoCortado(p).catch((e) => ['ERRO ' + e.message])
    const h = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1)
    if (c.length || h) out(`PROBLEMA ${view}/${tema}/${nome}: cortado=${JSON.stringify(c).slice(0, 300)} hscroll=${h}`)
    return c.length === 0 && !h
  }
  let ok = 0, tot = 0
  for (const aba of ['Início', 'Treinar', 'Cards', 'Assistente', 'Desempenho', 'Mais']) { await irPara(p, aba); await p.waitForTimeout(aba === 'Assistente' ? 5500 : 300); tot++; ok += (await checa(aba)) ? 1 : 0 }
  await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet'); tot++; ok += (await checa('questão')) ? 1 : 0
  await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(300); tot++; ok += (await checa('questão respondida')) ? 1 : 0
  await p.locator('.nota summary').click(); tot++; ok += (await checa('questão com anotação')) ? 1 : 0
  await foto(p, `vis-${view}-${tema}-questao`)
  await voltar(p)
  await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet'); tot++; ok += (await checa('simulado')) ? 1 : 0
  for (let i = 0; i < 70; i++) await p.locator('.foot .btn.pri').click()
  await p.waitForSelector('.cartao'); tot++; ok += (await checa('resultado simulado')) ? 1 : 0
  await foto(p, `vis-${view}-${tema}-resultado`)
  out(view, tema, `${ok}/${tot} telas sem problema`, erros.length ? erros : '')
  await fechar()
}
