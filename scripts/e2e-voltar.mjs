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

// ---- Cards: formulários e perguntas abertos (Novo baralho, Renomear, Excluir): o voltar fecha SÓ eles (F-11) ----
await irPara(p, 'Cards'); await p.waitForSelector('.deck')
await p.click('.btn >> text=Novo baralho'); await p.waitForSelector('#nb')
await voltar(); ok('Novo baralho aberto: voltar cancela o formulário e continua em Cards', (await p.locator('#nb').count()) === 0 && (await onde()) === 'cards', await onde())
await abrirBaralho()
await p.click('.btn >> text=Renomear'); await p.waitForSelector('.fcnovo')
await voltar(); ok('Renomear aberto: voltar fecha o formulário e continua no baralho', (await p.locator('.fcnovo').count()) === 0 && (await onde()) === 'baralho', await onde())
await p.click('.btn >> text=Excluir este baralho'); await p.waitForSelector('text=Sim, excluir')
await voltar(); ok('pergunta de excluir aberta: voltar fecha a pergunta e continua no baralho', (await p.locator('text=Sim, excluir').count()) === 0 && (await onde()) === 'baralho', await onde())
await voltar(); ok('…e o voltar seguinte sobe para Cards', (await onde()) === 'cards', await onde())

// ---- Início: provas em 3 níveis ----
await irPara(p, 'Início'); await p.waitForSelector('.provas')
await p.locator('.provas .crumbs button', { hasText: 'Bancos' }).click()
await p.locator('.provas .folder', { hasText: 'Banco do Brasil' }).click(); await p.locator('.provas .folder:has(.fnm:text-is("Agente Comercial"))').click()
await voltar(); ok('provas: voltar do cargo sobe ao banco', (await p.locator('.crumbs').innerText()).replace(/\s+/g, ' ').trim() === 'Bancos › Banco do Brasil')
await voltar(); ok('provas: voltar do banco sobe aos bancos', (await p.locator('.crumbs').innerText()).replace(/\s+/g, ' ').trim() === 'Bancos')

// ---- Treinar: questão → voltar → volta ao TREINAR (F-02: a aba de onde o treino começou); tela cheia da imagem fecha só ela ----
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
await voltar(); ok('voltar da questão (treino começado em Treinar) volta ao Treinar', (await onde()) === 'Treinar', await onde())
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

// ---- Treino do Início continua voltando ao Início; do Treinar, "Sair" e o botão do resultado levam ao Treinar ----
await irPara(p, 'Início'); await p.waitForSelector('.folders')
await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet'); await voltar()
ok('treino rápido (Início): voltar leva ao Início', (await onde()) === 'inicio', await onde())
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet'); await p.click('.btn >> text=Sair')
ok('Treinar › Sair leva ao Treinar', (await onde()) === 'Treinar', await onde())
await p.click('text=Começar'); await p.waitForSelector('.sheet')
for (let i = 0; i < 9; i++) await p.click('.foot >> text=Pular')
await p.click('.foot >> text=Ver resultado'); await p.waitForSelector('.cartao')
ok('resultado de treino do Treinar: o botão do pé se chama Treinar e leva ao Treinar', (await p.locator('.foot .btn').first().innerText()) === 'Treinar')
await p.locator('.foot .btn').first().click(); await p.waitForSelector('.filters')
ok('…e volta ao Treinar', (await onde()) === 'Treinar', await onde())

// ---- Assistente: treino e simulado pedidos por escrito saem de volta para o ASSISTENTE (F-02); entregar com questões em branco pergunta (F-04) ----
const pedir = async (t) => { await irPara(p, 'Assistente'); await p.waitForSelector('.chat-tela'); await p.waitForSelector('.as-pilula'); await p.waitForTimeout(700); await p.fill('#as-msg', t); await p.keyboard.press('Enter'); await p.waitForSelector('.sheet', { timeout: 20000 }) }
await pedir('treino de matemática com 5 questões'); await p.click('.btn >> text=Sair')
ok('treino pedido no Assistente: Sair volta ao Assistente', (await onde()) === 'Assistente', await onde())
await pedir('simulado de matemática com 5 questões'); await p.click('.btn >> text=Sair'); await p.waitForSelector('.dialogo')
await p.getByRole('button', { name: 'Encerrar', exact: true }).click(); await p.waitForTimeout(400)
ok('simulado pedido no Assistente: Sair + Encerrar volta ao Assistente', (await onde()) === 'Assistente', await onde())
await pedir('simulado de matemática com 5 questões')
await p.click('.alt >> nth=0')
while (await p.locator('.foot >> text=Próxima').count()) await p.click('.foot >> text=Próxima')
await p.click('.foot >> text=Entregar prova'); await p.waitForSelector('.dialogo')
ok('entregar com questões em branco pergunta, com "Voltar à prova" em foco', /Entregar mesmo assim?/.test(await p.locator('.dialogo h2').innerText()) && /4 questões em branco/.test(await p.locator('.dialogo p').innerText()) && (await p.evaluate(() => document.activeElement?.textContent)) === 'Voltar à prova', await p.locator('.dialogo p').innerText())
await p.getByRole('button', { name: 'Voltar à prova' }).click(); await p.waitForTimeout(300)
ok('Voltar à prova fecha o aviso e continua na questão', (await p.locator('.dialogo').count()) === 0 && (await p.locator('.sheet').count()) === 1)
await p.click('.foot >> text=Entregar prova'); await p.waitForSelector('.dialogo'); await voltar()
ok('o voltar do aparelho com o aviso aberto fecha só o aviso', (await p.locator('.dialogo').count()) === 0 && (await p.locator('.sheet').count()) === 1)
await p.click('.foot >> text=Entregar prova'); await p.waitForSelector('.dialogo'); await p.getByRole('button', { name: 'Entregar', exact: true }).click(); await p.waitForSelector('.cartao')
ok('Entregar mesmo assim entrega (resultado na tela)', (await p.locator('.cartao').count()) === 1)
await p.locator('.foot .btn').first().click(); await p.waitForTimeout(400)
ok('resultado de simulado do Assistente: o botão do pé volta ao Assistente', (await onde()) === 'Assistente', await onde())
await pedir('simulado de matemática com 5 questões')
for (let i = 0; i < 5; i++) { await p.click('.alt >> nth=0'); if (i < 4) await p.click('.foot >> text=Próxima') }
await p.click('.foot >> text=Entregar prova'); await p.waitForSelector('.cartao', { timeout: 5000 })
ok('sem questões em branco entrega direto, sem aviso', (await p.locator('.dialogo').count()) === 0)
await p.locator('.foot .btn').first().click(); await p.waitForTimeout(300)

// ---- Resultado do treino: questão do cartão-resposta → voltar leva ao RESULTADO (não ao Início); do resultado, ao Início ----
await irPara(p, 'Início'); await p.waitForSelector('.folders')
await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 9; i++) await p.click('.foot >> text=Pular')
await p.click('.foot >> text=Ver resultado'); await p.waitForSelector('.cartao')
await p.locator('.cell').nth(3).click(); await p.waitForSelector('.sheet')
await voltar(); ok('revisão de uma questão: voltar leva ao resultado (C-2)', (await p.locator('.cartao').count()) === 1 && (await p.locator('.sheet').count()) === 0)
await voltar(); ok('…e o voltar seguinte, do resultado, leva ao Início', (await onde()) === 'inicio', await onde())

// ---- Assistente: painel aberto na conversa (Meus materiais) → voltar fecha o painel e mostra as sugestões; só o voltar seguinte sai da aba ----
await irPara(p, 'Assistente'); await p.waitForSelector('.chat-tela'); await p.waitForSelector('.as-pilula'); await p.waitForTimeout(600)
await p.locator('.as-pilula[data-acao="materiais"]').click(); await p.waitForSelector('.as-painel'); await p.waitForTimeout(400)
await voltar(); await p.waitForTimeout(400)
ok('assistente: voltar com um painel aberto fecha o painel (continua no chat)', (await p.locator('.as-painel').count()) === 0 && (await p.locator('.chat-tela').count()) === 1 && (await p.locator('.as-pilula').count()) > 0)
await voltar(); ok('…e o voltar seguinte sai do assistente para o Início', (await onde()) === 'inicio', await onde())

// ---- barra de navegação aberta: voltar fecha a barra antes de tudo ----
await irPara(p, 'Cards'); await p.waitForSelector('.deck'); await p.locator('.deck-abrir').first().evaluate((e) => e.click()); await p.waitForSelector('.fcacoes')
await p.locator('.rail-alca').click(); await p.waitForTimeout(350)
await voltar(); ok('barra aberta: voltar fecha a barra e continua no baralho', (await p.locator('.nav.rail').evaluate((e) => e.getBoundingClientRect().right <= 0 || getComputedStyle(e).visibility === 'hidden').catch(() => true)) && (await onde()) === 'baralho', await onde())
await voltar(); ok('…e o voltar seguinte sobe para Cards', (await onde()) === 'cards', await onde())

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
