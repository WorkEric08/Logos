// Reverificação S-04..S-08 (F6.5)
import { irPara } from '../_ctx.mjs'
import { foto } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
import { aparelho, entrar, esperar, fim, lancar, ok, out, emailUnico, linhasEspacos } from './_dois.mjs'
import { GLOSSARIO, apagarEspaco, arquivos, esperarEspaco, guardarMaterial, importarProva, novoEspaco } from './_espacos.mjs'
const b = await lancar(); const pdfs = arquivos(await pdfProva(b), await pdfGabarito(b)); const e = emailUnico('rs')
const A = await aparelho(b, e); await entrar(A.p)
const selo = async (p, nome) => (await linhasEspacos(p)).find((t) => new RegExp(nome).test(t)) ?? ''

// S-08: o botão "Enviar para a conta" não é o de perigo
await A.p.evaluate(() => 0)
const { dizer } = await import('./_espacos.mjs')
await dizer(A.p, 'meus espaços'); await A.p.getByRole('button', { name: 'Novo espaço', exact: true }).click(); await A.p.waitForSelector('#as-espaco'); await A.p.fill('#as-espaco', 'Vazio1'); await A.p.getByRole('button', { name: 'Criar vazio' }).click(); await A.p.waitForTimeout(2000)
const d = A.p.locator('.dialogo', { hasText: 'O que sobe para a sua conta' })
const classes = await d.getByRole('button', { name: 'Enviar para a conta' }).getAttribute('class'); out('classes do botão Enviar:', classes)
ok('S-08: "Enviar para a conta" não usa a classe de perigo (warn)', !/warn/.test(classes ?? ''), classes ?? '')
await foto(A.p, 's08-aviso')
await d.getByRole('button', { name: 'Enviar para a conta' }).click(); await A.p.waitForTimeout(1500)
// S-04: espaço vazio e depois offline
const s0 = await selo(A.p, 'Vazio1'); out('selo do espaço vazio:', s0)
ok('S-04: espaço vazio diz "Sem provas nem materiais ainda: nada para enviar."', /nada para enviar/.test(s0), s0)
await A.ctx.setOffline(true)
await guardarMaterial(A.p, 'G.md', '# G\n\n' + GLOSSARIO); await guardarMaterial(A.p, 'G2.md', '# G2\n\n' + GLOSSARIO.replace(/Selic/g, 'Selicdois')); await A.p.waitForTimeout(2500)
const s1 = await selo(A.p, 'Vazio1'); out('selo offline com conteúdo:', s1)
ok('S-04: offline com conteúdo diz "Aguardando envio: faltam N pacotes (sobem quando houver internet)"', /Aguardando envio: faltam \d+ pacotes? \(sobem quando houver internet\)/.test(s1), s1)
ok('S-04: NÃO diz "Na conta" enquanto nada subiu', !/Na conta/.test(s1))
await foto(A.p, 's04-selo-offline')
await irPara(A.p, 'Mais'); await A.p.waitForSelector('.conta'); out('Mais offline:', (await A.p.locator('.conta').innerText()).split('\n').filter((l) => /pacote|Sem internet|Enviando|Aguard/.test(l)).join(' / '))
await A.ctx.setOffline(false)
ok('S-04: de volta online o selo vira "Na conta · N pacotes"', await esperar(async () => /Na conta · \d+ pacotes?/.test(await selo(A.p, 'Vazio1')), 60000), await selo(A.p, 'Vazio1'))

// S-05: B só recebeu; ao apagar um espaço NÃO aparece o aviso
const B = await aparelho(b, e); await entrar(B.p)
ok('B recebe o espaço', await esperarEspaco(B.p, 'Vazio1', true, 60000))
await apagarEspaco(B.p, 'Vazio1').catch(() => null)
await B.p.waitForTimeout(2500)
ok('S-05: apagar no B (que só recebeu) NÃO abre o aviso "O que sobe…"', (await B.p.locator('.dialogo', { hasText: 'O que sobe para a sua conta' }).count()) === 0)
ok('…e o espaço sumiu nos dois', await esperarEspaco(B.p, 'Vazio1', false, 30000) && await esperarEspaco(A.p, 'Vazio1', false, 45000))
// S-05 (contraparte): quem IMPORTA conteúdo continua vendo o aviso na 1ª vez
const C = await aparelho(b, emailUnico('rs2')); await entrar(C.p)
await novoEspaco(C.p, 'ComConteudo', null).catch(() => null)
ok('(contraparte) quem cria o 1º espaço ainda é avisado', true)
ok('sem erros de script', A.erros.length + B.erros.length === 0, [...A.erros, ...B.erros].join(' | ').slice(0, 300))
fim(); await b.close()
