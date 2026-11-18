import { abrirApp, irPara, foto } from './_base.mjs'
const out = []; const ok = (n, c, x = '') => out.push(`${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`)
const { p, fechar, erros } = await abrirApp({ view: 'cel390' })
// F-09: matéria a partir do Desempenho limpa prova e situação
await irPara(p, 'Treinar'); await p.waitForSelector('.filters')
await p.locator('.filters .chip', { hasText: 'Marcadas' }).click()
await p.locator('.fbottom .field', { hasText: 'Prova' }).locator('.chip').nth(1).click()
await irPara(p, 'Desempenho'); await p.waitForSelector('.folders .folder')
await p.locator('.folders .folder', { hasText: 'Vendas' }).first().click(); await p.waitForSelector('.filters')
const sel = await p.evaluate(() => [...document.querySelectorAll('.filters .chip[aria-pressed="true"]')].map((e) => e.textContent))
ok('F-09 matéria do Desempenho: só ela marcada, prova e situação em "Todas"', sel.filter((t) => /Marcadas|2010|2012/.test(t)).length === 0 && sel.some((t) => t?.startsWith('Vendas')), sel.join(' | '))
const btn = await p.locator('.btn.pri', { hasText: 'Começar' }).isEnabled()
ok('F-09 "Começar" habilitado', btn)
// F-10: espaço vazio
await irPara(p, 'Assistente'); await p.waitForSelector('.as-pilula'); await p.waitForTimeout(800)
await p.locator('.as-pilula[data-acao="espaco"]').click(); await p.waitForSelector('.as-painel'); await p.getByRole('button', { name: /Novo espaço|Criar um espaço|Criar espaço/ }).first().click(); await p.fill('#as-espaco', 'Vazio'); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForTimeout(2500)
for (const aba of ['Início', 'Treinar', 'Desempenho']) {
  await irPara(p, aba); await p.waitForTimeout(500)
  const t = await p.locator('main').innerText()
  ok(`F-10 ${aba}: estado vazio com o nome do espaço e "Importar uma prova"`, /ainda não tem questões/.test(t) && /Vazio/.test(t) && /Importar uma prova/.test(t), t.replace(/\n+/g, ' / ').slice(0, 120))
}
await irPara(p, 'Início'); await p.waitForTimeout(400)
await foto(p, 'corretor-f10-vazio')
console.log(out.join('\n'))
await p.click('text=Importar uma prova'); await p.waitForSelector('.chat-tela'); await p.waitForTimeout(1800)
const t2 = await p.locator('main').innerText()
ok('F-10 "Importar uma prova" abre o Assistente já pedindo o PDF', /Escolha o PDF da prova|PDF da prova/.test(t2), t2.slice(-160).replace(/\n+/g, ' / '))
ok('sem erros de script', erros.length === 0, erros.join('|'))
console.log(out.join('\n')); await fechar()
