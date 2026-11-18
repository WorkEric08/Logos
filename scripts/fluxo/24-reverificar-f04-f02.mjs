// Reverificação F-04 (aviso ao entregar com questões em branco) e F-02 (sair do treino volta à aba de origem)
import { abrirApp, irPara, onde, voltar, texto, foto } from './_base.mjs'
const out = (...a) => console.log(...a)
const R = []; const ok = (n, c, x = '') => { const l = `${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`; R.push(l); console.log(l) }
const { p, erros, fechar } = await abrirApp({ ctxExtra: { reducedMotion: 'reduce' } }); p.setDefaultTimeout(12000)
const ate = async (rx) => { for (let i = 0; i < 80; i++) { const t = await p.locator('.foot .btn.pri').innerText(); if (rx.test(t)) return; await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(30) } }

// ---------- F-04
await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 3; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(30) }
await ate(/Entregar/)
await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(500)
const d = await p.locator('.dialogo').count()
ok('F-04 entregar com questões em branco abre aviso', d === 1, await onde(p))
if (d) {
  const t = (await p.locator('.dialogo').innerText()).replace(/\n/g, ' | '); out('aviso:', t)
  ok('F-04 aviso cita a quantidade em branco (67)', /67/.test(t))
  const foco = await p.evaluate(() => document.activeElement?.textContent?.trim())
  ok('F-04 foco inicial no botão seguro ("Voltar à prova")', /Voltar/i.test(foco ?? ''), foco)
  await foto(p, 'f04-aviso')
  await voltar(p); await p.waitForTimeout(300)
  ok('F-04 voltar do aparelho fecha só o aviso e continua na prova', (await p.locator('.dialogo').count()) === 0 && (await p.locator('.sheet').count()) === 1 && (await p.locator('.cnt').innerText()).startsWith('70/'))
  await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(400)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  ok('F-04 Esc fecha só o aviso', (await p.locator('.dialogo').count()) === 0 && (await p.locator('.sheet').count()) === 1)
  await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(400)
  await p.getByRole('button', { name: /Voltar à prova/ }).click(); await p.waitForTimeout(300)
  ok('F-04 "Voltar à prova" mantém a prova (respostas e posição)', (await p.locator('.sheet').count()) === 1)
  await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(400)
  const ent = p.locator('.dialogo .btn', { hasText: /Entregar/ }); await ent.first().click(); await p.waitForTimeout(600)
  ok('F-04 "Entregar mesmo assim" entrega', /Resultado do simulado/.test(await onde(p)), await onde(p))
  ok('F-04 nota coerente (3 respondidas)', /\/ 100/.test(await texto(p)))
}
await p.locator('.foot .btn', { hasText: 'Início' }).click(); await p.waitForTimeout(400)
// simulado todo respondido: entrega direto, sem aviso
await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 70; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(30) }
await p.waitForTimeout(500)
ok('F-04 com TODAS respondidas entrega direto, sem aviso', /Resultado do simulado/.test(await onde(p)) && (await p.locator('.dialogo').count()) === 0, await onde(p))
await p.locator('.foot .btn', { hasText: 'Início' }).click(); await p.waitForTimeout(400)

// ---------- F-02
const treino = async () => { await p.waitForSelector('.sheet'); await p.locator('.alt:not([disabled])').first().click() }
// origem Treinar: Sair
await irPara(p, 'Treinar'); await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await treino()
await p.locator('.btn', { hasText: 'Sair' }).click(); await p.waitForTimeout(500)
ok('F-02 Treinar > Começar > Sair volta ao Treinar', (await onde(p)) === 'Treinar', await onde(p))
// origem Treinar: voltar do aparelho
await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await treino(); await voltar(p)
ok('F-02 Treinar > Começar > voltar do aparelho volta ao Treinar', (await onde(p)) === 'Treinar', await onde(p))
await voltar(p); ok('F-02 …e o voltar seguinte vai ao Início (não sai do app)', (await onde(p)) === 'Início', await onde(p))
// origem Início (treino rápido)
await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await treino(); await p.locator('.btn', { hasText: 'Sair' }).click(); await p.waitForTimeout(500)
ok('F-02 Início > Treino rápido > Sair volta ao Início', (await onde(p)) === 'Início', await onde(p))
// origem Assistente
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
await p.getByRole('button', { name: /Questões novas/ }).click(); await treino(); await p.locator('.btn', { hasText: 'Sair' }).click(); await p.waitForTimeout(600)
ok('F-02 Assistente > Questões novas > Sair volta ao Assistente', (await onde(p)) === 'Assistente', await onde(p))
await p.getByRole('button', { name: 'Treinar questões', exact: true }).click(); await p.waitForTimeout(1800)
await p.getByRole('button', { name: 'Todas as matérias' }).click(); await p.waitForTimeout(2500)
ok('(preparo) treino aberto pelo assistente', (await p.locator('.sheet').count()) === 1, await onde(p))
if (await p.locator('.sheet').count()) { await treino(); await voltar(p); await p.waitForTimeout(400); ok('F-02 Assistente > treino > voltar do aparelho volta ao Assistente', (await onde(p)) === 'Assistente', await onde(p)); await voltar(p); ok('F-02 …e o voltar seguinte vai ao Início', (await onde(p)) === 'Início', await onde(p)) }
// resultado do treino: Início / Mais como este; origem Treinar
await irPara(p, 'Treinar'); await p.locator('.btn.pri', { hasText: 'Começar' }).click()
for (let i = 0; i < 200 && await p.locator('.sheet').count(); i++) { await p.locator('.alt:not([disabled])').first().click({ timeout: 800 }).catch(() => {}); await p.locator('.foot .btn.pri').click().catch(() => {}); await p.waitForTimeout(80) }
out('resultado (origem Treinar): pé', await p.locator('.foot .btn').allInnerTexts())
await p.locator('.foot .btn').first().click(); await p.waitForTimeout(500); out('1º botão do resultado leva a →', await onde(p))
await irPara(p, 'Início')
// simulado: Sair + Encerrar (origem Início) e via Treinar? simulado só nasce no Início/Assistente
await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet'); await p.locator('.btn', { hasText: 'Sair' }).click(); await p.getByRole('button', { name: 'Encerrar', exact: true }).click(); await p.waitForTimeout(500)
ok('F-02 simulado do Início: Sair + Encerrar volta ao Início', (await onde(p)) === 'Início', await onde(p))
// recarregar no meio de um treino: sem origem guardada, cai no Início sem erro
ok('sem erros de script', erros.length === 0, erros.join(' | '))
console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas'); await fechar()
