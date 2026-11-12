// Simulado de 70: cronômetro escondido (tempo só no resultado e no histórico) e aviso “encerrar o simulado?” ao sair, no navegador de verdade.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-simulado.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
const p = await ctx.newPage()
const erros = []; p.on('pageerror', (e) => erros.push(e.message))
const aviso = p.locator('.dialogo[role=dialog]')
const iniciar = async () => { await irPara(p, 'Início'); await p.locator('.acts .act', { hasText: 'Simulado' }).click(); await p.waitForSelector('.sheet') }
const voltar = () => p.evaluate(() => history.back())
const hidden = (v) => p.evaluate((v) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => v }); document.dispatchEvent(new Event('visibilitychange')) }, v)
const entregar = async (n = 3) => {
  for (let i = 0; i < 69; i++) { if (i < n) await p.locator('.alt').first().click(); await p.click('.foot .pri') }
  await p.click('text=Entregar prova'); await p.waitForSelector('.scorecard')
}

await p.goto(base); await p.waitForSelector('.folders')

// ---- 1. o cronômetro é escondido
await iniciar()
await p.locator('.alt').first().click()
await p.waitForTimeout(1500)
const tela = await p.locator('.qbar, .foot').allInnerTexts() // (o enunciado pode ter a palavra "tempo": só a barra e o pé são conferidos)
ok('durante a prova nada mostra o tempo (cronômetro escondido)', !tela.some((t) => /\d+\s*(min|s)\b|\d{1,2}:\d{2}|cron[ôo]metro|tempo/i.test(t)) && (await p.locator('.tempo, [class*=cron]').count()) === 0)

// ---- 2. Sair pergunta; continuar volta exatamente onde estava
await p.click('.btn >> text=Sair')
ok('Sair do simulado abre o aviso “tem certeza?”', await aviso.isVisible() && /tem certeza/i.test(await aviso.innerText()) && /encerrar/i.test(await aviso.locator('h2').innerText()))
ok('o aviso já abre com foco em “Continuar o simulado” (o botão seguro)', (await p.evaluate(() => document.activeElement?.textContent)) === 'Continuar o simulado')
await p.click('text=Continuar o simulado')
ok('continuar: o aviso some e o simulado segue na questão 1 com a resposta dada', !(await aviso.count()) && (await p.locator('.qbar .cnt').textContent()) === '1/70' && (await p.locator('.alt[aria-pressed=true]').count()) === 1)

// ---- 3. voltar do celular/navegador: pergunta, e cancelar RE-ARMA o voltar
await voltar(); await p.waitForTimeout(150)
ok('voltar do aparelho abre o aviso (e não sai do simulado)', await aviso.isVisible() && (await p.locator('.qbar .cnt').count()) === 1)
await voltar(); await p.waitForTimeout(150)
ok('voltar com o aviso aberto fecha só o aviso e continua o simulado', !(await aviso.count()) && (await p.locator('.qbar .cnt').textContent()) === '1/70')
await voltar(); await p.waitForTimeout(150)
ok('voltar de novo pergunta outra vez (a camada do simulado foi re-armada)', await aviso.isVisible())
await p.keyboard.press('Escape'); await p.waitForTimeout(100)
ok('Esc fecha o aviso e continua o simulado', !(await aviso.count()) && (await p.locator('.qbar .cnt').textContent()) === '1/70')
await p.click('.btn >> text=Sair'); await p.mouse.click(20, 20); await p.waitForTimeout(100)
ok('tocar fora do aviso também continua o simulado', !(await aviso.count()) && (await p.locator('.qbar .cnt').count()) === 1)

// ---- 4. trocar de aba na barra também pergunta; encerrar não entrega nem conta
await irPara(p, 'Desempenho')
ok('tocar em outra aba da barra durante a prova também pergunta', await aviso.isVisible())
await p.getByRole('button', { name: 'Encerrar', exact: true }).click(); await p.waitForSelector('h1:has-text("Desempenho")')
ok('Encerrar: sai do simulado, vai para a aba pedida e nada entra em Simulados', !(await aviso.count()) && (await p.locator('.simlist li').count()) === 0 && (await p.locator('text=Nenhum simulado entregue ainda').count()) === 1)

// ---- 5. Sair pelo botão e confirmar volta ao Início
await iniciar(); await p.click('.btn >> text=Sair'); await p.getByRole('button', { name: 'Encerrar', exact: true }).click()
await p.waitForSelector('.folders')
ok('Sair + Encerrar volta ao Início, sem simulado aberto', (await p.locator('.sheet').count()) === 0 && (await p.locator('h1:has-text("Início")').count()) === 1)

// ---- 6. entregar: o tempo aparece no resultado e no histórico; app em segundo plano não conta
const t0 = Date.now()
await iniciar()
await hidden(true); await p.waitForTimeout(4000); await hidden(false) // 4 s com a tela bloqueada: não podem entrar no tempo
await p.waitForTimeout(1500)
await entregar()
const textoTempo = await p.locator('.scorecard .tempo').innerText()
const seg = (t) => { const m = /(?:(\d+) h )?(?:(\d+) min )?(\d+) s/.exec(t); return (+(m?.[1] ?? 0)) * 3600 + (+(m?.[2] ?? 0)) * 60 + +(m?.[3] ?? 0) }
const gasto = seg(textoTempo)
ok('resultado mostra “Tempo gasto” na nota do simulado', /^Tempo gasto: /.test(textoTempo), textoTempo)
// do relógio de parede (t0 → resultado) a pausa de 4 s tem de ficar de fora
const parede = (Date.now() - t0) / 1000
ok('o tempo parado em segundo plano (4 s) não entra na conta', gasto >= 1 && gasto <= parede - 3.5, `${gasto} s contados de ${parede.toFixed(1)} s reais`)
await p.screenshot({ path: 'docs/verificacao-capturas/simulado-resultado-tempo-1440-dark.png' })
await p.click('.cell >> nth=0'); await p.waitForSelector('.sheet')
await p.click('.btn >> text=Sair')
ok('depois de entregue, Sair (revendo uma questão) não pergunta nada', !(await aviso.count()) && (await p.locator('.folders').count()) > 0)
await irPara(p, 'Desempenho')
const linha = await p.locator('.simlist li').first().innerText()
ok('Desempenho mostra o tempo daquele simulado', /Tempo: /.test(linha) && seg(linha.replace(/[\s\S]*Tempo: /, '')) === gasto, linha.replace(/\n/g, ' '))
await p.screenshot({ path: 'docs/verificacao-capturas/simulado-historico-tempo-1440-dark.png' })

// ---- 7. o tempo sobrevive a recarregar (está gravado no histórico)
await p.reload(); await p.waitForSelector('.folders'); await irPara(p, 'Desempenho')
ok('depois de recarregar, o tempo do simulado continua no histórico', /Tempo: /.test(await p.locator('.simlist li').first().innerText()))

// ---- 8. Resultado → “Início” e “Novo simulado” não perguntam
await iniciar(); await entregar(1)
await p.click('.foot >> text=Início')
ok('no resultado, “Início” sai direto, sem aviso', !(await aviso.count()) && (await p.locator('.folders').count()) > 0)

// ---- 9. celular pequeno: o aviso cabe na tela com os dois botões à vista
await p.setViewportSize({ width: 320, height: 568 })
await p.goto(base); await p.waitForSelector('.folders'); await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet')
await p.click('.btn >> text=Sair'); await p.waitForSelector('.dialogo')
const caixa = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const d = r('.dialogo'); const bs = [...document.querySelectorAll('.dialogo .btn')].map((e) => e.getBoundingClientRect()); return { dentro: d.left >= 0 && d.right <= innerWidth && d.top >= 0 && d.bottom <= innerHeight, botoes: bs.every((x) => x.left >= 0 && x.right <= innerWidth && x.bottom <= innerHeight && x.height >= 44), lateral: document.documentElement.scrollWidth - innerWidth } })
ok('320×568: o aviso cabe, os dois botões ≥ 44 px estão visíveis e não há rolagem lateral', caixa.dentro && caixa.botoes && caixa.lateral <= 0, JSON.stringify(caixa))
await p.screenshot({ path: 'docs/verificacao-capturas/simulado-aviso-320-dark.png' })

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
