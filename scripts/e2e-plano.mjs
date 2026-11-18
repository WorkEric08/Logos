// Plano de estudo do assistente (2026-11-17), no Chrome: (1) o seletor de horas e minutos no lugar das opções de tempo (de 15 em 15, segurar repete, mínimo 00:15, máximo 05:00);
// (2) passar de 5 horas mostra o recado de descanso no aviso de baixo, no centro; (3) o plano é ACOMPANHADO: cartões primeiro (abre direto o estudo; ao acabar, vai sozinho às
// questões do plano), sair no meio e voltar mostra quantos faltam, e a posição em destaque passa dos cartões para as questões; (4) as duas sugestões que saíram da lista.
// Sobe o próprio servidor (porta 4322) e o encerra no fim. Uso: node scripts/e2e-plano.mjs
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { esperarMovimento, irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const PORTA = 4322, base = `http://localhost:${PORTA}/`
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)

const build = spawnSync('npx', ['vite', 'build'], { shell: true, stdio: 'ignore' })
if (build.status !== 0) { console.error('FALHOU: vite build'); process.exit(1) }
const servidor = spawn('npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort'], { shell: true, stdio: 'ignore' })
const encerra = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* já saiu */ } }
process.on('exit', encerra)
for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 500)) }

const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const ctx = await novoContexto(b, { viewport: { width: 360, height: 780 }, colorScheme: 'dark' })
const p = await ctx.newPage()
p.on('pageerror', (e) => erros.push(e.message))
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
await p.goto(base); await p.waitForSelector('.folders')

/** Escreve direto no banco do app: 3 cartões de revisão vencidos (para o plano ter cartões). */
await p.evaluate(async () => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })
  const tx = db.transaction(['decks', 'cards'], 'readwrite')
  tx.objectStore('decks').put({ id: 'b-e2e', nome: 'Baralho e2e', criado: 1 })
  for (let i = 0; i < 3; i++) tx.objectStore('cards').put({ id: 'c-e2e-' + i, b: 'b-e2e', f: 'Frente ' + i, v: 'Verso ' + i, criado: i + 1, estado: 'revisao', due: Date.now() - 86_400_000, ivl: 3, fac: 2.5, reps: 2, lapsos: 0, ult: 0 })
  await new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = () => no(tx.error) })
  db.close()
})
await p.reload(); await p.waitForSelector('.folders')

const abrirAssistente = async () => { await irPara(p, 'Assistente'); await p.waitForSelector('.chat-tela'); await p.waitForSelector('.as-pilula, .as-tempo'); await esperarMovimento(p) }
const msgs = () => p.locator('.as-msg.a:not(.as-digitando)').allInnerTexts()
const ultima = async () => (await msgs()).slice(-1)[0] ?? ''
const rotulos = () => p.locator('.as-pilula').allInnerTexts()
const nA = async () => (await msgs()).length
const falar = async (fn) => { const antes = await nA(); await fn(); await p.waitForFunction((n) => document.querySelectorAll('.as-msg.a:not(.as-digitando)').length > n, antes, { timeout: 10000 }); await esperarMovimento(p) }
const escrever = (t) => falar(async () => { await p.fill('#as-msg', t); await p.locator('.as-composer .as-enviar').click() })
const tempo = () => p.locator('.as-tempo .lemb-rel').innerText()
const botao = (sinal) => p.locator('.as-tempo .lemb-hora button', { hasText: sinal })
const segurar = async (sinal, ms) => { const r = await botao(sinal).boundingBox(); await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up() }
const minutos = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

await abrirAssistente()
const r0 = await rotulos()
ok('as sugestões fixas não têm mais "Perguntar ao meu material" nem "Ligar a ajuda de IA"', !r0.includes('Perguntar ao meu material') && !r0.includes('Ligar a ajuda de IA') && r0.includes('Painel do dia e plano de estudo'), r0.join(' | '))

// ───── 1. o seletor de tempo ─────
await escrever('plano de estudo')
ok('"plano de estudo": pergunta quanto tempo tem e mostra o seletor (00:30), sem as opções de tempo', (await ultima()) === 'Quanto tempo você tem hoje?' && (await tempo()) === '00:30' && (await p.locator('.as-pilula', { hasText: /^(15|30|45|60|90) min$|^1 hora$/ }).count()) === 0)
ok('é o mesmo elemento do lembrete (− 00:30 +, mesma classe)', (await p.locator('.as-tempo .lemb-hora .lemb-rel').count()) === 1 && (await botao('−').count()) === 1 && (await botao('+').count()) === 1)
await botao('+').click(); ok('um toque no "+" soma 15 minutos (00:45)', (await tempo()) === '00:45')
await botao('−').click(); await botao('−').click(); await botao('−').click(); await botao('−').click()
ok('o "−" para em 00:15 (o mínimo)', (await tempo()) === '00:15', await tempo())
await segurar('+', 1300)
const subiu = minutos(await tempo())
ok('segurar o "+" anda de 15 em 15 sem soltar (vários passos em 1,3 s)', subiu >= 15 + 15 * 5 && subiu <= 300 && subiu % 15 === 0, await tempo())
await segurar('+', 6000)
ok('segurando o "+" o tempo chega a 05:00 e PARA nele', (await tempo()) === '05:00', await tempo())
const toast = await p.evaluate(() => { const t = document.querySelector('.toast.longo'); if (!t) return null; const r = t.getBoundingClientRect(), c = getComputedStyle(t); return { texto: t.innerText, cx: Math.round(r.left + r.width / 2), w: innerWidth, base: Math.round(r.bottom), h: innerHeight, dentro: r.left >= 0 && r.right <= innerWidth, fundo: c.backgroundColor } })
ok('passou de 5 horas: aparece o recado de descanso no aviso de baixo, no centro, inteiro na tela', !!toast && /importante se esforçar, mas precisamos descansar/.test(toast.texto) && /5 horas/.test(toast.texto) && Math.abs(toast.cx - toast.w / 2) <= 2 && toast.dentro && toast.base > toast.h * 0.6, JSON.stringify(toast))
await p.waitForSelector('.toast.longo', { state: 'detached', timeout: 9000 })
await botao('+').click(); await p.waitForSelector('.toast.longo')
ok('um toque a mais no "+" (já em 05:00) mostra o recado de novo, e o tempo continua 05:00', (await tempo()) === '05:00')
await p.waitForSelector('.toast.longo', { state: 'detached', timeout: 9000 })
await segurar('−', 6000)
ok('segurando o "−" volta até 00:15 e para', (await tempo()) === '00:15', await tempo())
await botao('+').click(); await botao('+').click()
ok('00:15 + 2 passos = 00:45', (await tempo()) === '00:45')
await botao('−').click()
await falar(() => p.locator('.as-tempo .btn.pri').click())
const textoDoPlano = await ultima()
ok('"Montar o plano de 30 min" monta o plano de 30 minutos (3 cartões e as questões) e promete acompanhar', /^Plano de 30 minutos:\n1\. 3 cartões/.test(textoDoPlano) && /\n2\. \d+ questões/.test(textoDoPlano) && /Quando você voltar aqui, eu mostro o que ainda falta\. Se sair no meio, o treino fica salvo na aba Treinar por 30 min; se você entrar nele, leva o tempo que precisar\.$/.test(textoDoPlano), textoDoPlano.slice(0, 120))
const totalQ = Number(/2\. (\d+) questões/.exec(textoDoPlano)[1])
ok('a sugestão em destaque é "Começar pelos cartões (3)", seguida de "Fazer as N questões"', (await rotulos())[0] === 'Começar pelos cartões (3)' && (await rotulos())[1] === `Fazer as ${totalQ} questões` && (await p.locator('.as-pilula.pri').first().innerText()) === 'Começar pelos cartões (3)', (await rotulos()).join(' | '))

// ───── 2. cartões: abre direto o estudo; sair no meio; voltar mostra o que falta ─────
await p.locator('.as-pilula', { hasText: 'Começar pelos cartões (3)' }).click()
await p.waitForSelector('.fcstudy')
ok('"Começar pelos cartões" abre DIRETO o estudo (0/3)', (await p.locator('.fcstudy .cnt').innerText()) === '0/3')
const revisar = async () => { await p.waitForTimeout(400) /* (um toque logo depois de avaliar é ignorado de propósito: 280 ms) */; await p.locator('.fcnotas .btn.pri', { hasText: 'Mostrar resposta' }).click(); await p.locator('.fcbotoes .fcn2').click() }
await revisar()
await p.locator('.fcstudy .qbar .btn', { hasText: 'Sair' }).click()
await abrirAssistente()
await p.waitForFunction(() => [...document.querySelectorAll('.as-msg.a')].some((e) => /^Faltam 2 de 3 cartões do seu plano/.test(e.textContent)), null, { timeout: 8000 })
const meio = await ultima()
ok('saiu no cartão 1 de 3: ao voltar o assistente diz quantos faltam ("Faltam 2 de 3 cartões… você já fez 1")', meio === `Faltam 2 de 3 cartões do seu plano (você já fez 1). Depois, ${totalQ} questões.`, meio)
await esperarMovimento(p)
ok('e o botão em destaque vira "Continuar os cartões (2)", com as questões logo depois', (await rotulos())[0] === 'Continuar os cartões (2)' && (await p.locator('.as-pilula.pri').first().innerText()) === 'Continuar os cartões (2)' && (await rotulos())[1] === `Fazer as ${totalQ} questões`, (await rotulos()).join(' | '))

// ───── 3. terminar os cartões leva sozinho às questões do plano ─────
await p.locator('.as-pilula', { hasText: 'Continuar os cartões (2)' }).click()
await p.waitForSelector('.fcstudy')
await revisar()
await revisar()
await p.waitForSelector('.alt', { timeout: 8000 })
ok('ao acabar os cartões do plano, a pessoa vai SOZINHA às questões do plano (1/' + totalQ + ')', (await p.locator('.qbar .cnt').innerText()) === `1/${totalQ}`, await p.locator('.qbar .cnt').innerText())
ok('com o recado "Cartões feitos! Agora as questões."', (await p.locator('.toast').innerText()).includes('Cartões feitos! Agora as questões.'))

// ───── 4. sair no meio das questões; voltar mostra quantas faltam e o destaque passou para as questões ─────
await p.locator('.alt').first().click(); await p.locator('.foot .btn.pri', { hasText: 'Próxima' }).click()
await p.locator('.alt').first().click(); await p.locator('.foot .btn.pri', { hasText: 'Próxima' }).click()
await p.locator('.qbar .btn', { hasText: 'Sair' }).click()
await abrirAssistente()
const esperado = `Cartões do plano concluídos! Agora as questões: faltam ${totalQ - 2} de ${totalQ} questões.`
await p.waitForFunction((t) => [...document.querySelectorAll('.as-msg.a')].some((e) => e.textContent === t), esperado, { timeout: 8000 })
await esperarMovimento(p)
ok('terminou os cartões e respondeu 2 questões: o balão mostra quantas questões faltam', (await ultima()) === esperado, await ultima())
const r2 = await rotulos()
ok('a posição em destaque PASSOU dos cartões para as questões: "Continuar as questões (N)" primeiro, e sem pílula de cartões', r2[0] === `Continuar as questões (${totalQ - 2})` && !r2.some((r) => /cartões/.test(r)) && (await p.locator('.as-pilula.pri').first().innerText()) === r2[0], r2.join(' | '))
await p.locator('.as-pilula', { hasText: /^Continuar as questões/ }).click()
await p.waitForSelector('.alt')
ok('"Continuar as questões" começa só com as que faltam (1/' + (totalQ - 2) + ')', (await p.locator('.qbar .cnt').innerText()) === `1/${totalQ - 2}`, await p.locator('.qbar .cnt').innerText())

// ───── 5. o treino fica salvo na aba Treinar (pelo tempo que a pessoa disse ter) ─────
await p.locator('.alt').first().click(); await p.locator('.foot .btn.pri', { hasText: 'Próxima' }).click()
await p.locator('.qbar .btn', { hasText: 'Sair' }).click()
await irPara(p, 'Treinar'); await p.waitForSelector('.treino-plano')
const cartao = await p.locator('.treino-plano').innerText()
ok('saiu do treino do plano: na aba Treinar há o "Treino do seu plano" com quantas faltam e por quanto tempo fica salvo', cartao.includes(`Faltam 11 de ${totalQ} questões do plano de 30 min`) && /fica salvo aqui por mais (2\d|30) min/.test(cartao) && /pode levar o tempo que precisar/.test(cartao), cartao.replace(/\s+/g, ' '))
ok('com os botões "Continuar o treino (11)" e "Descartar"', (await p.locator('.treino-plano .btn.pri').innerText()) === 'Continuar o treino (11)' && (await p.locator('.treino-plano .btn', { hasText: 'Descartar' }).count()) === 1)
await p.locator('.treino-plano .btn', { hasText: 'Descartar' }).click()
await p.waitForFunction(() => !document.querySelector('.treino-plano'))
ok('"Descartar" tira o treino da aba (com o aviso "Treino descartado." e a chance de desfazer)', /Treino descartado\./.test(await p.locator('.toast').innerText()) && /Desfazer/.test(await p.locator('.toast').innerText()))
await p.locator('.toast button', { hasText: 'Desfazer' }).click(); await p.waitForSelector('.treino-plano')
ok('"Desfazer" traz o treino de volta', (await p.locator('.treino-plano .btn.pri').innerText()) === 'Continuar o treino (11)')
await abrirAssistente()
ok('painel do plano: a pílula que volta às sugestões se chama "Voltar" (C-7)', (await p.locator('.as-pilula[data-sug="mais"]').innerText()).trim() === 'Voltar')
await p.locator('.as-pilula[data-sug="mais"]').click(); await p.waitForSelector('.as-pilula[data-acao="plano"]'); await esperarMovimento(p) // (voltando, as sugestões são as do plano: "Voltar" abre a lista de sempre)
await falar(() => p.locator('.as-pilula[data-acao="plano"]').click())
const ja = await ultima()
ok('pedir de novo o "Painel do dia e plano de estudo": mostra o plano em andamento (e não pergunta o tempo)', /^Você já tem um plano de 30 min em andamento\./.test(ja) && /O treino fica salvo na aba Treinar até \d\d:\d\d/.test(ja) && (await p.locator('.as-tempo').count()) === 0, ja.slice(0, 140))
ok('com "Continuar as questões (11)" em destaque e "Outro tempo" ao lado', (await rotulos())[0] === 'Continuar as questões (11)' && (await rotulos()).includes('Outro tempo'), (await rotulos()).join(' | '))
await irPara(p, 'Treinar'); await p.waitForSelector('.treino-plano')
await p.locator('.treino-plano .btn.pri').click(); await p.waitForSelector('.alt')
ok('"Continuar o treino" da aba Treinar começa só com as que faltam (1/11)', (await p.locator('.qbar .cnt').innerText()) === '1/11', await p.locator('.qbar .cnt').innerText())

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
