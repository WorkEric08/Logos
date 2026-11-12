// Varredura visual em 320/360/390/768/1024/1440 px, claro e escuro: rolagem lateral, texto cortado, onde a imagem aparece,
// alternativas clicáveis + ✓/✕, link de ampliar, mensagens. Salva capturas em docs/verificacao-capturas/.
// Uso: node scripts/e2e-visual.mjs [url=http://localhost:4173/]   (precisa de vite preview e de `playwright`)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { textoCortado } from './varrer-texto-cortado.mjs'
import { irPara, novoContexto, esperarMovimento } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const PASTA = 'docs/verificacao-capturas'
mkdirSync(PASTA, { recursive: true })
const TAMANHOS = [[320, 568], [360, 740], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]
const FOTOS = new Set([320, 390, 768, 1440]) // tamanhos com captura salva
const linhas = [], capturas = []
let falhas = 0
const ok = (n, c, x = '') => { if (!c) falhas++; linhas.push(`${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`) }
const b = await chromium.launch({ channel: 'chrome' })

async function irParaEstatistica(p, k) {
  await p.goto(base); await p.waitForSelector('.folders')
  await irPara(p, 'Treinar')
  await p.locator('.chip', { hasText: /^Estatística\d+$/ }).first().click()
  await p.locator('.chip', { hasText: 'Banco da Amazônia 2024' }).first().click()
  await p.locator('.field', { has: p.locator('.lb', { hasText: 'Quantidade' }) }).locator('.chip', { hasText: 'Todas' }).click()
  await p.locator('.chip', { hasText: 'Ordem da prova' }).click(); await p.click('text=Começar'); await p.waitForSelector('.sheet')
  for (let i = 0; i < k; i++) { await p.click('.foot .pri'); await p.waitForTimeout(80) }
}

for (const tema of ['light', 'dark']) for (const [w, h] of TAMANHOS) {
  const rot = `${w}px ${tema}`
  const ctx = await novoContexto(b, { viewport: { width: w, height: h }, colorScheme: tema, hasTouch: w < 900, isMobile: w < 900, acceptDownloads: true })
  const p = await ctx.newPage()
  const erros = []; p.on('pageerror', (e) => erros.push(e.message))
  const largo = w >= 1180
  const mede = async (tela) => {
    await esperarMovimento(p) // as telas animam a entrada: mede quando terminou
    const lateral = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth + (document.querySelector('.scroll-y').scrollWidth - document.querySelector('.scroll-y').clientWidth))
    const cortado = await textoCortado(p, 'body')
    ok(`${rot} · ${tela}: sem rolagem lateral e sem texto cortado`, lateral <= 0 && cortado.length === 0, lateral > 0 ? `rolagem lateral ${lateral}px` : cortado.join('; '))
    if (FOTOS.has(w)) { const f = `${PASTA}/${w}-${tema}-${tela.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`; await p.screenshot({ path: f }); capturas.push(f) }
  }
  await p.goto(base); await p.waitForSelector('.folders'); await mede('inicio')
  await irPara(p, 'Treinar'); await p.locator('.chip', { hasText: /^Estatística\d+$/ }).first().click(); await mede('treinar')
  await irPara(p, 'Desempenho'); await mede('desempenho')
  await irPara(p, 'Mais'); await mede('mais')

  // questão SEM imagem (Treino por peso até achar uma sem imagem) e feedback ✓/✕
  await p.goto(base); await p.waitForSelector('.folders'); await irPara(p, 'Treinar'); await p.click('text=Começar')
  await p.waitForSelector('.sheet')
  for (let i = 0; i < 10 && (await p.locator('.qimg').count()) > 0; i++) { await p.click('.foot .pri'); await p.waitForTimeout(80) }
  await mede('questao sem imagem')
  await p.locator('.alt').nth(0).click(); await p.waitForSelector('.fb')
  ok(`${rot} · questão sem imagem: feedback mostra ✓ na certa`, (await p.locator('.alt.ok .mk').count()) === 1)

  // questão COM imagem (Amazônia 2024 Estatística Q36): imagem acima no celular, no painel direito em ≥ 1180 px
  await irParaEstatistica(p, 0); await p.waitForSelector('.qimg')
  await p.waitForFunction(() => { const i = document.querySelector('.qimg'); return i && i.complete && i.naturalWidth > 0 })
  ok(`${rot} · questão com imagem: imagem ${largo ? 'no painel da direita' : 'acima, dentro do cartão'}`, (await p.locator(largo ? '.side-in .qimg' : '.sheet .qimg').count()) === 1 && (await p.locator(largo ? '.sheet .qimg' : '.side-in .qimg').count()) === 0)
  await mede('questao com imagem')
  await p.locator('.alt').nth(1).click(); await p.waitForSelector('.fb')
  ok(`${rot} · questão com imagem: feedback ✓/✕`, (await p.locator('.alt.ok .mk').count()) === 1)
  await mede('questao com imagem respondida')

  // só-imagem + página inteira (Q39): só as letras, link de ampliar
  await irParaEstatistica(p, 3); await p.waitForSelector('.qimg')
  ok(`${rot} · só-imagem: só as letras A–E`, (await p.locator('.alts.letras .alt').count()) === 5 && (await p.locator('.enun').count()) === 0)
  ok(`${rot} · página inteira: legenda e link para ampliar`, (await p.locator('.qfig figcaption').count()) === 1 && (await p.locator('.qfig a[target=_blank]').count()) === 1)
  await mede('questao so imagem')
  await p.locator('.alts.letras .alt').nth(0).click(); await p.waitForSelector('.fb')
  ok(`${rot} · só-imagem: feedback depois de responder (✓ na certa)`, (await p.locator('.alt.ok .mk').count()) === 1)
  await mede('questao so imagem respondida')
  if (w === 390 || w === 1440) { // o link abre a imagem em tamanho real, em outra aba, sem tirar o app da questão
    const meta = await p.locator('.meta').innerText()
    const [pop] = await Promise.all([ctx.waitForEvent('page'), p.locator('.qfig a').click()])
    await pop.waitForURL(/\.png$/); await pop.waitForSelector('img')
    await pop.waitForFunction(() => document.images[0] && document.images[0].complete && document.images[0].naturalWidth > 0)
    const dims = await pop.evaluate(() => { const i = document.images[0]; return i ? [i.naturalWidth, i.naturalHeight] : null })
    ok(`${rot} · ampliar: abre o PNG em tamanho real em outra aba`, !!dims && dims[0] >= 900 && /\/q\/.+\.png$/.test(pop.url()), `${pop.url().split('/').pop()} ${dims}`)
    await pop.close()
    ok(`${rot} · ampliar: o app continua na mesma questão`, (await p.locator('.meta').innerText()) === meta)
  }

  // Resultado de um treino de 10 (Pular não vale: responde todas)
  await p.goto(base); await p.waitForSelector('.folders'); await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
  for (let i = 0; i < 10; i++) { await p.locator('.alt').nth(i % 5).click(); await p.waitForSelector('.fb'); await p.click('.foot .pri') }
  await p.waitForSelector('.cartao'); await mede('resultado')
  ok(`${rot} · sem erros de script`, erros.length === 0, erros.join(' | '))
  await ctx.close()
}
await b.close()
console.log(linhas.join('\n'))
console.log(`\n${linhas.length} verificações, ${falhas} falha(s). Capturas (${capturas.length}) em ${PASTA}/`)
process.exit(falhas ? 1 : 0)
