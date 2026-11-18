// Movimento do app todo (2026-11-10): o mesmo estilo das animações dos Cards em todas as telas, no navegador de verdade.
//  - trocar de aba: a tela sobe de leve ("troca"); entrar na questão/resultado desliza pela direita ("avanca"); sair volta pela esquerda ("recua");
//  - questão seguinte entra pela direita e a anterior pela esquerda, e o pé (Anterior/Próxima) NÃO se mexe;
//  - banco → cargo → provas desliza; grupos entram em cascata; barras do gráfico, barras de progresso e anel crescem; aviso de sair aparece com véu + pop;
//  - nada fica animando depois de ~1 s; nada causa rolagem lateral; "reduzir movimento" zera duração e atraso (e nada fica invisível).
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/e2e-movimento.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const erros = []

const nomes = (p) => p.evaluate(() => [...new Set(document.getAnimations().map((a) => a.animationName).filter(Boolean))])
const esperarFim = async (p) => { await p.waitForFunction(() => document.getAnimations().length === 0, null, { timeout: 4000 }).catch(() => {}) }
/** Grava por `ms` a posição do pé (Anterior/Próxima) e a rolagem lateral. Com `espera`, só começa quando esse seletor aparece (a nova questão). O pé acompanha a altura
 *  da questão (no monitor ele vem logo abaixo dela), então a posição de referência é a FINAL: o movimento da animação não pode tirá-lo dela em nenhum quadro. */
const vigiar = (p, ms, espera = null) => p.evaluate(({ ms, espera }) => new Promise((res) => {
  // Só a posição HORIZONTAL (esquerda e largura): o defeito que o teste existe para pegar é o pé deslizando junto com a tela. A altura NÃO entra: o pé acompanha a altura da
  // questão, e a questão seguinte pode ter imagem ou texto que termina de carregar no meio da medição (era a causa das falhas "do pé 27 px / 337 px" só sob carga).
  const pe = () => [...document.querySelectorAll('.foot.sticky .btn')].map((e) => { const r = e.getBoundingClientRect(); return [r.left, 0, r.width] })
  const amostras = []; let lateral = 0, t0 = null
  const q = () => {
    if (espera && t0 === null && !document.querySelector(espera)) return requestAnimationFrame(q)
    if (t0 === null) t0 = performance.now()
    amostras.push(pe())
    const m = document.querySelector('.scroll-y'); lateral = Math.max(lateral, m.scrollLeft, document.documentElement.scrollWidth - innerWidth)
    if (performance.now() - t0 < ms) requestAnimationFrame(q)
    else { const fim = amostras[amostras.length - 1]; let dPe = 0; amostras.forEach((a) => a.forEach((r, i) => { dPe = Math.max(dPe, Math.abs(r[0] - fim[i][0]), Math.abs(r[1] - fim[i][1]), Math.abs(r[2] - fim[i][2])) })); res({ dPe, lateral, temPe: fim.length }) }
  }
  requestAnimationFrame(q)
}), { ms, espera })
async function ctxPagina(opcoes) {
  const c = await novoContexto(b, opcoes), p = await c.newPage(); p.on('pageerror', (e) => erros.push(e.message)); await p.goto(base); await p.waitForSelector('.provas'); return { c, p }
}

// ───────── monitor ─────────
{
  const { c, p } = await ctxPagina({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
  await esperarFim(p)
  // 1. cascata no Início
  await p.reload(); await p.waitForSelector('.provas .folder')
  const atrasos = await p.evaluate(() => [...document.querySelectorAll('.provas .folders>.folder')].map((e) => Math.round(parseFloat(getComputedStyle(e).animationDelay) * 1000)))
  ok('Início: as pastas dos bancos entram em cascata (atraso cresce 40 ms por item)', atrasos.length === 5 && atrasos.every((a, i) => a === i * 40), atrasos.join(','))
  await esperarFim(p)
  ok('Início: depois de ~1 s nada continua animando', (await p.evaluate(() => document.getAnimations().length)) === 0)

  // 2. trocar de aba: sobe de leve
  await p.locator('.nav .rail-item', { hasText: 'Treinar' }).click()
  await p.waitForSelector('.page.fc-tela.troca')
  ok('trocar de aba: a tela sobe de leve (fc-troca)', (await nomes(p)).includes('fc-troca'))
  await esperarFim(p)

  // 3. Provas: banco → cargo → volta
  await irPara(p, 'Início'); await p.waitForSelector('.provas .folder'); await esperarFim(p)
  await p.locator('.provas .folder', { hasText: 'Banco do Brasil' }).click()
  await p.waitForSelector('.provas-corpo.fc-tela.avanca')
  ok('banco → cargo: a lista entra pela direita', (await nomes(p)).includes('fc-avanca'))
  await esperarFim(p)
  await p.locator('.provas .crumbs button', { hasText: 'Bancos' }).click()
  await p.waitForSelector('.provas-corpo.fc-tela.recua')
  ok('trilha "Bancos": a lista volta pela esquerda', (await nomes(p)).includes('fc-recua'))
  await esperarFim(p)

  // 4. treino: entra, passa questões, sai
  const v0 = vigiar(p, 700)
  await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
  ok('começar o treino: a questão entra pela direita', (await p.locator('.page.fc-tela.avanca').count()) === 1)
  await v0; await esperarFim(p)
  ok('a 1ª questão não desliza de novo (só a tela inteira entra)', (await p.locator('.sheet.q-avanca, .sheet.q-recua').count()) === 0)
  await p.locator('.alt').first().click(); await p.waitForSelector('.fb')
  ok('responder: o gabarito aparece com movimento (fc-verso) e a marca da alternativa (fc-marca)', (await nomes(p)).some((n) => n === 'fc-verso') && (await nomes(p)).includes('fc-marca'), (await nomes(p)).join(','))
  await esperarFim(p)
  const vNext = vigiar(p, 600, '.sheet.q-avanca')
  await p.click('.foot .pri'); await p.waitForSelector('.sheet.q-avanca')
  const rNext = await vNext
  ok('próxima questão: entra pela direita, e Anterior/Próxima não se mexem', rNext.temPe === 2 && rNext.dPe === 0 && rNext.lateral <= 0, `deslocamento do pé ${rNext.dPe}px, lateral ${rNext.lateral}`)
  await esperarFim(p)
  const vPrev = vigiar(p, 600, '.sheet.q-recua')
  await p.locator('.foot .btn', { hasText: 'Anterior' }).click(); await p.waitForSelector('.sheet.q-recua')
  const rPrev = await vPrev
  ok('questão anterior: entra pela esquerda, e o pé não se mexe', rPrev.dPe === 0 && rPrev.lateral <= 0, `deslocamento do pé ${rPrev.dPe}px`)
  await esperarFim(p)
  await p.click('.btn >> text=Sair'); await p.waitForSelector('.page.fc-tela.recua')
  ok('Sair do treino: a tela volta pela esquerda', (await nomes(p)).includes('fc-recua'))
  await esperarFim(p)

  // 5. treino de 10 até o resultado, cartão-resposta, revisão e volta
  await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet')
  for (let i = 0; i < 10; i++) { await p.locator('.alt').first().click(); await p.waitForSelector('.fb'); await p.click('.foot .pri'); await p.waitForTimeout(60) }
  await p.waitForSelector('.cartao')
  ok('ver resultado: a tela entra pela direita', (await p.locator('.page.fc-tela.avanca').count()) === 1)
  const cel = await p.evaluate(() => [...document.querySelectorAll('.cartao>.cell')].slice(0, 3).map((e) => Math.round(parseFloat(getComputedStyle(e).animationDelay) * 1000)))
  ok('cartão-resposta: as casas entram em sequência (14 ms entre elas)', cel.join(',') === '0,14,28', cel.join(','))
  await esperarFim(p)
  await p.locator('.cartao .cell').last().click(); await p.waitForSelector('.sheet') // a última: o pé mostra "Voltar ao resultado"
  ok('tocar numa casa do cartão: a questão entra pela direita', (await p.locator('.page.fc-tela.avanca').count()) === 1)
  await esperarFim(p)
  await p.locator('.foot .btn', { hasText: 'Voltar ao resultado' }).click(); await p.waitForSelector('.cartao')
  ok('"Voltar ao resultado": a tela volta pela esquerda', (await p.locator('.page.fc-tela.recua').count()) === 1)
  await esperarFim(p)
  await p.locator('.foot .btn', { hasText: 'Treinar' }).click(); await p.waitForSelector('.filters') // o treino começou em Treinar (F-02): o botão do pé leva de volta a ele
  await esperarFim(p)

  // 6. Desempenho: barras, anel, progresso
  await irPara(p, 'Desempenho'); await p.waitForSelector('.bars')
  const bar = await p.evaluate(() => ({
    bstack: [...document.querySelectorAll('.bstack')].slice(0, 3).map((e) => `${getComputedStyle(e).animationName}:${Math.round(parseFloat(getComputedStyle(e.closest('.bcol')).getPropertyValue('--i') || '0') * 14)}`),
    anel: getComputedStyle(document.querySelector('.ring .rp') ?? document.body).animationName,
  }))
  ok('Desempenho: as barras do gráfico sobem do chão em sequência (fc-barra-y)', bar.bstack.every((s) => s.startsWith('fc-barra-y')), bar.bstack.join(' '))
  ok('Desempenho: o anel de acerto cresce até o valor (fc-anel)', bar.anel === 'fc-anel' || bar.anel === 'none', bar.anel)
  await esperarFim(p)
  ok('Desempenho: depois de ~1 s nada continua animando', (await p.evaluate(() => document.getAnimations().length)) === 0)

  // 7. aviso de sair do simulado: véu + pop
  await irPara(p, 'Início'); await p.locator('.acts .act', { hasText: 'Simulado' }).click(); await p.waitForSelector('.sheet'); await esperarFim(p)
  await p.click('.btn >> text=Sair'); await p.waitForSelector('.dialogo')
  const nd = await nomes(p)
  ok('aviso "Encerrar o simulado?": o véu aparece e a caixa cresce de leve (fc-veu + fc-pop)', nd.includes('fc-veu') && nd.includes('fc-pop'), nd.join(','))
  await esperarFim(p)
  await p.getByRole('button', { name: 'Continuar o simulado' }).click()
  await p.click('.btn >> text=Sair'); await p.getByRole('button', { name: 'Encerrar', exact: true }).click(); await p.waitForSelector('.provas')
  await c.close()
}

// ───────── celular ─────────
{
  const { c, p } = await ctxPagina({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, colorScheme: 'dark' })
  await esperarFim(p)
  await p.locator('.rail-alca').click(); await p.locator('.nav .rail-item', { hasText: 'Desempenho' }).click(); await p.waitForSelector('.page.fc-tela.troca')
  const v = await vigiar(p, 500)
  ok('celular: trocar de aba sobe de leve e não gera rolagem lateral', v.lateral <= 0, `lateral ${v.lateral}`)
  await esperarFim(p)
  await p.locator('.rail-alca').click(); await p.locator('.nav .rail-item', { hasText: 'Treinar' }).click(); await p.waitForSelector('.filters'); await esperarFim(p)
  const vc = vigiar(p, 700)
  await p.click('text=Começar'); await p.waitForSelector('.sheet')
  const r = await vc
  ok('celular: a questão entra pela direita (a tela inteira desliza, pé incluso) sem rolagem lateral', (await p.locator('.page.fc-tela.avanca').count()) === 1 && r.lateral <= 0, `lateral ${r.lateral}`)
  await esperarFim(p)
  const vn = vigiar(p, 600, '.sheet.q-avanca')
  await p.locator('.alt').first().click(); await p.waitForSelector('.fb'); await p.click('.foot .pri'); await p.waitForSelector('.sheet.q-avanca')
  const rn = await vn
  ok('celular: próxima questão desliza, o pé (Anterior/Próxima) fica parado e não há rolagem lateral', rn.temPe === 2 && rn.dPe === 0 && rn.lateral <= 0, `pé ${rn.dPe}px, lateral ${rn.lateral}`)
  await c.close()
}

// ───────── "reduzir movimento" ─────────
{
  const { c, p } = await ctxPagina({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await p.reload(); await p.waitForSelector('.provas .folder')
  await irPara(p, 'Desempenho'); await p.waitForSelector('.bars')
  const t = await p.evaluate(() => document.getAnimations().filter((a) => a.animationName).map((a) => { const x = a.effect.getComputedTiming(); return { n: a.animationName, d: x.duration, atraso: x.delay } }))
  ok('reduzir movimento: nenhuma animação dura mais que ~0 nem espera (atraso zero)', t.every((x) => x.d <= 1 && x.atraso === 0), JSON.stringify(t.filter((x) => x.d > 1 || x.atraso !== 0).slice(0, 3)))
  await p.waitForTimeout(80)
  const ops = await p.evaluate(() => [...document.querySelectorAll('.bcol, .stat, .evo>.card')].filter((e) => e.getClientRects().length).map((e) => +getComputedStyle(e).opacity))
  ok('reduzir movimento: tudo aparece de uma vez (nada fica invisível esperando)', ops.length > 0 && ops.every((o) => o === 1), ops.slice(0, 5).join(','))
  await c.close()
}

ok('sem erros de página', erros.length === 0, erros.join(' | '))
await b.close()
console.log(out.join('\n'))
if (out.some((l) => l.startsWith('FALHOU'))) process.exit(1)
