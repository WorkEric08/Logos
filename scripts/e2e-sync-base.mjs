// Registro de eventos de sincronização, no navegador de verdade (2026-11-12, Fase 0 parte B): o que fica gravado no IndexedDB (tabela `eventos`) a cada ação.
//  - 1ª abertura de um aparelho que já tinha progresso: UM evento-base, o id do aparelho e a conferência "ok" (derivado dos eventos = o que a tela guarda);
//  - abrir de novo não cria outra base; cada resposta, simulado entregue e "Zerar" viram um evento; "Desfazer" apaga só o evento de zerar;
//  - depois de cada passo e de recarregar, a conferência continua "ok" (o progresso derivado dos eventos é igual ao da tela).
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-sync-base.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { esperarMovimento, irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message))

const banco = () => p.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open('treino-bb'); r.onerror = () => rej(r.error)
  r.onsuccess = () => {
    const db = r.result, tx = db.transaction(['prog', 'meta', 'eventos'], 'readonly')
    const todos = (t) => new Promise((ok2) => { const g = tx.objectStore(t).getAll(); g.onsuccess = () => ok2(g.result) })
    Promise.all([todos('prog'), todos('meta'), todos('eventos')]).then(([prog, meta, eventos]) => { db.close(); res({ prog, meta: Object.fromEntries(meta.map((m) => [m.key, m.value])), eventos, versao: db.version }) })
  }
}))
const somaN = (d) => d.prog.reduce((a, r) => a + r.n, 0)
const conferencia = (d) => JSON.parse(d.meta['sync:conferencia'] ?? 'null')
const tipos = (d) => d.eventos.reduce((a, e) => ({ ...a, [e.k]: (a[e.k] ?? 0) + 1 }), {})
const espera = () => p.waitForTimeout(400) // as gravações do app são assíncronas
const recarrega = async () => { await p.goto(base); await p.waitForSelector('.provas'); await esperarMovimento(p); await espera() }

await p.goto(base); await p.waitForSelector('.provas'); await espera()
let d = await banco()
ok('banco na versão 3 (com a tabela de eventos) e sem eventos num aparelho novo', d.versao >= 30 || d.versao === 3, `versão ${d.versao}`)
ok('aparelho novo (sem progresso): nenhum evento e conferência ok', d.eventos.length === 0 && conferencia(d)?.ok === true && !conferencia(d)?.curou, JSON.stringify(conferencia(d)))
const dev = d.meta.dev
ok('o aparelho tem um id guardado (d + 12 hexadecimais)', /^d[0-9a-f]{12}$/.test(dev ?? ''), dev)

// ---- progresso de ANTES (como o de quem já usa o app): entra como UM evento-base na próxima abertura ----
await p.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open('treino-bb'); r.onerror = () => rej(r.error)
  r.onsuccess = () => {
    const db = r.result, tx = db.transaction(['prog', 'meta'], 'readwrite'), t = new Date(2026, 10, 1, 12).getTime()
    tx.objectStore('prog').put({ id: 'bb2023-01', n: 3, c: 2, ok: true, last: 'C', t }); tx.objectStore('prog').put({ id: 'bb2023-02', n: 1, c: 0, ok: false, last: 'A', t: t + 1000 })
    tx.objectStore('meta').put({ key: 'hist', value: JSON.stringify({ dias: { '2026-11-01': { n: 4, c: 2 } }, sims: [{ t: t + 5000, p: 61.5, b: 20, e: 41.5, c: 44, n: 70, ok: true }] }) })
    tx.oncomplete = () => { db.close(); res() }
  }
}))
await recarrega()
d = await banco()
ok('1ª abertura com progresso de antes: UM evento-base deste aparelho', d.eventos.length === 1 && d.eventos[0].k === 'b' && d.eventos[0].id === `b:${dev}`, JSON.stringify(tipos(d)))
ok('o evento-base guarda o progresso e o histórico de antes', Object.keys(d.eventos[0].prog ?? {}).length === 2 && d.eventos[0].dias?.['2026-11-01']?.n === 4 && d.eventos[0].sims?.length === 1)
ok('conferência ok: derivado dos eventos = progresso guardado', conferencia(d)?.ok === true && !conferencia(d)?.curou && conferencia(d)?.diferencas?.length === 0, JSON.stringify(conferencia(d)))
const n0 = somaN(d)
await recarrega(); d = await banco()
ok('abrir de novo não cria outra base nem muda o id do aparelho', d.eventos.length === 1 && d.meta.dev === dev && somaN(d) === n0)

// ---- responder no treino: um evento por resposta ----
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
for (let i = 0; i < 3; i++) { await p.locator('.alt').first().click(); await p.waitForSelector('.fb'); await p.click('.foot .pri'); await p.waitForTimeout(80) }
await espera(); d = await banco()
ok('3 respostas no treino = 3 eventos de resposta deste aparelho, e o progresso soma 3', tipos(d).r === 3 && d.eventos.filter((e) => e.k === 'r').every((e) => e.dev === dev && /^r:/.test(e.id)) && somaN(d) === n0 + 3, `${JSON.stringify(tipos(d))}, Σn ${n0} → ${somaN(d)}`)
await recarrega(); d = await banco()
ok('depois de recarregar a conferência continua ok (eventos e progresso batem)', conferencia(d)?.ok === true && !conferencia(d)?.curou && tipos(d).r === 3 && tipos(d).b === 1, JSON.stringify(conferencia(d)))
const n1 = somaN(d)

// ---- simulado entregue: 1 evento de simulado + 1 por resposta ----
await irPara(p, 'Início'); await p.locator('.acts .act', { hasText: 'Simulado' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 69; i++) { if (i < 2) await p.locator('.alt').first().click(); await p.click('.foot .pri') }
await p.click('text=Entregar prova'); await p.getByRole('button', { name: 'Entregar', exact: true }).click({ timeout: 2500 }).catch(() => {}); await p.waitForSelector('.scorecard'); await espera(); d = await banco()
ok('simulado entregue = 1 evento de simulado e 2 de resposta (as respondidas)', tipos(d).s === 1 && tipos(d).r === 5 && somaN(d) === n1 + 2, `${JSON.stringify(tipos(d))}`)
await recarrega(); d = await banco()
ok('conferência ok depois do simulado', conferencia(d)?.ok === true && !conferencia(d)?.curou, JSON.stringify(conferencia(d)))
const n2 = somaN(d), eventosAntesZerar = d.eventos.length

// ---- zerar e desfazer ----
await irPara(p, 'Mais'); await p.click('text=Zerar tudo'); await p.click('text=Sim, zerar'); await espera(); d = await banco()
ok('Zerar: a tela fica sem progresso e histórico, e vira UM evento de zerar (nenhum evento antigo é apagado)', d.prog.length === 0 && tipos(d).z === 1 && d.eventos.length === eventosAntesZerar + 1 && JSON.parse(d.meta.hist).sims.length === 0, JSON.stringify(tipos(d)))
await p.locator('.toast').getByRole('button', { name: 'Desfazer' }).click(); await espera(); d = await banco()
ok('Desfazer: o evento de zerar FICA e o evento "desfeito" o anula (F6.3a: uma exclusão não chegaria a quem lê só o que é novo); o progresso e o histórico voltam IGUAIS', tipos(d).z === 1 && tipos(d).d === 1 && somaN(d) === n2 && d.eventos.length === eventosAntesZerar + 2 && JSON.parse(d.meta.hist).sims.length === 2, `Σn ${n2} → ${somaN(d)}, ${JSON.stringify(tipos(d))}`)
await recarrega(); d = await banco()
ok('depois de desfazer e recarregar: conferência ok', conferencia(d)?.ok === true && !conferencia(d)?.curou && somaN(d) === n2, JSON.stringify(conferencia(d)))

await irPara(p, 'Mais'); await p.click('text=Zerar tudo'); await p.click('text=Sim, zerar'); await espera()
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet'); await p.locator('.alt').first().click(); await p.waitForSelector('.fb'); await espera()
d = await banco()
ok('zerar e responder 1: a tela tem só essa questão (n=1) e os eventos antigos continuam guardados', d.prog.length === 1 && d.prog[0].n === 1 && tipos(d).z === 2 && tipos(d).d === 1 && tipos(d).r === 6 && tipos(d).b === 1, JSON.stringify(tipos(d)))
await recarrega(); d = await banco()
ok('depois de recarregar, a conferência continua ok (o derivado respeita o zerar)', conferencia(d)?.ok === true && !conferencia(d)?.curou && d.prog.length === 1, JSON.stringify(conferencia(d)))
ok('Desempenho mostra 1 questão vista', await (async () => { await irPara(p, 'Desempenho'); await p.waitForSelector('.bars'); return /1 de \d+ questões vistas|1\s*de/.test(await p.locator('body').innerText()) })())

ok('sem erros de página', erros.length === 0, erros.join(' | '))
await b.close()
console.log(out.join('\n'))
if (out.some((l) => l.startsWith('FALHOU'))) process.exit(1)
