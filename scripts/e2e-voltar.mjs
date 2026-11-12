// Botão voltar nas telas com sub-telas, no navegador de verdade (history.back = o voltar do aparelho): cada "voltar" sobe UM nível, em
// qualquer profundidade e mesmo depois de usar os botões da tela; nunca pula para o Início. Também: Provas (3 níveis), tela cheia da
// imagem, aviso do simulado e a barra de navegação.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-voltar.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'
import { cartao, idBaralho, semearCards } from './_cards-seed.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark' })
const p = await ctx.newPage()
const erros = []; p.on('pageerror', (e) => erros.push(e.message))
const abrir = async () => { await p.goto(base); await p.waitForSelector('.folders') }
const voltar = async () => { await p.evaluate(() => history.back()); await p.waitForTimeout(220) }
const onde = () => p.evaluate(() => {
  const h1 = document.querySelector('h1')?.textContent?.trim() ?? ''
  const q = (s) => !!document.querySelector(s)
  return q('.sheet') ? 'questão' : q('.fcface') ? 'estudo' : q('#cf') ? 'editor' : q('.fcacoes') ? 'baralho' : q('.deck, .fcvazio') && h1 === 'Cards' ? 'cards' : h1 === 'Início' ? 'inicio' : h1
})

await abrir()
// um baralho com cartões, semeado (o que importa aqui é a navegação)
await irPara(p, 'Cards'); await p.waitForSelector('h1:has-text("Cards")')
await p.click('text=Criar o primeiro baralho'); await p.fill('#nb', 'Siglas'); await p.click('text=Criar baralho'); await p.waitForSelector('.fcacoes')
const id = await idBaralho(p, 'Siglas')
await semearCards(p, { baralhos: [], cartoes: ['A', 'B', 'C'].map((f, i) => cartao('v' + i, id, 'Sigla ' + f, 'Significado ' + f)) })
const abrirBaralho = async () => { await irPara(p, 'Cards'); await p.waitForSelector('.deck'); await p.locator('.deck-abrir').first().evaluate((e) => e.click()); await p.waitForSelector('.fcacoes') }

// ---- Cards: baralho → editor → voltar → voltar ----
await abrirBaralho()
await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf')
ok('(preparo) no editor de cartão', (await onde()) === 'editor')
await voltar(); ok('voltar do editor leva ao baralho', (await onde()) === 'baralho', await onde())
await voltar(); ok('voltar do baralho leva à lista de baralhos de Cards (NÃO ao Início)', (await onde()) === 'cards', await onde())
await voltar(); ok('voltar da lista de baralhos leva ao Início', (await onde()) === 'inicio', await onde())

// ---- Cards: baralho → estudo → voltar → voltar ----
await abrirBaralho()
await p.click('.btn >> text=Estudar'); await p.waitForSelector('.fcface')
await voltar(); ok('voltar do estudo leva ao baralho', (await onde()) === 'baralho', await onde())
await voltar(); ok('voltar do baralho leva a Cards (NÃO ao Início)', (await onde()) === 'cards', await onde())

// ---- depois de usar os botões da tela (Voltar/Salvar), o voltar do aparelho continua valendo ----
await abrirBaralho()
await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf')
await p.fill('#cf', 'Pergunta nova'); await p.fill('#cv', 'Resposta nova'); await p.click('.foot >> text=Salvar >> nth=-1'); await p.waitForSelector('.fcacoes')
await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf'); await p.click('.btn >> text=Voltar'); await p.waitForSelector('.fcacoes')
ok('(preparo) de volta ao baralho pelos botões da tela', (await onde()) === 'baralho')
await voltar(); ok('o voltar do aparelho, depois dos botões da tela, ainda sobe UM nível (baralho → Cards)', (await onde()) === 'cards', await onde())

// ---- vários níveis seguidos: baralho → editor (salvar e criar outro ×3) → voltar ×2 ----
await abrirBaralho()
await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf')
for (let i = 1; i <= 3; i++) { await p.fill('#cf', 'Seq ' + i); await p.fill('#cv', 'Resp ' + i); await p.click('text=Salvar e criar outro'); await p.waitForTimeout(120) }
await voltar(); ok('depois de "Salvar e criar outro" ×3, voltar sobe ao baralho', (await onde()) === 'baralho', await onde())
await voltar(); ok('…e mais um voltar leva a Cards (não ao Início)', (await onde()) === 'cards', await onde())

// ---- Início: provas em 3 níveis ----
await irPara(p, 'Início'); await p.waitForSelector('.provas')
await p.locator('.provas .crumbs button', { hasText: 'Bancos' }).click()
await p.locator('.provas .folder', { hasText: 'Banco do Brasil' }).click(); await p.locator('.provas .folder:has(.fnm:text-is("Agente Comercial"))').click()
await voltar(); ok('provas: voltar do cargo sobe ao banco', (await p.locator('.crumbs').innerText()).replace(/\s+/g, ' ').trim() === 'Bancos › Banco do Brasil')
await voltar(); ok('provas: voltar do banco sobe aos bancos', (await p.locator('.crumbs').innerText()).replace(/\s+/g, ' ').trim() === 'Bancos')

// ---- Treinar: questão → voltar → Início; tela cheia da imagem fecha só ela ----
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
await voltar(); ok('voltar da questão sai do treino e volta ao Início', (await onde()) === 'inicio', await onde())
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
await p.locator('.pg a').first().scrollIntoViewIfNeeded(); await p.locator('.pg a').first().evaluate((e) => e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
await p.waitForTimeout(150)
await p.goto(base) // (a ampliação de tela cheia é só do APK; aqui só confirma que sair e voltar não quebra)
await abrir()

// ---- Simulado em andamento: voltar pergunta; cancelar e voltar de novo pergunta outra vez ----
await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet')
await voltar(); ok('simulado: voltar abre o aviso de encerrar (e não sai)', (await p.locator('.dialogo').count()) === 1 && (await onde()) === 'questão')
await voltar(); ok('simulado: voltar com o aviso aberto fecha só o aviso', (await p.locator('.dialogo').count()) === 0 && (await onde()) === 'questão')
await voltar(); ok('simulado: voltar de novo pergunta outra vez', (await p.locator('.dialogo').count()) === 1)
await voltar(); await p.click('.btn >> text=Sair'); await p.getByRole('button', { name: 'Encerrar', exact: true }).click(); await p.waitForSelector('.folders')

// ---- barra de navegação aberta: voltar fecha a barra antes de tudo ----
await irPara(p, 'Cards'); await p.waitForSelector('.deck'); await p.locator('.deck-abrir').first().evaluate((e) => e.click()); await p.waitForSelector('.fcacoes')
await p.locator('.rail-alca').click(); await p.waitForTimeout(350)
await voltar(); ok('barra aberta: voltar fecha a barra e continua no baralho', (await p.locator('.nav.rail').evaluate((e) => e.getBoundingClientRect().right <= 0 || getComputedStyle(e).visibility === 'hidden').catch(() => true)) && (await onde()) === 'baralho', await onde())
await voltar(); ok('…e o voltar seguinte sobe para Cards', (await onde()) === 'cards', await onde())

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
