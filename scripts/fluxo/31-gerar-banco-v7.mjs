// Monta, com o app ainda na v7 (Dexie 7 = IndexedDB 70), um banco REALISTA e o despeja em scripts/fluxo/dados/banco-v7.json:
// espaço importado (prova em PDF + gerar questões), espaço "com as questões do BB", materiais, progresso, simulado entregue, baralhos/cartões, marcações/anotações, conversa.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { abrirApp, irPara, voltar, texto } from './_base.mjs'
import { despejar } from './_idb.mjs'
import { pdfGabarito, pdfProva, TEXTO_RESUMO } from '../_pdf-prova.mjs'
const out = (...a) => console.log(...a)
const { b, p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } }); p.setDefaultTimeout(20000)
const prova = await pdfProva(b), gab = await pdfGabarito(b)
const arqs = async () => { await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab }) }
const dizer = async (t) => { await p.fill('#as-msg', t); await p.keyboard.press('Enter'); await p.waitForTimeout(1200) }
const MAIS = ['Selic: taxa básica de juros da economia brasileira, definida pelo Copom a cada reunião.', 'Copom: comitê do Banco Central que define a meta da taxa Selic.', 'CMN: conselho monetário nacional, órgão que edita as normas gerais do sistema financeiro.', 'CVM: autarquia que fiscaliza e regula o mercado de valores mobiliários.', 'BNDES: banco público de fomento que financia projetos de longo prazo de empresas.', 'Febraban: federação que reúne e representa os bancos brasileiros.', 'IPCA: índice oficial de preços ao consumidor, medido pelo IBGE todos os meses.', 'Poupança: aplicação de baixo risco com rendimento mensal definido em lei.'].join('\n\n')

// 2) espaço "Com as questões do BB"
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
await dizer('importar prova'); await p.waitForSelector('#as-espaco')
await p.fill('#as-espaco', 'Meu BB'); await p.getByRole('button', { name: 'Com as questões do BB' }).click(); await p.waitForTimeout(1500)
await voltar(p).catch(() => {}); await p.waitForTimeout(500)
// treino + simulado entregue + baralho/cartões + flashcard da questão
await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet')
await p.locator('.marcar').click()
for (let i = 0; i < 6; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(60); if (i === 0) { await p.locator('.criarcard').click(); await p.waitForTimeout(800) } await p.locator('.foot .btn.pri').click() }
await voltar(p); await p.waitForTimeout(400)
await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 70; i++) { if (i < 40) await p.locator('.alt:not([disabled])').first().click(); await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(25) }
await p.waitForTimeout(500); await p.locator('.dialogo .btn', { hasText: /Entregar/ }).first().click().catch(() => {}); await p.waitForSelector('.cartao'); await p.locator('.foot .btn', { hasText: 'Início' }).click()
await irPara(p, 'Cards'); await p.locator('text=Novo baralho').first().click(); await p.fill('#nb', 'Siglas'); await p.click('text=Criar baralho'); await p.waitForTimeout(700)
await p.click('.btn >> text=Novo cartão'); await p.fill('#cf', 'BACEN'); await p.fill('#cv', 'Banco Central do Brasil'); await p.click('text=Salvar e criar outro'); await p.waitForTimeout(400)
await p.fill('#cf', 'CMN'); await p.fill('#cv', 'Conselho Monetário Nacional'); await p.click('.foot >> text=Salvar >> nth=-1'); await p.waitForTimeout(700)

// 1) espaço "Concurso X": prova + materiais + questões geradas
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
await dizer('meus espaços'); await p.getByRole('button', { name: 'Novo espaço', exact: true }).click(); await p.waitForSelector('#as-espaco')
await p.fill('#as-espaco', 'Concurso X'); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForTimeout(2500)
if (!(await p.locator('#as-f-prova').count())) { await dizer('importar prova'); await p.waitForTimeout(1500) }
await p.waitForSelector('#as-f-prova', { state: 'attached' })
await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 })
await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso')
await p.getByRole('button', { name: 'Meus materiais', exact: true }).click().catch(async () => { await p.getByRole('button', { name: /Mais sugestões/ }).click(); await p.getByRole('button', { name: 'Meus materiais', exact: true }).click() })
await p.waitForTimeout(1200); await p.getByRole('button', { name: 'Guardar um material' }).click(); await p.waitForSelector('#as-f-material', { state: 'attached' })
await p.setInputFiles('#as-f-material', { name: 'Resumo moeda.md', mimeType: 'text/markdown', buffer: Buffer.from(TEXTO_RESUMO) }); await p.waitForTimeout(2500)
await p.getByRole('button', { name: 'Guardar outro material' }).click(); await p.waitForSelector('#as-f-material', { state: 'attached' })
await p.setInputFiles('#as-f-material', { name: 'Glossario bancario.md', mimeType: 'text/markdown', buffer: Buffer.from('# Glossário\n\n' + MAIS) }); await p.waitForTimeout(2500)
try {
await p.getByRole('button', { name: /Gerar questões deste material/ }).first().click(); await p.waitForTimeout(2500)
await p.getByRole('button', { name: /Glossario/ }).first().click(); await p.waitForTimeout(3500)
await p.getByRole('button', { name: /Adicionar/ }).first().click(); await p.waitForTimeout(2500)
} catch (e) { out('(gerar questões não rodou: '+e.message.slice(0,80)+')'); await p.screenshot({ path: 'docs/fluxos/capturas/gerar-falhou.png' }) }
out('espaço Concurso X pronto')
// estuda nele (progresso nas importadas e nas geradas) e marca/anota
await irPara(p, 'Treinar'); await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet')
await p.locator('.marcar').click(); await p.locator('.nota summary').click(); await p.fill('textarea', 'nota no Concurso X')
for (let i = 0; i < 6; i++) { await p.locator('.alt:not([disabled])').first().click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(60); await p.locator('.foot .btn.pri').click().catch(() => {}); await p.waitForTimeout(80) }
await voltar(p); await p.waitForTimeout(500)
await irPara(p, 'Assistente'); await p.waitForTimeout(800); await dizer('desfazer'); await dizer('ajuda')
const dump = await despejar(p)
const resumo = Object.fromEntries(Object.entries(dump.stores).map(([n, s]) => [n, s.valores.length]))
out('versão IndexedDB:', dump.versao, JSON.stringify(resumo))
writeFileSync(join(process.cwd(), 'scripts', 'fluxo', 'dados', 'banco-v7.json'), JSON.stringify(dump))
out('erros', erros); await fechar()
