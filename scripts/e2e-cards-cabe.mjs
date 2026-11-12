// Estudo de Cards (2026-11-10): o texto do cartão encolhe até o cartão INTEIRO (frente, verso e a linha de onde a questão veio) caber na tela, sem rolagem
// vertical. Usa o cartão de verdade que gerou o relato (uma questão longa do BB com 5 alternativas, criada pelo "Criar flashcard desta questão").
// Confere: cabe sem rolar (antes e depois de mostrar a resposta), o verso não fica atrás dos botões, o tamanho é o mesmo antes e depois de virar
// (nada pula), um cartão curto continua no tamanho de leitura, e um limite honesto: telas minúsculas podem rolar (tamanho mínimo 13 px).
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-cards-cabe.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { esperarMovimento, irPara, novoContexto } from './_ctx.mjs'
import { cartao, semearCards } from './_cards-seed.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const info = (n, x = '') => out.push(`INFO    ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const erros = []

const LONGA_F = 'A população de clientes de um banco certamente contém indivíduos que podem não estar satisfeitos ou que nunca serão lucrativos, considerando seu uso de recursos em relação à receita que propiciam. Assim sendo, uma instituição bancária que visasse apenas os clientes cujas necessidades ela poderia atender melhor do que seus concorrentes optou, na aplicação do Marketing Digital, pela personalização de conteúdo e pela publicidade direcionada, gerando um aumento da relevância da mensagem para públicos específicos. Esse banco aplicou ao Marketing Digital o conceito de\n\nA) fidelidade\nB) reposicionamento\nC) recuperação do serviço\nD) segmentação de mercado\nE) vantagem competitiva sustentável'
const LONGA_V = 'Gabarito: D) segmentação de mercado\n\nAssunto: Marketing Digital · BB 2023 · Agente Comercial, Prova A, questão 12'
const agora = Date.now()
const conjunto = {
  baralhos: [{ id: 'bl', nome: 'Questão longa', criado: agora - 1000 }, { id: 'bc', nome: 'Cartão curto', criado: agora - 2000 }],
  cartoes: [cartao('l1', 'bl', LONGA_F, LONGA_V, { agora }), cartao('c1', 'bc', 'SELIC', 'Taxa básica de juros da economia, definida pelo Copom.', { agora })],
}

// [largura, altura, precisa caber sem rolar?]
const TELAS = [[1899, 900, true], [1440, 900, true], [1280, 720, true], [1024, 768, true], [412, 892, true], [390, 844, true], [360, 780, false], [360, 640, false], [320, 568, false], [568, 320, false]]

async function estudar(p, deck) {
  await irPara(p, 'Cards'); await p.waitForSelector('.deck')
  await p.locator('.deck', { hasText: deck }).locator('.deck-estudar').evaluate((e) => e.click()); await p.waitForSelector('.fcface'); await esperarMovimento(p)
}
const medir = (p) => p.evaluate(() => {
  const rolo = document.querySelector('.scroll-y'), st = document.querySelector('.fcstudy')
  const verso = document.querySelector('.fcverso .fctexto')?.getBoundingClientRect(), foot = document.querySelector('.foot.sticky')?.getBoundingClientRect()
  const frente = document.querySelector('.fctexto')?.getBoundingClientRect()
  return {
    rola: rolo.scrollHeight - rolo.clientHeight, fs: parseFloat(getComputedStyle(document.querySelector('.fctexto')).fontSize), var: st.style.getPropertyValue('--fc-fs'),
    topoFrente: Math.round(frente.top), versoFim: Math.round(verso.bottom), pe: Math.round(foot.top), pefim: Math.round(foot.bottom), alt: innerHeight, lateral: document.documentElement.scrollWidth - innerWidth,
  }
})

for (const [w, h, precisa] of TELAS) {
  const toque = w < 900
  const ctx = await novoContexto(b, { viewport: { width: w, height: h }, hasTouch: toque, isMobile: toque, colorScheme: 'dark' })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(`${w}×${h}: ${e.message}`))
  await p.goto(base); await p.waitForSelector('.provas'); await semearCards(p, conjunto)
  if (toque) await p.locator('.rail-alca').click().catch(() => {})
  // ---- cartão longo ----
  await estudar(p, 'Questão longa')
  const a = await medir(p)
  await p.locator('.fcface').click({ position: { x: 40, y: 100 } }); await p.waitForSelector('.fcverso.aberto'); await esperarMovimento(p)
  const d = await medir(p)
  const rot = `${w}×${h}`
  const resumo = `fonte ${d.fs.toFixed(1)}px, sobra ${d.rola}px de rolagem, fim do verso y=${d.versoFim}, botões ${d.pe}–${d.pefim} de ${d.alt}`
  if (precisa) {
    ok(`${rot}: a questão longa cabe inteira, sem rolagem vertical, antes e depois de mostrar a resposta`, a.rola <= 1 && d.rola <= 1, `antes ${a.rola}px, depois ${d.rola}px · ${resumo}`)
    ok(`${rot}: a linha de onde a questão veio (fim do verso) está à vista, acima dos botões e dentro da tela`, d.versoFim <= d.pe + 1 && d.versoFim <= d.alt && d.pefim <= d.alt + 1, resumo)
    ok(`${rot}: texto legível (≥ 13 px) e sem rolagem lateral`, d.fs >= 13 && d.lateral <= 0, `${d.fs.toFixed(1)}px`)
  } else {
    info(`${rot}: questão longa (tela pequena, só informativo)`, `${resumo}${d.rola > 1 ? ' → ainda rola' : ' → cabe'}`)
    ok(`${rot}: mesmo sem caber, o texto fica no mínimo legível (≥ 13 px) e sem rolagem lateral`, d.fs >= 13 - 0.01 && d.lateral <= 0)
  }
  ok(`${rot}: o tamanho do texto e o lugar da frente não mudam ao mostrar a resposta (nada pula)`, Math.abs(a.fs - d.fs) < 0.01 && a.topoFrente === d.topoFrente, `${a.fs.toFixed(1)} → ${d.fs.toFixed(1)}px; topo ${a.topoFrente} → ${d.topoFrente}`)
  // ---- cartão curto: continua no tamanho de leitura ----
  await p.locator('.fcstudy .btn', { hasText: 'Sair' }).click(); await p.waitForSelector('.deck'); await esperarMovimento(p)
  await estudar(p, 'Cartão curto')
  const c = await medir(p)
  ok(`${rot}: um cartão curto continua no tamanho de leitura (${w >= 600 ? 24 : 22} px), sem encolher à toa`, Math.abs(c.fs - (w >= 600 ? 24 : 22)) < 0.01 && (!precisa || c.rola <= 1), `${c.fs.toFixed(1)}px`)
  await ctx.close()
}

// girar o celular / redimensionar a janela com o cartão aberto: o texto se refaz sozinho
{
  const ctx = await novoContexto(b, { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
  const p = await ctx.newPage(); await p.goto(base); await p.waitForSelector('.provas'); await semearCards(p, conjunto)
  await estudar(p, 'Questão longa')
  const grande = await medir(p)
  await p.setViewportSize({ width: 1440, height: 640 }); await p.waitForTimeout(250)
  const menor = await medir(p)
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(250)
  const volta = await medir(p)
  ok('redimensionar a janela com o cartão aberto: o texto encolhe com a janela e volta quando ela cresce, sempre sem rolagem', menor.fs < grande.fs && menor.rola <= 1 && Math.abs(volta.fs - grande.fs) < 0.6 && volta.rola <= 1, `900px: ${grande.fs.toFixed(1)}px · 640px: ${menor.fs.toFixed(1)}px (rola ${menor.rola}) · de volta: ${volta.fs.toFixed(1)}px`)
  await ctx.close()
}

ok('sem erros de página', erros.length === 0, erros.join(' | '))
await b.close()
console.log(out.join('\n'))
if (out.some((l) => l.startsWith('FALHOU'))) process.exit(1)
