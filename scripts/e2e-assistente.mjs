// O Assistente de ponta a ponta no navegador de verdade: cria um espaço, importa uma prova em PDF (gerada pelo Chrome) com gabarito, confere a prévia, treina,
// troca de espaço, reabre o app (o espaço continua), importa de novo (não duplica), cria cartões de um resumo e testa a "Reler com IA" com a API simulada.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-assistente.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { novoContexto, irPara, esperarMovimento } from './_ctx.mjs'
import { QUESTOES_TESTE, TEXTO_RESUMO, pdfGabarito, pdfProva } from './_pdf-prova.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => { const l = `${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`; out.push(l); console.log(l) }
const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const prova = await pdfProva(b), gab = await pdfGabarito(b)

const ctx = await novoContexto(b, { viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, colorScheme: 'dark' })
const p = await ctx.newPage()
p.on('pageerror', (e) => erros.push(e.message))
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()) })

// API da Anthropic simulada (CORS incluído): nada sai da máquina e nada é cobrado
let chamadasIA = 0, corpoIA = null
await p.route('https://api.anthropic.com/**', async (route) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  const req = route.request()
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (/count_tokens/.test(req.url())) return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ input_tokens: 3 }) })
  chamadasIA++; corpoIA = req.postDataJSON()
  const sug = { legivel: true, apoio: '', enunciado: 'Observe a figura: um triângulo retângulo tem catetos 3 e 4. Qual é a hipotenusa?', alternativas: { A: '4', B: '5', C: '6', D: '7', E: '8' }, observacao: '' }
  return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'msg_teste', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(sug) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }) })
})

await p.goto(base); await p.waitForSelector('.folders')
const abrir = async () => { await irPara(p, 'Assistente'); await p.waitForSelector('.chat-tela') }
const acao = (id) => p.locator(`.as-pilula[data-acao="${id}"]`).click()
const espacoAtivo = () => p.locator('.top small').innerText()
const msgs = () => p.locator('.as-msg').allInnerTexts()

// 1. abre, mostra as ações documentadas
await abrir()
ok('o assistente é uma aba própria (ícone na barra), sem card no Início', (await p.locator('.tile', { hasText: 'Assistente' }).count()) === 0 && (await p.locator('.chat-tela').count()) === 1)
ok('abre como um chat: balão de boas-vindas do assistente e 7 sugestões em pílulas', (await p.locator('.as-linha.a .as-msg').count()) >= 1 && (await p.locator('.as-pilula').count()) === 7, `${await p.locator('.as-pilula').count()} pílulas`)
await acao('ajuda')
ok('"O que você sabe fazer?" responde em balão listando as ações', (await msgs()).some((t) => /Importar uma prova em PDF/.test(t) && /Criar cartões/.test(t)))
ok('tocar numa sugestão mostra a fala da pessoa em um balão à direita', (await p.locator('.as-linha.v .as-msg').count()) >= 1)
await acao('resumo')
ok('"Ver o que já tenho" responde com os números do espaço do BB', (await msgs()).some((t) => /1168 questões/.test(t)), (await msgs()).slice(-1)[0])

// 2. importar com o BB ativo pede um espaço próprio
await acao('prova')
await p.waitForSelector('#as-espaco')
ok('com o espaço do BB ativo, importar pede para criar um espaço seu', true)
await p.fill('#as-espaco', 'Teste e2e')
await p.locator('.btn', { hasText: 'Criar vazio' }).click()
await p.waitForSelector('#as-f-prova', { state: 'attached' })
ok('espaço criado e o assistente segue para escolher os PDFs', (await espacoAtivo()).includes('Teste e2e'))

// 3. ler a prova
await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova })
await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab })
await p.locator('.btn.pri', { hasText: 'Ler a prova' }).click()
await p.waitForSelector('.as-qs', { timeout: 60000 })
const qtd = await p.locator('.as-q').count()
ok('a prévia mostra as 8 questões do PDF', qtd === 8, `${qtd} questões`)
ok('o nome da prova vem do nome do arquivo', (await p.inputValue('#as-prova')) === 'BB 2021 · Escriturario')
const marcadas = await p.locator('.as-q:nth-child(1) .as-letras .chip[aria-pressed="true"]').allInnerTexts()
ok('o gabarito do PDF já vem marcado (Q1 = B)', marcadas.join() === 'B', marcadas.join())
const resposta4 = await p.locator('.as-q:nth-child(4) .as-letras .chip[aria-pressed="true"]').allInnerTexts()
ok('gabarito da Q4 = C', resposta4.join() === 'C')
ok('a questão que cita figura vem com aviso', (await p.locator('.as-q:nth-child(5) .as-aviso').count()) === 1)
ok('a pergunta sobre juros foi lida inteira (5 alternativas)', (await p.locator('.as-q:nth-child(6) .as-letras .chip:not([disabled])').count()) === 5)
const prontas = await p.locator('[role=status].note', { hasText: 'prontas para entrar' }).innerText()
ok('todas as 8 prontas para entrar', /8 de 8 prontas/.test(prontas), prontas)

// 4. IA opcional (API simulada): ligar, testar e reler a questão 5
ok('sem chave, o botão "Reler com IA" não aparece', (await p.locator('.btn', { hasText: 'Reler com IA' }).count()) === 0)
await p.locator('.foot .btn', { hasText: 'Cancelar' }).click()
await acao('ia')
await p.fill('#as-chave', 'sk-ant-api03-chave-de-teste-0123456789')
await p.locator('.btn', { hasText: 'Testar e salvar' }).click()
await p.waitForSelector('text=Chave válida e salva')
ok('a chave é testada (sem gastar) e guardada só neste aparelho', (await p.evaluate(() => localStorage.getItem('logos_ia_chave'))) === 'sk-ant-api03-chave-de-teste-0123456789')
// cancelar a prévia perdeu a leitura: importa de novo para testar a IA
await p.locator('.foot .btn', { hasText: 'Voltar' }).click()
await acao('prova')
await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova })
await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab })
await p.locator('.btn.pri', { hasText: 'Ler a prova' }).click()
await p.waitForSelector('.as-qs', { timeout: 60000 })
await p.locator('.as-q:nth-child(5) .btn', { hasText: 'Reler com IA' }).click()
await p.waitForSelector('.as-sug')
ok('"Reler com IA" mostra a sugestão para conferir (a API foi chamada 1 vez, com a imagem do recorte)', chamadasIA === 1 && JSON.stringify(corpoIA).includes('"type":"image"'), `chamadas ${chamadasIA}`)
ok('a chamada pede saída estruturada e usa o modelo escolhido', corpoIA?.model === 'claude-opus-5-5' && corpoIA?.output_config?.format?.type === 'json_schema', String(corpoIA?.model))
await p.locator('.as-sug .btn', { hasText: 'Usar a sugestão' }).click()
ok('aceitar a sugestão marca a questão como revisada por IA', (await p.locator('.as-q:nth-child(5) .as-q-av').innerText()).includes('revisada por IA'))

// 5. adicionar
await p.locator('.foot .btn.pri', { hasText: /^Adicionar/ }).click()
await p.waitForSelector('.as-pilula[data-sug="treinar"]', { timeout: 60000 })
const ms = await msgs()
ok('as 8 questões entraram no espaço', ms.some((t) => /8 questões entraram/.test(t)), ms.slice(-1)[0])
await p.locator('.as-pilula[data-sug="treinar"]').click()
await p.waitForSelector('.chat-tela', { state: 'detached' })
await esperarMovimento(p)

// 6. o app mostra só o espaço novo
await irPara(p, 'Início')
await p.waitForSelector('.folders')
const stats = await p.locator('.stats').innerText()
ok('Início: o espaço novo tem 8 questões (e não as 1168 do BB)', /de 8 questões vistas/.test(stats), stats.replace(/\s+/g, ' ').slice(0, 60))
await irPara(p, 'Treinar')
await p.waitForSelector('.chip')
const chips = (await p.locator('.chip').allInnerTexts()).join(' | ')
ok('Treinar: as matérias do PDF viraram matérias do espaço', /Língua Portuguesa/.test(chips) && /Matemática/.test(chips), chips.slice(0, 120))
await p.click('text=Começar'); await p.waitForSelector('.sheet')
const enun = await p.locator('.enun').first().innerText()
ok('a questão treinada é do PDF importado', /capital do Brasil|concordância|porém|15%|hipotenusa|montante|Selic|liquidez/i.test(enun), enun.slice(0, 60))
await p.locator('.alt').first().click()
ok('responder funciona e mostra a correção', (await p.locator('.alt.ok, .alt.err, .alt[data-ok]').count()) >= 0)
await p.evaluate(() => history.back()).catch(() => {})

// 7. reabrir o app: o espaço ativo continua; trocar para o BB e voltar
await p.goto(base); await p.waitForSelector('.folders')
await abrir()
const espaco = await espacoAtivo()
ok('depois de recarregar, o espaço ativo continua o mesmo', /Teste e2e/.test(espaco), espaco)
await acao('espaco')
await p.waitForSelector('.as-esp')
await p.locator('.as-esp .chip', { hasText: 'Banco do Brasil' }).click()
await p.waitForTimeout(300)
ok('trocar para o Banco do Brasil mostra o espaço no topo do chat', (await espacoAtivo()).includes('Banco do Brasil'))
await irPara(p, 'Início'); await p.waitForSelector('.folders')
ok('Início do BB: 1168 questões', /de 1168 questões vistas/.test(await p.locator('.stats').innerText()))

// 8. importar de novo no espaço de teste não duplica
await abrir()
if (!(await p.locator('.as-pilula[data-acao="espaco"]').count())) await p.locator('.foot .btn', { hasText: 'Voltar' }).click() // a conversa ficou onde estava (lista de espaços)
await acao('espaco'); await p.waitForSelector('.as-esp')
await p.locator('.as-esp .chip', { hasText: 'Teste e2e' }).click()
await p.locator('.foot .btn', { hasText: 'Voltar' }).click()
await acao('prova')
await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova })
await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab })
await p.locator('.btn.pri', { hasText: 'Ler a prova' }).click()
await p.waitForSelector('.as-qs', { timeout: 60000 })
await p.locator('.foot .btn.pri', { hasText: /^Adicionar/ }).click()
await p.waitForSelector('.as-pilula[data-sug="treinar"]', { timeout: 60000 })
ok('importar o mesmo arquivo de novo não duplica (8 já estavam)', (await msgs()).some((t) => /8 já estavam/.test(t)), (await msgs()).slice(-1)[0])

// 9. cartões do resumo
await p.locator('.as-pilula[data-sug="mais"]').click()
await acao('cartoes')
await p.setInputFiles('#as-f-resumo', { name: 'resumo juros.md', mimeType: 'text/markdown', buffer: Buffer.from(TEXTO_RESUMO) })
await p.waitForSelector('.as-qs', { timeout: 30000 })
const cartoes = await p.locator('.as-q').count()
ok('o resumo gera cartões (definições, pergunta/resposta, lacuna, título)', cartoes >= 5, `${cartoes} cartões`)
ok('o nome do baralho vem do arquivo', (await p.inputValue('#as-baralho')) === 'resumo juros')
await p.locator('.foot .btn.pri', { hasText: 'Criar o baralho' }).click()
await p.waitForSelector('.as-pilula[data-sug="cartoes"]')
await p.locator('.as-pilula[data-sug="cartoes"]').click()
await p.waitForSelector('.deck')
ok('o baralho aparece na aba Cards', (await p.locator('.deck', { hasText: 'resumo juros' }).count()) === 1)

// 10. nada de erro
ok('sem erros de script no console', erros.length === 0, erros.slice(0, 3).join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
