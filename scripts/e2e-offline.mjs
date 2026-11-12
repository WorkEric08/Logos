// Offline e cache de imagens, no navegador de verdade. Precisa do app servido em http://localhost:4173/ (npm run build && npx vite preview --port 4173).
// 1) 1ª visita online; 2) vê uma questão com imagem (a imagem entra no cache em tempo de execução); 3) fica offline;
// 4) confere: Início, sorteio, resposta, progresso, simulado, questão JÁ vista (imagem abre) e questão NUNCA vista (mensagem clara).
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const erros = []; p.on('pageerror', (e) => erros.push(e.message))

// abre a questão `k` (0 = 1ª) de Estatística do Banco da Amazônia 2024, em ordem de prova
async function abrirEstatistica(k) {
  await p.goto(base); await p.waitForSelector('.folders')
  await irPara(p, 'Treinar')
  await p.locator('.chip', { hasText: /^Estatística\d+$/ }).first().click()
  await p.locator('.chip', { hasText: 'Banco da Amazônia 2024' }).first().click()
  await p.locator('.field', { has: p.locator('.lb', { hasText: 'Quantidade' }) }).locator('.chip', { hasText: 'Todas' }).click()
  await p.locator('.chip', { hasText: 'Ordem da prova' }).click(); await p.click('text=Começar'); await p.waitForSelector('.sheet')
  for (let i = 0; i < k; i++) { await p.click('.foot .pri'); await p.waitForTimeout(80) }
}
const imagemCarregada = () => p.evaluate(() => { const i = document.querySelector('.qimg'); return !!i && i.complete && i.naturalWidth > 0 })

// ---- 1. primeira visita online: o service worker instala e passa a controlar a página ----
await p.goto(base); await p.waitForSelector('.folders')
await p.evaluate(() => navigator.serviceWorker.ready)
await p.reload(); await p.waitForSelector('.folders')
await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 })
ok('service worker controla a página depois da 1ª visita', true)
await p.waitForTimeout(4000) // tempo do precache de 14 MB terminar

// ---- 2. vê uma questão com imagem online ----
await abrirEstatistica(0); await p.waitForSelector('.qimg')
await p.waitForFunction(() => { const i = document.querySelector('.qimg'); return i && i.complete && i.naturalWidth > 0 })
const visto = await p.locator('.qimg').getAttribute('src')
const questaoVista = await p.locator('.meta').innerText()
await p.waitForTimeout(500)
const noCache = await p.evaluate(async () => { const c = await caches.open('questoes-img'); const ks = await c.keys(); return ks.map((r) => new URL(r.url).pathname.split('/').pop()) })
ok('imagem vista online ficou no cache "questoes-img"', noCache.includes(visto.split('/').pop()), `${noCache.length} no cache: ${noCache.join(', ')}`)
const precache = await p.evaluate(async () => { const ns = await caches.keys(); const out = {}; for (const n of ns) out[n] = (await (await caches.open(n)).keys()).length; return out })
const pngNoPrecache = await p.evaluate(async () => { const ns = (await caches.keys()).filter((n) => n.includes('precache')); let q = 0; for (const n of ns) for (const r of await (await caches.open(n)).keys()) if (r.url.includes('/q/') && r.url.endsWith('.png')) q++; return q })
ok('as imagens de questão NÃO estão no precache (só as vistas ficam em questoes-img)', pngNoPrecache === 0, `PNG de questão no precache: ${pngNoPrecache}; caches: ${JSON.stringify(precache)}`)
const uso = await p.evaluate(async () => { const e = await navigator.storage.estimate(); return { usage: e.usage, quota: e.quota } })
console.log(`armazenamento depois da 1ª visita + 1 imagem: ${(uso.usage / 1048576).toFixed(1)} MB usados de ${(uso.quota / 1048576 / 1024).toFixed(0)} GB de cota`)

// ---- 3. offline ----
await ctx.setOffline(true)
await p.reload(); await p.waitForSelector('.folders')
ok('offline: Início abre', true)
const antes = await p.textContent('.side-in .ptitle')
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
ok('offline: sorteio abre questão', true)
await p.click('.alt >> nth=0'); await p.waitForSelector('.fb')
ok('offline: responder dá o feedback', true)
await irPara(p, 'Início')
await p.reload(); await p.waitForSelector('.folders')
const depois = await p.textContent('.side-in .ptitle')
ok('offline: o progresso foi gravado e continua depois de recarregar', antes !== depois && /^[1-9]/.test(depois), `${antes} → ${depois}`)
await abrirEstatistica(0)
await p.waitForSelector('.qimg', { timeout: 8000 }).catch(() => {})
ok('offline: questão com imagem JÁ vista abre com a imagem', (await p.locator('.meta').innerText()) === questaoVista && (await imagemCarregada()))
await p.click('.foot .pri')
await p.waitForSelector('.warnbox', { timeout: 8000 }).catch(() => {})
const msg = (await p.locator('.warnbox').first().textContent().catch(() => '')) ?? ''
ok('offline: questão com imagem NUNCA vista mostra mensagem clara (sem imagem quebrada)', /Não consegui carregar a imagem/.test(msg) && (await p.locator('.qimg').count()) === 0, msg.slice(0, 90))
const botao = await p.getByRole('button', { name: 'Tentar de novo' }).count()
ok('offline: a mensagem tem o botão "Tentar de novo"', botao === 1)
// a questão segue respondível mesmo sem imagem (as alternativas continuam na tela)
const alts = await p.locator('.alt').count()
ok('offline: as alternativas continuam clicáveis na questão sem imagem', alts === 5)
// simulado offline
await irPara(p, 'Início'); await p.locator('.acts .act', { hasText: 'Simulado' }).click(); await p.waitForSelector('.sheet')
ok('offline: simulado abre (70 questões)', (await p.locator('.qbar .cnt').textContent()) === '1/70')
await ctx.setOffline(false)
await p.waitForTimeout(500)
await p.getByRole('button', { name: 'Tentar de novo' }).count()
ok('sem erros de script no console durante o teste', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
