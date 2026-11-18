// "Câmera" das telas (2026-11-17): quando algo se abre ou cresce por um toque, a tela rola o mínimo para mostrá-lo INTEIRO (antes ficava como estava e o conteúdo novo
// saía cortado embaixo). Casos: Excluir baralho (Sim, excluir), Zerar tudo (Mais), Anotação da questão (aberta com o pé fixo por cima), quadro "Certo/Errou" ao responder.
// E a outra metade da regra: o que JÁ cabe não rola, e abrir a tela não rola sozinho. Sobe o próprio servidor (porta 4321) e o encerra no fim. Uso: node scripts/e2e-camera.mjs
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { esperarMovimento, irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const PORTA = 4321, base = `http://localhost:${PORTA}/`
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)

const build = spawnSync('npx', ['vite', 'build'], { shell: true, stdio: 'ignore' })
if (build.status !== 0) { console.error('FALHOU: vite build'); process.exit(1) }
const servidor = spawn('npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort'], { shell: true, stdio: 'ignore' })
const encerra = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* já saiu */ } }
process.on('exit', encerra)
for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 500)) }

const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const ctx = await novoContexto(b, { viewport: { width: 360, height: 520 }, colorScheme: 'dark' })
const p = await ctx.newPage()
p.on('pageerror', (e) => erros.push(e.message))
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
await p.goto(base); await p.waitForSelector('.folders')

/** Espera a tela assentar: animações acabadas e a rolagem parada por 3 quadros seguidos (a câmera é suave). */
const assentar = (pg) => pg.evaluate(async () => {
  const area = [...document.querySelectorAll('.scroll-y')].find((a) => a.offsetParent !== null) ?? document.scrollingElement
  let igual = 0, antes = -1
  for (let i = 0; i < 90 && igual < 4; i++) { await new Promise((r) => setTimeout(r, 50)); igual = area.scrollTop === antes && document.getAnimations().length === 0 ? igual + 1 : 0; antes = area.scrollTop }
})
/** O elemento está inteiro na faixa visível (acima do pé fixo, se houver)? Devolve as medidas. */
const visivel = (pg, seletor) => pg.evaluate((sel) => {
  const el = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null)
  if (!el) return { achou: false }
  const r = el.getBoundingClientRect()
  let limite = innerHeight
  for (const f of document.querySelectorAll('.foot.sticky, .side.go')) { const fr = f.getBoundingClientRect(); if (fr.height > 0 && fr.top < limite) limite = fr.top }
  const area = el.closest('.scroll-y')
  return { achou: true, topo: Math.round(r.top), base: Math.round(r.bottom), limite: Math.round(limite), inteiro: r.top >= 0 && r.bottom <= limite + 0.5, rolou: area ? Math.round(area.scrollTop) : 0 }
}, seletor)
const textoDe = (m) => JSON.stringify(m)
/** Rola a tela até o fim do elemento encostar na base da janela (como a pessoa que desceu até o botão). */
const descerAte = (pg, seletor) => pg.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null); el.scrollIntoView({ block: 'end' }) }, seletor)

// ───── 1. Excluir baralho (Cards) ─────
await irPara(p, 'Cards'); await p.waitForSelector('.fcnovo, .sec.first'); await esperarMovimento(p)
await p.getByRole('button', { name: 'Novo baralho' }).first().click()
await p.fill('#nb', 'Baralho da câmera'); await p.getByRole('button', { name: 'Criar baralho' }).click()
await p.getByRole('button', { name: 'Excluir este baralho' }).waitFor(); await esperarMovimento(p)
await descerAte(p, '.card .btn.warn'); await assentar(p)
const antes1 = await visivel(p, '.card .btn.warn')
await p.getByRole('button', { name: 'Excluir este baralho' }).click(); await p.waitForSelector('text=Sim, excluir'); await assentar(p)
const m1 = await visivel(p, '.fc-entra')
ok('Excluir baralho: a pergunta "Sim, excluir / Cancelar" aparece INTEIRA (a tela desceu sozinha)', m1.achou && m1.inteiro && m1.rolou > antes1.rolou, `antes ${textoDe(antes1)}; depois ${textoDe(m1)}`)
await p.getByRole('button', { name: 'Cancelar' }).click(); await assentar(p)

// ───── 2. Zerar tudo (Mais) ─────
await irPara(p, 'Mais'); await p.waitForSelector('.mgrid'); await esperarMovimento(p)
await descerAte(p, '.card .btn.warn'); await assentar(p)
const antes2 = await visivel(p, '.card .btn.warn')
await p.getByRole('button', { name: 'Zerar tudo' }).click(); await p.waitForSelector('text=Sim, zerar'); await assentar(p)
const m2 = await visivel(p, '[role=alert]')
const botoes = await p.evaluate(() => { const r = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Sim, zerar')?.getBoundingClientRect(); return r ? { base: Math.round(r.bottom), janela: innerHeight } : null })
ok('Mais › Zerar tudo: o aviso e o botão "Sim, zerar" aparecem inteiros', m2.achou && m2.inteiro && !!botoes && botoes.base <= botoes.janela, `${textoDe(m2)} ${textoDe(botoes)}`)
await p.getByRole('button', { name: 'Cancelar' }).last().click(); await assentar(p)

// ───── 3. A tela já cabe: não rola sozinha ─────
{
  const alta = await novoContexto(b, { viewport: { width: 412, height: 1400 }, colorScheme: 'dark' })
  const q = await alta.newPage(); await q.goto(base); await q.waitForSelector('.folders'); await irPara(q, 'Mais'); await q.waitForSelector('.mgrid'); await esperarMovimento(q)
  await q.evaluate(() => { document.querySelector('button.warn').scrollIntoView({ block: 'center' }) }); await assentar(q) // (o clique do Playwright também rola até o botão: por isso a posição é fixada ANTES)
  const antes3 = await visivel(q, 'button.warn')
  await q.getByRole('button', { name: 'Zerar tudo' }).click(); await q.waitForSelector('text=Sim, zerar'); await assentar(q)
  const m3 = await visivel(q, '[role=alert]'); ok('numa tela alta, onde tudo já cabe, a câmera não rola', m3.rolou === antes3.rolou, `antes ${antes3.rolou}; ${textoDe(m3)}`)
  await alta.close()
}

// ───── 4. Questão: resultado e anotação ─────
await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet'); await esperarMovimento(p)
const topo4 = await visivel(p, '.alts')
await p.locator('.alt').first().click(); await p.waitForSelector('.fb'); await assentar(p)
const m4 = await visivel(p, '.fb')
ok('Questão: ao responder, o quadro "Certo/Errou" aparece inteiro, acima do pé fixo', m4.achou && m4.inteiro, `${textoDe(m4)} (alternativas antes: ${textoDe(topo4)})`)
await p.locator('details.nota summary').click(); await assentar(p)
const m5 = await visivel(p, 'details.nota textarea')
ok('Questão: ao abrir a Anotação, o campo aparece inteiro, acima de "Anterior / Próxima"', m5.achou && m5.inteiro, textoDe(m5))
const foco = await p.evaluate(() => document.activeElement?.tagName)
ok('abrir a Anotação não põe foco no campo (nada de teclado sozinho)', foco !== 'TEXTAREA', String(foco))
// fechar e abrir de novo com a tela rolada para cima: continua mostrando
await p.evaluate(() => { document.querySelector('details.nota textarea').closest('.scroll-y').scrollTo(0, 0) }); await assentar(p)
await p.locator('details.nota summary').click(); await assentar(p); await p.locator('details.nota summary').click(); await assentar(p)
const m6 = await visivel(p, 'details.nota textarea')
ok('fechar e abrir a Anotação de novo, com a tela no topo: o campo volta a aparecer inteiro', m6.achou && m6.inteiro, textoDe(m6))
// fechar a anotação não pode mover a tela para longe
await p.locator('details.nota summary').click(); await assentar(p)
const m7 = await visivel(p, 'details.nota summary')
ok('ao fechar a Anotação, o título dela continua à vista', m7.achou && m7.inteiro, textoDe(m7))

// ───── 5. sem vazio rolável no fim quando o valor de --teclado fica velho ─────
{
  const altura = () => p.evaluate(() => document.querySelector('details.nota textarea').closest('.scroll-y').scrollHeight)
  await p.evaluate(() => { document.activeElement?.blur(); document.querySelector('details.nota').open = true }); await assentar(p) // (anotação aberta antes de medir: abrir muda a altura)
  const sem = await altura()
  await p.evaluate(() => document.documentElement.style.setProperty('--teclado', '400px')) // o Android "esqueceu" de avisar que o teclado fechou
  const velho = await altura()
  ok('--teclado velho, sem campo em foco: a tela NÃO ganha vazio rolável no fim', velho === sem, `sem ${sem}; com valor velho ${velho}`)
  await p.locator('details.nota textarea').focus()
  const com = await altura()
  ok('com um campo de texto em foco, o espaçador do teclado volta (400 px): dá para rolar o campo para cima do teclado', com - sem >= 399 && com - sem <= 401, `diferença ${com - sem}`)
  await p.evaluate(() => { document.activeElement?.blur(); document.documentElement.style.removeProperty('--teclado') })
}

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
