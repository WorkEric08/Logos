// Lembrete diário por notificação (2026-11-16), no Chrome com a ponte do Capacitor SIMULADA (scripts/ponte-nativa-simulada.mjs).
// Prova a tela ("Mais" › Lembrete diário) e o CONTRATO com o plugin de notificações locais (o que o app manda agendar); NÃO prova o Android de verdade
// (a notificação chegando, o diálogo de permissão, o alarme com o app fechado). Sobe o próprio servidor (porta 4319) e o encerra no fim.
// O relógio é fixado (segunda-feira, 16/11/2026, 10:00) para as contas de "hoje"/"amanhã" não dependerem de quando o teste roda. Uso: node scripts/e2e-lembrete.mjs
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { chamadas, definirResposta, instalarPonteNativa } from './ponte-nativa-simulada.mjs'
import { esperarMovimento, irPara } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const PORTA = 4319, base = `http://localhost:${PORTA}/`
const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const AGORA = new Date(2026, 10, 16, 10, 0, 0)

const build = spawnSync('npx', ['vite', 'build'], { shell: true, env: { ...process.env, VITE_ANDROID: '1' }, stdio: 'ignore' })
if (build.status !== 0) { console.error('FALHOU: VITE_ANDROID=1 vite build'); process.exit(1) }
const servidor = spawn('npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort'], { shell: true, env: { ...process.env, VITE_ANDROID: '1' }, stdio: 'ignore' })
const encerra = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* já saiu */ } }
process.on('exit', encerra)
for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 500)) }

const b = await chromium.launch({ channel: 'chrome' })
const erros = []

/** Um celular com a ponte simulada. `permissao`: o que o Android responde a "checkPermissions" no começo. */
async function celular({ w = 360, h = 780, permissao = 'prompt', pedido = 'granted' } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  await ctx.clock.install({ time: AGORA })
  await instalarPonteNativa(ctx, {
    localStorage: { treino_skip_splash: '1' },
    plugins: { LocalNotifications: { checkPermissions: { display: permissao }, requestPermissions: { display: pedido }, getPending: { notifications: [] }, createChannel: {}, schedule: { notifications: [] }, cancel: {} } },
  })
  await ctx.addInitScript(() => {
    const c = window.Capacitor, np = c.nativePromise, nc = c.nativeCallback
    // a permissão dada continua dada quando o app é fechado e aberto de novo (a página recarregada começaria de novo do 'prompt')
    try { if (sessionStorage.getItem('perm_dada')) window.__respostas.LocalNotifications.checkPermissions = { display: 'granted' } } catch { /* sem armazenamento */ }
    // quando a pessoa responde ao diálogo de permissão, o Android passa a responder igual a "checkPermissions" (a ponte simulada é estática)
    c.nativePromise = async (plugin, method, options) => { const r = await np(plugin, method, options); if (plugin === 'LocalNotifications' && method === 'requestPermissions') { window.__respostas.LocalNotifications.checkPermissions = r; try { sessionStorage.setItem('perm_dada', '1') } catch { /* sem armazenamento */ } } return r }
    c.nativeCallback = (plugin, method, options, cb) => { window.__chamadas.push({ plugin, method, options }); return nc(plugin, method, options, cb) }
  })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => erros.push(e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/plugin is not implemented/i.test(m.text())) erros.push(m.text()) })
  await p.goto(base); await p.waitForSelector('.folders')
  return { ctx, p }
}
const abrirMais = async (p) => { await irPara(p, 'Mais'); await p.waitForSelector('.lembrete'); await esperarMovimento(p) }
const noPlugin = (p, metodo) => chamadas(p).then((c) => c.filter((x) => x.plugin === 'LocalNotifications' && x.method === metodo))
const agendamentos = async (p) => (await noPlugin(p, 'schedule')).map((c) => c.options.notifications)
const esperarAgendamentos = (p, n) => p.waitForFunction((k) => window.__chamadas.filter((c) => c.plugin === 'LocalNotifications' && c.method === 'schedule').length >= k, n, { timeout: 8000 })
const interruptor = (p) => p.locator('.lembrete [role=switch]')
const hm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const dia = (iso) => new Date(iso).getDate()

// ───── 1. navegador comum: não há como avisar com o app fechado ─────
{
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  await ctx.addInitScript(() => { try { localStorage.setItem('treino_skip_splash', '1') } catch { /* sem armazenamento */ } })
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message))
  await p.goto(base); await p.waitForSelector('.folders'); await abrirMais(p)
  ok('sem Android (navegador): o cartão explica que só funciona no app e não mostra interruptor', (await p.locator('.lembrete [role=switch]').count()) === 0 && /só no aplicativo do Android/.test(await p.locator('.lembrete').innerText()))
  await ctx.close()
}

// ───── 2. permissão negada ─────
{
  const { ctx, p } = await celular({ permissao: 'denied' }); await abrirMais(p)
  ok('desligado de fábrica: nada agendado e a permissão NÃO é pedida só por abrir o app', (await noPlugin(p, 'schedule')).length === 0 && (await noPlugin(p, 'requestPermissions')).length === 0 && (await interruptor(p).getAttribute('aria-checked')) === 'false')
  await interruptor(p).click(); await p.waitForTimeout(400)
  ok('permissão bloqueada: não liga, explica onde liberar e não agenda', (await interruptor(p).getAttribute('aria-checked')) === 'false' && /Configurações do Android/.test(await p.locator('.lembrete [role=status]').innerText()) && (await noPlugin(p, 'schedule')).length === 0 && (await noPlugin(p, 'requestPermissions')).length === 0)
  await ctx.close()
}

// ───── 3. o caminho feliz ─────
{
  const { ctx, p } = await celular({ permissao: 'prompt' }); await abrirMais(p)
  await interruptor(p).click(); await esperarAgendamentos(p, 1)
  ok('ao ligar, pede a permissão (uma vez)', (await noPlugin(p, 'requestPermissions')).length === 1)
  const [lista] = await agendamentos(p)
  ok('agenda 14 avisos, um por dia, às 19:00', lista.length === 14 && lista.every((n) => hm(n.schedule.at) === '19:00') && dia(lista[0].schedule.at) === 16 && dia(lista[1].schedule.at) === 17, `${lista.length} avisos; 1º ${hm(lista[0].schedule.at)} dia ${dia(lista[0].schedule.at)}`)
  ok('contrato com o plugin: canal próprio, sem alarme exato, ids diferentes e título certo', lista.every((n) => n.channelId === 'lembrete-diario' && n.isExactNotification === false && n.schedule.allowWhileIdle === true && n.title === 'Hora de estudar') && new Set(lista.map((n) => n.id)).size === 14)
  const canal = (await noPlugin(p, 'createChannel'))[0]?.options
  ok('cria o canal "Lembrete diário de estudo" (importância alta) antes de agendar', canal?.id === 'lembrete-diario' && canal.importance === 4 && canal.vibration === true)
  ok('o aviso de hoje diz o que espera; os outros são frases gerais', /Que tal 10 questões novas|Esperando por você/.test(lista[0].body) && lista.slice(1).every((n) => !/\d+ cartões|\d+ questões no caderno/.test(n.body)), lista[0].body)
  ok('a tela mostra ligado, o próximo aviso e o horário', (await interruptor(p).getAttribute('aria-checked')) === 'true' && /Próximo aviso: hoje às 19:00/.test(await interruptor(p).innerText()) && (await p.locator('.lemb-rel').innerText()) === '19:00')
  ok('o app ouve o toque na notificação (para abrir o Assistente)', (await chamadas(p)).some((c) => c.plugin === 'LocalNotifications' && c.method === 'addListener' && c.options?.eventName === 'localNotificationActionPerformed'))

  // mudar a hora
  await p.locator('.lemb-hora button', { hasText: '+' }).click(); await esperarAgendamentos(p, 2)
  ok('o botão "+" soma 15 minutos e reagenda (19:15)', (await p.locator('.lemb-rel').innerText()) === '19:15' && hm((await agendamentos(p)).at(-1)[0].schedule.at) === '19:15')
  await p.locator('.lemb-hora button', { hasText: '−' }).click(); await p.locator('.lemb-hora button', { hasText: '−' }).click(); await esperarAgendamentos(p, 4)
  ok('o botão "−" volta 15 minutos por toque (19:00 → 18:45)', (await p.locator('.lemb-rel').innerText()) === '18:45')
  await p.locator('.lemb-rapidos .chip', { hasText: 'Manhã' }).click(); await esperarAgendamentos(p, 5)
  const l5 = (await agendamentos(p)).at(-1)
  ok('atalho "Manhã" (07:30): como 07:30 de hoje já passou, o primeiro aviso é amanhã', (await p.locator('.lemb-rel').innerText()) === '07:30' && hm(l5[0].schedule.at) === '07:30' && dia(l5[0].schedule.at) === 17 && l5.length === 13, `1º dia ${dia(l5[0].schedule.at)}; ${l5.length} avisos`)
  ok('o atalho escolhido fica marcado', (await p.locator('.lemb-rapidos .chip[aria-pressed="true"]').count()) === 1)
  await p.locator('.lemb-rapidos .chip', { hasText: 'Noite' }).click(); await esperarAgendamentos(p, 6)
  ok('cada troca CANCELA o que estava agendado antes (não acumula): getPending + cancel a cada lista', (await noPlugin(p, 'getPending')).length >= 6)

  // enviar um teste
  const antesTeste = (await agendamentos(p)).length
  await p.locator('.lembrete .btn', { hasText: 'Enviar um teste' }).click(); await esperarAgendamentos(p, antesTeste + 1)
  const teste = (await agendamentos(p)).at(-1)
  ok('"Enviar um teste" agenda UM aviso em 5 segundos, com id negativo e texto de teste', teste.length === 1 && teste[0].id < 0 && /^Teste: /.test(teste[0].body) && Math.abs(new Date(teste[0].schedule.at).getTime() - (AGORA.getTime() + 5000)) < 3000, JSON.stringify(teste[0]).slice(0, 160))
  ok('e diz na tela que o aviso chega em 5 segundos', /5 segundos/.test(await p.locator('.lembrete [role=status]').innerText()))

  // estudar tira o aviso de hoje
  await definirResposta(p, 'LocalNotifications', 'getPending', { notifications: [{ id: 11 }, { id: 12 }] })
  await p.locator('.lemb-rapidos .chip', { hasText: 'Noite' }).click() // 21:00 (ainda é hoje às 10:00)
  const antes = (await agendamentos(p)).length; await esperarAgendamentos(p, antes + 1)
  const hojeAntes = (await agendamentos(p)).at(-1)
  ok('com a hora de hoje ainda por vir (21:00), o aviso de hoje existe', dia(hojeAntes[0].schedule.at) === 16 && hojeAntes.length === 14, `${hojeAntes.length} avisos; 1º dia ${dia(hojeAntes[0].schedule.at)}`)
  await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet'); await p.locator('.alt').first().click()
  const n0 = (await agendamentos(p)).length; await esperarAgendamentos(p, n0 + 1)
  const hojeDepois = (await agendamentos(p)).at(-1)
  ok('depois de responder uma questão o aviso de hoje SAI da lista (a lista é refeita) e os outros dias ficam', hojeDepois.length === 13 && dia(hojeDepois[0].schedule.at) === 17, `${hojeDepois.length} avisos; 1º dia ${dia(hojeDepois[0].schedule.at)}`)
  ok('e a lista antiga é cancelada antes (ids pendentes 11 e 12 vão ao cancel)', (await noPlugin(p, 'cancel')).some((c) => JSON.stringify(c.options) === JSON.stringify({ notifications: [{ id: 11 }, { id: 12 }] })))

  // sobrevive a fechar e abrir o app
  await p.reload(); await p.waitForSelector('.folders')
  await p.waitForFunction(() => window.__chamadas.some((c) => c.plugin === 'LocalNotifications' && c.method === 'schedule'), null, { timeout: 8000 })
  await abrirMais(p)
  ok('ao abrir o app de novo: continua ligado, na mesma hora (21:00), e a lista é refeita sozinha', (await interruptor(p).getAttribute('aria-checked')) === 'true' && (await p.locator('.lemb-rel').innerText()) === '21:00' && (await agendamentos(p)).length >= 1)
  // desligar
  await definirResposta(p, 'LocalNotifications', 'getPending', { notifications: [{ id: 31 }, { id: 32 }] })
  await interruptor(p).click(); await p.waitForFunction(() => window.__chamadas.some((c) => c.plugin === 'LocalNotifications' && c.method === 'cancel'), null, { timeout: 8000 })
  ok('desligar cancela tudo e esconde o horário', (await interruptor(p).getAttribute('aria-checked')) === 'false' && (await p.locator('.lemb-hora').count()) === 0)
  await ctx.close()
}

// ───── 4. a tela no celular pequeno ─────
{
  const { ctx, p } = await celular({ w: 320, h: 568, permissao: 'granted' }); await abrirMais(p)
  await interruptor(p).click(); await esperarAgendamentos(p, 1); await esperarMovimento(p)
  const m = await p.evaluate(() => {
    const card = document.querySelector('.lembrete'), cr = card.getBoundingClientRect()
    const filhos = [...card.querySelectorAll('button, output, p')].map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || '').slice(0, 24), l: r.left, r: r.right, w: r.width, h: r.height, corte: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1, botao: e.tagName === 'BUTTON' } })
    return { card: { l: cr.left, r: cr.right }, filhos, pagina: document.documentElement.scrollWidth > innerWidth }
  })
  ok('320 px: nada sai do cartão nem da tela e nenhum texto é cortado', !m.pagina && m.filhos.every((f) => f.l >= m.card.l - 0.5 && f.r <= m.card.r + 0.5 && !f.corte), JSON.stringify(m.filhos.filter((f) => f.corte || f.r > m.card.r + 0.5)))
  ok('320 px: todo botão tem pelo menos 44 px de altura (e os de hora 56 px de largura)', m.filhos.filter((f) => f.botao).every((f) => f.h >= 44 - 0.5) && m.filhos.filter((f) => f.t === '−' || f.t === '+' || /mais/.test(f.t)).every((f) => f.w >= 56 - 0.5))
  await p.locator('.lembrete').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'docs/verificacao-capturas/lembrete-320.png' })
  await ctx.close()
}

ok('sem erros de script no console', erros.length === 0, erros.join(' | '))
console.log(out.join('\n')); await b.close()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
