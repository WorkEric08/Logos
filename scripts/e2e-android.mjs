// O app do APK (dist-android/, build com VITE_ANDROID=1) rodando num Chrome com a ponte do Capacitor SIMULADA.
// Prova a interface e o contrato com os plugins (arquivos, compartilhar, botão voltar, imagem em tela cheia, sem service worker);
// NÃO prova o código Java nem a WebView do aparelho. Sobe o próprio servidor (porta 4318) e o encerra no fim.
// Reconstrói o pacote (VITE_ANDROID=1 vite build) antes de testar. Uso: node scripts/e2e-android.mjs
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { chamadas, instalarPonteNativa } from './ponte-nativa-simulada.mjs'
import { irPara } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const PORTA = 4318, base = `http://localhost:${PORTA}/`
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)

// reconstrói o pacote do APK (rápido), para o teste nunca olhar uma versão velha
const build = spawnSync('npx', ['vite', 'build'], { shell: true, env: { ...process.env, VITE_ANDROID: '1' }, stdio: 'ignore' })
if (build.status !== 0) { console.error('FALHOU: VITE_ANDROID=1 vite build'); process.exit(1) }

const servidor = spawn('npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort'], { shell: true, env: { ...process.env, VITE_ANDROID: '1' }, stdio: 'ignore' })
const encerra = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* já saiu */ } }
process.on('exit', encerra)
for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 500)) }

const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
await instalarPonteNativa(ctx, {
  localStorage: { treino_skip_splash: '1' },
  plugins: { Filesystem: { writeFile: { uri: 'file:///data/cache/backup.json' } }, Share: { share: {} } },
})
// a ponte simulada não registra os ouvintes de evento (addListener é "callback"): registra aqui, para ver que o app liga o botão voltar
await ctx.addInitScript(() => {
  const c = window.Capacitor, original = c.nativeCallback
  c.nativeCallback = (plugin, method, options, cb) => { window.__chamadas.push({ plugin, method, options }); return original(plugin, method, options, cb) }
})
const p = await ctx.newPage()
p.on('pageerror', (e) => erros.push(e.message))
p.on('console', (m) => { if (m.type() === 'error' && !/plugin is not implemented/i.test(m.text())) erros.push(m.text()) })
const novasAbas = []; ctx.on('page', (n) => { if (n !== p) novasAbas.push(n.url()) })
await p.goto(base); await p.waitForSelector('.folders')

// ---- pacote do APK ----
ok('sem service worker no APK (o app já está em disco)', (await p.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0)) === 0)
const html = await (await fetch(base)).text()
ok('index.html do APK: sem manifest, sem viewport-fit=cover (a WebView recua pelas barras) e com interactive-widget=overlays-content (o teclado só cobre)', !/manifest/.test(html) && !/viewport-fit/.test(html) && /interactive-widget=overlays-content/.test(html))
ok('o app acha que está no Android (Capacitor.isNativePlatform)', await p.evaluate(() => window.Capacitor?.isNativePlatform?.() ?? true))
const ch0 = await chamadas(p)
ok('o app ouve o botão voltar do Android (App.addListener "backButton")', ch0.some((c) => c.plugin === 'App' && c.method === 'addListener' && c.options?.eventName === 'backButton'), JSON.stringify(ch0.filter((c) => c.plugin === 'App').map((c) => c.method + ':' + (c.options?.eventName ?? ''))))

// ---- exportar saiu da tela de Cards (2026-11-09): o app não grava arquivo; o contrato do plugin Filesystem/Share segue testado em src/services/native/arquivos.test.ts ----
ok('nenhum download <a download> no APK (não funciona na WebView)', novasAbas.length === 0)

// ---- imagem da questão em tela cheia (não existe "outra aba" na WebView) ----
await irPara(p, 'Treinar')
await p.locator('.chip', { hasText: /^Estatística\d+$/ }).first().click()
await p.locator('.chip', { hasText: 'Banco da Amazônia 2024' }).first().click()
await p.locator('.field', { has: p.locator('.lb', { hasText: 'Quantidade' }) }).locator('.chip', { hasText: 'Todas' }).click()
await p.locator('.chip', { hasText: 'Ordem da prova' }).click(); await p.click('text=Começar'); await p.waitForSelector('.qimg')
await p.waitForFunction(() => { const i = document.querySelector('.qimg'); return i && i.complete && i.naturalWidth > 0 })
ok('a imagem da questão vem do pacote (sem rede, sem service worker)', await p.evaluate(() => document.querySelector('.qimg').complete && document.querySelector('.qimg').naturalWidth > 0))
await p.click('.qfig a'); await p.waitForSelector('.ampliador')
ok('tocar na imagem abre a tela cheia (e NÃO abre outra aba)', (await p.locator('.ampliador img').count()) === 1 && novasAbas.length === 0)
const w0 = await p.locator('.ampliador-rolo img').evaluate((e) => e.getBoundingClientRect().width)
await p.click('[aria-label="Aumentar o zoom"]'); await p.click('[aria-label="Aumentar o zoom"]')
const w2 = await p.locator('.ampliador-rolo img').evaluate((e) => e.getBoundingClientRect().width)
ok('zoom por botões aumenta a imagem (100% → 200%) e a tela rola', Math.abs(w2 / w0 - 2) < 0.05 && (await p.locator('.ampliador-rolo').evaluate((e) => e.scrollWidth > e.clientWidth)), `${Math.round(w0)} → ${Math.round(w2)} px; ${await p.locator('.ampliador-zoom .num').innerText()}`)
await p.screenshot({ path: 'docs/verificacao-capturas/apk-ampliador-360.png' })
await p.click('.ampliador >> text=Fechar')
ok('"Fechar" volta para a questão', (await p.locator('.ampliador').count()) === 0 && (await p.locator('.sheet').isVisible()))
// a página inteira da prova também amplia em tela cheia (não abre outra aba)
await p.locator('.pg a').first().scrollIntoViewIfNeeded(); await p.locator('.pg a').first().click(); await p.waitForSelector('.ampliador')
ok('tocar na página da prova abre a tela cheia (e NÃO abre outra aba)', (await p.locator('.ampliador img').count()) === 1 && /pages\/p/.test(await p.locator('.ampliador img').getAttribute('src')) && novasAbas.length === 0)
await p.click('.ampliador >> text=Fechar')

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close(); encerra()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
