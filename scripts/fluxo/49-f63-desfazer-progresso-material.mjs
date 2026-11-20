// F6.3: (1) B responde questões do espaço, o A DESFAZ a importação: B perde as questões mas o progresso fica; o A importa de novo e elas voltam com o progresso. (2) Apagar material no A some no B (busca não acha mais); "Desfazer" no A devolve.
import { irPara } from '../_ctx.mjs'
import { voltar } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
import { aparelho, entrar, esperar, fim, lancar, ok, out, emailUnico } from './_dois.mjs'
import { GLOSSARIO, arquivos, ativar, chat, dizer, esperarEspaco, guardarMaterial, importarProva, novoEspaco, treinarN } from './_espacos.mjs'
const b = await lancar(); const pdfs = arquivos(await pdfProva(b), await pdfGabarito(b)); const e = emailUnico('dp')
const A = await aparelho(b, e), B = await aparelho(b, e); await entrar(A.p); await entrar(B.p)
await novoEspaco(A.p, 'DP'); await importarProva(A.p, pdfs)
ok('B recebe espaço e questões', await esperarEspaco(B.p, 'DP') && (await ativar(B.p, 'DP'), await esperar(async () => (await treinarN(B.p)) === 8, 45000)))
// B responde 5 questões do espaço
await irPara(B.p, 'Treinar'); await B.p.locator('.chip', { hasText: 'Ordem da prova' }).click(); await B.p.locator('.btn.pri', { hasText: 'Começar' }).click(); await B.p.waitForSelector('.sheet')
for (let i = 0; i < 5; i++) { await B.p.locator('.alt:not([disabled])').first().click(); await B.p.waitForTimeout(80); if (i < 4) await B.p.locator('.foot .btn.pri').click() }
await voltar(B.p); await B.p.waitForTimeout(1500)
// A desfaz a importação, mas o B JÁ respondeu 5 das questões: o desfazer é recusado (regra do C-9: só enquanto nenhuma foi respondida, em qualquer aparelho)
await chat(A.p); const pil = A.p.getByRole('button', { name: /Desfazer: importar a prova/ })
ok('há a pílula "Desfazer: importar a prova" no A', (await pil.count()) === 1)
await pil.click(); await A.p.waitForTimeout(2000)
const fala = (await A.p.locator('.as-linha.a').last().innerText()).split('\n').join(' ')
ok('desfazer é RECUSADO com explicação (o B já respondeu algumas)', /Não consegui desfazer/.test(fala), fala.slice(0, 160))
await B.p.waitForTimeout(4000)
ok('B continua com as 8 questões e o progresso (nada se perde)', (await treinarN(B.p)) === 8)
ok('A também continua com as 8', (await treinarN(A.p)) === 8)
// (2) material
await guardarMaterial(A.p, 'Glossario.md', '# G\n\n' + GLOSSARIO)
const marcasNaUltima = (p) => p.locator('.as-linha.a').last().locator('.as-achado mark').count()
const buscar = async (p) => { await dizer(p, 'o que é IPCA?'); await p.waitForTimeout(2500); return marcasNaUltima(p) }
ok('B acha "IPCA" no material', await esperar(async () => (await buscar(B.p)) > 0, 40000))
await dizer(A.p, 'meus materiais'); await A.p.locator('.as-mat button[aria-label^="Apagar o material"]').first().click(); await A.p.waitForSelector('.dialogo'); await A.p.locator('.dialogo .btn.warn', { hasText: 'Apagar' }).click(); await A.p.waitForTimeout(2500)
ok('apagar o material no A: a busca no B deixa de achar', await esperar(async () => (await buscar(B.p)) === 0, 45000))
await chat(A.p); const des = A.p.getByRole('button', { name: /Desfazer/ })
out('Desfazer do material no A:', await des.count())
if (await des.count()) { await des.first().click(); await A.p.waitForTimeout(2000); ok('"Desfazer" no A devolve o material: o B volta a achar', await esperar(async () => (await buscar(B.p)) > 0, 45000)) }
ok('sem erros de script', A.erros.length + B.erros.length === 0, [...A.erros, ...B.erros].join(' | ').slice(0, 300))
fim(); await b.close()
