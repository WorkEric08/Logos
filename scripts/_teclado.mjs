// Teclado digital: ao focar um campo NADA na tela pode se mexer, sumir ou aparecer (o teclado só cobre a tela).
// `semMudar(p, rotulo, focar)` tira uma foto da posição de tudo o que é visível (botões, títulos, campos, rolagem), executa `focar`
// (que foca o campo) e confere a cada quadro por ~700 ms que nada saiu do lugar, nenhum botão do pé ficou `display:none`
// nem piscou, e que a página não ganhou marca de teclado. Devolve [] se estiver tudo igual, ou a lista do que mudou.
// (Teclado de verdade não existe no Chrome do computador: isto prova que o APP não reage ao foco; a janela nativa não encolher
// depende do Android e está descrita no README.)

const FOTO = () => {
  const alvo = '.foot, .side.go, .fcnotas, button, .top, h1, input, textarea, summary, .alt, .nav.rail, .shell'
  const f = {}
  let n = 0
  for (const e of document.querySelectorAll(alvo)) {
    const r = e.getBoundingClientRect()
    if (!r.width && !r.height) continue
    const k = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}#${n++}`
    f[k] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), getComputedStyle(e).display === 'none' ? 'none' : '']
  }
  const rolagem = (document.querySelector('.assist .scroll-y') ?? document.querySelector('.scroll-y'))
  return { f, rolou: Math.round(rolagem?.scrollTop ?? 0), janela: Math.round(scrollY), vv: Math.round(visualViewport?.offsetTop ?? 0), alt: innerHeight, marca: document.documentElement.className }
}

export async function semMudar(p, focar) {
  await p.evaluate(`window.__foto = (${FOTO.toString()})`)
  await p.waitForTimeout(500) // deixa terminar qualquer animação em curso (a barra, a troca de tela)
  await p.evaluate(() => { window.__antes = window.__foto() })
  const olhar = p.evaluate(() => new Promise((res) => {
    const dif = new Set()
    const t0 = performance.now()
    const um = () => {
      const agora = window.__foto()
      if (agora.rolou !== window.__antes.rolou) dif.add(`a rolagem da tela mudou (${window.__antes.rolou} → ${agora.rolou})`)
      if (agora.janela !== window.__antes.janela) dif.add('a janela rolou')
      if (agora.vv !== window.__antes.vv) dif.add('a janela visual se deslocou')
      if (agora.alt !== window.__antes.alt) dif.add(`a altura da janela mudou (${window.__antes.alt} → ${agora.alt})`)
      if (/kb-/.test(agora.marca)) dif.add(`a página ganhou a marca "${agora.marca}"`)
      for (const k of Object.keys(window.__antes.f)) {
        const a = window.__antes.f[k], b = agora.f[k]
        if (!b) dif.add(`${k} sumiu`)
        else if (b[4] === 'none') dif.add(`${k} ficou display:none`)
        else if (a.slice(0, 4).join() !== b.slice(0, 4).join()) dif.add(`${k} se mexeu (${a.slice(0, 4).join(',')} → ${b.slice(0, 4).join(',')})`)
      }
      if (performance.now() - t0 < 700) requestAnimationFrame(um); else res([...dif])
    }
    um()
  }))
  await focar()
  return olhar
}

/** Vigia UM elemento a cada quadro por ~700 ms enquanto `acao` roda: devolve a menor e a maior posição de baixo, quantos quadros ele
 *  não existiu ou esteve `display:none` (o "aparece rápido e some") e quantas posições diferentes teve. */
export async function vigiar(p, seletor, acao) {
  await p.evaluate(({ sel }) => {
    window.__vig = { bottoms: new Set(), ausente: 0, quadros: 0, fim: false }
    const t0 = performance.now()
    const um = () => {
      const e = document.querySelector(sel), v = window.__vig
      v.quadros++
      if (!e || getComputedStyle(e).display === 'none' || !e.getClientRects().length) v.ausente++
      else v.bottoms.add(Math.round(e.getBoundingClientRect().bottom))
      if (performance.now() - t0 < 700) requestAnimationFrame(um); else v.fim = true
    }
    um()
  }, { sel: seletor })
  await acao()
  await p.waitForFunction(() => window.__vig.fim)
  return p.evaluate(() => ({ posicoes: [...window.__vig.bottoms], ausente: window.__vig.ausente, quadros: window.__vig.quadros }))
}

// ───────── REGRA DO TECLADO (2026-11-10) ─────────
// O teclado digital só COBRE a tela. Nenhum botão de ação pode aparecer acima dele se a camada de conteúdo dele fica por baixo; só se
// vê esse botão rolando a página ou fechando o teclado. Simulação de celular real: viewport do aparelho + a altura do teclado, que
// no app chega pela variável CSS `--teclado` (o MainActivity.java mede e injeta no APK; ver services/teclado.ts).
// Prints do celular do usuário (Samsung, 2026-11-10): tela ~412×880 dp com o teclado cobrindo ~414 dp.
export const PERFIS_TECLADO = [
  { nome: 'celular do usuário 412×880, teclado 414', w: 412, h: 880, kb: 414 },
  { nome: '360×780, teclado 330', w: 360, h: 780, kb: 330 },
  { nome: '390×844, teclado 340', w: 390, h: 844, kb: 340 },
  { nome: '320×568, teclado 250', w: 320, h: 568, kb: 250 },
]

const fotografarBotoes = () => {
  window.__botoes = new Map()
  for (const e of document.querySelectorAll('button, summary, [role=button], [role=switch], a.btn')) { // (a função é serializada para a página: nada de variável de fora)
    const r = e.getBoundingClientRect()
    if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue
    window.__botoes.set(e, { t: r.top, b: r.bottom, l: r.left, r: r.right })
  }
}
const mudaramDe = () => {
  const out = []
  for (const [e, a] of window.__botoes) {
    if (!e.isConnected) continue
    const r = e.getBoundingClientRect()
    if (Math.abs(r.top - a.t) > 1 || Math.abs(r.left - a.l) > 1 || Math.abs(r.height - (a.b - a.t)) > 1) out.push({ botao: (e.innerText || e.getAttribute('aria-label') || e.className || e.tagName).trim().slice(0, 30), antes: [Math.round(a.t), Math.round(a.b)], depois: [Math.round(r.top), Math.round(r.bottom)] })
  }
  return out
}

/** Simula o teclado aberto no campo que `focar` foca e confere a regra. Devolve { violacoes: [...], detalhes }. */
export async function regraTeclado(p, { kb, focar, h }) {
  const violacoes = []
  const rolo = () => p.evaluate(() => { const s = (document.querySelector('.assist .scroll-y') ?? document.querySelector('.scroll-y')); return { st: Math.round(s.scrollTop), max: Math.round(s.scrollHeight - s.clientHeight) } })
  await p.waitForTimeout(900) // deixa assentar as animações de entrada da tela e o recolher da barra de navegação
  await p.evaluate(`(${fotografarBotoes.toString()})()`)
  const sem = await rolo()
  await focar(); await p.waitForTimeout(250)
  await p.evaluate((px) => document.documentElement.style.setProperty('--teclado', px + 'px'), kb) // o que o Android faz ao abrir o teclado
  await p.waitForTimeout(400)
  const moveram = await p.evaluate(`(${mudaramDe.toString()})()`)
  for (const m of moveram) violacoes.push(`o botão “${m.botao}” se mexeu com o teclado aberto (${m.antes} → ${m.depois})`)
  const acima = await p.evaluate(({ kb, h }) => [...window.__botoes].filter(([e]) => e.isConnected && e.getBoundingClientRect().bottom <= h - kb + 0.5 && window.__botoes.get(e).b > h - kb + 0.5).map(([e]) => (e.innerText || e.className).trim().slice(0, 30)), { kb, h })
  for (const x of acima) violacoes.push(`o botão “${x}” foi parar acima do teclado`)
  const com = await rolo()
  if (com.st !== sem.st) violacoes.push(`a página rolou sozinha ao abrir o teclado (${sem.st} → ${com.st})`)
  // o campo em foco tem de ser alcançável rolando
  const campo = await p.evaluate(() => { const e = document.activeElement; if (!e || !e.matches('input, textarea')) return null; const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, h: r.height } })
  if (!campo) violacoes.push('o campo não ficou em foco')
  else {
    const preciso = Math.max(0, campo.b - (h - kb) + 8)
    if (preciso > com.max + 1) violacoes.push(`o campo não dá para alcançar rolando (precisa ${Math.round(preciso)} px, a página só rola ${com.max})`)
    else {
      await p.evaluate((y) => { (document.querySelector('.assist .scroll-y') ?? document.querySelector('.scroll-y')).scrollTop = y }, com.st + preciso); await p.waitForTimeout(150)
      const c2 = await p.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { t: r.top, b: r.bottom } })
      if (c2.b > h - kb + 1 || c2.t < -1) violacoes.push(`depois de rolar o campo não ficou todo acima do teclado (${Math.round(c2.t)}–${Math.round(c2.b)}, teclado a partir de ${h - kb})`)
    }
  }
  // fechou o teclado: tudo volta ao lugar
  await p.evaluate((y) => { (document.querySelector('.assist .scroll-y') ?? document.querySelector('.scroll-y')).scrollTop = y; document.documentElement.style.setProperty('--teclado', '0px') }, sem.st); await p.waitForTimeout(300) // volta à rolagem de antes
  const voltaram = await p.evaluate(`(${mudaramDe.toString()})()`)
  for (const m of voltaram) violacoes.push(`com o teclado fechado o botão “${m.botao}” não voltou ao lugar (${m.antes} → ${m.depois})`)
  return { violacoes, botoes: await p.evaluate(() => window.__botoes.size) }
}
