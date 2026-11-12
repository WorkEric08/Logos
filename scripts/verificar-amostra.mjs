// Sorteia ~40 questões (todas as 11 só-imagem, 3 de página inteira, 2 de cada matéria, 2 antigas sem par) e confere NO NAVEGADOR
// que o que a tela mostra (enunciado, alternativas, texto-base, imagem, tag, gabarito no feedback) bate com src/data/bank.json.
// Uso: node scripts/verificar-amostra.mjs [url=http://localhost:4173/] [semente=1]   (precisa de vite preview e de `playwright`)
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
let semente = Number(process.argv[3] ?? 1)
const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647
const bank = JSON.parse(readFileSync('src/data/bank.json', 'utf8'))
const Q = bank.q
const CURTO = { 'Língua Portuguesa': 'Português', 'Língua Inglesa': 'Inglês', 'Matemática': 'Matemática', 'Matemática Financeira': 'Mat. Financeira', 'Atualidades do Mercado Financeiro': 'Atualidades', 'Conhecimentos Bancários': 'Bancários', 'Conhecimentos de Informática': 'Informática', 'Vendas e Negociação': 'Vendas', 'Estatística': 'Estatística', 'Ética': 'Ética', 'Legislação': 'Legislação', 'Conhecimentos Digitais': 'Digitais' }
const curtoProva = (s) => { const [a, b = ''] = bank.sources[s].split(' · '); return b.endsWith('(TI)') ? `${a} (TI)` : a }
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const soImagem = (q) => !!q.ia || !!q.rv?.includes('texto_pode_ter_perdido_formulas__usar_imagem')

const sorteia = (l, n) => { const a = l.slice(), o = []; while (o.length < n && a.length) o.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return o }
const amostra = new Map()
const add = (l) => l.forEach((q) => amostra.set(q.id, q))
add(Q.filter((q) => q.ia))
add(sorteia(Q.filter((q) => q.ig && !q.ia), 3))
for (const m of Object.keys(CURTO)) add(sorteia(Q.filter((q) => q.m === m && !q.ia && !q.ant), 2))
add(sorteia(Q.filter((q) => q.ant), 2))
const lista = [...amostra.values()]

const nav = await chromium.launch({ channel: 'chrome' })
const erros = [], linhas = []
async function abrir(pag, q) {
  await pag.goto(base); await pag.waitForSelector('.folders')
  await irPara(pag, 'Treinar')
  await pag.locator('.chip', { hasText: new RegExp(`^${esc(CURTO[q.m])}\\d+$`) }).first().click()
  await pag.locator('.chip', { hasText: new RegExp(`^${esc(curtoProva(q.s))}\\d+$`) }).first().click()
  await pag.locator('.field', { has: pag.locator('.lb', { hasText: 'Quantidade' }) }).locator('.chip', { hasText: 'Todas' }).click()
  await pag.locator('.chip', { hasText: 'Ordem da prova' }).click()
  await pag.click('text=Começar'); await pag.waitForSelector('.sheet')
  const pool = Q.filter((x) => x.m === q.m && x.s === q.s).sort((a, b) => a.y - b.y || a.n - b.n)
  const idx = pool.findIndex((x) => x.id === q.id)
  for (let i = 0; i < idx; i++) { await pag.click('.foot .pri'); await pag.waitForTimeout(60) }
}
async function confere(pag, q, largura, certa) {
  const falhas = []
  const tag = await pag.locator('.meta').innerText()
  if (!tag.includes(`questão ${q.n}`) || !tag.includes(bank.sources[q.s])) falhas.push(`tag errada: "${tag.replace(/\n/g, ' ')}"`)
  if (q.ant && !tag.includes('gabarito não conferido')) falhas.push('falta a marca "gabarito não conferido"')
  const so = soImagem(q)
  if (so) {
    if ((await pag.locator('.enun').count()) !== 0) falhas.push('enunciado deveria estar oculto (só imagem)')
    if ((await pag.locator('.alts.letras .alt').count()) !== 5) falhas.push('deveria mostrar só as 5 letras')
  } else {
    const enun = await pag.locator('.enun').textContent()
    if (enun !== q.e) falhas.push('enunciado diferente do JSON')
    const tx = await pag.locator('.alt .tx').allTextContents()
    ;['A', 'B', 'C', 'D', 'E'].forEach((l, i) => { if (tx[i] !== q.o[l]) falhas.push(`alternativa ${l} diferente`) })
    if (tx.length !== 5) falhas.push(`${tx.length} alternativas`)
  }
  if (q.b) { const t = await pag.locator('details.base .txt').textContent().catch(() => null); if (t !== bank.bases[q.b]) falhas.push('texto-base diferente') }
  const sel = largura >= 1180 ? '.side-in .qimg' : '.sheet .qimg'
  if (q.img) {
    await pag.waitForSelector(sel, { timeout: 5000 }).catch(() => {})
    const i = await pag.locator(sel).evaluate((e) => ({ ok: e.complete && e.naturalWidth > 0, src: e.getAttribute('src'), w: e.naturalWidth })).catch(() => null)
    if (!i || !i.ok) falhas.push(`imagem não carregou (${sel})`)
    else if (!i.src.endsWith(`q/${q.img}`)) falhas.push(`imagem errada: ${i.src}`)
    const fora = largura >= 1180 ? '.sheet .qimg' : '.side-in .qimg'
    if ((await pag.locator(fora).count()) !== 0) falhas.push('imagem duplicada (nos dois lugares)')
    if (q.ig && (await pag.locator('.qfig a[target=_blank]').count()) !== 1) falhas.push('página inteira sem link de ampliar')
  } else if ((await pag.locator('.qimg').count()) !== 0) falhas.push('mostra imagem em questão sem imagem')
  // responde (certa ou errada) e confere o feedback com o gabarito do JSON
  const letras = ['A', 'B', 'C', 'D', 'E']
  const alvo = certa ? q.g : letras.find((l) => l !== q.g)
  await pag.locator('.alt').nth(letras.indexOf(alvo)).click(); await pag.waitForSelector('.fb')
  const fb = await pag.locator('.fb').innerText()
  if (certa ? !fb.includes('Certo.') : !(fb.includes('Errou.') && fb.includes(`Gabarito: ${q.g}`))) falhas.push(`feedback errado: "${fb.split('\n')[0]}"`)
  const okLetra = await pag.locator('.alt.ok .bub').first().textContent()
  if (okLetra !== q.g) falhas.push(`alternativa marcada como certa é ${okLetra}, JSON diz ${q.g}`)
  if ((await pag.locator('.alt.ok .mk').count()) !== 1 || (!certa && (await pag.locator('.alt.err .mk').count()) !== 1)) falhas.push('faltam os símbolos ✓/✕')
  return falhas
}
let n = 0
for (const largura of [1440, 390]) {
  const ctx = await novoContexto(nav, { viewport: { width: largura, height: 900 }, colorScheme: 'dark', hasTouch: largura < 900, isMobile: largura < 900 })
  const pag = await ctx.newPage()
  const alvo = largura === 1440 ? lista : sorteia(lista, 12) // no celular, 12 delas
  for (const q of alvo) {
    n++
    try {
      await abrir(pag, q)
      const f = await confere(pag, q, largura, n % 2 === 0)
      linhas.push(`${f.length ? 'FALHOU' : 'OK    '} ${String(largura).padStart(4)}px ${q.id}${q.ia ? ' [só imagem]' : q.ig ? ' [página inteira]' : q.img ? ' [imagem]' : ''}${f.length ? ' — ' + f.join('; ') : ''}`)
      if (f.length) erros.push(q.id)
    } catch (e) { linhas.push(`FALHOU ${String(largura).padStart(4)}px ${q.id} — exceção: ${String(e.message).split('\n')[0]}`); erros.push(q.id) }
  }
  await ctx.close()
}
await nav.close()
console.log(linhas.join('\n'))
console.log(`\nAmostra: ${lista.length} questões a 1440 px + 12 a 390 px = ${n} conferências; ${erros.length} falha(s).`)
console.log(`Composição: ${lista.filter((q) => q.ia).length} só-imagem, ${lista.filter((q) => q.ig).length} página inteira, ${lista.filter((q) => q.img).length} com imagem, ${lista.filter((q) => !q.img).length} sem imagem, ${lista.filter((q) => q.ant).length} antigas sem par; matérias: ${[...new Set(lista.map((q) => q.m))].length}`)
process.exit(erros.length ? 1 : 0)
