// Fluxo REAL de atualização, no mesmo perfil e na mesma origem do Chrome:
//   versão ANTIGA (banco antigo, sem migração) -> cria progresso de verdade pela interface (treinos, simulado) -> ->
//   versão NOVA no mesmo perfil -> confere aviso, números e IndexedDB -> zerar/desfazer.
// Sobe o preview em http://localhost:4180 (primeiro dist-antigo, depois dist). Gera dist-antigo/ e .tmp-antigo/ e os apaga ao final.
// Uso: node scripts/e2e-migracao.mjs        (precisa de `npm run build` feito, do Chrome e de `playwright`)
import { execSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { irPara } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const PORTA = 4180, BASE = `http://localhost:${PORTA}/`
const novo = JSON.parse(readFileSync('src/data/bank.json', 'utf8'))
const mapa = JSON.parse(readFileSync('src/data/id-map.json', 'utf8'))
const antigo = JSON.parse(readFileSync('backup/bank.antigo-2026-11-06.json', 'utf8'))
const NOVO = Object.fromEntries(novo.q.map((q) => [q.id, q]))
const out = []
let falhas = 0
const ok = (n, c, x = '') => { if (!c) falhas++; out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`) }

// ---- 0. a versão antiga: dados antigos, sem mapa de ids ----
rmSync('.tmp-antigo', { recursive: true, force: true }); mkdirSync('.tmp-antigo')
const FONTES_ANTIGAS = { '2023': 'BB 2023 · Agente Comercial, Prova A', '2021': 'BB 2021 · Agente Comercial, Prova C', '2018': 'BB 2018 · Escriturário', '2015b': 'BB out/2015 · Escriturário', '2015a': 'BB mar/2015 · Escriturário', '2014': 'BB 2014 · Escriturário', '2012': 'BB 2012 · Escriturário', '2010': 'BB 2010 · Escriturário (Amarela)' }
writeFileSync('.tmp-antigo/bank.json', JSON.stringify({ ...antigo, sources: FONTES_ANTIGAS }))
writeFileSync('.tmp-antigo/id-map.json', JSON.stringify({ ids: {}, trocas: {} }))
execSync('npx vite build --config scripts/vite.antigo.config.mjs', { stdio: 'ignore' })

let servidor = null
async function sobe(pasta) {
  if (servidor) { servidor.kill(); await new Promise((r) => setTimeout(r, 800)); try { execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORTA} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`, { stdio: 'ignore' }) } catch { /* já parou */ } }
  servidor = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort', '--outDir', pasta], { stdio: 'ignore', shell: true })
  for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE)).ok) return } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 400)) }
  throw new Error('servidor não subiu')
}
const perfil = mkdtempSync(join(tmpdir(), 'treino-perfil-'))
const abre = async () => { // com a chave de teste que pula a abertura animada (localStorage.treino_skip_splash)
  const c = await chromium.launchPersistentContext(perfil, { channel: 'chrome', viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  await c.addInitScript(() => { try { localStorage.setItem('treino_skip_splash', '1') } catch { /* sem armazenamento */ } })
  return c
}
const lerBanco = (p) => p.evaluate(() => new Promise((res, rej) => { const rq = indexedDB.open('treino-bb'); rq.onerror = () => rej(rq.error); rq.onsuccess = () => { const g = rq.result.transaction('prog').objectStore('prog').getAll(); g.onsuccess = () => { rq.result.close(); res(g.result) } } }))
const comoMapa = (rows) => Object.fromEntries(rows.map(({ id, ...p }) => [id, p]))
const numeros = async (p) => { const t = await p.textContent('.side-in .ptitle'); const m = t.match(/^(\d+) de (\d+)/); const meta = await p.textContent('.side-in .pmeta'); return { vistas: +m[1], total: +m[2], meta: meta.trim() } }

// resposta esperada da migração, calculada à parte (mesma regra, escrita de novo aqui para não repetir o código testado)
function esperado(prog) {
  const out = {}
  for (const [id, p] of Object.entries(prog)) {
    const n = mapa.ids[id]
    if (!n) { out[id] = p; continue }
    let q = { ...p }
    const t = mapa.trocas[id]
    if (t && p.last) q = { ...p, c: Math.min(p.n, Math.max(0, p.c - (p.last === t[0] ? 1 : 0) + (p.last === t[1] ? 1 : 0))), ok: p.last === t[1] }
    out[n] = q
  }
  return out
}

// ---- 1. versão antiga: progresso de verdade pela interface ----
await sobe('dist-antigo')
let ctx = await abre(); let p = await ctx.newPage()
const erros = []; p.on('pageerror', (e) => erros.push(e.message))
await p.goto(BASE); await p.waitForSelector('.folders')
ok('versão antiga está de pé (478 questões, sem migração)', (await p.textContent('.stats')).includes('478'))
async function treinoFiltrado(mat, prova, qtdTodas = true) {
  await p.goto(BASE); await p.waitForSelector('.folders'); await irPara(p, 'Treinar')
  if (mat) await p.locator('.chip', { hasText: new RegExp(`^${mat}\\d+$`) }).first().click()
  if (prova) await p.locator('.chip', { hasText: new RegExp(`^${prova}\\d+$`) }).first().click()
  if (qtdTodas) await p.locator('.field', { has: p.locator('.lb', { hasText: 'Quantidade' }) }).locator('.chip', { hasText: 'Todas' }).click()
  await p.locator('.chip', { hasText: 'Ordem da prova' }).click(); await p.click('text=Começar'); await p.waitForSelector('.sheet')
}
const ordem = (s, m) => antigo.q.filter((q) => q.s === s && (!m || q.m === m)).sort((a, b) => a.y - b.y || a.n - b.n)
// BB 2023, Português: responde 6 com o gabarito ANTIGO (errado) e 4 com o gabarito NOVO (certo)
await treinoFiltrado('Português', 'BB 2023')
const por23 = ordem('2023', 'Língua Portuguesa')
for (let i = 0; i < por23.length; i++) {
  const o = por23[i], n = NOVO[mapa.ids[o.id]]
  const letra = i < 6 ? o.g : n.g
  await p.locator('.alt').nth('ABCDE'.indexOf(letra)).click(); await p.waitForSelector('.fb'); if (i < por23.length - 1) await p.click('.foot .pri'); else break
}
// BB 2018, Matemática: responde tudo com a primeira alternativa (mistura de certas e erradas)
await treinoFiltrado('Matemática', 'BB 2018')
const mat18 = ordem('2018', 'Matemática')
for (let i = 0; i < mat18.length; i++) { await p.locator('.alt').nth(0).click(); await p.waitForSelector('.fb'); if (i < mat18.length - 1) await p.click('.foot .pri') }
// questões antigas sem par (BB 2010, Matemática Q26–30 entre outras): responde todas as de Matemática da prova de 2010
await treinoFiltrado('Matemática', 'BB 2010')
const mat10 = ordem('2010', 'Matemática')
for (let i = 0; i < mat10.length; i++) { await p.locator('.alt').nth(i % 5).click(); await p.waitForSelector('.fb'); if (i < mat10.length - 1) await p.click('.foot .pri') }
// um treino por peso de 10 (aleatório)
await p.goto(BASE); await p.waitForSelector('.folders'); await irPara(p, 'Treinar'); await p.click('text=Começar')
for (let i = 0; i < 10; i++) { await p.locator('.alt').nth(i % 5).click(); await p.waitForSelector('.fb'); await p.click('.foot .pri') }
await p.waitForSelector('.cartao')
// um simulado de 70 (responde alternando as letras) e entrega
await p.goto(BASE); await p.waitForSelector('.folders'); await p.locator('.acts .act', { hasText: 'Simulado' }).click()
await p.waitForSelector('.sheet')
for (let i = 0; i < 69; i++) { await p.locator('.alt').nth(i % 5).click(); await p.click('.foot .pri') }
await p.locator('.alt').nth(0).click(); await p.click('text=Entregar prova'); await p.getByRole('button', { name: 'Entregar', exact: true }).click({ timeout: 2500 }).catch(() => {}); await p.waitForSelector('.score')
await p.goto(BASE); await p.waitForSelector('.folders')
const antes = comoMapa(await lerBanco(p))
const idsAntes = Object.keys(antes)
const semPar = idsAntes.filter((i) => !mapa.ids[i]), mapeadas = idsAntes.filter((i) => mapa.ids[i]), trocadas = idsAntes.filter((i) => mapa.trocas[i])
ok('versão antiga gravou progresso real com ids antigos', idsAntes.length > 40 && idsAntes.every((i) => /^\d{4}[ab]?-\d+$/.test(i)), `${idsAntes.length} questões vistas (${mapeadas.length} com par, ${semPar.length} sem par, ${trocadas.length} com gabarito corrigido)`)
const somaN = (m) => Object.values(m).reduce((a, x) => a + x.n, 0), somaC = (m) => Object.values(m).reduce((a, x) => a + x.c, 0)
const stAntes = await numeros(p)
console.log(`ANTES (versão antiga): ${stAntes.vistas} de ${stAntes.total} vistas | ${stAntes.meta} | Σn=${somaN(antes)} Σc=${somaC(antes)} erradas(ok=false)=${Object.values(antes).filter((x) => x.ok === false).length}`)
await ctx.close()

// ---- 2. a versão nova, no MESMO perfil e na MESMA origem ----
await sobe('dist')
ctx = await abre(); p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
let recargas = 0
await p.goto(BASE); await p.waitForSelector('.folders')
// o service worker antigo pode servir a versão antiga na 1ª abertura: recarrega até aparecer a nova (e conta quantas vezes)
while (!(await p.textContent('.stats').catch(() => '')).includes('1168') && recargas < 4) { await p.waitForTimeout(2500); await p.reload(); await p.waitForSelector('.folders'); recargas++ }
ok('service worker: a versão nova assume sobre a antiga instalada', (await p.textContent('.stats')).includes('1168'), `recargas manuais necessárias: ${recargas}`)
// o aviso aparece na abertura que carrega o código novo; se já passou, a cópia de segurança prova que a migração rodou
await p.waitForTimeout(800)
const aviso = await p.locator('.toast').first().textContent({ timeout: 1500 }).catch(() => '')
const copia = await p.evaluate(() => localStorage.getItem('treino_progresso_antes_do_banco_novo'))
ok('migração rodou e deixou a cópia de segurança do progresso antigo (idêntica ao que a versão antiga gravou)', !!copia && JSON.stringify(JSON.parse(copia).prog) === JSON.stringify(antes))
console.log(`aviso visto na tela: "${aviso}"`)
const depois = comoMapa(await lerBanco(p))
const esp = esperado(antes)
const idsDepois = Object.keys(depois)
ok('IndexedDB depois: nenhum id antigo mapeado sobrou e todos os ids existem no banco novo', idsDepois.every((i) => NOVO[i]) && !mapeadas.some((i) => depois[i]), `${idsDepois.length} registros`)
ok('nenhum registro perdido nem duplicado (mesma quantidade de questões vistas)', idsDepois.length === idsAntes.length)
ok('registro a registro igual ao esperado pela regra (ok/c reavaliados só onde o gabarito mudou)', JSON.stringify(Object.keys(esp).sort()) === JSON.stringify(idsDepois.sort()) && Object.entries(esp).every(([i, v]) => JSON.stringify(v) === JSON.stringify(depois[i])))
ok('as questões sem par mantêm o id e o registro', semPar.length > 0 && semPar.every((i) => JSON.stringify(depois[i]) === JSON.stringify(antes[i])), `${semPar.length} sem par`)
ok('total de tentativas (Σn) idêntico antes e depois', somaN(depois) === somaN(antes), `${somaN(antes)} → ${somaN(depois)}`)
// Sincronização (2026-11-12): o banco antigo (esquema v2, com progresso real) sobe para a v3 e o que já existia vira UM evento-base, já com os ids novos
const sync = await p.evaluate(() => new Promise((res, rej) => { const rq = indexedDB.open('treino-bb'); rq.onerror = () => rej(rq.error); rq.onsuccess = () => { const db = rq.result, tx = db.transaction(['eventos', 'meta']); const g = tx.objectStore('eventos').getAll(); g.onsuccess = () => { const m = tx.objectStore('meta').get('sync:conferencia'); m.onsuccess = () => { db.close(); res({ eventos: g.result, conf: m.result ? JSON.parse(m.result.value) : null, versao: db.version }) } } } }))
ok('sincronização: o banco antigo (v2) subiu para a v3 e ganhou a tabela de eventos', sync.versao >= 30, `versão ${sync.versao}`)
ok('sincronização: o progresso de antes virou UM evento-base, com os ids novos e igual ao da tela', sync.eventos.length === 1 && sync.eventos[0].k === 'b' && JSON.stringify(Object.fromEntries(Object.entries(sync.eventos[0].prog).sort())) === JSON.stringify(Object.fromEntries(Object.entries(depois).sort())), `${sync.eventos.length} evento(s), ${Object.keys(sync.eventos[0]?.prog ?? {}).length} questões na base`)
// (nesta rodada a "versão antiga" é feita do código atual com o banco antigo, então seus eventos nasceram com ids antigos: a abertura os refaz como base)
ok('sincronização: conferência ok na atualização real (derivado dos eventos = progresso migrado)', sync.conf?.ok === true && sync.conf?.diferencas?.length === 0, JSON.stringify(sync.conf))
const mudouC = somaC(depois) - somaC(antes)
const mudancaEsperada = trocadas.reduce((a, i) => a + (esp[mapa.ids[i]].c - antes[i].c), 0)
ok('Σ acertos muda só pelas questões com gabarito corrigido', mudouC === mudancaEsperada, `Σc ${somaC(antes)} → ${somaC(depois)} (variação ${mudouC}, esperada ${mudancaEsperada})`)
await p.waitForSelector('.side-in .ptitle')
const stDepois = await numeros(p)
console.log(`DEPOIS (versão nova):  ${stDepois.vistas} de ${stDepois.total} vistas | ${stDepois.meta} | Σn=${somaN(depois)} Σc=${somaC(depois)} erradas(ok=false)=${Object.values(depois).filter((x) => x.ok === false).length}`)
ok('a tela mostra o mesmo número de questões vistas', stDepois.vistas === stAntes.vistas && stDepois.total === 1168, `${stAntes.vistas} → ${stDepois.vistas}`)
const errAntes = Object.values(antes).filter((x) => x.ok === false).length, errDepois = Object.values(depois).filter((x) => x.ok === false).length
console.log(`erradas (ok=false): ${errAntes} → ${errDepois} (diferença só onde o gabarito foi corrigido)`)

// (o backup/restauração por arquivo e por texto saiu da tela Mais; ida e volta e ids antigos seguem cobertos por store/app.test.ts)
const igual = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())

// ---- 4. zerar + desfazer ----
await irPara(p, 'Mais'); await p.getByRole('button', { name: 'Zerar tudo' }).click(); await p.getByRole('button', { name: 'Sim, zerar' }).click()
await p.locator('.toast').getByRole('button', { name: 'Desfazer' }).click(); await p.waitForTimeout(500)
ok('zerar + Desfazer (dentro de 8 s) devolve tudo', igual(comoMapa(await lerBanco(p)), depois))
await p.getByRole('button', { name: 'Zerar tudo' }).click(); await p.getByRole('button', { name: 'Sim, zerar' }).click()
await p.waitForSelector('.toast'); const t0 = Date.now()
await p.waitForSelector('.toast', { state: 'detached', timeout: 12000 }); const dur = (Date.now() - t0) / 1000
ok('o aviso de Desfazer some sozinho em ~8 s', dur > 7 && dur < 9.5, `${dur.toFixed(1)} s`)
ok('depois de expirar, o progresso continua zerado (sem Desfazer)', Object.keys(comoMapa(await lerBanco(p))).length === 0)
ok('sem erros de script em todo o fluxo', erros.length === 0, erros.join(' | '))
await ctx.close()
servidor.kill()
try { execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORTA} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`, { stdio: 'ignore' }) } catch { /* já parou */ }
rmSync('.tmp-antigo', { recursive: true, force: true }); rmSync('dist-antigo', { recursive: true, force: true }); rmSync(perfil, { recursive: true, force: true })
console.log(out.join('\n')); console.log(`\n${out.length} verificações, ${falhas} falha(s).`)
process.exit(falhas ? 1 : 0)
