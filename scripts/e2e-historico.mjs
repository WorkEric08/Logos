// Histórico por dia, simulados guardados, marcar para revisar e anotar, e zerar/desfazer, no navegador de verdade.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-historico.mjs [url]
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { irPara, novoContexto, esperarMovimento } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 1440, height: 900 }, acceptDownloads: true, colorScheme: 'dark' })
const p = await ctx.newPage()
const erros = []; p.on('pageerror', (e) => erros.push(e.message))
const abrir = async () => { await p.goto(base); await p.waitForSelector('.folders') }
const resumo = async (k) => (await p.locator('.side-in .sum div', { has: p.locator('dt', { hasText: new RegExp(`^${k}$`) }) }).locator('dd').textContent()).trim()
const nMarcadas = async () => +(await p.locator('.chip', { hasText: /^Marcadas\d+$/ }).locator('small').textContent())

await abrir()
ok('começa sem nada: Hoje = 0 respostas', (await (async () => { await irPara(p, 'Desempenho'); return resumo('Hoje') })()) === '0 respostas')

// ---- 1. responde 3, marca a 1ª, anota na 2ª
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
ok('questão tem o botão Marcar (não marcada)', (await p.locator('.marcar').getAttribute('aria-pressed')) === 'false')
await p.locator('.alt').first().click(); await p.waitForSelector('.fb')
await p.click('.marcar')
ok('Marcar vira Marcada', (await p.locator('.marcar').getAttribute('aria-pressed')) === 'true' && /Marcada/.test(await p.locator('.marcar').innerText()))
await p.click('.foot .pri'); await p.waitForTimeout(80)
await p.locator('.nota summary').click(); await p.locator('.nota textarea').fill('lembrar da crase')
await p.locator('.alt').first().click(); await p.waitForSelector('.fb')
ok('anotar marca a questão automaticamente', (await p.locator('.marcar').getAttribute('aria-pressed')) === 'true')
await p.click('.foot .pri'); await p.waitForTimeout(80)
await p.locator('.alt').first().click(); await p.waitForSelector('.fb')
await p.waitForTimeout(700) // a anotação é gravada meio segundo depois da última tecla

// ---- 2. tudo continua depois de recarregar
await abrir(); await irPara(p, 'Desempenho')
ok('depois de recarregar: Hoje = 3 respostas e Sequência = 1 dia', (await resumo('Hoje')) === '3 respostas' && (await resumo('Sequência')) === '1 dia', `${await resumo('Hoje')} / ${await resumo('Sequência')}`)
await esperarMovimento(p) // as barras sobem do chão ao entrar: mede a altura quando terminou
const barras = await p.locator('.bcol').count()
const altura = await p.locator('.bcol.hoje .bstack').evaluate((e) => e.getBoundingClientRect().height)
const diasNoMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
ok('gráfico: o mês atual inteiro, e a barra de hoje tem altura', barras === diasNoMes && altura > 20, `${barras} barras, hoje ${altura.toFixed(0)}px`)
ok('gráfico: a barra de hoje descreve o dia (dica e leitor de tela)', /: 3 respostas, \d+ certas?/.test((await p.locator('.bcol.hoje').getAttribute('aria-label')) ?? ''))
await p.locator('.bcol.hoje').click()
ok('tocar numa barra mostra o dia acima do gráfico', /: 3 respostas, \d+ certas?/.test((await p.locator('.evo .note').first().textContent()) ?? ''))
ok('tabela escondida (leitor de tela) com uma linha por dia do mês', (await p.locator('table.sr-only tbody tr').count()) === diasNoMes)
await p.screenshot({ path: 'docs/verificacao-capturas/historico-desempenho-1440-dark.png' })

// ---- 3. Treinar > Marcadas
await irPara(p, 'Treinar')
ok('chip Marcadas mostra 2', (await nMarcadas()) === 2)
await p.locator('.chip', { hasText: /^Marcadas\d+$/ }).click()
await p.locator('.field', { has: p.locator('.lb', { hasText: 'Quantidade' }) }).locator('.chip', { hasText: 'Todas' }).click()
ok('resumo do treino mostra Situação = Marcadas e 2 questões', (await resumo('Situação')) === 'Marcadas' && /^2/.test(await p.locator('.side-in .count').innerText()))
await p.click('text=Começar'); await p.waitForSelector('.sheet')
ok('treino só das marcadas: 2 questões, a 1ª já vem marcada', (await p.locator('.qbar .cnt').textContent()) === '1/2' && (await p.locator('.marcar').getAttribute('aria-pressed')) === 'true')
// as 2 marcadas vêm em ordem de sorteio: acha a que tem a anotação (a caixa abre sozinha quando há texto)
let notaAberta = ''
for (let i = 0; i < 2 && notaAberta !== 'lembrar da crase'; i++) {
  if (i) { await p.click('.foot .pri'); await p.waitForTimeout(80) }
  notaAberta = (await p.locator('.nota textarea').isVisible()) ? await p.locator('.nota textarea').inputValue() : ''
}
ok('a anotação voltou (depois de recarregar) e a caixa abre sozinha', notaAberta === 'lembrar da crase')
await p.locator('.nota textarea').fill(''); await p.locator('.nota textarea').blur() // apaga o texto (continua marcada)
await p.click('.marcar') // desmarca
await p.waitForTimeout(100)
await abrir(); await irPara(p, 'Treinar')
ok('apagar o texto e desmarcar: a questão sai das marcadas (sobra 1)', (await nMarcadas()) === 1)

// ---- 4. simulado entregue vira histórico
await irPara(p, 'Início'); await p.locator('.acts .act', { hasText: 'Simulado' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 69; i++) { if (i < 3) await p.locator('.alt').first().click(); await p.click('.foot .pri') }
await p.click('text=Entregar prova'); await p.getByRole('button', { name: 'Entregar', exact: true }).click({ timeout: 2500 }).catch(() => {}); await p.waitForSelector('.scorecard')
await irPara(p, 'Desempenho')
ok('simulado entregue aparece em Simulados (nota e "Não passou")', (await p.locator('.simlist li').count()) === 1 && /Não passou/.test(await p.locator('.simlist li').innerText()), (await p.locator('.simlist li').innerText()).replace(/\n/g, ' '))
await p.screenshot({ path: 'docs/verificacao-capturas/historico-simulado-1440-dark.png', fullPage: false })

// ---- 5. zerar apaga progresso e evolução, mantém marcações; Desfazer devolve tudo (o backup em arquivo saiu do app)
const antes = { hoje: await resumo('Hoje'), sims: await p.locator('.simlist li').count() }
await irPara(p, 'Mais')
// (a "Cópia de segurança" de 2026-11-17 é outra coisa: espaços, questões e materiais, não o progresso; o único seletor de arquivo de Mais é o dela)
ok('Mais não tem mais a seção de backup do progresso', (await p.locator('text=Backup do progresso').count()) === 0 && (await p.locator('text=Salvar arquivo de backup').count()) === 0 && (await p.locator('input[type=file]:not(.copia input)').count()) === 0)
await p.click('text=Zerar tudo'); await p.click('text=Sim, zerar'); await p.waitForTimeout(300)
const desfazer = p.locator('.toast').getByRole('button', { name: 'Desfazer' })
await irPara(p, 'Desempenho')
ok('Zerar apaga progresso e evolução (Hoje = 0, sem simulados)', (await resumo('Hoje')) === '0 respostas' && (await p.locator('.simlist li').count()) === 0)
await irPara(p, 'Treinar')
ok('Zerar mantém as marcações', (await nMarcadas()) === 1)
await desfazer.click(); await p.waitForTimeout(500)
await irPara(p, 'Desempenho')
ok('Desfazer devolve evolução e simulado', (await resumo('Hoje')) === antes.hoje && (await p.locator('.simlist li').count()) === antes.sims, `${await resumo('Hoje')}, ${await p.locator('.simlist li').count()} simulado`)
await abrir()
ok('depois de recarregar, tudo segue no lugar', (await (async () => { await irPara(p, 'Treinar'); return nMarcadas() })()) === 1)

// ---- 6. celular (mesma sessão, janela de 390 px)
await p.setViewportSize({ width: 390, height: 844 })
const q = p
await q.goto(base); await q.waitForSelector('.folders'); await irPara(q, 'Treinar'); await q.click('text=Começar'); await q.waitForSelector('.sheet')
await q.locator('.alt').first().click(); await q.waitForSelector('.fb')
ok('celular: botão Marcar cabe na barra, sem rolagem lateral', (await q.evaluate(() => { const s = document.querySelector('.scroll-y'); return s.scrollWidth - s.clientWidth })) === 0 && (await q.locator('.marcar').isVisible()))
await q.locator('.nota summary').click(); await q.locator('.nota textarea').fill('teste no celular')
await q.screenshot({ path: 'docs/verificacao-capturas/historico-questao-390-dark.png' })
await q.click('.btn >> text=Sair'); await irPara(q, 'Desempenho'); await q.waitForTimeout(200)
ok('celular: Desempenho mostra evolução e simulados sem rolagem lateral', (await q.locator('.bars').isVisible()) && (await q.evaluate(() => { const s = document.querySelector('.scroll-y'); return s.scrollWidth - s.clientWidth })) === 0)
await q.evaluate(() => document.querySelector('.evo').scrollIntoView())
await q.screenshot({ path: 'docs/verificacao-capturas/historico-evolucao-390-dark.png' })

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
