// REGRA DO TECLADO, em TODOS os campos de texto do app, em celulares com o tamanho de tela e a altura de teclado dos prints do usuário:
//  1) abrir o teclado não mexe em nenhum botão (nenhum botão de ação aparece acima do teclado; os do pé ficam por baixo dele);
//  2) a página não rola sozinha;
//  3) o campo em foco pode ser levado acima do teclado rolando;
//  4) fechou o teclado, tudo volta ao lugar.
// O teclado é simulado como o Android o entrega ao app: a variável CSS --teclado (ver services/teclado.ts e MainActivity.java).
// Toda tela ou campo novo entra na lista CENARIOS abaixo (e em scripts/campos-de-texto.json, que src/teclado-campos.test.ts confere).
// Precisa do app em http://localhost:4173/. Uso: node scripts/e2e-teclado.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'
import { cartao, conjuntoPadrao, idBaralho, semearCards } from './_cards-seed.mjs'
import { PERFIS_TECLADO, regraTeclado } from './_teclado.mjs'
import { TEXTO_RESUMO, pdfGabarito, pdfProva } from './_pdf-prova.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const PROVA = await pdfProva(b), GAB = await pdfGabarito(b)
const abrirAssistente = async (p) => { await irPara(p, 'Assistente'); await p.waitForSelector('.chat-tela') }
const foco = (p, sel) => () => p.locator(sel).evaluate((e) => e.focus({ preventScroll: true }))

// Cada cenário leva o app até a tela do campo e devolve a função que o foca. `semDados`: banco de cartões vazio.
const CENARIOS = [
  { campo: '#nb', rotulo: 'Cards · Novo baralho (já com baralhos)', ir: async (p) => { await irPara(p, 'Cards'); await p.waitForSelector('.deck'); await p.click('.secbtn'); await p.waitForSelector('#nb') }, focar: (p) => foco(p, '#nb') },
  { campo: '#nb', rotulo: 'Cards · Criar o primeiro baralho (sem baralhos)', semDados: true, ir: async (p) => { await irPara(p, 'Cards'); await p.click('text=Criar o primeiro baralho'); await p.waitForSelector('#nb') }, focar: (p) => foco(p, '#nb') },
  { campo: '#rn', rotulo: 'Baralho · Renomear', ir: async (p) => { await abrirBaralho(p); await p.click('.btn >> text=Renomear'); await p.waitForSelector('#rn') }, focar: (p) => foco(p, '#rn') },
  { campo: '#bq', rotulo: 'Baralho · Buscar nos cartões', ir: async (p) => { await abrirBaralho(p); await p.waitForSelector('#bq') }, focar: (p) => foco(p, '#bq') },
  { campo: '#cf', rotulo: 'Editor · novo cartão · Frente', ir: async (p) => { await abrirBaralho(p); await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf'); await p.waitForTimeout(350) }, focar: (p) => foco(p, '#cf') },
  { campo: '#cv', rotulo: 'Editor · novo cartão · Verso', ir: async (p) => { await abrirBaralho(p); await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cv'); await p.waitForTimeout(350) }, focar: (p) => foco(p, '#cv') },
  { campo: '#cf', rotulo: 'Editor · editar cartão · Frente', ir: async (p) => { await abrirBaralho(p); await p.locator('.fcedit').first().click(); await p.waitForSelector('#cf'); await p.waitForTimeout(350) }, focar: (p) => foco(p, '#cf') },
  { campo: 'anotação', rotulo: 'Treinar · Anotação da questão', ir: async (p) => { await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet'); await p.locator('.alt').first().click(); await p.locator('.nota summary').click(); await p.waitForSelector('.nota textarea') }, focar: (p) => foco(p, '.nota textarea') },
  { campo: 'anotação', rotulo: 'Simulado · Anotação da questão', ir: async (p) => { await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet'); await p.locator('.nota summary').click(); await p.waitForSelector('.nota textarea') }, focar: (p) => foco(p, '.nota textarea') },
  { campo: '#as-espaco', rotulo: 'Assistente · Nome do espaço', ir: async (p) => { await abrirAssistente(p); await p.locator('.as-pilula[data-acao="espaco"]').click(); await p.locator('.btn', { hasText: 'Novo espaço' }).click(); await p.waitForSelector('#as-espaco') }, focar: (p) => foco(p, '#as-espaco') },
  { campo: '#as-chave', rotulo: 'Assistente · Chave da IA', ir: async (p) => { await abrirAssistente(p); await p.locator('.as-pilula[data-acao="ia"]').click(); await p.waitForSelector('#as-chave') }, focar: (p) => foco(p, '#as-chave') },
  { campo: '#as-baralho', rotulo: 'Assistente · Nome do baralho (prévia dos cartões)', ir: async (p) => { await abrirAssistente(p); await p.locator('.as-pilula[data-acao="cartoes"]').click(); await p.setInputFiles('#as-f-resumo', { name: 'resumo.md', mimeType: 'text/markdown', buffer: Buffer.from(TEXTO_RESUMO) }); await p.waitForSelector('#as-baralho') }, focar: (p) => foco(p, '#as-baralho') },
  { campo: '#as-prova', rotulo: 'Assistente · Nome da prova (prévia da prova)', ir: async (p) => { await abrirAssistente(p); await p.locator('.as-pilula[data-acao="prova"]').click(); await p.fill('#as-espaco', 'Teclado'); await p.locator('.btn', { hasText: 'Criar vazio' }).click(); await p.setInputFiles('#as-f-prova', { name: 'prova.pdf', mimeType: 'application/pdf', buffer: PROVA }); await p.setInputFiles('#as-f-gab', { name: 'gab.pdf', mimeType: 'application/pdf', buffer: GAB }); await p.locator('.btn.pri', { hasText: 'Ler a prova' }).click(); await p.waitForSelector('#as-prova', { timeout: 60000 }) }, focar: (p) => foco(p, '#as-prova') },
]
async function abrirBaralho(p) { await irPara(p, 'Cards'); await p.waitForSelector('.deck'); await p.locator('.deck', { hasText: 'Siglas do Sistema' }).locator('.deck-abrir').evaluate((e) => e.click()); await p.waitForSelector('.fcacoes') }

for (const perfil of PERFIS_TECLADO) {
  const falhas = [], feitos = []
  for (const semDados of [false, true]) {
    const lista = CENARIOS.filter((c) => !!c.semDados === semDados)
    if (!lista.length) continue
    const ctx = await novoContexto(b, { viewport: { width: perfil.w, height: perfil.h }, hasTouch: true, isMobile: true, colorScheme: 'dark' })
    const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
    await p.goto(base); await p.waitForSelector('.folders')
    if (!semDados) await semearCards(p, conjuntoPadrao())
    for (const c of lista) {
      await p.goto(base); await p.waitForSelector('.folders')
      try { await c.ir(p) } catch (e) { falhas.push(`${c.rotulo}: não consegui chegar à tela (${String(e.message).split('\n')[0]})`); continue }
      const r = await regraTeclado(p, { kb: perfil.kb, h: perfil.h, focar: c.focar(p) })
      feitos.push(`${c.rotulo} (${r.botoes} botões)`)
      for (const v of r.violacoes) falhas.push(`${c.rotulo}: ${v}`)
    }
    await ctx.close()
  }
  ok(`${perfil.nome}: ${feitos.length} campos/telas — teclado aberto não mexe em nenhum botão, o campo é alcançável e tudo volta ao fechar`, falhas.length === 0 && feitos.length === CENARIOS.length, falhas.slice(0, 4).join(' | '))
}
ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
