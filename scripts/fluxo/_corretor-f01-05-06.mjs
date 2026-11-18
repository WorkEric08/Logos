import { abrirApp, irPara, foto } from './_base.mjs'
const out = []; const ok = (n, c, x = '') => out.push(`${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`)
for (const view of ['cel390', 'cel360']) {
  const { p, fechar, erros } = await abrirApp({ view })
  await p.setViewportSize(view === 'cel390' ? { width: 390, height: 844 } : { width: 320, height: 568 })
  // F-01: treino de Português → resultado → "Mais como este" mantém a matéria
  await irPara(p, 'Treinar'); await p.waitForSelector('.filters')
  await p.locator('.filters .chip', { hasText: 'Português' }).first().click()
  await p.click('text=Começar'); await p.waitForSelector('.sheet')
  const mats = async () => p.evaluate(() => [...document.querySelectorAll('.meta .tag.m')].map((e) => e.textContent))
  ok(`${view} treino começa em Português`, (await mats())[0]?.startsWith('Port'), (await mats()).join())
  for (let i = 0; i < 9; i++) await p.click('.foot >> text=Pular')
  await p.click('.foot >> text=Ver resultado'); await p.waitForSelector('.cartao')
  const mais = await p.locator('.foot .btn.pri').innerText()
  ok(`${view} resultado oferece "Mais como este"`, mais === 'Mais como este', mais)
  await p.click('.foot .btn.pri'); await p.waitForSelector('.sheet')
  const seg = []; for (let i = 0; i < 4; i++) { seg.push((await mats())[0]); await p.click('.foot >> text=Pular') }
  ok(`${view} "Mais como este" segue em Português`, seg.every((m) => m?.startsWith('Port')), seg.join())
  // F-06: revisão pelo cartão-resposta tem "Resultado" em toda questão
  for (let i = 0; i < 5; i++) await p.click('.foot >> text=Pular')
  await p.click('.foot >> text=Ver resultado'); await p.waitForSelector('.cartao')
  await p.locator('.cell').nth(2).click(); await p.waitForSelector('.sheet')
  const pe = await p.locator('.foot .btn').allInnerTexts()
  ok(`${view} revisão: pé com Anterior, Resultado, Próxima`, pe.join('|') === 'Anterior|Resultado|Próxima', pe.join('|'))
  const cortado = await p.evaluate(() => [...document.querySelectorAll('.foot .btn')].some((b) => b.scrollWidth > b.clientWidth + 1))
  ok(`${view} pé da revisão sem texto cortado`, !cortado)
  await foto(p, `corretor-revisao-${view}`)
  await p.click('.foot >> text=Resultado'); await p.waitForSelector('.cartao'); ok(`${view} "Resultado" leva ao resultado`, true)
  // F-05: simulado entregue, questão em branco não responde
  await p.locator('.foot .btn').first().click(); await irPara(p, 'Início'); await p.waitForSelector('.folders, .provas')
  await p.locator('.tile', { hasText: 'Simulado de 70' }).click().catch(async () => { await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Simulado de 70' }).click() })
  await p.waitForSelector('.sheet'); await p.click('.alt >> nth=0')
  await p.evaluate(async () => {}) // vai à última e entrega
  const proxima = async () => { while (await p.locator('.foot >> text=Próxima').count()) await p.click('.foot >> text=Próxima') }
  await proxima(); await p.click('.foot >> text=Entregar prova'); await p.waitForSelector('.cartao')
  await p.locator('.cell').nth(5).click(); await p.waitForSelector('.sheet')
  const alts = await p.locator('.alt').evaluateAll((l) => l.map((e) => e.disabled))
  ok(`${view} simulado entregue: alternativas da questão em branco travadas`, alts.every(Boolean) && alts.length === 5)
  ok(`${view} mostra "Em branco. Gabarito: X"`, /Em branco\. Gabarito: [A-E]/.test(await p.locator('.fb').innerText()))
  await foto(p, `corretor-embranco-${view}`)
  ok(`${view} sem erros de script`, erros.length === 0, erros.join('|'))
  await fechar()
}
console.log(out.join('\n'))
