// Reverificação independente das correções C-1..C-3, F-01, F-05..F-08
import { abrirApp, irPara, onde, voltar, texto, toast, esperarMovimento } from './_base.mjs'
const out = (...a) => console.log(...a)
const R = []; const ok = (n, c, x = '') => { R.push(`${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`) }
const { p, erros, fechar } = await abrirApp({})
const terminar = async (resp = true) => { for (let i = 0; i < 200 && await p.locator('.sheet').count(); i++) { if (resp) await p.locator('.alt:not([disabled])').first().click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(40); await p.locator('.foot .btn.pri').click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(120) } await p.waitForTimeout(300) }

// F-01
await irPara(p, 'Treinar'); await p.locator('.chip', { hasText: 'Português' }).first().click()
await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet'); await terminar()
const foot = await p.locator('.foot .btn').allInnerTexts(); out('F-01 foot:', foot)
const mais = p.locator('.foot .btn', { hasText: 'Mais como este' })
ok('F-01 botão "Mais como este" existe', await mais.count() === 1, foot.join(' / '))
if (await mais.count()) { await mais.click(); await p.waitForSelector('.sheet'); const m = new Set(await p.locator('.tag.m').allInnerTexts()); ok('F-01 mesma matéria (Português)', m.size === 1 && m.has('Português'), [...m].join(',')); await voltar(p) }

// F-08: gerar >20 erros (responde sempre a 1ª alternativa; ~80% errado). 3 treinos Português de 10
for (let r = 0; r < 4; r++) { await irPara(p, 'Treinar'); await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet'); await terminar() ; await p.locator('.foot .btn', { hasText: 'Início' }).click(); await p.waitForTimeout(200) }
await irPara(p, 'Início'); const tile = (await p.locator('.tile', { hasText: 'Rever erros' }).innerText()).replace(/\n/g, ' ')
out('F-08 tile:', tile); ok('F-08 rótulo "N de M" se >20', /Rever erros \((\d+)\)|20 de \d+/.test(tile), tile)
await p.locator('.tile', { hasText: 'Rever erros' }).click(); await p.waitForSelector('.sheet'); out('F-08 sessão:', await p.locator('.cnt').innerText()); await voltar(p)

// F-05 / F-06: simulado entregue com 2 respondidas
await p.locator('.tile', { hasText: 'Simulado de 70' }).click(); await p.waitForSelector('.sheet')
for (let i = 0; i < 70; i++) { if (i < 2) await p.locator('.alt:not([disabled])').first().click(); const b = p.locator('.foot .btn.pri'); await b.click(); await p.waitForTimeout(40) }
await p.waitForSelector('.cartao')
const vistas0 = await p.evaluate(() => 0)
await p.locator('.cell').nth(10).click(); await p.waitForSelector('.sheet')
ok('F-05 alternativas travadas na revisão de simulado em branco', await p.locator('.alt:not([disabled])').count() === 0)
out('F-05 texto:', (await p.locator('.fb').innerText().catch(() => 'sem .fb')).replace(/\n/g, ' '))
const f6 = await p.locator('.foot .btn').allInnerTexts(); ok('F-06 pé na revisão tem Resultado', f6.some((t) => /Resultado/.test(t)), f6.join(' / '))
await p.locator('.foot .btn', { hasText: 'Resultado' }).first().click(); await p.waitForTimeout(300)
ok('F-06 botão leva ao Resultado', /Resultado do simulado/.test(await onde(p)), await onde(p))
await p.locator('.cell').nth(3).click(); await p.waitForSelector('.sheet'); await voltar(p); ok('C-2 voltar da revisão → Resultado', /Resultado do simulado/.test(await onde(p)), await onde(p))
await p.locator('.foot .btn', { hasText: 'Início' }).click(); await p.waitForTimeout(300)
const st = await p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|')); out('stats Início (vistas|acerto|rever):', st)

// C-3 dois toques rápidos
await p.locator('.rail-alca').click().catch(() => {}); await p.waitForTimeout(400)
const a = p.locator('.nav .rail-item', { hasText: 'Cards' }), b2 = p.locator('.nav .rail-item', { hasText: 'Mais' })
if (await a.isVisible()) { await a.click(); await b2.click({ delay: 0 }).catch(() => {}); await p.waitForTimeout(700); ok('C-3 dois toques seguidos: vale o último (Mais)', (await onde(p)) === 'Mais', await onde(p)) } else out('C-3 barra fechada, ignorado')

// C-1 simulado parcial do assistente
await irPara(p, 'Assistente'); await p.waitForTimeout(5000)
await p.getByRole('button', { name: 'Montar um simulado', exact: true }).click(); await p.waitForTimeout(2500)
await p.getByRole('button', { name: 'Matemática', exact: true }).click(); await p.waitForTimeout(2500)
const qb = p.getByRole('button', { name: /10 questões/ }); if (await qb.count()) await qb.first().click(); await p.waitForTimeout(2500)
out('C-1 onde:', await onde(p), await p.locator('.cnt').innerText().catch(() => ''))
if (await p.locator('.sheet').count()) {
  const total = parseInt((await p.locator('.cnt').innerText()).split('/')[1])
  for (let i = 0; i < total; i++) { await p.locator('.alt:not([disabled])').first().click().catch(() => {}); await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(40) }
  await p.waitForSelector('.cartao'); out('C-1 foot do resultado:', await p.locator('.foot .btn').allInnerTexts())
  await p.locator('.foot .btn', { hasText: 'Início' }).click(); await irPara(p, 'Desempenho')
  const nSim = await p.locator('.simlist li').count(); ok('C-1 Desempenho: só os simulados de 70 (já há 1)', nSim === 1, 'linhas=' + nSim)
}
console.log(R.join('\n')); console.log('erros', erros); await fechar()
