// F6.2: banco v7 realista (scripts/fluxo/dados/banco-v7.json, gerado por 31-gerar-banco-v7.mjs) -> abrir o app novo (Dexie v8): NADA some, o app abre e o estudo funciona.
// Uso: node scripts/fluxo/32-migracao-v8.mjs [url]   (o app da url precisa estar rodando; sem login, sem nuvem)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { novoContexto, irPara, esperarMovimento } from '../_ctx.mjs'
import { despejar, restaurar } from './_idb.mjs'
import { onde, voltar, texto, BASE } from './_base.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? BASE
const out = (...a) => console.log(...a)
const R = []; const ok = (n, c, x = '') => { const l = `${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`; R.push(l); console.log(l) }
const v7 = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'fluxo', 'dados', 'banco-v7.json'), 'utf8'))
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce' })
const p = await ctx.newPage(); p.setDefaultTimeout(20000)
const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR|status of 404/.test(m.text())) erros.push('console: ' + m.text()) })

// 1) banco antigo no lugar (numa página da origem que NÃO inicia o app)
await p.goto(base + 'icon-192.png'); await restaurar(p, v7)
out('banco v7 restaurado: versão', v7.versao, '| linhas:', JSON.stringify(Object.fromEntries(Object.entries(v7.stores).map(([n, s]) => [n, s.valores.length]))))
// 2) abre o app novo
await p.goto(base); await p.waitForSelector('h1', { timeout: 30000 }); await esperarMovimento(p)
ok('o app abre depois da migração', true, await onde(p))
await p.waitForTimeout(1500)
const novo = await despejar(p)
out('banco depois: versão', novo.versao, '| lojas:', Object.keys(novo.stores).join(','))
ok('a versão do banco subiu (v8) sem trocar o nome', novo.versao > v7.versao, `${v7.versao} -> ${novo.versao}`)

// 3) nada some: cada linha antiga existe (mesma chave, mesmo conteúdo, ignorando campos acrescentados)
const igual = (a, b2) => { if (a && typeof a === 'object' && !Array.isArray(a)) return Object.keys(a).every((k) => k === 'pk' || igual(a[k], b2?.[k])); if (Array.isArray(a)) return Array.isArray(b2) && a.length === b2.length && a.every((x, i) => igual(x, b2[i])); return a === b2 }
const chaveDe = (s, v) => Array.isArray(s.keyPath) ? s.keyPath.map((k) => v[k]).join('|') : v[s.keyPath]
const MUDAM = new Set(['meta', 'sinc', 'conversa']) // meta/sinc ganham chaves; conversa recebe falas novas
for (const [n, s] of Object.entries(v7.stores)) {
  const depois = novo.stores[n], extra = Object.entries(novo.stores).filter(([m]) => m !== n && m.toLowerCase().startsWith(n.toLowerCase()))
  const acha = (v) => {
    const k = chaveDe(s, v)
    for (const st of [depois, ...extra.map((e) => e[1])].filter(Boolean)) { const l = st.valores.find((x) => chaveDe(st, x) === k || (n === 'questoes' && x.id === v.id && x.e === v.e)); if (l) return l }
    return null
  }
  const faltam = s.valores.filter((v) => !acha(v))
  const diferem = s.valores.filter((v) => { const l = acha(v); return l && !igual(v, l) })
  ok(`loja ${n}: ${s.valores.length} linhas, todas presentes`, faltam.length === 0, faltam.length ? `${faltam.length} faltam, ex.: ${JSON.stringify(chaveDe(s, faltam[0]))}` : '')
  if (!MUDAM.has(n)) ok(`loja ${n}: conteúdo igual`, diferem.length === 0, diferem.length ? `${diferem.length} diferem, ex.: ${JSON.stringify(diferem[0]).slice(0, 160)}` : '')
}
// imagens (Blob) com o mesmo tamanho
for (const v of v7.stores.imagens?.valores ?? []) { const l = novo.stores.imagens?.valores.find((x) => x.id === v.id) ?? Object.entries(novo.stores).filter(([m]) => /^imagens/i.test(m)).flatMap(([, s]) => s.valores).find((x) => x.id === v.id); ok('imagem recortada preservada byte a byte', !!l && JSON.stringify(l.blob ?? l.b ?? l) === JSON.stringify(v.blob ?? v.b ?? v)) }

// 4) o app funciona de verdade com os dados migrados
const painelEspacos = async () => { await irPara(p, 'Assistente'); await p.waitForTimeout(1200); for (let i = 0; i < 3; i++) { const b1 = p.getByRole('button', { name: 'Meus espaços de estudo', exact: true }); if (await b1.count()) { await b1.click(); break } const mais = p.getByRole('button', { name: /Mais sugestões/ }); if (await mais.count()) await mais.click(); else { await p.getByRole('button', { name: /^(Voltar|Cancelar)$/ }).first().click().catch(() => {}) } await p.waitForTimeout(800) } await p.waitForSelector('.as-esp li'); await p.waitForTimeout(1500) }
const stats = () => p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|'))
await irPara(p, 'Início'); out('Início (espaço ativo):', await stats())
await irPara(p, 'Cards'); await p.waitForTimeout(400); out('Cards:', (await texto(p)).split('\n').slice(0, 2).join(' '), '| baralhos:', await p.locator('.deck').allInnerTexts().then((a) => a.map((t) => t.split('\n')[0]).join(',')))
const prog0 = v7.stores.prog.valores.length
ok('Cards tem os 2 baralhos e 3 cartões do v7', /3 cartões em 2 baralhos/.test(await texto(p)))
await painelEspacos()
await p.waitForTimeout(1500)
const esp = await p.locator('.as-esp').allInnerTexts().catch(() => [])
out('Meus espaços:', esp.map((t) => t.replace(/\n/g, ' ')).join(' || '))
ok('os 2 espaços criados (+ BB) aparecem', /Concurso X/.test(await texto(p)) && /Meu BB/.test(await texto(p)))
for (const nome of ['Concurso X', 'Meu BB']) {
  await p.getByRole('button', { name: new RegExp(nome) }).first().click(); await p.waitForTimeout(1500)
  await irPara(p, 'Treinar'); const sub = (await texto(p)).split('\n').slice(0, 2).join(' '); out(`espaço ${nome}: Treinar =`, sub)
  const btn = p.locator('.btn.pri', { hasText: 'Começar' })
  if (!(await btn.isDisabled())) { await btn.click(); await p.waitForSelector('.sheet'); await p.locator('.alt:not([disabled])').first().click(); ok(`espaço ${nome}: treino abre e responde`, (await p.locator('.fb').count()) === 1); await voltar(p); await p.waitForTimeout(300) } else ok(`espaço ${nome}: tem questões`, false, sub)
  await painelEspacos()
}
// material: pergunta ao assistente (busca)
await painelEspacos(); await p.getByRole('button', { name: /Concurso X/ }).first().click(); await p.waitForTimeout(1800)
if (!(await p.locator('#as-msg').count())) { await p.getByRole('button', { name: /Mais sugestões|Voltar/ }).first().click().catch(() => {}); await p.waitForTimeout(800) }
await p.fill('#as-msg', 'o que é Copom?'); await p.keyboard.press('Enter'); await p.waitForTimeout(3500)
ok('busca no material migrado acha "Copom"', (await p.locator('.as-achado mark').count()) > 0)
// simulado no Meu BB e Desempenho
await painelEspacos()
await p.getByRole('button', { name: /Meu BB/ }).first().click().catch(() => {}); await p.waitForTimeout(1500)
await irPara(p, 'Desempenho'); out('Desempenho simulados (Meu BB):', await p.locator('.simlist li').count())
ok('o simulado entregue no v7 continua em Desempenho', (await p.locator('.simlist li').count()) >= 1)
await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Simulado' }).first().click(); await p.waitForSelector('.sheet'); ok('simulado novo abre no espaço migrado', true); await voltar(p); await p.getByRole('button', { name: 'Encerrar', exact: true }).click().catch(() => {}); await p.waitForTimeout(500)
ok('sem erros de script', erros.length === 0, erros.join(' | ').slice(0, 300))
// reabrir de novo (2ª abertura do banco já migrado) e conferir contagens iguais
await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p)
const novo2 = await despejar(p)
for (const n of Object.keys(v7.stores)) if (!MUDAM.has(n)) ok(`2ª abertura: loja ${n} com pelo menos as ${v7.stores[n].valores.length} linhas`, (novo2.stores[n]?.valores.length ?? 0) >= v7.stores[n].valores.length, `${novo2.stores[n]?.valores.length}`)
writeFileSync(join(process.cwd(), 'scripts', 'fluxo', 'dados', 'banco-depois.json'), JSON.stringify(novo2))
console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas de ' + R.length); await b.close()
