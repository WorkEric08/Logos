// F6.3a: leitura incremental. Aparelho "dormindo" (página fechada, cache do Firestore apagado) volta e (1) lê só uma janela, (2) mesmo assim recebe tudo o que mudou enquanto dormia (cartão novo, baralho apagado, respostas, zerar+desfazer por evento "d"); zerar/desfazer com um aparelho offline; "Sincronizar tudo de novo"
import { irPara } from '../_ctx.mjs'
import { voltar, foto } from './_base.mjs'
import { aparelho, entrar, esperar, fim, lancar, ok, out, emailUnico, vistas } from './_dois.mjs'
const b = await lancar(); const e = emailUnico('inc')
const A = await aparelho(b, e), C = await aparelho(b, e); await entrar(A.p); await entrar(C.p)
const lidos = (p) => p.evaluate(() => ({ ...(globalThis.__logosLeituras ?? {}) }))
const cards = async (p) => { await irPara(p, 'Cards'); await p.waitForTimeout(500); return (await p.locator('main').innerText()).split('\n').join(' ') }
const treino = async (p, n) => { await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet'); for (let i = 0; i < n; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(70); await p.locator('.foot .btn.pri').click() } await voltar(p); await p.waitForTimeout(400) }
const baralho = async (p, nome, qtd) => { await irPara(p, 'Cards'); await p.getByRole('button', { name: /Novo baralho|Criar o primeiro baralho/ }).first().click(); await p.fill('#nb', nome); await p.click('text=Criar baralho'); await p.waitForTimeout(700); for (let i = 0; i < qtd; i++) { await p.click('.btn >> text=Novo cartão').catch(() => {}); await p.fill('#cf', `${nome}-P${i}`); await p.fill('#cv', `R${i}`); await p.click('text=Salvar e criar outro'); await p.waitForTimeout(250) } await voltar(p); await p.waitForTimeout(300); await voltar(p); await p.waitForTimeout(300) }
await baralho(A.p, 'Base', 3); await treino(A.p, 6)
ok('C recebe o que o A fez (6 vistas, baralho Base)', await esperar(async () => (await vistas(C.p)) === '6' && /Base/.test(await cards(C.p)), 45000))
out('leituras do C na 1ª vez:', JSON.stringify(await lidos(C.p)))
// C "dorme": fecha a página e apaga o cache do Firestore (o caso dos 30+ min)
await C.p.close()
// durante o sono o A: cria cartão em baralho novo, apaga o baralho Base, responde mais 4, zera e desfaz
await baralho(A.p, 'Novo', 2)
await irPara(A.p, 'Cards'); await A.p.locator('.deck-abrir', { hasText: 'Base' }).first().evaluate((x) => x.click()).catch(() => {}); await A.p.waitForTimeout(500); await A.p.click('text=Excluir este baralho'); await A.p.click('text=Sim, excluir'); await A.p.waitForTimeout(800)
await treino(A.p, 3)
const vA0 = await vistas(A.p)
await irPara(A.p, 'Mais'); await A.p.locator('.btn.warn', { hasText: 'Zerar tudo' }).click(); await A.p.locator('text=Sim, zerar').click(); await A.p.waitForTimeout(800)
await A.p.locator('.toast button', { hasText: 'Desfazer' }).click(); await A.p.waitForTimeout(1500)
out('A depois de zerar+desfazer: vistas', await vistas(A.p), '(antes', vA0 + ')')
const C2p = await C.ctx.newPage(); C2p.setDefaultTimeout(20000); const errosC = []; C2p.on('pageerror', (x) => errosC.push(x.message))
await C2p.goto('http://localhost:5391/'); await C2p.waitForSelector('h1'); await C2p.evaluate(async () => { for (const d of await indexedDB.databases()) if (d.name?.startsWith('firestore/')) indexedDB.deleteDatabase(d.name) })
await C2p.reload(); await C2p.waitForSelector('h1'); await C2p.waitForTimeout(12000)
const l2 = await lidos(C2p); out('leituras do C ao acordar (cache vazio):', JSON.stringify(l2))
ok('C acordado lê só uma janela (poucos documentos), não a conta toda', (l2.itens ?? 0) > 0 && (l2.itens ?? 0) < 60, JSON.stringify(l2))
ok('C acordado vê o baralho novo e NÃO vê mais o Base (apagado enquanto dormia)', await esperar(async () => { const c = await cards(C2p); return /Novo/.test(c) && !/Base/.test(c) }, 40000), (await cards(C2p)).slice(0, 160))
ok('C acordado vê o progresso depois de zerar+DESFAZER no A (evento "d")', await esperar(async () => (await vistas(C2p)) === await vistas(A.p) && Number(await vistas(C2p)) >= 6, 40000), `C ${await vistas(C2p)} · A ${await vistas(A.p)}`)

// zerar com C offline; A desfaz; C volta
await C2p.context().setOffline(true)
await irPara(A.p, 'Mais'); await A.p.locator('.btn.warn', { hasText: 'Zerar tudo' }).click(); await A.p.locator('text=Sim, zerar').click(); await A.p.waitForTimeout(800)
await A.p.locator('.toast button', { hasText: 'Desfazer' }).click(); await A.p.waitForTimeout(1500)
const vFinal = await vistas(A.p)
await C2p.context().setOffline(false)
ok('C estava offline durante zerar+desfazer: ao voltar tem o mesmo progresso do A', await esperar(async () => (await vistas(C2p)) === vFinal && Number(vFinal) > 0, 45000), `C ${await vistas(C2p)} · A ${vFinal}`)
// zerar SEM desfazer: C (online) zera também
await irPara(A.p, 'Mais'); await A.p.locator('.btn.warn', { hasText: 'Zerar tudo' }).click(); await A.p.locator('text=Sim, zerar').click(); await A.p.waitForTimeout(800)
ok('zerar no A zera o C (eventos novos)', await esperar(async () => (await vistas(C2p)) === '0', 40000), 'C ' + await vistas(C2p))
// Sincronizar tudo de novo
await irPara(C2p, 'Mais'); await C2p.getByRole('button', { name: /Sincronizar tudo de novo|Tentar de novo/ }).click(); await C2p.waitForTimeout(4000)
out('situação depois de "Sincronizar tudo de novo":', (await C2p.locator('[data-testid=conta-situacao]').innerText()).split('\n').join(' '))
ok('"Sincronizar tudo de novo" não apaga nada (C continua com baralho Novo e progresso zerado igual ao A)', /Novo/.test(await cards(C2p)) && (await vistas(C2p)) === '0')
ok('sem erros de script', A.erros.length + errosC.length === 0, [...A.erros, ...errosC].join(' | ').slice(0, 300))
fim(); await b.close()
