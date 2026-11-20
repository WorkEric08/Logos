// F6.2 caso 2.6 item 2, ORDEM CONTRÁRIA: R importa a prova primeiro, S importa depois (no v7 a linha passa a ser do S); apagar o S não pode tirar as questões do R (nem o inverso, com imagem)
import { abrirApp, irPara, voltar, texto, foto } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
const out = (...a) => console.log(...a)
const R = []; const ok = (n, c, x = '') => { const l = `${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`; R.push(l); console.log(l) }
const { b, p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } }); p.setDefaultTimeout(20000)
const prova = await pdfProva(b), gab = await pdfGabarito(b)
const arqs = async () => { await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab }) }
const chat = async () => { await irPara(p, 'Assistente'); await p.waitForTimeout(1200); for (let i = 0; i < 4 && !(await p.locator('#as-msg').count()); i++) { await p.getByRole('button', { name: /^(Voltar|Cancelar)$|Mais sugestões/ }).first().click().catch(() => {}); await p.waitForTimeout(700) } }
const dizer = async (t) => { await chat(); await p.fill('#as-msg', t); await p.keyboard.press('Enter'); await p.waitForTimeout(1300) }
const painel = async () => { await dizer('meus espaços'); await p.waitForTimeout(600) }
const treinarN = async () => { await irPara(p, 'Treinar'); return parseInt((await p.locator('.top small').first().innerText()).replace(/\D/g, '') || '0') }
const enunciados = async () => { await irPara(p, 'Treinar'); await p.locator('.chip', { hasText: 'Ordem da prova' }).click(); const n = parseInt((await p.locator('.btn.pri', { hasText: 'Começar' }).innerText()).replace(/\D/g, '')); await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet'); const v = []; for (let i = 0; i < n; i++) { v.push((await p.locator('.enun').innerText().catch(() => '')).trim()); if (i < n - 1) await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(50) } await voltar(p); await p.waitForTimeout(300); return v }
const criarEImportar = async (nome) => {
  await painel(); await p.getByRole('button', { name: 'Novo espaço', exact: true }).click(); await p.waitForSelector('#as-espaco'); await p.fill('#as-espaco', nome); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForTimeout(2500)
  if (!(await p.locator('#as-f-prova').count())) await dizer('importar prova')
  await p.waitForSelector('#as-f-prova', { state: 'attached' }); await arqs(); await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 }); await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso')
}
const ativar = async (nome) => { await painel(); await p.getByRole('button', { name: new RegExp(nome) }).first().click(); await p.waitForTimeout(1500) }
const apagar = async (nome) => { await painel(); await p.getByRole('button', { name: new RegExp('Apagar o espaço ' + nome) }).click(); await p.waitForTimeout(500); await p.locator('.dialogo .btn', { hasText: /Apagar/ }).last().click(); await p.waitForTimeout(1500) }

await criarEImportar('R'); await criarEImportar('S')
await ativar('R'); const enR = await enunciados(); ok('R e S com a mesma prova: R tem 8 questões', enR.length === 8)
await apagar('S'); await ativar('R')
const nR = await treinarN(); ok('apagar S (importou DEPOIS) NÃO tira as questões do R', nR === 8, 'R tem ' + nR)
if (nR === 8) ok('…e os enunciados do R continuam', JSON.stringify(await enunciados()) === JSON.stringify(enR))
ok('sem erros de script', erros.length === 0, erros.join(' | ').slice(0, 300))
console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas de ' + R.length); await fechar()
