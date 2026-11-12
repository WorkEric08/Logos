// Treinar e provas no navegador de verdade (2026-11-09):
//  - as provas de um cargo aparecem já nas 3 ordens (Mais novas, Mais antigas, Menos vistas), cada uma sob um TÍTULO que não é botão;
//  - ao escolher uma prova, os filtros se adaptam a ela (matérias, contagens e quantidades vêm das questões dela);
//  - tocar no ícone da barra lateral recomeça a tela daquele ícone;
//  - em toda questão a PÁGINA INTEIRA da prova aparece sozinha, com a legenda "Página N da prova. A questão M está nesta página.".
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-treinar.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
const p = await ctx.newPage()
const erros = []; p.on('pageerror', (e) => erros.push(e.message))
const abrir = async () => { await p.goto(base); await p.waitForSelector('.folders') }
const trilha = () => p.locator('.crumbs').innerText().then((t) => t.replace(/\s+/g, ' ').trim())
const grupo = (rotulo) => p.locator('.filters .field', { has: p.locator('.lb', { hasText: new RegExp(`^${rotulo}$`) }) })
const chips = (rotulo) => grupo(rotulo).locator('.chip').allInnerTexts().then((l) => l.map((t) => t.replace(/\s+/g, '')))
const naProva = async (banco, cargo, prova) => {
  await irPara(p, 'Início'); await p.waitForSelector('.provas')
  await p.locator('.provas .crumbs button', { hasText: 'Bancos' }).click()
  await p.locator('.provas .folder', { hasText: banco }).click()
  await p.locator(`.provas .folder:has(.fnm:text-is("${cargo}"))`).click()
  await p.locator('.file', { hasText: prova }).first().click(); await p.waitForSelector('.filters')
}

await abrir()

// ---- 1. as três ordens são títulos, com as provas já organizadas ----
await p.locator('.provas .folder', { hasText: 'Banco do Brasil' }).click()
await p.locator('.provas .folder:has(.fnm:text-is("Agente Comercial"))').click()
const titulos = await p.locator('.provas .provas-titulo').evaluateAll((l) => l.map((e) => e.textContent.trim())) // (innerText sairia em MAIÚSCULAS: é só o estilo)
ok('provas do cargo: 3 títulos, na ordem Mais novas · Mais antigas · Menos vistas', JSON.stringify(titulos) === JSON.stringify(['Mais novas', 'Mais antigas', 'Menos vistas']), titulos.join(' | '))
ok('os títulos NÃO são botões nem filtros (nenhum botão de ordem na tela)', (await p.locator('.provas .provas-titulo button, .provas button.chip, .provas .chips').count()) === 0 && (await p.locator('.provas .provas-titulo').evaluateAll((l) => l.every((e) => !e.closest('button') && e.tagName === 'H3'))))
const listas = await p.locator('.provas .provas-grupo').evaluateAll((gs) => gs.map((g) => [...g.querySelectorAll('.file .fname')].map((e) => e.textContent.trim())))
ok('cada título já traz TODAS as provas do cargo (8 no BB)', listas.length === 3 && listas.every((l) => l.length === 8), listas.map((l) => l.length).join(','))
ok('"Mais novas": do ano mais novo ao mais antigo (BB 2023 … BB 2010)', listas[0][0].startsWith('BB 2023') && listas[0][7].startsWith('BB 2010'), listas[0].join(' | '))
ok('"Mais antigas" é a mesma lista ao contrário', JSON.stringify(listas[1]) === JSON.stringify([...listas[0]].reverse()))
ok('"Menos vistas" tem as mesmas 8 provas', JSON.stringify([...listas[2]].sort()) === JSON.stringify([...listas[0]].sort()))
await p.locator('.provas .provas-titulo', { hasText: 'Mais antigas' }).click()
const depois = await p.locator('.provas .provas-grupo').evaluateAll((gs) => gs.map((g) => [...g.querySelectorAll('.file .fname')].map((e) => e.textContent.trim())))
ok('tocar num título não muda nada', JSON.stringify(depois) === JSON.stringify(listas))
await p.screenshot({ path: 'docs/verificacao-capturas/provas-tres-ordens-1440-dark.png' })

// ---- 2. os filtros se adaptam à prova escolhida ----
await p.locator('.file', { hasText: 'BB 2023' }).first().click(); await p.waitForSelector('.filters')
const mat70 = await grupo('Matéria').locator('.chip').evaluateAll((l) => l.map((e) => ({ t: e.firstChild?.textContent?.trim(), n: Number(e.querySelector('small')?.textContent ?? 0) })).filter((x) => x.t !== 'Todas'))
ok('BB 2023 (70): só as 8 matérias da prova, com as contagens dela (somam 70)', mat70.length === 8 && mat70.reduce((a, x) => a + x.n, 0) === 70 && !mat70.some((x) => x.t === 'Estatística'), JSON.stringify(mat70))
ok('BB 2023 (70): quantidades 10 · 20 · 30 · 40 · 50 · Todas (70)', JSON.stringify(await chips('Quantidade')) === JSON.stringify(['10', '20', '30', '40', '50', 'Todas70']), (await chips('Quantidade')).join(','))
await naProva('Caixa', 'TI', '2024')
ok('Caixa 2024 TI (5 questões): só a matéria que ela tem, com as 5', JSON.stringify(await chips('Matéria')) === JSON.stringify(['Todas5', 'ConhecimentosDigitais5']) || (await chips('Matéria')).filter((t) => !t.startsWith('Todas')).length === 1, (await chips('Matéria')).join(','))
ok('Caixa 2024 TI (5): a quantidade é só "Todas (5)" e o botão diz 5 questões', JSON.stringify(await chips('Quantidade')) === JSON.stringify(['Todas5']) && /Começar · 5 questões/.test(await p.locator('.go .btn.pri, .side-in .btn.pri').first().innerText()), (await chips('Quantidade')).join(','))
await naProva('Banco do Brasil', 'TI', '2021')
ok('BB 2021 TI (35): quantidades 10 · 20 · 30 · Todas (35) (o 40 e o 50 saem: seriam "todas")', JSON.stringify(await chips('Quantidade')) === JSON.stringify(['10', '20', '30', 'Todas35']), (await chips('Quantidade')).join(','))
await grupo('Matéria').locator('.chip', { hasText: /^Estatística/ }).click()
ok('escolher a matéria da prova (Estatística: 5) adapta a quantidade → só "Todas (5)" e os temas são os dela', JSON.stringify(await chips('Quantidade')) === JSON.stringify(['Todas5']) && (await p.locator('.top small').innerText()).startsWith('5 questões'), (await chips('Quantidade')).join(','))
await grupo('Prova').locator('.chip', { hasText: /^BB 2023/ }).click()
ok('trocar para uma prova que não tem essa matéria limpa a matéria (o treino não fica vazio)', (await grupo('Matéria').locator('.chip[aria-pressed=true]').innerText()).startsWith('Todas') && (await p.locator('.top small').innerText()).startsWith('70 questões'))
await grupo('Situação').locator('.chip', { hasText: /^Errei por último/ }).click()
await naProva('Banco do Brasil', 'Agente Comercial', 'BB 2023')
ok('abrir uma prova pelo Início zera a Situação (mostra a prova toda)', (await grupo('Situação').locator('.chip[aria-pressed=true]').innerText()).startsWith('Todas') && (await p.locator('.top small').innerText()).startsWith('70 questões'))
const cont = await grupo('Situação').locator('.chip').evaluateAll((l) => l.map((e) => e.querySelector('small')?.textContent ?? ''))
ok('as contagens de Situação (não vistas · erros · marcadas) são as da prova', cont[1] === '70' && cont[2] === '0' && cont[3] === '0', cont.join(','))
await p.screenshot({ path: 'docs/verificacao-capturas/treinar-prova-1440-dark.png' })

// ---- 3. página inteira da prova em toda questão ----
const verPagina = async (rotulo, indices = 3) => {
  const r = []
  for (let i = 0; i < indices; i++) {
    const fig = p.locator('.pg').last()
    await fig.scrollIntoViewIfNeeded().catch(() => {})
    await p.waitForFunction(() => { const i = [...document.querySelectorAll('.pg img')].pop(); return i && i.complete && i.naturalWidth > 0 }, null, { timeout: 8000 }).catch(() => {})
    r.push({ n: await p.locator('.pg').count(), carregou: await p.evaluate(() => [...document.querySelectorAll('.pg img')].every((i) => i.complete && i.naturalWidth > 0)), legenda: (await p.locator('.pg figcaption').last().innerText().catch(() => '')).trim(), botoes: await p.getByRole('button', { name: /Ver na prova|Ver o texto na prova|Esconder a prova/ }).count(), num: await p.locator('.qbar .cnt').innerText() })
    if (i < indices - 1) await p.click('.foot .pri')
  }
  return r
}
for (const [banco, cargo, prova, rot] of [['Banco do Brasil', 'Agente Comercial', 'BB 2023', 'BB 2023'], ['Caixa', 'Agente Comercial', 'Caixa 2024', 'Caixa 2024'], ['BNB', 'Agente Comercial', 'BNB 2024', 'BNB 2024'], ['Banco da Amazônia', 'TI', '2024', 'Amazônia 2024 TI'], ['Banese', 'Agente Comercial', '2025', 'Banese 2025']]) {
  await naProva(banco, cargo, prova)
  await grupo('Ordem').locator('.chip', { hasText: 'Ordem da prova' }).click()
  await p.click('.go .btn.pri, .side-in .btn.pri'); await p.waitForSelector('.sheet')
  const v = await verPagina(rot)
  ok(`${rot}: em cada questão a página inteira da prova aparece sozinha, carregada, com "Página N da prova. A questão M está nesta página."`, v.every((x) => x.n >= 1 && x.carregou && /^Página \d+ da prova\. A questão \d+ está nesta página\.$/.test(x.legenda) && x.botoes === 0), JSON.stringify(v.map((x) => [x.num, x.legenda])))
  await p.click('.btn >> text=Sair')
}
// no celular a página cabe na largura da tela e fica abaixo da questão
await p.setViewportSize({ width: 390, height: 844 }); await abrir()
await irPara(p, 'Treinar'); await grupo('Prova').locator('.chip', { hasText: /^BB 2023/ }).click(); await grupo('Ordem').locator('.chip', { hasText: 'Ordem da prova' }).click()
await p.click('.go .btn.pri, .side-in .btn.pri'); await p.waitForSelector('.sheet')
await p.locator('.pg').last().scrollIntoViewIfNeeded(); await p.waitForTimeout(600)
const cel = await p.evaluate(() => { const g = document.querySelector('.pg img').getBoundingClientRect(), f = document.querySelector('.sheet').getBoundingClientRect(); return { dentro: g.left >= 0 && g.right <= innerWidth, abaixo: g.top > f.top, lateral: document.querySelector('.scroll-y').scrollWidth - document.querySelector('.scroll-y').clientWidth } })
ok('celular: a página cabe na largura da tela, vem depois da questão e não há rolagem lateral', cel.dentro && cel.abaixo && cel.lateral <= 0, JSON.stringify(cel))
await p.screenshot({ path: 'docs/verificacao-capturas/questao-pagina-390-dark.png' })
await p.click('.btn >> text=Sair')

// ---- 4. ícone da barra lateral = a tela daquele ícone desde o início (computador) ----
await p.setViewportSize({ width: 1440, height: 900 }); await abrir()
await p.locator('.provas .folder', { hasText: 'Banco do Brasil' }).click(); await p.locator('.provas .folder:has(.fnm:text-is("Agente Comercial"))').click()
ok('(preparo) as provas estão no 3º nível', (await trilha()) === 'Bancos › Banco do Brasil › Agente Comercial')
await irPara(p, 'Início'); await p.waitForTimeout(150)
ok('clicar no ícone Início volta as provas para a lista de bancos', (await trilha()) === 'Bancos' && (await p.locator('.provas .folders .fnm').count()) === 5)
await irPara(p, 'Cards'); await p.waitForSelector('h1:has-text("Cards")')
await p.click('text=Criar o primeiro baralho'); await p.fill('#nb', 'Reinício'); await p.click('text=Criar baralho'); await p.waitForSelector('.fcacoes')
await irPara(p, 'Cards'); await p.waitForTimeout(200)
ok('clicar no ícone Cards dentro de um baralho volta à tela inicial de Cards', (await p.locator('h1').innerText()) === 'Cards' && (await p.locator('.fcacoes').count()) === 0 && (await p.locator('.deck').count()) === 1)
await p.click('.secbtn'); await p.waitForSelector('#nb')
await irPara(p, 'Cards'); await p.waitForTimeout(200)
ok('…e fecha o formulário de novo baralho que estava aberto', (await p.locator('#nb').count()) === 0)
await p.setViewportSize({ width: 1440, height: 420 }); await irPara(p, 'Treinar'); await p.waitForSelector('.filters')
await p.evaluate(() => { document.querySelector('.scroll-y').scrollTop = 300 }); await p.waitForTimeout(100)
const rolou = await p.evaluate(() => document.querySelector('.scroll-y').scrollTop)
await irPara(p, 'Treinar'); await p.waitForTimeout(200)
ok('clicar no ícone da aba em que já está leva ao topo dela', rolou > 100 && (await p.evaluate(() => document.querySelector('.scroll-y').scrollTop)) === 0, `rolou ${rolou}`)
await p.setViewportSize({ width: 1440, height: 900 })

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
