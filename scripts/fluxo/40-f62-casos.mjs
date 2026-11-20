// F6.2 (caso 2.6 item 2): a MESMA prova importada em dois espaços; apagar um não mexe no outro (questões e imagens). Caso 3.6: progresso de questão cujo espaço não existe mais (caderno, Desempenho, Rever erros, plano, sorteio) não quebra.
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

await criarEImportar('P'); const nP = await treinarN(); await criarEImportar('Q'); const nQ = await treinarN()
ok('a mesma prova em dois espaços: cada um com 8 questões', nP === 8 && nQ === 8, `P=${nP} Q=${nQ}`)
const enQ = await enunciados()
await apagar('P')
await ativar('Q'); const nQ2 = await treinarN(); const enQ2 = await enunciados()
ok('apagar P NÃO tira as questões do Q (8 e enunciados iguais)', nQ2 === 8 && JSON.stringify(enQ2) === JSON.stringify(enQ), `Q=${nQ2}`)
// recria P, importa, apaga Q: P intacto
await criarEImportar('P2'); await apagar('Q'); await ativar('P2'); ok('apagar Q NÃO tira as questões do P2', (await treinarN()) === 8)
await p.reload(); await p.waitForSelector('h1'); await p.waitForTimeout(800)
await ativar('P2'); ok('depois de recarregar o P2 segue com 8 questões e enunciados', (await treinarN()) === 8 && (await enunciados()).every((t) => t.length > 15))

// ---- 3.6: progresso de questão de um espaço apagado
await irPara(p, 'Treinar'); await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 8; i++) { await p.locator('.alt:not([disabled])').first().click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(60); await p.locator('.foot .btn.pri').click().catch(() => {}); await p.waitForTimeout(80) }
await p.waitForTimeout(400); await voltar(p).catch(() => {}); await p.waitForTimeout(400)
await apagar('P2'); await ativar('Banco do Brasil')
const stats = async () => { await irPara(p, 'Início'); return p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|')) }
out('Início depois de apagar o espaço com progresso:', await stats())
await irPara(p, 'Desempenho'); await p.waitForTimeout(400); out('Desempenho:', (await texto(p)).replace(/\n/g, ' | ').slice(0, 160))
ok('Desempenho abre', /Desempenho/.test(await texto(p)))
await irPara(p, 'Início'); const re = p.locator('.tile', { hasText: 'Rever erros' }); out('Rever erros:', (await re.innerText()).replace(/\n/g, ' '))
if (!(await re.isDisabled())) { await re.click(); await p.waitForTimeout(800); out('Rever erros abre sessão:', await p.locator('.sheet').count()); await voltar(p); await p.waitForTimeout(300) }
await chat(); for (const t of ['caderno de erros', 'painel do dia', 'o que eu já tenho?']) { await dizer(t); await p.waitForTimeout(1500); out(`"${t}" →`, (await texto(p)).replace(/\n/g, ' | ').slice(-160)); await chat() }
await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet'); ok('Treino rápido abre (sorteio com progresso fantasma)', true); await voltar(p)
ok('sem erros de script', erros.length === 0, erros.join(' | ').slice(0, 300))
console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas de ' + R.length); await fechar()
