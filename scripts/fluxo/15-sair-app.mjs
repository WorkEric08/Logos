// Voltar nas abas: Treinar/Desempenho/Mais/Assistente → Início → toque de novo para sair (e o 2º sai de verdade)
import { abrirApp, irPara, onde, voltar, toast, historyLen } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({}); p.setDefaultTimeout(8000)
for (const aba of ['Treinar', 'Cards', 'Desempenho', 'Mais', 'Assistente']) {
  await irPara(p, aba); await p.waitForTimeout(400)
  await voltar(p); out(`${aba}: voltar →`, await onde(p), '| toast', await toast(p))
}
await voltar(p); out('Início: 1º voltar → toast:', await toast(p), '| url', p.url())
await p.waitForTimeout(3200); out('toast depois de 3 s:', await toast(p))
await voltar(p); out('Início: voltar depois do prazo → toast outra vez:', await toast(p))
await irPara(p, 'Treinar'); await voltar(p); out('Treinar→voltar→Início; toast:', await toast(p), '(não deve haver ainda)')
await voltar(p); await p.waitForTimeout(300); await voltar(p); await p.waitForTimeout(500)
out('2º voltar seguido: url', p.url())
out('erros', erros); await fechar()
