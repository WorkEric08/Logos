// C-10: questão importada/gerada perdia o ENUNCIADO depois de fechar e reabrir. Importar -> treinar -> RECARREGAR -> abrir de novo; geradas; cópia de segurança (salvar, apagar dados, restaurar, reabrir)
import { join } from 'node:path'
import { abrirApp, irPara, voltar, esperarMovimento } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
const out = (...a) => console.log(...a)
const R = []; const ok = (n, c, x = '') => { const l = `${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`; R.push(l); console.log(l) }
const { b, p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce', acceptDownloads: true } }); p.setDefaultTimeout(20000)
const prova = await pdfProva(b), gab = await pdfGabarito(b)
const arqs = async () => { await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab }) }
const dizer = async (t) => { await p.fill('#as-msg', t); await p.keyboard.press('Enter'); await p.waitForTimeout(1200) }
// abre o Treinar no espaço ativo e percorre TODAS as questões lendo o enunciado
const lerTodas = async (pg) => {
  await irPara(pg, 'Treinar'); await pg.locator('.chip', { hasText: 'Ordem da prova' }).click()
  const n = parseInt((await pg.locator('.btn.pri', { hasText: 'Começar' }).innerText()).replace(/\D/g, '')); await pg.locator('.btn.pri', { hasText: 'Começar' }).click(); await pg.waitForSelector('.sheet')
  const vistos = []
  for (let i = 0; i < n; i++) { vistos.push((await pg.locator('.enun').innerText().catch(() => '(sem enunciado)')).trim()); if (i < n - 1) await pg.locator('.foot .btn.pri').click(); await pg.waitForTimeout(60) }
  await voltar(pg); await pg.waitForTimeout(300); return vistos
}
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
await dizer('importar prova'); await p.waitForSelector('#as-espaco'); await p.fill('#as-espaco', 'E10'); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForSelector('#as-f-prova', { state: 'attached' })
await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 }); await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso')
const antes = await lerTodas(p); ok('logo depois de importar: 8 enunciados inteiros', antes.length === 8 && antes.every((t) => t.length > 15), `${antes.length} questões; mais curto: ${Math.min(...antes.map((t) => t.length))}`)
await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p)
const depois = await lerTodas(p); ok('DEPOIS DE RECARREGAR: os mesmos 8 enunciados', JSON.stringify(depois) === JSON.stringify(antes), depois.map((t) => t.slice(0, 20)).join(' | '))
ok('nenhum enunciado vazio ou "(sem enunciado)"', depois.every((t) => t.length > 15 && !/sem enunciado/.test(t)))

// geradas
await irPara(p, 'Assistente'); await p.waitForTimeout(1200)
const MAIS = ['Selic: taxa básica de juros da economia brasileira, definida pelo Copom a cada reunião.', 'Copom: comitê do Banco Central que define a meta da taxa Selic.', 'CMN: conselho monetário nacional, órgão que edita as normas gerais do sistema financeiro.', 'CVM: autarquia que fiscaliza e regula o mercado de valores mobiliários.', 'BNDES: banco público de fomento que financia projetos de longo prazo de empresas.', 'Febraban: federação que reúne e representa os bancos brasileiros.', 'IPCA: índice oficial de preços ao consumidor, medido pelo IBGE todos os meses.', 'Poupança: aplicação de baixo risco com rendimento mensal definido em lei.'].join('\n\n')
await dizer('meus materiais'); await p.getByRole('button', { name: 'Guardar um material' }).click(); await p.waitForSelector('#as-f-material', { state: 'attached' })
await p.setInputFiles('#as-f-material', { name: 'Glossario bancario.md', mimeType: 'text/markdown', buffer: Buffer.from('# Glossário\n\n' + MAIS) }); await p.waitForTimeout(2500)
await p.getByRole('button', { name: /Gerar questões deste material/ }).first().click(); await p.waitForTimeout(3000)
await p.getByRole('button', { name: /Adicionar/ }).first().click(); await p.waitForTimeout(2500)
const g1 = await lerTodas(p); out('após gerar:', g1.length, 'questões no espaço')
await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p)
const g2 = await lerTodas(p); ok('geradas: depois de recarregar o enunciado continua inteiro', g2.length === g1.length && g2.every((t) => t.length > 15 && !/sem enunciado/.test(t)) && JSON.stringify(g1) === JSON.stringify(g2), `${g2.length} questões`)

// cópia de segurança: salvar, apagar dados (contexto novo), restaurar, reabrir
await irPara(p, 'Mais'); await p.waitForTimeout(500)
const dl = p.waitForEvent('download'); await p.getByRole('button', { name: 'Salvar cópia' }).click(); const d = await dl; const arq = join(process.cwd(), 'scripts', 'fluxo', 'dados', 'copia-c10.json'); await d.saveAs(arq)
const b2 = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } }); const q = b2.p; q.setDefaultTimeout(20000)
await irPara(q, 'Mais'); await q.setInputFiles('#copia-arquivo', arq); await q.waitForTimeout(2000)
await q.reload(); await q.waitForSelector('h1'); await esperarMovimento(q)
await irPara(q, 'Assistente'); await q.waitForTimeout(1500)
for (let i = 0; i < 3; i++) { const bt = q.getByRole('button', { name: 'Meus espaços de estudo', exact: true }); if (await bt.count()) { await bt.click(); break } await q.getByRole('button', { name: /Mais sugestões/ }).click().catch(() => {}); await q.waitForTimeout(600) }
await q.waitForTimeout(1200); await q.getByRole('button', { name: /E10/ }).first().click(); await q.waitForTimeout(1800)
const r = await lerTodas(q); ok('cópia restaurada em aparelho novo + reaberto: enunciados inteiros', r.length === g1.length && r.every((t) => t.length > 15) && JSON.stringify(r) === JSON.stringify(g1), `${r.length} questões`)
await b2.fechar()
ok('sem erros de script', erros.length === 0, erros.join(' | ').slice(0, 300))
console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas de ' + R.length); await fechar()
