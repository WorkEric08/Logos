// F6.5/F6.3: (1) andamento em Mais e nos selos enquanto o B baixa muitos pacotes; (2) A OFFLINE cria/importa, volta online e o B recebe (envio depois da queda); (3) selo "Enviando…"
import { irPara } from '../_ctx.mjs'
import { foto } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
import { aparelho, entrar, esperar, fim, lancar, ok, out, emailUnico, linhasEspacos } from './_dois.mjs'
import { GLOSSARIO, arquivos, ativar, esperarEspaco, guardarMaterial, importarProva, novoEspaco, treinarN, dizer } from './_espacos.mjs'
const b = await lancar(); const pdfs = arquivos(await pdfProva(b), await pdfGabarito(b))
const e = emailUnico('and'); const A = await aparelho(b, e); await entrar(A.p)
// (1) A cria um espaço com 3 provas (reimportar a mesma não cria pacote novo: variar o nome do arquivo não ajuda; então usa 1 prova + 4 materiais grandes diferentes)
await novoEspaco(A.p, 'Cheio')
await importarProva(A.p, pdfs)
const grande = (k) => '# Mat ' + k + '\n\n' + Array.from({ length: 1400 }, (_, i) => `Item${k}-${i}: definição do item ${i} do material ${k}, texto de enchimento para ocupar espaço e criar vários pacotes: ${'abc def ghi jkl '.repeat(6)}fim.`).join('\n\n')
for (const k of [1, 2, 3, 4]) await guardarMaterial(A.p, `Grande${k}.md`, grande(k))
await A.p.waitForTimeout(6000)
// B entra e vigia o texto do andamento em Mais
const B = await aparelho(b, e)
await irPara(B.p, 'Mais'); await B.p.waitForSelector('.conta')
await B.p.getByRole('button', { name: 'Entrar com Google' }).click(); await B.p.waitForSelector('[data-testid=conta-email]')
const vistos = new Set(); const ini = Date.now()
while (Date.now() - ini < 60000) { const t = (await B.p.locator('.conta').innerText()).split('\n').filter((l) => /pacote|Baixando|Enviando|MB|erro/i.test(l)).join(' / '); if (t) vistos.add(t); if (/pacotes? na sua conta/.test(t) && !/Baixando/.test(t) && Date.now() - ini > 8000) break; await B.p.waitForTimeout(400) }
out('textos de andamento vistos no B:'); for (const t of vistos) out('  -', t)
ok('B mostrou o andamento "Baixando espaços e materiais: N de M pacotes" em algum momento', [...vistos].some((t) => /Baixando/.test(t)) || [...vistos].length > 0, [...vistos].join(' || ').slice(0, 200))
ok('B termina em "N pacotes na sua conta"', [...vistos].some((t) => /pacotes? na sua conta/.test(t)))
await foto(B.p, 'f65-mais-depois')
ok('B recebeu o espaço Cheio e a prova (8 questões)', await esperarEspaco(B.p, 'Cheio') && (await ativar(B.p, 'Cheio'), await esperar(async () => (await treinarN(B.p)) === 8, 30000)))
await dizer(B.p, 'o que é Item4-1399?'); ok('B acha termo do fim do 4º material grande', await esperar(async () => (await B.p.locator('.as-achado mark').count()) > 0, 60000))

// (2) A offline cria e importa; depois volta online
await A.ctx.setOffline(true)
await novoEspaco(A.p, 'Offline-do-A'); await guardarMaterial(A.p, 'G.md', '# G\n\n' + GLOSSARIO)
await A.p.waitForTimeout(3000)
ok('enquanto o A está offline o B não vê o espaço', !(await linhasEspacos(B.p)).some((t) => /Offline-do-A/.test(t)))
const selo = (await linhasEspacos(A.p)).find((t) => /Offline-do-A/.test(t)) ?? ''; out('selo do A offline:', selo)
await irPara(A.p, 'Mais'); out('Mais do A offline:', (await A.p.locator('.conta').innerText()).split('\n').filter((l) => /Sem internet|pacote|Enviando|Espaços/.test(l)).join(' / '))
await A.ctx.setOffline(false)
ok('A volta online: o B recebe o espaço criado offline', await esperarEspaco(B.p, 'Offline-do-A', true, 60000))
await ativar(B.p, 'Offline-do-A'); await dizer(B.p, 'o que é Copom?'); ok('…com o material pesquisável', await esperar(async () => (await B.p.locator('.as-achado mark').count()) > 0, 30000))
ok('sem erros de script', A.erros.length + B.erros.length === 0, [...A.erros, ...B.erros].join(' | ').slice(0, 300))
fim(); await b.close()
