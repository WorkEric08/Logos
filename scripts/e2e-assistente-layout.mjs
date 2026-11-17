// Tela do assistente no celular (2026-11-16): (1) sugestões curtas em duplas, sem encostar nas bordas; (2) a câmera vai para o INÍCIO da resposta;
// (3) caixa de mensagem estilo app de mensagem: presa no pé, logo acima do teclado, campo que cresce, só ícone de enviar fixo à direita, sem emoji;
// (4) cor de destaque laranja. O teclado é simulado como o Android o entrega ao app: a variável CSS --teclado (ver services/teclado.ts).
// Precisa do app em http://localhost:4173/. Uso: node scripts/e2e-assistente-layout.mjs [url]
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { esperarMovimento, irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const b = await chromium.launch({ channel: 'chrome' })
const erros = []
const PERFIS = [{ nome: '412×880', w: 412, h: 880, kb: 414 }, { nome: '360×780', w: 360, h: 780, kb: 330 }, { nome: '320×568', w: 320, h: 568, kb: 250 }]

async function abrir(perfil) {
  const ctx = await novoContexto(b, { viewport: { width: perfil.w, height: perfil.h }, hasTouch: true, isMobile: true, colorScheme: 'dark' })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
  await p.goto(base); await p.waitForSelector('.folders')
  await irPara(p, 'Assistente'); await p.waitForSelector('.chat-tela'); await p.waitForSelector('.as-pilula'); await esperarMovimento(p)
  return { ctx, p }
}
const teclado = async (p, px) => { await p.evaluate((v) => document.documentElement.style.setProperty('--teclado', v + 'px'), px); await p.waitForTimeout(900) }
const caixa = (p) => p.evaluate(() => {
  const c = document.querySelector('.as-composer'), r = c.getBoundingClientRect(), t = c.querySelector('textarea').getBoundingClientRect(), bt = c.querySelector('button').getBoundingClientRect()
  let ant = c.previousElementSibling
  while (ant?.classList.contains('sr-only')) ant = ant.previousElementSibling
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, campo: { top: t.top, bottom: t.bottom, left: t.left, right: t.right, h: t.height }, btn: { top: bt.top, bottom: bt.bottom, left: bt.left, right: bt.right, w: bt.width, h: bt.height }, fim: ant ? ant.getBoundingClientRect().bottom : 0 }
})
const falar = async (p, t) => {
  const n = await p.locator('.as-msg.a:not(.as-digitando)').count()
  await p.fill('#as-msg', t); await p.press('#as-msg', 'Enter')
  await p.waitForFunction((x) => document.querySelectorAll('.as-msg.a:not(.as-digitando)').length > x, n, { timeout: 10000 })
  await esperarMovimento(p)
}

for (const perfil of PERFIS) {
  const { ctx, p } = await abrir(perfil)
  const W = perfil.w, H = perfil.h

  // ───── 1. sugestões em duplas ─────
  const pil = await p.evaluate(() => {
    const lista = document.querySelector('.as-sug-lista'), lr = lista.getBoundingClientRect()
    const itens = [...lista.querySelectorAll('.as-pilula')].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), meia: e.classList.contains('meia'), top: Math.round(r.top), l: r.left, r: r.right, w: r.width } })
    return { lista: { l: lr.left, r: lr.right, w: lr.width }, itens }
  })
  const meias = pil.itens.filter((i) => i.meia), inteiras = pil.itens.filter((i) => !i.meia)
  const paresOk = meias.every((m) => meias.filter((x) => x.top === m.top).length === 2) // cada curta tem exatamente uma vizinha na mesma linha
  const igual = meias.every((m) => Math.abs(m.w - meias[0].w) < 1.5)
  const inteirasOk = inteiras.every((i) => Math.abs(i.w - pil.lista.w) < 1.5)
  const dentro = pil.itens.every((i) => i.l >= pil.lista.l - 0.5 && i.r <= pil.lista.r + 0.5) && pil.lista.r <= W - 16 + 0.5
  ok(`${perfil.nome}: sugestões curtas em duplas (${meias.length} em duplas, ${inteiras.length} na linha toda), colunas iguais`, meias.length >= 2 && paresOk && igual && inteirasOk, JSON.stringify(pil.itens.map((i) => `${i.meia ? '½' : '1'} ${i.t}`)))
  ok(`${perfil.nome}: nenhuma sugestão encosta nas bordas (o recuo de 16 px da tela é respeitado)`, dentro, `lista ${Math.round(pil.lista.l)}–${Math.round(pil.lista.r)} de ${W}`)
  ok(`${perfil.nome}: as sugestões vão de uma margem à outra (16 px de cada lado), sem o recuo que havia para o ícone`, Math.abs(pil.lista.l - 16) < 1 && Math.abs(pil.lista.r - (W - 16)) < 1, `lista ${Math.round(pil.lista.l)}–${Math.round(pil.lista.r)} de ${W}`)
  const semCorte = await p.evaluate(() => [...document.querySelectorAll('.as-pilula')].every((e) => e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1))
  ok(`${perfil.nome}: o texto das sugestões não é cortado`, semCorte)

  // ───── 2. caixa de mensagem ─────
  const c0 = await caixa(p)
  ok(`${perfil.nome}: a caixa fica presa no pé da tela (teclado fechado)`, c0.bottom <= H + 0.5 && c0.bottom >= H - 14, `base ${Math.round(c0.bottom)} de ${H}`)
  const botoes = await p.locator('.as-composer button').count()
  const textoBtn = (await p.locator('.as-composer button').innerText()).trim()
  const temSvg = await p.locator('.as-composer button svg').count()
  ok(`${perfil.nome}: um só botão (enviar), só com ícone, sem emoji nem texto`, botoes === 1 && textoBtn === '' && temSvg === 1 && (await p.locator('.as-composer button').getAttribute('aria-label')) === 'Enviar')
  ok(`${perfil.nome}: o botão de enviar é redondo e fica fixo à direita; o campo ocupa o resto (comprido)`, Math.abs(c0.btn.w - c0.btn.h) < 1 && c0.btn.right >= c0.right - 0.5 && c0.campo.right <= c0.btn.left && (c0.campo.right - c0.campo.left) > W - 32 - 70, JSON.stringify({ campo: [Math.round(c0.campo.left), Math.round(c0.campo.right)], btn: [Math.round(c0.btn.left), Math.round(c0.btn.right)] }))
  ok(`${perfil.nome}: o botão está apagado enquanto não há texto e vira laranja ao escrever`, await (async () => {
    const vazio = await p.locator('.as-enviar').isDisabled()
    await p.fill('#as-msg', 'simulado'); await p.waitForTimeout(300)
    const cor = await p.locator('.as-enviar').evaluate((e) => getComputedStyle(e).backgroundColor)
    await p.fill('#as-msg', '')
    return vazio && cor === 'rgb(249, 115, 22)'
  })())

  // o campo cresce com o texto; o botão continua à direita, na base do campo, e a caixa não sai do lugar
  const longo = 'quero um simulado de matemática financeira com vinte questões das provas mais recentes do banco '.repeat(2).slice(0, 190)
  await p.fill('#as-msg', 'curto'); const umaLinha = await caixa(p)
  await p.fill('#as-msg', longo); await p.waitForTimeout(100); const cresceu = await caixa(p)
  ok(`${perfil.nome}: o campo cresce conforme se escreve (${Math.round(umaLinha.campo.h)} → ${Math.round(cresceu.campo.h)} px, máximo 144)`, cresceu.campo.h > umaLinha.campo.h + 20 && cresceu.campo.h <= 144.5)
  ok(`${perfil.nome}: ao crescer, a base da caixa e o botão de enviar (à direita) ficam onde estavam`, Math.abs(cresceu.bottom - umaLinha.bottom) < 1.5 && Math.abs(cresceu.btn.right - umaLinha.btn.right) < 1 && Math.abs(cresceu.btn.bottom - cresceu.campo.bottom) < 1.5 && Math.abs(cresceu.btn.bottom - umaLinha.btn.bottom) < 1.5)
  await p.fill('#as-msg', '')

  // ───── 3. o teclado: a caixa pousa logo acima dele, de onde a pessoa tocar ─────
  const pre = await caixa(p) // o fim da conversa estava à vista logo antes de o teclado abrir?
  await p.locator('#as-msg').evaluate((e) => e.focus({ preventScroll: true })); await teclado(p, perfil.kb)
  const k1 = await caixa(p)
  ok(`${perfil.nome}: com o teclado aberto, a caixa e o botão de enviar ficam logo acima dele (${Math.round(H - perfil.kb - k1.bottom)} px de folga)`, k1.bottom <= H - perfil.kb + 0.5 && k1.bottom >= H - perfil.kb - 16 && k1.btn.bottom <= H - perfil.kb + 0.5 && k1.btn.top >= 0, `base ${Math.round(k1.bottom)}, teclado a partir de ${H - perfil.kb}`)
  ok(`${perfil.nome}: a "câmera" não deixa a caixa cobrir o fim da conversa (se ele estava à vista)`, !(pre.fim <= H + 1) || k1.fim <= k1.top + 1, `fim ${Math.round(k1.fim)} · caixa ${Math.round(k1.top)}`)
  await p.keyboard.type('simulado'); await p.waitForTimeout(100)
  ok(`${perfil.nome}: o foco continua no campo ao tocar em enviar (o teclado não fecha)`, await (async () => {
    await p.locator('.as-enviar').click({ force: true }) // clique de verdade no botão
    await p.waitForTimeout(150)
    return (await p.evaluate(() => document.activeElement?.id)) === 'as-msg'
  })())
  await esperarMovimento(p)
  await teclado(p, 0)

  // conversa longa: quem subiu para reler não é puxado de volta ao abrir o teclado, e a caixa continua à vista
  for (const t of ['ajuda', 'quantas questões eu tenho', 'ajuda']) await falar(p, t)
  const rolou = await p.evaluate(() => { const s = document.querySelector('.scroll-y'); s.scrollTop = Math.max(0, s.scrollHeight / 3); return Math.round(s.scrollTop) })
  await p.waitForTimeout(200)
  await p.locator('#as-msg').evaluate((e) => e.focus({ preventScroll: true })); await teclado(p, perfil.kb)
  const depois = await p.evaluate(() => Math.round(document.querySelector('.scroll-y').scrollTop))
  const k2 = await caixa(p)
  ok(`${perfil.nome}: quem subiu para reler não é puxado ao abrir o teclado (rolagem ${rolou} → ${depois}); a caixa fica acima do teclado`, Math.abs(depois - rolou) <= 1 && k2.bottom <= H - perfil.kb + 0.5 && k2.bottom >= H - perfil.kb - 16)
  await teclado(p, 0)
  // no fim da conversa, ao abrir o teclado a câmera leva o fim para cima da caixa
  await p.evaluate(() => { const s = document.querySelector('.scroll-y'); s.scrollTop = s.scrollHeight })
  await p.waitForTimeout(200)
  await p.locator('#as-msg').evaluate((e) => e.focus({ preventScroll: true })); await teclado(p, perfil.kb)
  const k3 = await caixa(p)
  ok(`${perfil.nome}: no fim da conversa, com o teclado aberto, o fim fica acima da caixa`, k3.fim <= k3.top + 1 && k3.bottom <= H - perfil.kb + 0.5, `fim ${Math.round(k3.fim)} · caixa ${Math.round(k3.top)}`)
  await teclado(p, 0)
  await p.locator('#as-msg').evaluate((e) => e.blur())

  // ───── 4. a câmera vai para o início da resposta ─────
  await falar(p, 'ajuda')
  await p.waitForTimeout(250)
  const cam = await p.evaluate(() => {
    const s = document.querySelector('.scroll-y'), sr = s.getBoundingClientRect()
    const linhas = [...document.querySelectorAll('.as-chat > .as-linha:not(.as-digitando-linha)')]
    let i = linhas.length
    while (i > 0 && linhas[i - 1].classList.contains('a')) i--
    const ini = linhas[i]
    return { topo: ini ? Math.round(ini.getBoundingClientRect().top - sr.top) : null, ehA: ini?.classList.contains('a'), max: Math.round(s.scrollHeight - s.clientHeight), rolo: Math.round(s.scrollTop) }
  })
  ok(`${perfil.nome}: a resposta do assistente aparece a partir do início dela (topo a ${cam.topo} px do alto da tela)`, cam.ehA && cam.topo !== null && cam.topo >= -1 && cam.topo <= 40, JSON.stringify(cam))

  // ───── 5. cor de destaque laranja ─────
  const cores = await p.evaluate(() => {
    const v = document.querySelector('.as-msg.v'), pri = document.querySelector('.as-pilula.pri'), av = v
    return { v: v && getComputedStyle(v).backgroundColor, pri: pri && getComputedStyle(pri).backgroundColor, av: av && getComputedStyle(av).backgroundColor }
  })
  ok(`${perfil.nome}: o destaque é laranja (balão da pessoa, avatar e sugestão principal)`, cores.v === 'rgb(249, 115, 22)' && cores.av === 'rgb(249, 115, 22)' && (cores.pri === null || cores.pri === 'rgb(249, 115, 22)'), JSON.stringify(cores))
  // ───── 6. balões: sem ícone ao lado, com bico no canto de cima à esquerda, compridos; sugestões na largura toda ─────
  const bal = await p.evaluate(() => {
    const chat = document.querySelector('.as-chat').getBoundingClientRect()
    const a = document.querySelector('.as-linha.a .as-msg.a'), v = document.querySelector('.as-linha.v .as-msg.v')
    const ra = a.getBoundingClientRect(), rv = v.getBoundingClientRect()
    const bico = getComputedStyle(a, '::before'), cobre = getComputedStyle(a, '::after')
    const lista = document.querySelector('.as-sug-lista')?.getBoundingClientRect()
    return {
      semIcone: document.querySelectorAll('.as-linha.a svg, .as-avatar').length === 0,
      larguraA: ra.width / chat.width, direitaV: Math.abs(rv.right - chat.right), esquerdaA: Math.abs(ra.left - chat.left),
      bico: { w: bico.borderTopWidth, estilo: bico.borderTopStyle, esq: bico.borderLeftColor, esqW: bico.borderLeftWidth, pos: bico.position, left: bico.left, top: bico.top },
      cobre: { w: cobre.borderTopWidth, esqW: cobre.borderLeftWidth },
      cantoReto: getComputedStyle(a).borderTopLeftRadius,
      lista: lista ? { esq: Math.abs(lista.left - chat.left), dir: Math.abs(lista.right - chat.right) } : null,
    }
  })
  ok(`${perfil.nome}: a fala do assistente não tem ícone ao lado`, bal.semIcone)
  ok(`${perfil.nome}: o bico do assistente está no canto de cima à esquerda, apontando para a esquerda (e o canto do balão é reto)`, bal.bico.pos === 'absolute' && bal.bico.w === '12px' && bal.bico.estilo === 'solid' && bal.bico.esq === 'rgba(0, 0, 0, 0)' && bal.bico.top === '-1px' && parseFloat(bal.bico.left) < 0 && bal.cobre.w === '11px' && bal.cantoReto === '0px', JSON.stringify(bal.bico))
  ok(`${perfil.nome}: balões compridos (assistente ≥ 94 % da largura) e a fala da pessoa encosta na borda direita`, bal.larguraA >= 0.94 && bal.direitaV < 1 && bal.esquerdaA < 1, `assistente ${Math.round(bal.larguraA * 100)} %; pessoa a ${bal.direitaV.toFixed(1)} px da borda`)
  ok(`${perfil.nome}: as sugestões usam a largura toda, sem recuo de nenhum lado`, !bal.lista || (bal.lista.esq < 1 && bal.lista.dir < 1), JSON.stringify(bal.lista))
  await ctx.close()
}
ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
