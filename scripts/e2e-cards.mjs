// Flashcards no navegador de verdade: criar baralho e cartões, estudar (mouse, teclado e voltar), repetição
// espaçada, desfazer, editar/excluir, limite de novos, "criar flashcard" a partir de uma questão, backup completo e celular.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-cards.mjs [url]
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { irPara, novoContexto, esperarMovimento } from './_ctx.mjs'
import { semMudar, vigiar } from './_teclado.mjs'
import { cartao, idBaralho, semearCards } from './_cards-seed.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 1440, height: 900 }, acceptDownloads: true, colorScheme: 'dark' })
const p = await ctx.newPage()
const erros = []; p.on('pageerror', (e) => erros.push(e.message))
const abrir = async () => { await p.goto(base); await p.waitForSelector('.folders') }
const irCards = async () => { await irPara(p, 'Cards'); await p.waitForSelector('h1:has-text("Cards")') }
const painel = async (k) => (await p.locator('.side-in .sum div', { has: p.locator('dt', { hasText: new RegExp(`^${k}$`) }) }).locator('dd').textContent()).trim()
const toast = () => p.locator('.toast').innerText().catch(() => '')
const FRENTES = [['SELIC', 'Taxa básica de juros'], ['CDI', 'Certificado de Depósito Interbancário'], ['IPCA', 'Índice oficial de inflação'], ['PIX', 'Pagamentos instantâneos'], ['COPOM', 'Comitê de Política Monetária'], ['FGC', 'Fundo Garantidor de Créditos'], ['CMN', 'Conselho Monetário Nacional']]

await abrir(); await irCards()
ok('ícone e aba "Cards" na barra lateral (5 abas, todas com ícone)', (await p.locator('.rail-item').count()) === 5 && (await p.locator('.rail-item svg').count()) === 5)
ok('estado vazio: explica o que fazer e oferece criar o 1º baralho', (await p.locator('.fcvazio').innerText()).includes('Nenhum baralho ainda') && (await p.getByRole('button', { name: 'Criar o primeiro baralho' }).count()) === 1)
ok('sem baralho, "Estudar agora" fica desativado', await p.locator('.side-in button.btn.pri').isDisabled())
// botão desativado é SÓLIDO em todo o app (sem opacidade nem fundo transparente): no celular, em Cards e no Início
const naoSolidos = () => p.evaluate(() => [...document.querySelectorAll('button:disabled')].filter((e) => e.getClientRects().length).map((e) => { const c = getComputedStyle(e), m = /rgba?(([^)]+))/.exec(c.backgroundColor)[1].split(',').map(Number); return { t: e.textContent.trim().slice(0, 24), op: c.opacity, alfa: m.length === 4 ? m[3] : 1 } }).filter((x) => x.op !== '1' || x.alfa !== 1))
const nDesativados = () => p.evaluate(() => [...document.querySelectorAll('button:disabled')].filter((e) => e.getClientRects().length).length)
await p.setViewportSize({ width: 390, height: 844 }); await abrir(); await irCards(); await p.waitForTimeout(300)
ok('celular, Cards: "Nada para estudar hoje" e todo botão desativado são sólidos (opacidade 1, fundo opaco)', (await nDesativados()) >= 1 && (await naoSolidos()).length === 0, JSON.stringify(await naoSolidos()))
await irPara(p, 'Início'); await p.waitForSelector('.tile'); await esperarMovimento(p)
ok('celular, Início: o atalho "Rever erros" desativado também é sólido', (await p.locator('.tile[disabled]').count()) === 1 && (await p.locator('.tile[disabled]').evaluate((e) => getComputedStyle(e).opacity)) === '1' && (await naoSolidos()).length === 0, JSON.stringify(await naoSolidos()))
await p.setViewportSize({ width: 1440, height: 900 }); await abrir(); await irCards()

// ---- criar baralho (recusa vazio) ----
await p.click('text=Criar o primeiro baralho')
await p.click('text=Criar baralho'); ok('nome vazio: avisa e não cria', (await toast()).includes('Dê um nome'))
await p.fill('#nb', 'Siglas do SFN'); await p.click('text=Criar baralho')
await p.waitForSelector('h1:has-text("Siglas do SFN")')
ok('criar baralho abre a tela dele (0 cartões)', (await p.locator('.top small').innerText()).startsWith('0 cartões'))

// ---- adicionar cartões ----
await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf')
await p.click('.foot >> text=Salvar >> nth=-1'); ok('cartão vazio: avisa e não salva', (await toast()).includes('Preencha a frente e o verso'))
await p.fill('#cf', 'Qual a função do Copom?'); await p.fill('#cv', 'Definir a meta da taxa Selic.')
await p.click('text=Salvar e criar outro'); await p.waitForTimeout(100)
await p.waitForTimeout(1700) // a mensagem "Cartão salvo" ocupa o subtítulo por 1,5 s; depois ele vira o contador
ok('"Salvar e criar outro" limpa os campos e conta o que foi criado', (await p.inputValue('#cf')) === '' && (await p.locator('.top small').innerText()).includes('1 cartão criado'))
await p.fill('#cf', 'Fundo de garantia'); await p.fill('#cv', 'FGC protege até R$ 250 mil.')
await p.click('text=Criar também o cartão inverso'); await p.click('.foot >> text=Salvar >> nth=-1')
await p.waitForSelector('.fclista')
ok('salvar com "inverso" cria 2 cartões; no total 3', (await p.locator('.fcrow').count()) === 3, `${await p.locator('.fcrow').count()} cartões`)

// ---- mais 7 cartões (o Importar saiu da tela: semeados direto no banco do navegador) ----
const bid = await idBaralho(p, 'Siglas do SFN')
await semearCards(p, { baralhos: [], cartoes: FRENTES.map(([f, v], i) => cartao('sx' + i, bid, f, v)) })
await irCards(); await p.locator('.deck', { hasText: 'Siglas do SFN' }).locator('.deck-abrir').click(); await p.waitForSelector('.fclista')
ok('a tela do baralho não tem mais Importar nem Exportar, só 3 ações em sequência: Estudar, Novo cartão, Renomear', (await p.locator('.fcacoes .btn').allInnerTexts()).map((t) => t.replace(/ · \d+$/, '')).join() === 'Estudar,Novo cartão,Renomear' && (await p.getByRole('button', { name: /^(Importar|Exportar)/ }).count()) === 0)
ok('baralho com 10 cartões', (await p.locator('.top small').innerText()).startsWith('10 cartões'))
await p.fill('#bq', 'selic')
ok('busca encontra por frente ou verso (sem diferenciar maiúsculas)', (await p.locator('.fcrow').count()) === 2, `${await p.locator('.fcrow').count()} achados`)
await p.fill('#bq', 'zzzz'); ok('busca sem resultado diz isso', (await p.locator('text=Nenhum cartão com').count()) === 1)
await p.fill('#bq', '')
await p.screenshot({ path: 'docs/verificacao-capturas/cards-baralho-1440-dark.png' })

// ---- limite de novos por dia + contagens ----
await p.click('.btn >> text=Baralhos'); await p.waitForSelector('.deck')
ok('home: baralho mostra 10 cartões e painel "novos de hoje" = 10 (limite padrão 10)', (await p.locator('.deck .deckmeta').innerText()).includes('10 cartões') && (await painel('Novos de hoje')) === '10')
await p.click('.chip >> text=5')
ok('limite de 5 novos por dia: painel e botão mostram 5', (await painel('Novos de hoje')) === '5' && /Estudar agora · 5/.test(await p.locator('.side-in button.btn.pri').innerText()))

// ---- estudar com o teclado ----
await p.click('.deck .btn.pri'); await p.waitForSelector('.fcface')
ok('estudo mostra só a frente; contador Novos 5', !(await p.locator('.fcface').innerText()).includes('VERSO') && (await p.locator('.fccont').innerText()).includes('Novos 5'))
const frente1 = await p.locator('.fctexto').first().innerText()
await p.keyboard.press('Space')
ok('espaço mostra o verso e os 4 botões com o prazo de cada um', (await p.locator('.fcface').innerText()).includes('VERSO') && (await p.locator('.fcn small').allInnerTexts()).join() === '10 min,1 d,2 d,5 d')
await p.keyboard.press('1') // Errei: volta ao fim da fila desta sessão
await p.waitForTimeout(80)
ok('"Errei": avança e o cartão volta ao fim da fila (1/6; outra frente na tela)', (await p.locator('.qbar .cnt').innerText()) === '1/6' && (await p.locator('.fctexto').first().innerText()) !== frente1)
await p.keyboard.press('Space'); await p.keyboard.press('3') // Bom
await p.keyboard.press('Space'); await p.keyboard.press('4') // Fácil
await p.waitForTimeout(80)
await p.click('.btn >> text=Desfazer')
ok('"Desfazer" volta um cartão (2/6) com o verso fechado', (await p.locator('.qbar .cnt').innerText()) === '2/6' && !(await p.locator('.fcface').innerText()).includes('VERSO'))
await p.keyboard.press('Space'); await p.keyboard.press('4') // Fácil de novo
await p.keyboard.press('Space'); await p.keyboard.press('2') // Difícil
await p.keyboard.press('Space'); await p.keyboard.press('Space') // Bom (espaço com o verso aberto)
await p.waitForTimeout(60)
await p.screenshot({ path: 'docs/verificacao-capturas/cards-estudo-1440-dark.png' })
await p.keyboard.press('Space'); await p.keyboard.press('3') // o cartão que errou, agora Bom
await p.waitForSelector('text=Sessão concluída')
const resumoSessao = await p.locator('.top small').innerText()
ok('fim da sessão: resumo com respostas e % lembrados, e quando os próximos voltam', /6 respostas · 83% lembrados/.test(resumoSessao) && /voltam (amanhã|em \d+ dias)/.test(await p.locator('.fcvazio').innerText()), resumoSessao)
await p.click('.fcvazio >> text=Voltar')
const painelDepois = `${await painel('Respondidos hoje')} / ${await painel('Sequência')} / ${await painel('Aprendidos')}`
ok('depois de estudar: 6 respondidos hoje, sequência de 1 dia, 5 de 10 aprendidos', painelDepois === '6 / 1 dia / 5 de 10', painelDepois)
ok('limite de novos já gasto: "Estudar agora" desativado', await p.locator('.side-in button.btn.pri').isDisabled())

// ---- persistência ----
await abrir(); await irCards()
ok('depois de recarregar: baralho, cartões e andamento continuam (5 de 10 aprendidos)', (await p.locator('.deck .deckmeta').innerText()).includes('10 cartões') && (await painel('Aprendidos')) === '5 de 10')

// ---- botão voltar do navegador fecha a camada de cima ----
await p.click('.chip >> text=Sem limite') // libera o resto dos novos
await p.click('.deck .btn.pri'); await p.waitForSelector('.fcface')
await p.goBack(); await p.waitForSelector('.deck')
ok('voltar do navegador sai do estudo e volta aos baralhos (sem sair do app)', /cards/i.test((await p.locator('.rail-nome').textContent()) ?? '') && (await p.locator('.fcface').count()) === 0)
await p.click('.deck .deck-abrir'); await p.waitForSelector('.fclista')
await p.goBack(); await p.waitForSelector('.deck')
ok('voltar também sai da tela do baralho', (await p.locator('.fclista').count()) === 0)

// ---- editar, excluir (com desfazer), renomear, excluir baralho ----
await p.click('.deck .deck-abrir'); await p.waitForSelector('.fclista')
await p.fill('#bq', 'Copom')
await p.locator('.fcrow', { hasText: 'Qual a função do Copom?' }).getByRole('button', { name: /Editar/ }).click(); await p.waitForSelector('#cf')
await p.fill('#cv', 'Definir a meta da Selic (editado).'); await p.click('.foot >> text=Salvar')
await p.waitForSelector('.fclista')
ok('editar o cartão salva o texto novo', (await p.locator('.fcrow', { hasText: 'Qual a função do Copom?' }).innerText()).includes('(editado)'))
await p.fill('#bq', '')
const antes = await p.locator('.fcrow').count()
await p.locator('.fcrow').first().getByRole('button', { name: /Excluir/ }).click(); await p.waitForTimeout(600) // a linha encolhe (320 ms) antes de sair
ok('excluir cartão: some e mostra "Desfazer"', (await p.locator('.fcrow').count()) === antes - 1 && (await p.locator('.toast button').innerText()) === 'Desfazer')
await p.click('.toast button'); await p.waitForTimeout(100)
ok('"Desfazer" devolve o cartão', (await p.locator('.fcrow').count()) === antes)
await p.click('.btn >> text=Renomear'); await p.fill('#rn', 'Siglas e órgãos'); await p.click('text=Salvar nome')
ok('renomear baralho', (await p.locator('h1').innerText()) === 'Siglas e órgãos')
await p.click('text=Excluir este baralho'); await p.click('text=Sim, excluir'); await p.waitForSelector('.fcvazio')
ok('excluir baralho: some com os cartões e avisa com "Desfazer"', (await toast()).startsWith('Baralho excluído.') && (await p.locator('.toast button').innerText()) === 'Desfazer')
await p.click('.toast button'); await p.waitForSelector('.deck')
ok('"Desfazer" devolve o baralho e os 10 cartões', (await p.locator('.deck .deckmeta').innerText()).includes('10 cartões'))

// ---- criar flashcard a partir de uma questão ----
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
ok('antes de responder não oferece criar flashcard', (await p.locator('.criarcard').count()) === 0)
await p.locator('.alt').first().click(); await p.waitForSelector('.fb')
await p.click('.criarcard'); ok('criar flashcard da questão avisa', (await toast()).includes('Das questões'))
await p.click('.criarcard'); ok('segunda vez não duplica', (await toast()).includes('já tem um flashcard'))
await irCards()
ok('baralho "Das questões" criado com 1 cartão', (await p.locator('.deck', { hasText: 'Das questões' }).count()) === 1 && (await p.locator('.deck', { hasText: 'Das questões' }).innerText()).includes('1 cartão'))
await p.locator('.deck', { hasText: 'Das questões' }).getByRole('button', { name: /Abrir/ }).click(); await p.waitForSelector('.fcrow')
const txt = await p.locator('.fcrow').innerText()
ok('o cartão da questão traz o gabarito no verso (e as alternativas na frente quando há texto)', /Gabarito: [A-E]/.test(txt) && (/A\) /.test(txt) || /imagem/.test(txt)), txt.replace(/\n/g, ' ').slice(0, 90))

// ---- "Zerar tudo" não apaga flashcards (o backup em arquivo saiu do app) ----
await irPara(p, 'Mais')
await p.click('text=Zerar tudo'); await p.click('text=Sim, zerar'); await p.waitForTimeout(200)
await irCards()
ok('"Zerar tudo" não apaga os flashcards', (await p.locator('.deck').count()) === 2)
await abrir(); await irCards()
ok('depois de recarregar tudo segue no lugar', (await p.locator('.deck').count()) === 2)

// ---- celular ----
await p.setViewportSize({ width: 390, height: 844 })
await abrir(); await irCards()
const sobra = await p.evaluate(() => ({ lat: document.querySelector('.scroll-y').scrollWidth - document.querySelector('.scroll-y').clientWidth, jan: document.documentElement.scrollHeight - innerHeight }))
ok('celular: 5 abas cabem, sem rolagem lateral nem da janela', (await p.locator('.rail-item').count()) === 5 && sobra.lat <= 0 && sobra.jan <= 0, JSON.stringify(sobra))
await p.locator('.deck', { hasText: 'Siglas e órgãos' }).locator('.btn.pri').click(); await p.waitForSelector('.fcface')
await p.click('text=Mostrar resposta')
const pe = await p.evaluate(() => { const f = document.querySelector('.fcnotas').getBoundingClientRect(); return Math.round(innerHeight - f.bottom) })
ok('celular: botões de nota no pé da tela, colados no fim da tela (≤ 12 px)', pe <= 12, `${pe}px`)
await p.screenshot({ path: 'docs/verificacao-capturas/cards-estudo-390-dark.png' })
await p.click('.btn >> text=Sair'); await p.locator('.deck', { hasText: 'Siglas e órgãos' }).getByRole('button', { name: /Abrir/ }).click()
// teclado digital: ao focar qualquer campo a tela fica como está (o teclado só cobre); os botões do pé NÃO somem nem sobem
await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf'); await p.locator('#cv').focus(); await p.locator('#cv').blur()
const dif1 = await semMudar(p, () => p.locator('#cv').focus())
ok('celular, editor de cartão: focar o campo não mexe em nada e Salvar continua no pé', dif1.length === 0 && (await p.locator('.foot.sticky').isVisible()), dif1.join(' | '))
await p.locator('#cv').blur(); await p.click('.btn >> text=Voltar'); await p.waitForSelector('#bq')
const dif2 = await semMudar(p, () => p.locator('#bq').focus())
ok('celular, busca de cartões: focar não mexe em nada', dif2.length === 0, dif2.join(' | '))
await p.locator('#bq').blur()
await p.click('.btn >> text=Renomear'); await p.waitForSelector('#rn')
ok('celular, renomear: o campo já abre focado e os botões Salvar nome/Cancelar seguem onde estavam', (await p.locator('text=Salvar nome').isVisible()) && (await p.locator('text=Cancelar').isVisible()))
await p.click('text=Cancelar'); await p.click('.btn >> text=Baralhos'); await p.waitForSelector('.decks')
// o caso do relato: "Novo baralho" abre o campo com foco e o botão do pé ("Estudar agora" / "Nada para estudar hoje") não pode subir nem piscar
const vig = await vigiar(p, '.side.go .btn', async () => { await p.click('text=Novo baralho') })
ok('celular, Novo baralho: o campo do nome abre com foco, Criar baralho/Cancelar aparecem e o botão do pé (Nada para estudar hoje) fica no mesmo lugar, sem sumir nem piscar', (await p.locator('#nb').evaluate((e) => e === document.activeElement)) && (await p.locator('text=Criar baralho').isVisible()) && vig.ausente === 0 && vig.posicoes.length === 1, JSON.stringify(vig))
await p.click('text=Cancelar')
ok('celular: nenhuma marca de teclado na página', !(await p.evaluate(() => /kb-/.test(document.documentElement.className))) && (await p.locator('[data-kb-hide]').count()) === 0)

// ---- melhorias de uso no celular (2026-11-09): toque no cartão do baralho, rolagem por tela, foco sem pular, animações, editor ----
await p.setViewportSize({ width: 320, height: 568 }); await abrir(); await irCards(); await p.waitForSelector('.deck')
await p.locator('.deck').first().click({ position: { x: 24, y: 70 } }) // toca no CARTÃO (não no título nem no botão Estudar)
await p.waitForSelector('.fclista, .fcvazio')
ok('celular: tocar em qualquer ponto do cartão do baralho abre o baralho', (await p.locator('.fcacoes').count()) === 1)
await p.goBack(); await p.waitForSelector('.deck')
await p.evaluate(() => { document.querySelector('.scroll-y').scrollTop = 150 }); await p.waitForTimeout(100)
const rolouAntes = await p.evaluate(() => document.querySelector('.scroll-y').scrollTop)
await p.locator('.deck-abrir').first().evaluate((e) => e.click()); await p.waitForSelector('.fcacoes'); await p.waitForTimeout(300)
const noBaralho = await p.evaluate(() => document.querySelector('.scroll-y').scrollTop)
await p.goBack(); await p.waitForSelector('.deck'); await p.waitForTimeout(300)
const volta = await p.evaluate(() => document.querySelector('.scroll-y').scrollTop)
ok('celular: a sub-tela abre no topo e, ao voltar, a lista reaparece onde estava', rolouAntes >= 100 && noBaralho === 0 && Math.abs(volta - rolouAntes) <= 2, `antes ${rolouAntes} · no baralho ${noBaralho} · ao voltar ${volta}`)
await p.locator('.deck', { hasText: 'Siglas e órgãos' }).locator('.deck-abrir').evaluate((e) => e.click()); await p.waitForSelector('.fcacoes')
await p.click('.btn >> text=Novo cartão'); await p.waitForSelector('#cf'); await p.waitForTimeout(400)
const ed = await p.evaluate(() => ({ rolou: document.querySelector('.scroll-y').scrollTop, foco: document.activeElement?.id }))
ok('celular 320×568: o editor abre com o campo da frente já focado e a tela NÃO rola sozinha', ed.foco === 'cf' && ed.rolou === 0, JSON.stringify(ed))
const h0 = await p.locator('#cf').evaluate((e) => e.getBoundingClientRect().height)
await p.fill('#cf', Array.from({ length: 14 }, (_, i) => `linha ${i + 1} do texto da pergunta`).join('\n'))
const h1 = await p.locator('#cf').evaluate((e) => e.getBoundingClientRect().height)
ok('editor: o campo cresce com o texto, até 42% da altura da tela (e passa a rolar por dentro)', h1 > h0 && h1 <= 568 * 0.42 + 2, `${Math.round(h0)} → ${Math.round(h1)} px`)
await p.fill('#cf', 'x'.repeat(1700)); ok('editor: perto do limite aparece o contador de caracteres', (await p.locator('.fccount').innerText()) === '1700/2000')
await p.fill('#cf', '')
const sw = p.getByRole('switch', { name: /cartão inverso/ })
ok('editor: "cartão inverso" é um interruptor (liga e desliga)', (await sw.getAttribute('aria-checked')) === 'false' && (await sw.click(), await sw.getAttribute('aria-checked')) === 'true')
await p.click('.btn >> text=Voltar'); await p.waitForSelector('.fcacoes')
// estudo: toque no cartão vira, toque duplo logo depois de avaliar não vira o próximo sem querer
await p.click('.deck-abrir >> nth=0').catch(() => {}); await p.click('.btn >> text=Baralhos'); await p.waitForSelector('.deck')
await p.locator('.deck', { hasText: 'Siglas e órgãos' }).locator('.deck-estudar').evaluate((e) => e.click()); await p.waitForSelector('.fcface')
const topoFrente = () => p.locator('.fctexto').first().evaluate((e) => Math.round(e.getBoundingClientRect().top))
const topo0 = await topoFrente()
await p.locator('.fcface').click({ position: { x: 30, y: 120 } }); await p.waitForTimeout(350)
ok('estudo no celular: tocar no cartão mostra a resposta e a frente continua no mesmo lugar (sem pular)', (await p.locator('.fcface').innerText()).includes('VERSO') && (await p.locator('.fcn').count()) === 4 && (await topoFrente()) === topo0, `topo da frente ${topo0} → ${await topoFrente()}`)
await p.evaluate(() => document.querySelector('.fcn2').click()); await p.evaluate(() => document.querySelector('.fcface').click())
ok('estudo: um toque duplo logo depois de avaliar não mostra a resposta do próximo cartão sem querer', !(await p.locator('.fcface').innerText()).includes('VERSO'))
await p.click('.btn >> text=Sair'); await p.waitForSelector('.deck')
// excluir cartão: a linha encolhe (animação) antes de sair, com Desfazer
await p.locator('.deck', { hasText: 'Siglas e órgãos' }).locator('.deck-abrir').evaluate((e) => e.click()); await p.waitForSelector('.fclista')
const n0 = await p.locator('.fcrow').count()
await p.locator('.fcrow').first().getByRole('button', { name: /Excluir/ }).click(); await p.waitForTimeout(90)
ok('excluir cartão: a linha começa a encolher na hora (animação) e o cartão ainda não saiu', (await p.locator('.fcrow.saindo').count()) === 1 && (await p.locator('.fcrow').count()) === n0)
await p.waitForTimeout(700)
ok('excluir cartão: depois da animação a linha sai e aparece "Desfazer"', (await p.locator('.fcrow').count()) === n0 - 1 && (await p.locator('.toast button').innerText()) === 'Desfazer')
await p.click('.toast button'); await p.waitForTimeout(150)
ok('Desfazer devolve a linha', (await p.locator('.fcrow').count()) === n0)
const lat = await p.evaluate(() => { const s = document.querySelector('.scroll-y'); return { lat: s.scrollWidth - s.clientWidth, jan: document.documentElement.scrollWidth - innerWidth } })
ok('320 px: sem rolagem lateral nas telas de Cards', lat.lat <= 0 && lat.jan <= 0, JSON.stringify(lat))

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
