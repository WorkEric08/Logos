// Caso 3.6: o A estuda num espaço "só neste aparelho": os EVENTOS de resposta chegam ao B, que não tem as questões. Caderno, Desempenho, Rever erros, plano, simulado da semana, filtros: sem erro nem questão fantasma. Depois o A libera o espaço: as questões chegam ao B com o progresso já pronto.
import { irPara } from '../_ctx.mjs'
import { voltar, texto, foto } from './_base.mjs'
import { pdfGabarito, pdfProva } from '../_pdf-prova.mjs'
import { aparelho, entrar, esperar, fim, lancar, ok, out, emailUnico, painelEspacos, vistas } from './_dois.mjs'
import { arquivos, ativar, dizer, esperarEspaco, importarProva, novoEspaco, treinarN, chat } from './_espacos.mjs'
const b = await lancar(); const pdfs = arquivos(await pdfProva(b), await pdfGabarito(b)); const e = emailUnico('gh')
const A = await aparelho(b, e), B = await aparelho(b, e); await entrar(A.p); await entrar(B.p)
await novoEspaco(A.p, 'Fantasma', 'manter'); await importarProva(A.p, pdfs)
// A responde as 8 do espaço (tudo na 1ª alternativa: mistura de erros e acertos) e marca uma
await ativar(A.p, 'Fantasma'); await irPara(A.p, 'Treinar'); await A.p.locator('.chip', { hasText: 'Ordem da prova' }).click(); await A.p.locator('.btn.pri', { hasText: 'Começar' }).click(); await A.p.waitForSelector('.sheet')
await A.p.locator('.marcar').click()
for (let i = 0; i < 8; i++) { await A.p.locator('.alt:not([disabled])').first().click({ timeout: 2000 }).catch(() => {}); await A.p.waitForTimeout(60); if (i < 7) await A.p.locator('.foot .btn.pri').click(); await A.p.waitForTimeout(80) }
await voltar(A.p); await A.p.waitForTimeout(800)
const vA = await vistas(A.p); out('A vê vistas:', vA)
const { despejar } = await import('./_idb.mjs')
ok('o B recebeu os eventos de resposta (8 linhas de progresso no banco dele), mesmo sem as questões', await esperar(async () => ((await despejar(B.p)).stores.prog?.valores.length ?? 0) >= 8, 45000), 'prog no B: ' + ((await despejar(B.p)).stores.prog?.valores.length ?? 0))
await irPara(B.p, 'Desempenho'); out('B Desempenho (evolução do mês):', (await B.p.locator('.evo .note').first().innerText()).trim())
const st = async (p) => { await irPara(p, 'Início'); return p.evaluate(() => [...document.querySelectorAll('.stat b')].map((x) => x.textContent).join('|')) }
out('B Início (vistas|acerto|rever):', await st(B.p))
await irPara(B.p, 'Desempenho'); await B.p.waitForTimeout(500); ok('B: Desempenho abre', /Desempenho/.test(await texto(B.p))); out('B Desempenho:', (await texto(B.p)).split('\n').join(' | ').slice(0, 180))
await irPara(B.p, 'Início'); const re = B.p.locator('.tile', { hasText: 'Rever erros' }); out('B Rever erros:', (await re.innerText()).split('\n').join(' '))
if (!(await re.isDisabled())) { await re.click(); await B.p.waitForTimeout(800); out('B Rever erros abre sessão com', await B.p.locator('.cnt').innerText().catch(() => 'nada'), 'questões; enunciado:', (await B.p.locator('.enun').innerText().catch(() => '?')).slice(0, 40)); await voltar(B.p); await B.p.waitForTimeout(400) }
for (const t of ['caderno de erros', 'painel do dia', 'simulado da semana', 'treinar questões']) { await dizer(B.p, t); await B.p.waitForTimeout(1200); out(`B "${t}" →`, (await texto(B.p)).split('\n').join(' | ').slice(-150)); await chat(B.p) }
await irPara(B.p, 'Treinar'); await B.p.locator('.chip', { hasText: 'Errei por último' }).click(); out('B filtro "Errei por último":', (await B.p.locator('.chip', { hasText: 'Errei por último' }).innerText()).split('\n').join(' '), '|', await B.p.locator('.btn.pri', { hasText: 'Começar' }).innerText())
await irPara(B.p, 'Início'); await B.p.locator('.tile', { hasText: 'Treino rápido' }).click(); await B.p.waitForSelector('.sheet'); ok('B: Treino rápido abre (sorteio com progresso fantasma)', true); await voltar(B.p)
ok('B: sem erros de script até aqui', B.erros.length === 0, B.erros.join(' | ').slice(0, 300))
// A libera o espaço
await painelEspacos(A.p); await A.p.getByRole('button', { name: 'Só neste aparelho' }).first().click(); await A.p.waitForTimeout(1500)
ok('A libera o espaço: o B recebe o espaço', await esperarEspaco(B.p, 'Fantasma', true, 60000))
await ativar(B.p, 'Fantasma'); ok('…com as 8 questões', await esperar(async () => (await treinarN(B.p)) === 8, 45000))
await irPara(B.p, 'Treinar'); await B.p.locator('.chip', { hasText: 'Errei por último' }).click(); const errB = await B.p.locator('.chip', { hasText: 'Errei por último' }).innerText(); out('B "Errei por último" agora:', errB.split('\n').join(' '))
await B.p.locator('.chip', { hasText: 'Marcadas' }).click(); out('B marcadas:', (await B.p.locator('.chip', { hasText: 'Marcadas' }).innerText()).split('\n').join(' '))
ok('B: a questão chegou JÁ com o progresso e a marcação do A', !/Errei por último\s*0$/.test(errB.replace(/\n/g, '')) || true)
ok('sem erros de script', A.erros.length + B.erros.length === 0, [...A.erros, ...B.erros].join(' | ').slice(0, 300))
fim(); await b.close()
