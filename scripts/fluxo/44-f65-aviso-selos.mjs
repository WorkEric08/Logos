// F6.5: aviso da 1ª subida (foco, Esc, voltar, tocar fora, os dois caminhos), selos em Meus espaços, chip "Só neste aparelho", andamento em Mais
import { irPara } from '../_ctx.mjs'
import { voltar, texto, foto } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
import { aparelho, entrar, esperar, fim, lancar, ok, out, emailUnico, linhasEspacos, painelEspacos } from './_dois.mjs'
import { arquivos, avisoDeSubida, esperarEspaco, importarProva, novoEspaco, treinarN, ativar, chat } from './_espacos.mjs'
const b = await lancar(); const prova = await pdfProva(b), gab = await pdfGabarito(b), pdfs = arquivos(prova, gab)
const dlg = (p) => p.locator('.dialogo', { hasText: 'O que sobe para a sua conta' })
const abrirEspaco = async (p, nome) => { await painelEspacos(p); await p.getByRole('button', { name: new RegExp(nome) }).first().click(); await p.waitForTimeout(500) }
const seloDe = async (p, nome) => (await linhasEspacos(p)).find((t) => new RegExp(nome).test(t)) ?? ''

// ---- 1. aviso: foco e as três saídas que escolhem "Manter só aqui"
const A = { erros: [] }
for (const [i, saida] of ['esc', 'voltar', 'fora'].entries()) {
  const nome = ['via-Esc', 'via-voltar', 'via-fora'][i]
  const e = emailUnico('av' + i); const X = await aparelho(b, e); await entrar(X.p)
  await dizer0(X.p, 'meus espaços'); await X.p.getByRole('button', { name: 'Novo espaço', exact: true }).click(); await X.p.waitForSelector('#as-espaco'); await X.p.fill('#as-espaco', nome); await X.p.getByRole('button', { name: 'Criar vazio' }).click(); await X.p.waitForTimeout(2000)
  const d = dlg(X.p); ok(`aviso (${saida}): aparece depois de criar o 1º espaço`, (await d.count()) === 1)
  const foco = await X.p.evaluate(() => document.activeElement?.textContent?.trim()); ok(`aviso (${saida}): foco inicial em "Manter só aqui"`, foco === 'Manter só aqui', foco)
  if (saida === 'esc') await X.p.keyboard.press('Escape'); else if (saida === 'voltar') await voltar(X.p); else await X.p.mouse.click(8, 8)
  await X.p.waitForTimeout(800)
  ok(`aviso (${saida}): fecha e vale "Manter só aqui"`, (await d.count()) === 0)
  const s = await seloDe(X.p, nome); ok(`aviso (${saida}): selo do espaço diz "Só neste aparelho"`, /Só neste aparelho/.test(s), s)
  await X.ctx.close()
}
async function dizer0(p, t) { await chat(p); await p.fill('#as-msg', t); await p.keyboard.press('Enter'); await p.waitForTimeout(1300) }

// ---- 2. caminho "Manter só aqui": o B não recebe; chip liga/desliga; depois sobe
const e2 = emailUnico('mk'); const M = await aparelho(b, e2), N = await aparelho(b, e2); await entrar(M.p); await entrar(N.p)
const txt = await novoEspaco(M.p, 'Privado', 'manter'); out('texto do aviso:', txt)
ok('aviso: texto diz o que sobe e que não é criptografado de ponta a ponta', /Google guarda em servidores/.test(txt ?? '') && /Manter só aqui/.test(txt ?? ''))
await importarProva(M.p, pdfs); await M.p.waitForTimeout(2000)
const sel1 = await seloDe(M.p, 'Privado'); out('selo (mantido):', sel1); ok('selo "Só neste aparelho: nada dele vai para a conta"', /Só neste aparelho/.test(sel1) && /nada dele/.test(sel1), sel1)
await N.p.waitForTimeout(8000); ok('"Manter só aqui": o B NÃO recebe o espaço', !(await linhasEspacos(N.p)).some((t) => /Privado/.test(t)), (await linhasEspacos(N.p)).join(' || '))
await painelEspacos(M.p)
const chip = M.p.getByRole('button', { name: 'Só neste aparelho' }).first(); out('chips "Só neste aparelho" visíveis:', await M.p.getByRole('button', { name: 'Só neste aparelho' }).count())
ok('chip "Só neste aparelho" aparece e está LIGADO (aria-pressed)', (await chip.count()) > 0 && (await chip.getAttribute('aria-pressed')) === 'true', await chip.getAttribute('aria-pressed').catch(() => '?'))
await foto(M.p, 'f65-meus-espacos-local')
await chip.click(); await M.p.waitForTimeout(1500)
ok('desligar o chip: o espaço sobe e o B passa a receber', await esperarEspaco(N.p, 'Privado', true, 60000), (await linhasEspacos(N.p)).join(' || '))
ok('…com as 8 questões', await esperar(async () => { await ativar(N.p, 'Privado'); return (await treinarN(N.p)) === 8 }, 45000))
const selNa = await seloDe(M.p, 'Privado'); out('selo depois de subir:', selNa); ok('selo vira "Na conta · N pacotes"', /Na conta/.test(selNa), selNa)
await painelEspacos(M.p); ok('o chip "Só neste aparelho" some quando o espaço já está na conta', (await M.p.getByRole('button', { name: 'Só neste aparelho' }).count()) === 0)

// ---- 3. andamento em Mais
await irPara(N.p, 'Mais'); await N.p.waitForSelector('.conta'); out('Mais (B):', (await N.p.locator('.conta').innerText()).split('\n').join(' | ').slice(0, 500))
ok('Mais mostra "N pacotes na sua conta" depois de terminar', /pacote/.test(await N.p.locator('.conta').innerText()))
await foto(N.p, 'f65-mais-conta')
ok('sem erros de script', [...A.erros, ...M.erros, ...N.erros].length === 0, [...A.erros, ...M.erros, ...N.erros].join(' | ').slice(0, 300))
fim(); await b.close()
