// C-9: importar prova / gerar questões -> "Desfazer" remove só o que a ação trouxe; o resto do espaço (questões do BB, progresso, cartões, material) fica; voltar do aparelho e troca de aba
import { abrirApp, irPara, onde, voltar, texto, foto } from './_base.mjs'
import { pdfGabarito, pdfProva, TEXTO_RESUMO } from '../_pdf-prova.mjs'
const out = (...a) => console.log(...a)
const R = []; const ok = (n, c, x = '') => { const l = `${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`; R.push(l); console.log(l) }
const { b, p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } }); p.setDefaultTimeout(20000)
const prova = await pdfProva(b), gab = await pdfGabarito(b)
const arqs = async () => { await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab }) }
const pil = () => p.getByRole('button').allInnerTexts().then((l) => l.filter((t) => /Desfazer/.test(t)))
const nTreinar = async () => { await irPara(p, 'Treinar'); return parseInt((await p.locator('h1 ~ *, .top small').first().innerText()).replace(/\D/g, '') || '0') }
const stat = async () => { await irPara(p, 'Início'); return p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|')) }

// espaço com as questões do BB
await irPara(p, 'Assistente'); await p.waitForTimeout(1200)
await p.fill('#as-msg', 'importar prova'); await p.keyboard.press('Enter'); await p.waitForSelector('#as-espaco')
await p.fill('#as-espaco', 'C9'); await p.getByRole('button', { name: 'Com as questões do BB' }).click(); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await p.waitForTimeout(500)
// o espaço novo já nasce com as 1168; estuda 3, cria baralho e guarda um material ANTES de importar
await voltar(p); await p.waitForTimeout(500)
const n0 = await nTreinar(); out('questões no espaço C9 antes:', n0)
await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 3; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(60); await p.locator('.foot .btn.pri').click() }
await voltar(p); await p.waitForTimeout(300)
const s0 = await stat(); out('progresso antes:', s0)
await irPara(p, 'Cards'); await p.locator('text=Criar o primeiro baralho').click(); await p.fill('#nb', 'Meu'); await p.click('text=Criar baralho'); await p.waitForTimeout(600)
await irPara(p, 'Assistente'); await p.waitForTimeout(1200)
await p.getByRole('button', { name: 'Meus materiais', exact: true }).click(); await p.waitForTimeout(1500)
await p.getByRole('button', { name: 'Guardar um material' }).click(); await p.waitForSelector('#as-f-material', { state: 'attached' })
await p.setInputFiles('#as-f-material', { name: 'Resumo moeda.md', mimeType: 'text/markdown', buffer: Buffer.from(TEXTO_RESUMO) }); await p.waitForTimeout(3000)
out('material guardado; pílulas Desfazer:', await pil())

// importar a prova (8 questões novas)
await p.fill('#as-msg', 'importar prova').catch(async () => { await p.getByRole('button', { name: /Mais sugestões/ }).click().catch(() => {}); await p.fill('#as-msg', 'importar prova') })
await p.keyboard.press('Enter'); await p.waitForSelector('#as-f-prova', { state: 'attached' }); await arqs()
await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso', { timeout: 20000 })
const d1 = await pil(); ok('depois de importar a prova: "Desfazer: importar a prova"', d1.join('|') === 'Desfazer: importar a prova', d1.join('|'))
const n1 = await nTreinar(); ok('Treinar passou a ter +8 questões', n1 === n0 + 8, `${n0} -> ${n1}`)
// trocar de aba e voltar: a pílula continua?
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
const d2 = await pil(); ok('depois de trocar de aba e voltar, a pílula continua', d2.length === 1, d2.join('|'))
await p.getByRole('button', { name: /Desfazer: importar a prova/ }).click(); await p.waitForTimeout(1500)
out('fala:', (await texto(p)).replace(/\n/g, ' | ').match(/Desfiz[^|]*/)?.[0])
const n2 = await nTreinar(); ok('desfazer: volta ao número de antes (só as 8 saíram)', n2 === n0, `${n1} -> ${n2}`)
ok('progresso do espaço intacto', (await stat()) === s0, `${s0} -> ${await stat()}`)
await irPara(p, 'Cards'); ok('baralho "Meu" continua', /Meu/.test(await texto(p)))
await irPara(p, 'Assistente'); await p.waitForTimeout(1200)
await p.getByRole('button', { name: 'Meus materiais', exact: true }).click().catch(async () => { await p.getByRole('button', { name: /Mais sugestões/ }).click(); await p.getByRole('button', { name: 'Meus materiais', exact: true }).click() })
await p.waitForTimeout(1500); ok('material "Resumo moeda" continua', /Resumo moeda/.test(await texto(p)))
await voltar(p); await p.waitForTimeout(400); out('voltar do aparelho fecha o painel →', await onde(p))
await irPara(p, 'Treinar'); await irPara(p, 'Assistente'); await p.waitForTimeout(800)
ok('depois de desfazer não sobra pílula de desfazer', (await pil()).length === 0, (await pil()).join('|'))
await foto(p, 'c9-depois')

// gerar questões do material -> adicionar -> desfazer
await irPara(p, 'Assistente'); await p.waitForTimeout(1000)
await p.getByRole('button', { name: 'Gerar questões do meu material', exact: true }).click(); await p.waitForTimeout(2000)
out('gerar: botões', (await p.getByRole('button').allInnerTexts()).slice(-8))
const MAIS = ['Selic: taxa básica de juros da economia brasileira, definida pelo Copom a cada reunião.', 'Copom: comitê do Banco Central que define a meta da taxa Selic.', 'CMN: conselho monetário nacional, órgão que edita as normas gerais do sistema financeiro.', 'CVM: autarquia que fiscaliza e regula o mercado de valores mobiliários.', 'BNDES: banco público de fomento que financia projetos de longo prazo de empresas.', 'Febraban: federação que reúne e representa os bancos brasileiros.', 'IPCA: índice oficial de preços ao consumidor, medido pelo IBGE todos os meses.', 'Poupança: aplicação de baixo risco com rendimento mensal definido em lei.'].join('\n\n')
await p.getByRole('button', { name: 'Guardar outro material' }).click(); await p.waitForSelector('#as-f-material', { state: 'attached' })
await p.setInputFiles('#as-f-material', { name: 'Glossario bancario.md', mimeType: 'text/markdown', buffer: Buffer.from('# Glossário\n\n' + MAIS) }); await p.waitForTimeout(3000)
await p.getByRole('button', { name: /Gerar questões deste material/ }).first().click(); await p.waitForTimeout(3500)
out('escolher material:', (await p.getByRole('button').allInnerTexts()).slice(-6))
const gl = p.getByRole('button', { name: /Glossario/ }); if (await gl.count()) { await gl.first().click(); await p.waitForTimeout(3500) }
out('após escolher:', (await texto(p)).split('\n').join(' | ').slice(-260), '| botões', (await p.getByRole('button').allInnerTexts()).slice(-5))
const add = p.getByRole('button', { name: /Adicionar/ })
if (await add.count()) {
  await add.first().click(); await p.waitForTimeout(2500)
  const d3 = await pil(); ok('depois de adicionar questões geradas: "Desfazer: adicionar as questões geradas"', d3.join('|') === 'Desfazer: adicionar as questões geradas', d3.join('|'))
  const n3 = await nTreinar(); await irPara(p, 'Assistente'); await p.waitForTimeout(1000)
  await voltar(p); await p.waitForTimeout(300); out('(voltar do aparelho no chat) →', await onde(p))
  await irPara(p, 'Assistente'); await p.waitForTimeout(1000)
  await p.getByRole('button', { name: /Desfazer: adicionar/ }).click(); await p.waitForTimeout(1500)
  const n4 = await nTreinar(); ok('desfazer das geradas tira só elas', n4 === n0 && n3 > n0, `${n0} -> ${n3} -> ${n4}`)
  ok('progresso intacto depois de desfazer as geradas', (await stat()) === s0)
} else out('não cheguei à prévia das geradas'); await foto(p, 'c9-geradas')
ok('sem erros de script', erros.length === 0, erros.join(' | '))
console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas de ' + R.length); await fechar()
