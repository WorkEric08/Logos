import { abrirApp, irPara, voltar, onde } from './_base.mjs'
const { p, fechar, erros } = await abrirApp()
await irPara(p, 'Assistente'); await p.waitForSelector('.as-pilula'); await p.waitForTimeout(800)
for (const acao of ['simulado', 'treinar', 'prova', 'cartoes', 'caderno', 'plano', 'materiais']) {
  await p.locator(`.as-pilula[data-acao="${acao}"]`).click().catch((e) => console.log('sem pilula', acao))
  await p.waitForTimeout(1500)
  const antes = await p.evaluate(() => ({ etapa: document.querySelector('.as-corpo')?.innerText.slice(0, 60), pil: document.querySelectorAll('.as-pilula').length }))
  await voltar(p); await p.waitForTimeout(500)
  console.log(acao, '| antes:', JSON.stringify(antes), '| depois:', await onde(p))
  if ((await onde(p)) !== 'Assistente') { await irPara(p, 'Assistente'); await p.waitForSelector('.as-pilula'); await p.waitForTimeout(800) }
}
console.log(erros)
await fechar()
