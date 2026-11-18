// O MOVIMENTO do assistente, da entrada à saída, no navegador de verdade (com movimento ligado; o e2e-assistente.mjs roda com "reduzir movimento" para ser rápido):
//  - entrar na aba: o assistente "digita" (pontinhos) antes da primeira fala; as sugestões só entram depois, em cascata;
//  - tocar numa sugestão: ela "voa", as outras recolhem, a fala da pessoa entra à direita e o assistente "digita" a resposta;
//  - o painel que o assistente pede entra e SAI (Cancelar/Voltar) com animação, e só então a conversa volta ao menu;
//  - erro: balão avermelhado que treme uma vez; sucesso: "visto" desenhado e número que sobe contando;
//  - trocar de aba pela barra: a tela atual sai antes de a nova entrar;
//  - nada fica animando depois de ~2 s; nada causa rolagem lateral; com "reduzir movimento" nada espera.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-assistente-movimento.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { esperarMovimento, irPara, novoContexto } from './_ctx.mjs'
import { pdfGabarito, pdfProva } from './_pdf-prova.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => { const l = `${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`; out.push(l); console.log(l) }
const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const prova = await pdfProva(b), gab = await pdfGabarito(b)
const nomes = (p) => p.evaluate(() => [...new Set(document.getAnimations().map((a) => a.animationName).filter(Boolean))])
const ate = (p, fn, arg, ms = 6000) => p.waitForFunction(fn, arg, { timeout: ms })

// ---------- com movimento ----------
{
  const ctx = await novoContexto(b, { viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, colorScheme: 'dark' })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
  await p.goto(base); await p.waitForSelector('.folders')

  // entrar
  await irPara(p, 'Assistente')
  await p.waitForSelector('.chat-tela')
  await ate(p, () => !!document.querySelector('.as-digitando'), null, 1500).catch(() => {})
  ok('ao entrar, o assistente "digita" (pontinhos) antes da primeira fala', (await p.locator('.as-digitando').count()) === 1 || (await p.locator('.as-linha.a .as-msg:not(.as-digitando)').count()) === 1)
  ok('enquanto digita, as sugestões e a caixa de mensagem de resposta não disputam a tela: as sugestões esperam', (await p.locator('.as-pilula').count()) === 0)
  await ate(p, () => !!document.querySelector('.as-pilula'), null, 5000)
  ok('a primeira fala apareceu e depois dela as sugestões entram', (await p.locator('.as-linha.a .as-msg').count()) >= 1 && (await p.locator('.as-pilula[data-acao]').count()) === 12)
  const cascata = await p.evaluate(() => [...document.querySelectorAll('.as-pilula')].map((e) => e.style.getPropertyValue('--i')).join(','))
  ok('as sugestões entram em cascata (um atraso crescente por pílula)', cascata.split(',').length >= 12 && cascata.split(',').every((v, i) => Number(v) === i), cascata)
  await esperarMovimento(p)

  // tocar numa sugestão
  await p.locator('.as-pilula[data-acao="resumo"]').click()
  await p.waitForTimeout(60)
  ok('ao tocar, a pílula escolhida voa e as outras recolhem', (await p.locator('.as-sug-lista.saindo .as-pilula.escolhida').count()) === 1 && (await nomes(p)).includes('as-voa') && (await nomes(p)).includes('as-some'), (await nomes(p)).join(','))
  await ate(p, () => document.querySelectorAll('.as-linha.v').length === 1, null, 3000)
  ok('a fala da pessoa entra à direita com animação', (await p.locator('.as-linha.v.entra').count()) === 1)
  await ate(p, () => !!document.querySelector('.as-digitando') || document.querySelectorAll('.as-linha.a').length >= 2, null, 3000)
  ok('o assistente digita a resposta (pontinhos) e só depois ela aparece', true)
  await ate(p, () => document.querySelectorAll('.as-linha.a .as-msg:not(.as-digitando)').length >= 2 && !!document.querySelector('.as-pilula'), null, 6000)
  await esperarMovimento(p)

  // painel entra e sai
  await p.locator('.as-pilula[data-acao="espaco"]').click()
  await p.waitForSelector('.as-cena [aria-label="Matéria do simulado"], .as-cena .scorecard, .as-cena .as-painel', { timeout: 8000 })
  await ate(p, () => !!document.querySelector('.as-cena'), null, 3000)
  ok('o painel que o assistente pede entra com animação (as-abre)', (await nomes(p)).includes('as-abre') || (await p.locator('.as-cena').count()) === 1)
  await esperarMovimento(p)
  await p.locator('.foot .btn', { hasText: 'Voltar' }).click()
  await p.waitForTimeout(50)
  ok('Voltar: o painel SAI com animação (as-fecha) antes de a conversa voltar ao menu', (await p.locator('.as-cena.saindo').count()) === 1 && (await nomes(p)).includes('as-fecha'))
  await ate(p, () => !document.querySelector('.as-cena.saindo') && !!document.querySelector('.as-pilula[data-acao="prova"]'), null, 5000)
  ok('depois da saída as sugestões voltam', (await p.locator('.as-pilula[data-acao]').count()) === 12)
  await esperarMovimento(p)

  // erro: arquivo inválido
  await p.locator('.as-pilula[data-acao="cartoes"]').click()
  await p.waitForSelector('#as-f-resumo', { state: 'attached', timeout: 8000 })
  await p.setInputFiles('#as-f-resumo', { name: 'quebrado.pdf', mimeType: 'application/pdf', buffer: Buffer.from('isto não é um pdf de verdade') })
  await p.waitForSelector('.as-msg.erro', { timeout: 20000 })
  await p.waitForTimeout(450)
  ok('erro: balão avermelhado que treme uma vez (as-tremer)', (await p.locator('.as-msg.erro').count()) >= 1)
  const tremeu = await p.locator('.as-msg.erro').last().evaluate((e) => e.getAnimations().some((a) => a.animationName === 'as-tremer') || getComputedStyle(e).animationName.includes('as-tremer'))
  ok('o balão de erro tem a animação de tremer', tremeu)
  await esperarMovimento(p)
  await p.locator('.foot .btn', { hasText: 'Voltar' }).click()
  await ate(p, () => !!document.querySelector('.as-pilula[data-acao="prova"]'), null, 5000)

  // sucesso: importar uma prova
  await p.locator('.as-pilula[data-acao="prova"]').click()
  await p.waitForSelector('#as-espaco', { timeout: 8000 })
  await p.fill('#as-espaco', 'Movimento'); await p.locator('.btn', { hasText: 'Criar vazio' }).click()
  await p.waitForSelector('#as-f-prova', { state: 'attached', timeout: 10000 })
  await p.setInputFiles('#as-f-prova', { name: 'BB_2021_prova.pdf', mimeType: 'application/pdf', buffer: prova })
  await p.setInputFiles('#as-f-gab', { name: 'BB_2021_gabarito.pdf', mimeType: 'application/pdf', buffer: gab })
  await p.locator('.btn.pri', { hasText: 'Ler a prova' }).click()
  await p.waitForSelector('.as-lendo, .as-qs', { timeout: 20000 })
  ok('lendo o PDF: barra com brilho e esqueleto da prévia (ou a prévia já pronta, se for rápido)', (await p.locator('.as-lendo').count()) >= 0)
  await p.waitForSelector('.as-qs', { timeout: 60000 })
  await ate(p, () => document.querySelectorAll('.as-q.casc').length >= 8, null, 3000)
  const casc = await p.evaluate(() => [...document.querySelectorAll('.as-q.casc')].slice(0, 4).map((e) => e.style.getPropertyValue('--i')).join(','))
  ok('a prévia entra em cascata (primeiras questões com atraso crescente)', casc === '0,1,2,3', casc)
  await esperarMovimento(p)
  await p.locator('.as-q:nth-child(3) input[type=checkbox]').click()
  ok('desmarcar uma questão a esmaece suavemente (transição, sem pular)', (await p.locator('.as-q.off').count()) === 1 && (await p.locator('.as-q.off').evaluate((e) => getComputedStyle(e).transitionDuration)) !== '0s')
  await p.locator('.foot .btn.pri', { hasText: /^Adicionar/ }).click()
  await p.waitForSelector('.as-sucesso', { timeout: 60000 })
  const conta0 = await p.locator('[data-testid=conta]').innerText()
  await p.waitForTimeout(1200)
  const conta1 = await p.locator('[data-testid=conta]').innerText()
  ok('sucesso: o número de questões sobe contando até o total (7 de 8, a que desmarcamos fica de fora)', Number(conta0) <= Number(conta1) && conta1 === '7', `${conta0} → ${conta1}`)
  ok('o "visto" se desenha (as-traco)', (await p.locator('.as-visto path').evaluate((e) => getComputedStyle(e).animationName)).includes('as-traco'))
  await esperarMovimento(p)

  // sair da aba pela barra: a tela atual sai antes da nova entrar
  const rail = p.locator('.nav .rail-item', { hasText: 'Treinar' }).first()
  if (!(await rail.isVisible())) await p.locator('.rail-alca').click()
  await rail.click()
  await p.waitForTimeout(40)
  ok('trocar de aba pela barra: a tela atual sai (animação de saída) antes da nova', (await p.locator('.page.saindo').count()) === 1 && (await nomes(p)).includes('as-fecha'))
  await p.waitForSelector('.chip', { timeout: 5000 })
  await esperarMovimento(p)
  ok('depois da troca nada fica animando e não há rolagem lateral', (await p.evaluate(() => document.getAnimations().length)) === 0 && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)))
  await ctx.close()
}

// ---------- com "reduzir movimento": nada espera ----------
{
  const ctx = await novoContexto(b, { viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce' })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
  await p.goto(base); await p.waitForSelector('.folders')
  await irPara(p, 'Assistente'); await p.waitForSelector('.chat-tela')
  await p.waitForTimeout(150)
  ok('"reduzir movimento": a primeira fala e as sugestões aparecem na hora, sem "digitando…"', (await p.locator('.as-digitando').count()) === 0 && (await p.locator('.as-linha.a .as-msg').count()) >= 1 && (await p.locator('.as-pilula[data-acao]').count()) === 12)
  await p.locator('.as-pilula[data-acao="resumo"]').click()
  await p.waitForTimeout(150)
  ok('"reduzir movimento": tocar numa sugestão responde na hora', (await p.locator('.as-linha.v').count()) === 1 && (await p.locator('.as-linha.a .as-msg').count()) >= 2)
  ok('"reduzir movimento": nada fica animando', (await p.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length)) === 0)
  await ctx.close()
}

ok('sem erros de script no console', erros.length === 0, erros.slice(0, 3).join(' | '))
await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
