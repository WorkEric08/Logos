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
/** Escreve direto no banco do app (o mesmo treino-bb): a configuração do lembrete e/ou N cartões novos (que contam como "para revisar hoje"). Depois, recarregue a página. */
const semear = (p, { config, cartoes = 0 }) => p.evaluate(async ({ config, cartoes }) => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })
  const tx = db.transaction(['meta', 'decks', 'cards'], 'readwrite')
  if (config) tx.objectStore('meta').put({ key: 'lembrete', value: JSON.stringify(config) })
  if (cartoes) {
    tx.objectStore('decks').put({ id: 'b-e2e', nome: 'Baralho e2e', criado: 1 })
    for (let i = 0; i < cartoes; i++) tx.objectStore('cards').put({ id: 'c-e2e-' + i, b: 'b-e2e', f: 'Frente ' + i, v: 'Verso ' + i, criado: i + 1, estado: 'novo', due: 0, ivl: 0, fac: 2.5, reps: 0, lapsos: 0, ult: 0 })
  }
  await new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = () => no(tx.error) })
  db.close()
}, { config, cartoes })
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

// ───── 3. o caminho feliz: o horário começa em 00:00 ─────
{
  const { ctx, p } = await celular({ permissao: 'prompt' }); await abrirMais(p)
  await interruptor(p).click(); await esperarAgendamentos(p, 1)
  ok('ao ligar, pede a permissão (uma vez)', (await noPlugin(p, 'requestPermissions')).length === 1)
  const [lista] = await agendamentos(p)
  ok('o horário começa em 00:00: 13 avisos (o de hoje, 00:00, já passou), um por dia, a partir de amanhã', lista.length === 13 && lista.every((n) => hm(n.schedule.at) === '00:00') && dia(lista[0].schedule.at) === 17 && dia(lista[1].schedule.at) === 18, `${lista.length} avisos; 1º ${hm(lista[0].schedule.at)} dia ${dia(lista[0].schedule.at)}`)
  ok('contrato com o plugin: canal próprio, sem alarme exato, ids diferentes, título certo e destino "assistente"', lista.every((n) => n.channelId === 'lembrete-diario' && n.isExactNotification === false && n.schedule.allowWhileIdle === true && n.title === 'Hora de estudar' && n.extra?.destino === 'assistente') && new Set(lista.map((n) => n.id)).size === 13)
  const canal = (await noPlugin(p, 'createChannel'))[0]?.options
  ok('cria o canal "Lembrete diário de estudo" (importância alta) antes de agendar', canal?.id === 'lembrete-diario' && canal.importance === 4 && canal.vibration === true)
  ok('a tela mostra ligado, o próximo aviso (amanhã às 00:00) e o horário 00:00', (await interruptor(p).getAttribute('aria-checked')) === 'true' && /Próximo aviso: amanhã às 00:00/.test(await interruptor(p).innerText()) && (await p.locator('.lemb-rel').innerText()) === '00:00')
  ok('o app ouve o toque na notificação (para abrir o Assistente ou os Cartões)', (await chamadas(p)).some((c) => c.plugin === 'LocalNotifications' && c.method === 'addListener' && c.options?.eventName === 'localNotificationActionPerformed'))
  const texto = async () => (await p.locator('.lemb-rel').innerText())
  const minutos = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const passos = (de, para) => (((minutos(para) - minutos(de)) % 1440) + 1440) % 1440 / 15 // quantos passos de 15 min para a frente (módulo 24 h)

  // um toque = um passo de 15 minutos
  await p.locator('.lemb-hora button', { hasText: '+' }).click(); await esperarAgendamentos(p, 2)
  ok('um toque no "+" soma 15 minutos e reagenda (00:15)', (await texto()) === '00:15' && hm((await agendamentos(p)).at(-1)[0].schedule.at) === '00:15')
  await p.locator('.lemb-hora button', { hasText: '−' }).click(); await esperarAgendamentos(p, 3)
  await p.locator('.lemb-hora button', { hasText: '−' }).click(); await esperarAgendamentos(p, 4)
  ok('dois toques no "−" voltam 30 minutos e dão a volta no relógio (00:15 → 23:45)', (await texto()) === '23:45', await texto())

  // apertar e SEGURAR o "+": anda de 15 em 15 enquanto aperta, e só ao soltar guarda e reagenda (uma vez)
  const mais = await p.locator('.lemb-hora button', { hasText: '+' }).boundingBox()
  const antes = await texto(), n0 = (await agendamentos(p)).length
  await p.mouse.move(mais.x + mais.width / 2, mais.y + mais.height / 2); await p.mouse.down()
  await p.waitForTimeout(1400)
  const durante = await texto(), n1 = (await agendamentos(p)).length
  await p.mouse.up()
  await esperarAgendamentos(p, n0 + 1); await p.waitForTimeout(500)
  const depois = await texto(), n2 = (await agendamentos(p)).length
  ok('segurando o "+": o horário anda de 15 em 15 minutos (vários passos) enquanto aperta', passos(antes, durante) >= 5 && passos(antes, durante) <= 14, `${antes} → ${durante} (${passos(antes, durante)} passos em 1,4 s)`)
  ok('segurando: NADA é reagendado durante o aperto (só a tela muda)', n1 === n0, `agendamentos antes ${n0}, durante ${n1}`)
  ok('ao soltar: o horário final é o que a tela mostrava e a lista é refeita UMA vez', depois >= durante && passos(durante, depois) <= 1 && n2 === n0 + 1 && hm((await agendamentos(p)).at(-1)[0].schedule.at) === depois, `soltou em ${durante} → ${depois}; agendamentos ${n0} → ${n2}`)

  // segurar o "−"
  const menos = await p.locator('.lemb-hora button', { hasText: '−' }).boundingBox()
  const a2 = await texto(), n3 = (await agendamentos(p)).length
  await p.mouse.move(menos.x + menos.width / 2, menos.y + menos.height / 2); await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up()
  await esperarAgendamentos(p, n3 + 1)
  const d2 = await texto()
  ok('segurando o "−": o horário volta de 15 em 15 minutos (e dá a volta no relógio)', passos(d2, a2) >= 3 && passos(d2, a2) <= 12, `${a2} → ${d2}`)

  // teclado (Enter): um passo por vez, sem repetir
  const n4 = (await agendamentos(p)).length
  await p.locator('.lemb-hora button', { hasText: '+' }).focus(); await p.keyboard.press('Enter'); await esperarAgendamentos(p, n4 + 1)
  ok('pelo teclado (Enter) o "+" anda um passo só', passos(d2, await texto()) === 1, `${d2} → ${await texto()}`)
  await ctx.close()
}

// ───── 3b. avisos de cartões por período (com 3 cartões esperando) e o aviso de começo às 21:00 ─────
{
  const { ctx, p } = await celular({ permissao: 'granted' })
  await semear(p, { config: { ativo: false, hora: 21, minuto: 0, periodos: [] }, cartoes: 3 })
  await p.reload(); await p.waitForSelector('.folders'); await abrirMais(p)
  ok('desligado: não mostra o horário nem os períodos', (await p.locator('.lemb-hora').count()) === 0 && (await p.locator('.lemb-rapidos').count()) === 0)
  await interruptor(p).click(); await esperarAgendamentos(p, 1)
  const [l0] = await agendamentos(p)
  ok('ligado às 21:00: 14 avisos de começo (o de hoje ainda vem), sem aviso de cartões porque nenhum período está marcado', l0.length === 14 && l0.every((n) => hm(n.schedule.at) === '21:00' && n.extra.destino === 'assistente') && dia(l0[0].schedule.at) === 16)
  ok('o aviso de hoje diz o que espera; os outros são frases gerais', /Que tal 10 questões novas|Esperando por você/.test(l0[0].body) && l0.slice(1).every((n) => !/\d+ cartões|\d+ questões no caderno/.test(n.body)), l0[0].body)
  ok('a tela explica: o horário é o aviso de começo e os períodos avisam de cartões para revisar (multisseleção, pode não marcar nenhum)', await (async () => {
    const t = await p.locator('.lembrete').innerText()
    return /horário abaixo é o aviso de começo do estudo/.test(t) && /ainda tiver flashcards para revisar/.test(t) && /Marque quantos quiser ou nenhum/.test(t) && /Nenhum período marcado/.test(t)
  })())
  const chips = await p.locator('.lemb-rapidos .chip').evaluateAll((e) => e.map((x) => x.textContent))
  ok('os quatro períodos, nesta ordem e com a faixa de cada um (manhã 06:00–11:59, tarde 12:00–17:59, noite 18:00–23:59, madrugada 00:00–05:59)', JSON.stringify(chips) === JSON.stringify(['Manhã06:00 às 11:59', 'Tarde12:00 às 17:59', 'Noite18:00 às 23:59', 'Madrugada00:00 às 05:59']), JSON.stringify(chips))
  ok('nenhum período vem marcado de fábrica', (await p.locator('.lemb-rapidos .chip[aria-pressed="true"]').count()) === 0)
  const cartoesDe = (l) => l.filter((n) => n.extra.destino === 'cartoes')

  await p.locator('.lemb-rapidos .chip', { hasText: 'Tarde' }).click(); await esperarAgendamentos(p, 2)
  const l1 = (await agendamentos(p)).at(-1), c1 = cartoesDe(l1)
  ok('marcar "Tarde": um aviso de cartões por dia às 15:00 (hoje e os 13 seguintes), título próprio e destino "cartoes"', c1.length === 14 && c1.every((n) => hm(n.schedule.at) === '15:00' && n.title === 'Cartões para revisar') && l1.length === 28, `${c1.length} de cartões; ${l1.length} no total`)
  ok('o de hoje diz quantos ("Você ainda tem 3 cartões para revisar hoje.") e os outros dias não dizem número', c1[0].body === 'Você ainda tem 3 cartões para revisar hoje.' && c1.slice(1).every((n) => !/\d/.test(n.body)), c1[0].body)
  ok('os ids dos avisos de cartões não colidem com os de começo', new Set(l1.map((n) => n.id)).size === l1.length)
  ok('a tela mostra o período marcado e o resumo', (await p.locator('.lemb-rapidos .chip[aria-pressed="true"]').count()) === 1 && /aviso às 15:00/.test(await p.locator('[data-resumo-periodos]').innerText()))

  await p.locator('.lemb-rapidos .chip', { hasText: 'Madrugada' }).click(); await esperarAgendamentos(p, 3)
  const l2 = (await agendamentos(p)).at(-1)
  ok('multisseleção: marcar também "Madrugada" soma os avisos das 02:00 (a de hoje já passou: 13 dias)', cartoesDe(l2).length === 14 + 13 && cartoesDe(l2).filter((n) => hm(n.schedule.at) === '02:00').length === 13 && (await p.locator('.lemb-rapidos .chip[aria-pressed="true"]').count()) === 2)
  await p.locator('.lemb-rapidos .chip', { hasText: 'Noite' }).click(); await esperarAgendamentos(p, 4)
  const l3 = (await agendamentos(p)).at(-1)
  ok('"Noite" (21:00) é a mesma hora do aviso de começo: não repete o aviso naquela hora', cartoesDe(l3).length === 14 + 13 && l3.length === 14 + 27)
  ok('o próximo aviso mostrado é sempre o de começo do estudo (hoje às 21:00), não o de cartões', /Próximo aviso: hoje às 21:00/.test(await interruptor(p).innerText()))

  // estudar uma questão: o aviso de começo de hoje sai, o de cartões de hoje (ainda há cartão) continua
  await definirResposta(p, 'LocalNotifications', 'getPending', { notifications: [{ id: 41 }] })
  await irPara(p, 'Treinar'); await p.click('text=Começar'); await p.waitForSelector('.sheet'); await p.locator('.alt').first().click()
  const nEst = (await agendamentos(p)).length; await esperarAgendamentos(p, nEst + 1)
  const l4 = (await agendamentos(p)).at(-1)
  ok('depois de responder uma questão: o aviso de começo de hoje sai, mas o de cartões de hoje (15:00) fica, porque ainda há cartão', !l4.some((n) => n.extra.destino === 'assistente' && dia(n.schedule.at) === 16) && l4.some((n) => n.extra.destino === 'cartoes' && dia(n.schedule.at) === 16 && hm(n.schedule.at) === '15:00'))
  ok('e a lista antiga é cancelada antes (id pendente 41 vai ao cancel)', (await noPlugin(p, 'cancel')).some((c) => JSON.stringify(c.options) === JSON.stringify({ notifications: [{ id: 41 }] })))

  // sobrevive a fechar e abrir o app; desmarcar todos
  await p.reload(); await p.waitForSelector('.folders'); await abrirMais(p)
  const marcadosDepois = await p.locator('.lemb-rapidos .chip[aria-pressed="true"]').evaluateAll((e) => e.map((x) => x.firstChild.textContent))
  ok('ao abrir o app de novo: continua ligado e com os mesmos períodos marcados (Tarde, Noite, Madrugada)', (await interruptor(p).getAttribute('aria-checked')) === 'true' && marcadosDepois.join() === 'Tarde,Noite,Madrugada', marcadosDepois.join())
  for (const nome of ['Tarde', 'Noite', 'Madrugada']) { const n = (await agendamentos(p)).length; await p.locator('.lemb-rapidos .chip', { hasText: nome }).click(); await esperarAgendamentos(p, n + 1) }
  const l5 = (await agendamentos(p)).at(-1)
  ok('desmarcar todos (não escolher nenhum): sobram só os avisos de começo e o texto diz isso', cartoesDe(l5).length === 0 && /Nenhum período marcado/.test(await p.locator('[data-resumo-periodos]').innerText()))

  // enviar um teste
  const antesTeste = (await agendamentos(p)).length
  await p.locator('.lembrete .btn', { hasText: 'Enviar um teste' }).click(); await esperarAgendamentos(p, antesTeste + 1)
  const teste = (await agendamentos(p)).at(-1)
  ok('"Enviar um teste" agenda UM aviso em 5 segundos, com id negativo e texto de teste', teste.length === 1 && teste[0].id < 0 && /^Teste: /.test(teste[0].body) && Math.abs(new Date(teste[0].schedule.at).getTime() - ((await p.evaluate(() => Date.now())) + 5000)) < 3000, JSON.stringify(teste[0]).slice(0, 160))
  ok('e diz na tela que o aviso chega em 5 segundos', /5 segundos/.test(await p.locator('.lembrete [role=status]').innerText()))

  // desligar
  await definirResposta(p, 'LocalNotifications', 'getPending', { notifications: [{ id: 31 }, { id: 32 }] })
  await interruptor(p).click(); await p.waitForFunction(() => window.__chamadas.some((c) => c.plugin === 'LocalNotifications' && c.method === 'cancel' && JSON.stringify(c.options) === '{"notifications":[{"id":31},{"id":32}]}'), null, { timeout: 8000 })
  ok('desligar cancela tudo e esconde o horário e os períodos', (await interruptor(p).getAttribute('aria-checked')) === 'false' && (await p.locator('.lemb-hora').count()) === 0 && (await p.locator('.lemb-rapidos').count()) === 0)
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
