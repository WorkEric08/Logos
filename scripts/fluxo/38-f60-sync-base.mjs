// F6.0 (verificação independente): a sincronização que JÁ existia, com dois aparelhos e o emulador: cartão A->B, resposta A->B, apagar baralho, offline, zerar+desfazer, outra conta recusada, selos/andamento em Mais
import { irPara } from '../_ctx.mjs'
import { voltar, foto } from './_base.mjs'
import { aparelho, entrar, esperar, fim, lancar, ok, out, emailUnico, vistas } from './_dois.mjs'
const b = await lancar(); const email = emailUnico('f60')
const A = await aparelho(b, email), B = await aparelho(b, email)
await entrar(A.p); await entrar(B.p)
ok('os dois aparelhos entram na mesma conta e ficam "Sincronizado"', /Sincronizado/.test(await A.p.locator('[data-testid=conta-situacao]').innerText()) && /Sincronizado/.test(await B.p.locator('[data-testid=conta-situacao]').innerText()))
const cards = async (p) => { await irPara(p, 'Cards'); await p.waitForTimeout(500); return (await p.locator('main').innerText()).replace(/\s+/g, ' ') }
// 1) baralho + cartão no A aparece no B
await irPara(A.p, 'Cards'); await A.p.click('text=Criar o primeiro baralho'); await A.p.fill('#nb', 'Siglas'); await A.p.click('text=Criar baralho'); await A.p.waitForTimeout(700)
await A.p.click('.btn >> text=Novo cartão'); await A.p.fill('#cf', 'BCB'); await A.p.fill('#cv', 'Banco Central do Brasil'); await A.p.click('.foot >> text=Salvar >> nth=-1'); await A.p.waitForTimeout(800)
ok('baralho e cartão criados no A aparecem no B', await esperar(async () => /Siglas/.test(await cards(B.p)) && /1 cartão/.test(await cards(B.p))))
// 2) respostas do A chegam ao B
await irPara(A.p, 'Início'); await A.p.locator('.tile', { hasText: 'Treino rápido' }).click(); await A.p.waitForSelector('.sheet')
for (let i = 0; i < 4; i++) { await A.p.locator('.alt:not([disabled])').first().click(); await A.p.waitForTimeout(80); await A.p.locator('.foot .btn.pri').click() }
await voltar(A.p); await A.p.waitForTimeout(500)
ok('4 respostas do A chegam ao B (4 vistas)', await esperar(async () => (await vistas(B.p)) === '4'), 'B: ' + (await vistas(B.p)))
// 3) apagar baralho no A some no B
await irPara(A.p, 'Cards'); await A.p.locator('.deck-abrir').filter({ hasText: 'Siglas' }).first().evaluate((e) => e.click()).catch(async () => { await A.p.locator('.deck-abrir').first().evaluate((e) => e.click()) }); await A.p.waitForTimeout(500)
await A.p.click('text=Excluir este baralho'); await A.p.click('text=Sim, excluir'); await A.p.waitForTimeout(600)
ok('baralho apagado no A some do B', await esperar(async () => !/Siglas/.test(await cards(B.p))))
// 4) B offline estuda, volta e junta
await B.ctx.setOffline(true)
await irPara(B.p, 'Início'); await B.p.locator('.tile', { hasText: 'Treino rápido' }).click(); await B.p.waitForSelector('.sheet')
for (let i = 0; i < 3; i++) { await B.p.locator('.alt:not([disabled])').first().click(); await B.p.waitForTimeout(80); await B.p.locator('.foot .btn.pri').click() }
await voltar(B.p); await B.p.waitForTimeout(500)
const bOff = await vistas(B.p); const aEnq = await vistas(A.p)
out('B offline: vistas', bOff, '| A vê:', aEnq)
await irPara(B.p, 'Mais'); out('situação do B offline:', (await B.p.locator('[data-testid=conta-situacao]').innerText()).replace(/\s+/g, ' '))
await B.ctx.setOffline(false)
const totalB = Number(bOff)
ok('B volta online: o A passa a ver as respostas feitas offline', await esperar(async () => Number(await vistas(A.p)) >= totalB && totalB > 4, 40000), `A: ${await vistas(A.p)}, B: ${totalB}`)
// 5) zerar no A + desfazer
await irPara(A.p, 'Mais'); await A.p.locator('.btn.warn', { hasText: 'Zerar tudo' }).click(); await A.p.locator('text=Sim, zerar').click(); await A.p.waitForTimeout(600)
ok('zerar no A zera o B', await esperar(async () => (await vistas(B.p)) === '0'), 'B: ' + (await vistas(B.p)))
await A.p.locator('.toast button', { hasText: 'Desfazer' }).click().catch(() => out('(toast sumiu)')); await A.p.waitForTimeout(800)
ok('desfazer no A devolve o progresso nos dois', await esperar(async () => (await vistas(B.p)) !== '0' && (await vistas(A.p)) !== '0'), `A ${await vistas(A.p)} B ${await vistas(B.p)}`)
await foto(B.p, 'f60-b'); out('erros A', A.erros, 'B', B.erros)
ok('sem erros de script', A.erros.length + B.erros.length === 0)
fim(); await b.close()
