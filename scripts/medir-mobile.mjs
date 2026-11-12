// Medição de celular (site responsivo): em 320/360/390/412/768 px com toque, mede em cada tela
//  - rolagem lateral (scroll-y e janela) e rolagem da JANELA (só o conteúdo pode rolar);
//  - alvos de toque menores que 44 px (botão, link, resumo, campo);
//  - texto cortado (reticências, altura, estouro) com varrer-texto-cortado.mjs;
//  - focar um campo (anotação da questão) não mexe, esconde nem faz piscar nada: o teclado só cobre a tela.
// Uso: node scripts/medir-mobile.mjs [url=http://localhost:4173/]   (precisa de vite preview e playwright). Sai com 1 se algo falhar.
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { textoCortado } from './varrer-texto-cortado.mjs'
import { irPara, novoContexto } from './_ctx.mjs'
import { semMudar } from './_teclado.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
// em pé e também deitado (telas baixas: a quebra que importa costuma estar na altura)
const TAMANHOS = [[320, 568], [360, 640], [390, 844], [412, 892], [768, 1024], [568, 320], [640, 360], [844, 390], [892, 412]]
const MIN = 44
const falhas = []
const b = await chromium.launch({ channel: 'chrome' })

const medida = (p) => p.evaluate((MIN) => {
  const area = document.querySelector('.scroll-y')
  const pequenos = []
  for (const e of document.querySelectorAll('button, a[href], summary, label.btn, input:not([type=hidden]), textarea, select, [role=button], [tabindex="0"]')) {
    const r = e.getBoundingClientRect()
    if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden' || e.closest('.sr-only') || e.hidden) continue
    if (e.closest('.bars')) continue // gráfico: a faixa inteira é o alvo (ver escolheBarra em Views.tsx); medida abaixo
    if (r.bottom < 0 || r.top > innerHeight * 6) continue
    if (r.width < MIN - 0.5 || r.height < MIN - 0.5) pequenos.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 18)}" ${Math.round(r.width)}×${Math.round(r.height)}`)
  }
  return {
    lateral: Math.max(area.scrollWidth - area.clientWidth, document.documentElement.scrollWidth - innerWidth),
    janela: document.documentElement.scrollHeight - innerHeight,
    pequenos: [...new Set(pequenos)],
    grafico: (() => { const g = document.querySelector('.bars'); if (!g) return null; const r = g.getBoundingClientRect(); return r.height >= MIN && r.width >= MIN })(),
  }
}, MIN)

for (const [w, h] of TAMANHOS) {
  const ctx = await novoContexto(b, { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, colorScheme: 'dark' })
  const p = await ctx.newPage()
  const rot = `${w}×${h}`
  const confere = async (tela) => {
    await p.waitForTimeout(200)
    const m = await medida(p)
    const cortado = await textoCortado(p, '.shell')
    const prob = []
    if (m.lateral > 0) prob.push(`rolagem lateral ${m.lateral}px`)
    if (m.janela > 0) prob.push(`a janela rola ${m.janela}px`)
    if (m.pequenos.length) prob.push(`alvos < ${MIN}px: ${m.pequenos.join('; ')}`)
    if (m.grafico === false) prob.push('gráfico de barras com faixa de toque menor que 44px')
    if (cortado.length) prob.push(`texto cortado: ${cortado.slice(0, 4).join(' | ')}`)
    if (prob.length) falhas.push(`${rot} · ${tela}: ${prob.join(' — ')}`)
    return prob.length === 0
  }
  await p.goto(base); await p.waitForSelector('.folders')
  await confere('Início')
  await irPara(p, 'Treinar'); await p.waitForSelector('.filters')
  await p.locator('.chip', { hasText: /^Português\d+$/ }).first().click()
  await confere('Treinar (com temas)')
  await irPara(p, 'Desempenho'); await confere('Desempenho')
  await irPara(p, 'Mais'); await confere('Mais')

  // (o teclado na tela Mais saiu junto com o campo "Cole um backup"; o teclado com botões no pé segue medido na questão com anotação, mais abaixo)

  // flashcards: vazio, baralho, editor, lista de baralhos e estudo (frente e verso)
  await irPara(p, 'Cards'); await confere('Cards (vazio)')
  await p.click('text=Criar o primeiro baralho'); await p.fill('#nb', 'Siglas do Sistema Financeiro'); await p.click('text=Criar baralho')
  for (const [f, v] of [['SELIC', 'Taxa básica de juros da economia, definida pelo Copom a cada reunião'], ['CDI', 'Certificado de Depósito Interbancário']]) { await p.click('.btn >> text=Novo cartão'); await p.fill('#cf', f); await p.fill('#cv', v); await p.click('.foot >> text=Salvar >> nth=-1'); await p.waitForSelector('.fclista') }
  await confere('Cards (baralho)')
  await p.click('.btn >> text=Novo cartão'); await confere('Cards (editor)'); await p.click('.btn >> text=Voltar')
  await p.click('.btn >> text=Baralhos'); await confere('Cards (baralhos)')
  await p.locator('.deck .btn.pri').click(); await confere('Cards (estudo: frente)')
  await p.click('text=Mostrar resposta'); await confere('Cards (estudo: verso)')

  await irPara(p, 'Treinar'); await p.locator('.field', { has: p.locator('.lb', { hasText: 'Ordem' }) }).locator('.chip', { hasText: 'Ordem da prova' }).click()
  await p.click('text=Começar'); await p.waitForSelector('.sheet')
  await confere('Questão (antes de responder)')
  await p.locator('.alt').first().click(); await p.waitForSelector('.fb'); await confere('Questão (respondida)')
  // anotação com o teclado aberto
  await p.locator('.nota summary').click(); await p.locator('.nota textarea').focus()
  await p.locator('.nota textarea').blur()
  // o teclado só cobre a tela: focar a anotação não pode mexer em nada nem esconder Anterior/Próxima (README, "Teclado")
  const dif = await semMudar(p, () => p.locator('.nota textarea').focus())
  if (dif.length) falhas.push(`${rot} · Questão com teclado (anotação): a tela mudou ao focar o campo: ${dif.slice(0, 3).join(' | ')}`)
  if (!(await p.locator('.foot.sticky').isVisible())) falhas.push(`${rot} · Questão com teclado (anotação): Anterior/Próxima sumiram`)
  await p.locator('.nota textarea').blur()

  for (let i = 0; i < 9; i++) { await p.click('.foot .pri'); await p.waitForTimeout(40); if (i < 8) { await p.locator('.alt').first().click().catch(() => {}) } }
  await p.click('text=Ver resultado').catch(() => {})
  if (await p.locator('.cartao').count()) await confere('Resultado')
  await ctx.close()
}
await b.close()
console.log(falhas.length ? falhas.map((f) => `FALHOU ${f}`).join('\n') : 'OK: nenhuma falha de celular')
console.log(`\n${falhas.length} tela(s)/situação(ões) com problema em ${TAMANHOS.length} tamanhos.`)
process.exit(falhas.length ? 1 : 0)
