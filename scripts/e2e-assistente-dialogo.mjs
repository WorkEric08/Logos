// O DIÁLOGO do assistente (F2) no navegador de verdade: pedidos com detalhes, perguntas do que falta (tocar ou escrever a resposta), sugestões que se filtram
// enquanto se digita, desfazer, histórico que volta ao reabrir o app e limpar a conversa. Roda com "reduzir movimento" (a conversa não espera o "digitando…").
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-assistente-dialogo.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { esperarMovimento, irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => { const l = `${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`; out.push(l); console.log(l) }
const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const ctx = await novoContexto(b, { viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce' })
const p = await ctx.newPage()
p.on('pageerror', (e) => erros.push(e.message))
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()) })

const abrir = async () => { await irPara(p, 'Assistente'); await p.waitForSelector('.chat-tela'); await p.waitForSelector('.as-pilula'); await esperarMovimento(p) }
const msgs = () => p.locator('.as-msg:not(.as-digitando)').allInnerTexts()
const ultima = async () => (await msgs()).slice(-1)[0] ?? ''
const nA = () => p.locator('.as-msg.a:not(.as-digitando)').count()
const falar = async (fn) => { const antes = await nA(); await fn(); await p.waitForFunction((n) => document.querySelectorAll('.as-msg.a:not(.as-digitando)').length > n, antes, { timeout: 10000 }); await esperarMovimento(p) }
const escrever = (t) => falar(async () => { await p.fill('#as-msg', t); await p.locator('.as-composer .btn.pri').click() })
const enviarSemEsperar = async (t) => { await p.fill('#as-msg', t); await p.locator('.as-composer .btn.pri').click() }
const rotulos = () => p.locator('.as-pilula').allInnerTexts()
const voltarDaSessao = async () => { await irPara(p, 'Assistente'); const enc = p.locator('.btn.warn', { hasText: 'Encerrar' }); if (await enc.count()) await enc.click(); await p.waitForSelector('.chat-tela'); await p.waitForSelector('.as-pilula'); await esperarMovimento(p) }

await p.goto(base); await p.waitForSelector('.folders')
await abrir()
ok('abre com 10 sugestões (as 9 de antes + "Treinar questões")', (await p.locator('.as-pilula').count()) === 10 && (await rotulos()).includes('Treinar questões'), (await rotulos()).join(' | '))

// 1. sugestões enquanto se digita
await p.fill('#as-msg', 'si')
await p.waitForTimeout(80)
ok('digitando "si": a lista se filtra e o simulado vem primeiro', (await rotulos())[0] === 'Montar um simulado', (await rotulos()).join(' | '))
await p.fill('#as-msg', 'trein')
await p.waitForTimeout(80)
ok('digitando "trein": "Treinar questões" vem primeiro', (await rotulos())[0] === 'Treinar questões', (await rotulos()).join(' | '))
await p.fill('#as-msg', 'inflação')
await p.waitForTimeout(80)
ok('texto que não é comando oferece "Procurar … no meu material"', (await rotulos()).some((r) => /Procurar “inflação”/.test(r)), (await rotulos()).join(' | '))
await falar(() => p.locator('.as-pilula', { hasText: 'Procurar' }).click())
ok('tocar nela faz a pergunta de verdade (a fala da pessoa e a resposta do assistente)', (await msgs()).some((t) => t === 'inflação') && (await ultima()).length > 0)
ok('depois de enviar a caixa fica vazia e as sugestões voltam ao normal', (await p.inputValue('#as-msg')) === '' && (await p.locator('.as-pilula').count()) >= 10)

// 2. pedido completo: não pergunta nada
await enviarSemEsperar('simulado de matemática com 10 questões')
await p.waitForFunction(() => !document.querySelector('.chat-tela'), null, { timeout: 5000 })
ok('"simulado de matemática com 10 questões" monta direto: sai do chat e a prova começa', (await p.locator('.chat-tela').count()) === 0)
await voltarDaSessao()
ok('a conversa guardou o aviso do que foi montado', (await msgs()).some((t) => /Pronto: simulado de 10 questões de Matemática/.test(t)))
ok('o histórico continua ao voltar para a aba (mensagens de antes aparecem de uma vez)', (await msgs()).some((t) => t === 'simulado de matemática com 10 questões'))

// 3. perguntar o que falta, tocando
await acaoSimulado()
async function acaoSimulado() { await falar(() => p.locator('.as-pilula[data-acao="simulado"]').click()) }
ok('"Montar um simulado" pergunta qual (edital ou matéria) com opções para tocar', /Qual simulado\?/.test(await ultima()) && (await rotulos()).includes('Simulado do edital (70 questões)') && (await rotulos()).includes('Matemática') && (await rotulos()).includes('Cancelar'), (await rotulos()).join(' | '))
await falar(() => p.locator('.as-pilula', { hasText: /^Matemática$/ }).click())
ok('escolhida a matéria, pergunta a quantidade (sem repetir a matéria)', (await ultima()) === 'Quantas questões?' && (await rotulos()).includes('20 questões'), (await rotulos()).join(' | '))
// 4. ...e escrevendo a resposta
await escrever('banana')
ok('resposta sem sentido: repete a pergunta e as opções continuam', /Não entendi essa resposta\. Quantas questões\?/.test(await ultima()) && (await rotulos()).includes('20 questões'))
await p.fill('#as-msg', 'vinte questões'); await p.locator('.as-composer .btn.pri').click()
await p.waitForFunction(() => !document.querySelector('.chat-tela'), null, { timeout: 5000 })
ok('"vinte questões" escrito vale como a opção tocada: a prova começa', true)
await voltarDaSessao()

// 5. cancelar a pergunta
await acaoSimulado()
await falar(() => p.locator('.as-pilula[data-sug="cancelar"]').click())
ok('"Cancelar" desiste do pedido e volta às sugestões', /deixei para lá/.test(await ultima()) && (await p.locator('.as-pilula[data-acao="prova"]').count()) === 1)

// 6. treino e quantidade de questões de uma matéria
await escrever('quantas questões de matemática eu tenho?')
ok('contar por matéria: "quantas questões de matemática eu tenho?"', /\d+ questões de Matemática/.test(await ultima()), await ultima())
await escrever('quero treinar')
ok('"quero treinar" pergunta a matéria (sem opção do edital)', /Treinar o quê\?/.test(await ultima()) && !(await rotulos()).some((r) => /edital/.test(r)))
await p.fill('#as-msg', 'português'); await p.locator('.as-composer .btn.pri').click()
await p.waitForFunction(() => !document.querySelector('.chat-tela'), null, { timeout: 5000 })
ok('escrever a matéria começa o treino de 10 questões', true)
await voltarDaSessao()

// 7. desfazer (criar espaço) + histórico + limpar
await escrever('criar espaço Direito Teste')
await p.waitForFunction(() => /Espaço: Direito Teste/.test(document.body.innerText), null, { timeout: 8000 })
ok('"criar espaço Direito Teste" cria e ativa o espaço', true)
await p.waitForSelector('.as-pilula[data-sug="desfazer"]')
ok('aparece a sugestão "Desfazer: criar o espaço…"', (await rotulos()).some((r) => /^Desfazer: criar o espaço "Direito Teste"/.test(r)), (await rotulos()).join(' | '))
await falar(() => p.locator('.as-pilula[data-sug="desfazer"]').click())
await p.waitForFunction(() => /Espaço: Banco do Brasil/.test(document.body.innerText), null, { timeout: 8000 })
ok('desfazer apaga o espaço criado e volta ao de antes', /Desfiz: criar o espaço "Direito Teste"/.test(await ultima()))

// reabrir o app: o histórico volta
const antes = await msgs()
await p.reload(); await p.waitForSelector('.folders')
await abrir()
const depois = await msgs()
ok('fechar e abrir o app: a conversa toda volta, na mesma ordem', depois.length >= antes.length && antes.every((t, i) => depois[i] === t), `${antes.length} → ${depois.length}`)
ok('o histórico aparece de uma vez (sem "digitando…" nem entrada animada)', (await p.locator('.as-digitando').count()) === 0 && (await p.locator('.as-linha.entra').count()) === 0)
ok('com a conversa longa aparece "Limpar a conversa"', (await rotulos()).includes('Limpar a conversa'), String(depois.length))
await falar(() => p.locator('.as-pilula[data-sug="limpar"]').click())
ok('pede confirmação antes de apagar', /Apagar toda a conversa/.test(await ultima()) && (await rotulos()).join('|') === 'Apagar a conversa|Manter')
await p.locator('.as-pilula', { hasText: 'Manter' }).click()
await p.waitForSelector('.as-pilula[data-acao="prova"]')
ok('"Manter" não apaga nada', (await msgs()).length >= depois.length)
await escrever('limpar conversa')
await p.locator('.as-pilula', { hasText: 'Apagar a conversa' }).click()
await p.waitForFunction(() => document.querySelectorAll('.as-msg:not(.as-digitando)').length === 1, null, { timeout: 8000 })
await esperarMovimento(p)
await p.waitForFunction(() => document.querySelectorAll('.as-linha').length <= 2, null, { timeout: 8000 }).catch(() => {})
ok('apagar deixa só a apresentação do assistente', (await msgs()).length === 1 && /assistente do Logos/.test((await msgs())[0]), (await msgs()).length + ' falas')
await p.reload(); await p.waitForSelector('.folders'); await abrir()
ok('o que foi apagado não volta ao reabrir o app', (await msgs()).length === 1)

// 8. a regra do teclado continua valendo: o campo é o mesmo (conferido em e2e-teclado.mjs); aqui só garante que não há rolagem lateral
ok('sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
ok('sem erros de script no console', erros.length === 0, erros.slice(0, 3).join(' | '))
await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
