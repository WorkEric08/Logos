// F6.3 (e F6.2/F6.5 na prática): espaço criado/importado/apagado no A aparece/some no B; mesmo PDF nos dois não duplica; Desfazer da importação; material pesquisável no B.
import { irPara } from '../_ctx.mjs'
import { voltar, texto, foto } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
import { aparelho, entrar, esperar, fim, lancar, ok, out, emailUnico, painelEspacos, linhasEspacos } from './_dois.mjs'
const b = await lancar(); const email = emailUnico('esp')
const prova = await pdfProva(b), gab = await pdfGabarito(b)
const A = await aparelho(b, email), B = await aparelho(b, email)
await entrar(A.p); await entrar(B.p)
const arqs = async (p) => { await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab }) }
const chat = async (p) => { await irPara(p, 'Assistente'); await p.waitForTimeout(1200); for (let i = 0; i < 4 && !(await p.locator('#as-msg').count()); i++) { await p.getByRole('button', { name: /^(Voltar|Cancelar)$|Mais sugestões/ }).first().click().catch(() => {}); await p.waitForTimeout(700) } }
const dizer = async (p, t) => { await chat(p); await p.fill('#as-msg', t); await p.keyboard.press('Enter'); await p.waitForTimeout(1300) }
const MAIS = ['Selic: taxa básica de juros da economia brasileira, definida pelo Copom a cada reunião.', 'Copom: comitê do Banco Central que define a meta da taxa Selic.', 'CMN: conselho monetário nacional, órgão que edita as normas gerais do sistema financeiro.', 'CVM: autarquia que fiscaliza e regula o mercado de valores mobiliários.', 'BNDES: banco público de fomento que financia projetos de longo prazo de empresas.', 'Febraban: federação que reúne e representa os bancos brasileiros.', 'IPCA: índice oficial de preços ao consumidor, medido pelo IBGE todos os meses.', 'Poupança: aplicação de baixo risco com rendimento mensal definido em lei.'].join('\n\n')
const treinarN = async (p) => { await irPara(p, 'Treinar'); return parseInt((await p.locator('.top small, h1 ~ *').first().innerText()).replace(/\D/g, '') || '0') }
const enunciados = async (p) => { await irPara(p, 'Treinar'); await p.locator('.chip', { hasText: 'Ordem da prova' }).click(); const n = parseInt((await p.locator('.btn.pri', { hasText: 'Começar' }).innerText()).replace(/\D/g, '')); await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet'); const v = []; for (let i = 0; i < n; i++) { v.push((await p.locator('.enun').innerText().catch(() => '')).trim()); if (i < n - 1) await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(50) } await voltar(p); await p.waitForTimeout(300); return v }

// ---- 1. espaço + prova + material no A
await dizer(A.p, 'meus espaços'); await A.p.getByRole('button', { name: 'Novo espaço', exact: true }).click(); await A.p.waitForSelector('#as-espaco')
await A.p.fill('#as-espaco', 'Compartilhado'); await A.p.getByRole('button', { name: 'Criar vazio' }).click(); await A.p.waitForTimeout(2500)
if (!(await A.p.locator('#as-f-prova').count())) await dizer(A.p, 'importar prova')
await A.p.waitForSelector('#as-f-prova', { state: 'attached' }); await arqs(A.p)
await A.p.getByRole('button', { name: /Ler a prova/ }).click(); await A.p.waitForSelector('.as-qs', { timeout: 60000 }); await A.p.getByRole('button', { name: /Adicionar/ }).click(); await A.p.waitForSelector('.as-sucesso')
await dizer(A.p, 'meus materiais'); await A.p.getByRole('button', { name: 'Guardar um material' }).click(); await A.p.waitForSelector('#as-f-material', { state: 'attached' })
await A.p.setInputFiles('#as-f-material', { name: 'Glossario bancario.md', mimeType: 'text/markdown', buffer: Buffer.from('# Glossário\n\n' + MAIS) }); await A.p.waitForTimeout(2500)
out('A: espaço Compartilhado pronto; questões no Treinar:', await treinarN(A.p))
await A.p.waitForTimeout(1500)
// ---- 2. aparece no B
const apareceu = await esperar(async () => (await linhasEspacos(B.p)).some((t) => /Compartilhado/.test(t)), 45000)
ok('o espaço criado no A aparece em "Meus espaços" do B', apareceu, (await linhasEspacos(B.p)).join(' || '))
await foto(B.p, 'f6-b-espacos')
if (apareceu) {
  await B.p.getByRole('button', { name: /Compartilhado/ }).first().click(); await B.p.waitForTimeout(1500)
  ok('B recebe as 8 questões da prova (espaço utilizável)', await esperar(async () => (await treinarN(B.p)) === 8, 45000), 'questões no B: ' + (await treinarN(B.p)))
  const en = await enunciados(B.p); ok('B: os 8 enunciados chegam inteiros', en.length === 8 && en.every((t) => t.length > 15), en.map((t) => t.length).join(','))
  await dizer(B.p, 'o que é Copom?'); await B.p.waitForTimeout(3000)
  ok('B pesquisa no material vindo do A ("Copom")', await esperar(async () => (await B.p.locator('.as-achado mark').count()) > 0, 20000))
}
// ---- 3. apagar no A some no B
await painelEspacos(A.p); await A.p.getByRole('button', { name: /Apagar o espaço Compartilhado/ }).click(); await A.p.waitForTimeout(500)
await A.p.locator('.dialogo .btn.warn, .dialogo .btn', { hasText: /Apagar/ }).last().click(); await A.p.waitForTimeout(1500)
ok('espaço apagado no A some do B (e o B volta ao Banco do Brasil)', await esperar(async () => !(await linhasEspacos(B.p)).some((t) => /Compartilhado/.test(t)), 45000), (await linhasEspacos(B.p)).join(' || '))
ok('B continua abrindo (Treinar com as questões do BB)', (await treinarN(B.p)) === 1168, String(await treinarN(B.p)))
out('erros A', A.erros, 'B', B.erros); ok('sem erros de script', A.erros.length + B.erros.length === 0)
fim(); await b.close()
