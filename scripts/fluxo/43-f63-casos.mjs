// F6.3 casos difíceis com dois aparelhos + emulador. Uso: node scripts/fluxo/43-f63-casos.mjs [c1 c2 ...]   (sem argumento roda todos)
import { irPara } from '../_ctx.mjs'
import { voltar, texto, foto } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
import { aparelho, entrar, esperar, fim, lancar, ok, out, emailUnico, linhasEspacos, painelEspacos } from './_dois.mjs'
import { GLOSSARIO, apagarEspaco, arquivos, ativar, chat, dizer, enunciados, esperarEspaco, guardarMaterial, importarProva, novoEspaco, temEspaco, treinarN } from './_espacos.mjs'
const quais = process.argv.slice(2); const roda = (c) => !quais.length || quais.includes(c)
const b = await lancar(); const prova = await pdfProva(b), gab = await pdfGabarito(b), pdfs = arquivos(prova, gab)
const par = async (p0, offlineB = false) => { const e = emailUnico(p0); const A = await aparelho(b, e), B = await aparelho(b, e); await entrar(A.p); await entrar(B.p); return { A, B } }
const erros = (A, B, n) => ok(`${n}: sem erros de script`, A.erros.length + B.erros.length === 0, [...A.erros, ...B.erros].join(' | ').slice(0, 300))
const nEmB = async (B, nome, esperado, ms = 45000) => { await ativar(B.p, nome); return esperar(async () => (await treinarN(B.p)) === esperado, ms) }

if (roda('c1')) { out('\n== c1: Desfazer a importação no A some no B; importar de novo volta ==')
  const { A, B } = await par('c1'); await novoEspaco(A.p, 'D1'); await importarProva(A.p, pdfs)
  ok('c1: B recebe as 8 questões', await esperarEspaco(B.p, 'D1') && await nEmB(B, 'D1', 8))
  await chat(A.p); await A.p.getByRole('button', { name: /Desfazer: importar a prova/ }).click(); await A.p.waitForTimeout(1500)
  ok('c1: desfazer no A tira as 8 questões do B (espaço continua, vazio)', await esperar(async () => (await treinarN(B.p)) === 0, 45000) && await temEspaco(B.p, 'D1'), 'B: ' + (await treinarN(B.p)))
  await importarProva(A.p, pdfs)
  ok('c1: importar de novo no A: as 8 voltam no B', await esperar(async () => (await treinarN(B.p)) === 8, 45000), 'B: ' + (await treinarN(B.p)))
  ok('c1: enunciados inteiros no B', (await enunciados(B.p)).every((t) => t.length > 15))
  erros(A, B, 'c1') }

if (roda('c2')) { out('\n== c2: B offline quando o A cria e importa ==')
  const { A, B } = await par('c2'); await B.ctx.setOffline(true)
  await novoEspaco(A.p, 'D2'); await importarProva(A.p, pdfs); await guardarMaterial(A.p, 'Glossario.md', '# G\n\n' + GLOSSARIO)
  await B.p.waitForTimeout(4000); ok('c2: B offline NÃO vê o espaço ainda (e nada quebra)', !(await temEspaco(B.p, 'D2')))
  await irPara(B.p, 'Treinar'); await B.p.waitForTimeout(300)
  await B.ctx.setOffline(false)
  ok('c2: B online recebe o espaço', await esperarEspaco(B.p, 'D2', true, 60000))
  ok('c2: …com as 8 questões', await nEmB(B, 'D2', 8))
  await dizer(B.p, 'o que é Copom?'); ok('c2: …e o material pesquisável', await esperar(async () => (await B.p.locator('.as-achado mark').count()) > 0, 20000))
  erros(A, B, 'c2') }

if (roda('c3')) { out('\n== c3: os dois apagam o mesmo espaço ao mesmo tempo ==')
  const { A, B } = await par('c3'); await novoEspaco(A.p, 'D3'); await importarProva(A.p, pdfs)
  ok('c3: B recebe', await esperarEspaco(B.p, 'D3'))
  await Promise.all([apagarEspaco(A.p, 'D3'), apagarEspaco(B.p, 'D3')])
  ok('c3: some nos dois', await esperarEspaco(A.p, 'D3', false, 30000) && await esperarEspaco(B.p, 'D3', false, 30000))
  await A.p.waitForTimeout(4000); ok('c3: continua sumido (não ressuscita) e o BB abre', !(await temEspaco(A.p, 'D3')) && !(await temEspaco(B.p, 'D3')) && (await treinarN(B.p)) === 1168)
  erros(A, B, 'c3') }

if (roda('c4')) { out('\n== c4: a MESMA prova importada nos dois aparelhos em espaços DIFERENTES ==')
  const { A, B } = await par('c4')
  await Promise.all([(async () => { await novoEspaco(A.p, 'X-A'); await importarProva(A.p, pdfs) })(), (async () => { await novoEspaco(B.p, 'X-B'); await importarProva(B.p, pdfs) })()])
  ok('c4: cada aparelho vê os DOIS espaços', await esperarEspaco(A.p, 'X-B', true, 60000) && await esperarEspaco(B.p, 'X-A', true, 60000), (await linhasEspacos(A.p)).join(' || '))
  ok('c4: X-A e X-B com 8 questões em cada aparelho', await nEmB(A, 'X-A', 8) && await nEmB(A, 'X-B', 8) && await nEmB(B, 'X-A', 8) && await nEmB(B, 'X-B', 8))
  await apagarEspaco(A.p, 'X-A')
  ok('c4: apagar X-A no A: some no B e o X-B continua COM as 8 questões nos dois', await esperarEspaco(B.p, 'X-A', false) && await nEmB(B, 'X-B', 8) && await nEmB(A, 'X-B', 8))
  erros(A, B, 'c4') }

if (roda('c5')) { out('\n== c5: mesma prova importada nos dois, no MESMO espaço ==')
  const { A, B } = await par('c5'); await novoEspaco(A.p, 'D5'); await importarProva(A.p, pdfs)
  ok('c5: B recebe', await esperarEspaco(B.p, 'D5') && await nEmB(B, 'D5', 8))
  await importarProva(B.p, pdfs); await B.p.waitForTimeout(3000)
  ok('c5: depois do B importar de novo: B continua com 8 (não duplica)', (await treinarN(B.p)) === 8, String(await treinarN(B.p)))
  await A.p.waitForTimeout(6000); ok('c5: …e o A também com 8', (await treinarN(A.p)) === 8, String(await treinarN(A.p)))
  erros(A, B, 'c5') }

if (roda('c6')) { out('\n== c6: o A apaga o espaço enquanto o B está no meio de um treino dele ==')
  const { A, B } = await par('c6'); await novoEspaco(A.p, 'D6'); await importarProva(A.p, pdfs)
  ok('c6: B recebe', await esperarEspaco(B.p, 'D6') && await nEmB(B, 'D6', 8))
  await irPara(B.p, 'Treinar'); await B.p.locator('.chip', { hasText: 'Ordem da prova' }).click(); await B.p.locator('.btn.pri', { hasText: 'Começar' }).click(); await B.p.waitForSelector('.sheet')
  await B.p.locator('.foot .btn.pri').click(); await B.p.waitForTimeout(400); const antes = (await B.p.locator('.enun').innerText()).trim(); const cnt = await B.p.locator('.cnt').innerText()
  await apagarEspaco(A.p, 'D6'); await B.p.waitForTimeout(9000)
  ok('c6: B NÃO é puxado: segue na mesma questão com o mesmo enunciado', (await B.p.locator('.sheet').count()) === 1 && (await B.p.locator('.enun').innerText()).trim() === antes && (await B.p.locator('.cnt').innerText()) === cnt, cnt)
  await B.p.locator('.alt:not([disabled])').first().click(); await B.p.waitForTimeout(300); ok('c6: B ainda consegue responder a questão', (await B.p.locator('.fb').count()) === 1)
  await B.p.locator('.foot .btn.pri').click(); await B.p.waitForTimeout(300); await B.p.locator('.alt:not([disabled])').first().click().catch(() => {})
  await voltar(B.p); await B.p.waitForTimeout(2500)
  ok('c6: ao sair do treino o espaço apagado some do B e o app segue (Treinar do BB)', await esperarEspaco(B.p, 'D6', false, 30000) && (await treinarN(B.p)) === 1168, String(await treinarN(B.p)))
  erros(A, B, 'c6') }

if (roda('c7')) { out('\n== c7: material GRANDE (vários pacotes) ==')
  const { A, B } = await par('c7'); await novoEspaco(A.p, 'D7')
  const par1 = (i) => `Termo${i}: definição número ${i} do glossário gigante, com texto de enchimento para ocupar espaço e forçar vários pacotes na nuvem: ${'lorem ipsum dolor sit amet consectetur '.repeat(5)}fim${i}.`
  const grande = '# Glossário gigante\n\n' + Array.from({ length: 2800 }, (_, i) => par1(i)).join('\n\n')
  out('tamanho do material (KB):', Math.round(Buffer.byteLength(grande) / 1024))
  await guardarMaterial(A.p, 'Gigante.md', grande); await A.p.waitForTimeout(4000)
  ok('c7: B recebe o espaço D7', await esperarEspaco(B.p, 'D7', true, 90000))
  await ativar(B.p, 'D7'); await dizer(B.p, 'o que é Termo2790?')
  ok('c7: B acha no material um termo do FIM do arquivo (todos os pacotes chegaram)', await esperar(async () => (await B.p.locator('.as-achado mark').count()) > 0, 90000))
  erros(A, B, 'c7') }
fim(); await b.close()
