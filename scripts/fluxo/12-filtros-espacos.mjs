// Filtros que sobram ao entrar por cartão de matéria; Treinar com pool vazio; espaço vazio (estados vazios em todas as abas)
import { abrirApp, irPara, onde, voltar, texto, foto, toast } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({})
const resumo = async () => (await p.locator('.chip[aria-pressed=true]').allInnerTexts()).join(' / ')
// 1) deixa filtros: prova BB 2010 + situação Marcadas
await irPara(p, 'Treinar'); await p.locator('.chip', { hasText: 'BB 2010' }).click(); await p.locator('.chip', { hasText: 'Marcadas' }).click(); await p.waitForTimeout(200)
out('filtros:', await resumo(), '|', await p.locator('.btn.pri', { hasText: 'Começar' }).innerText(), 'desabilitado?', await p.locator('.btn.pri', { hasText: 'Começar' }).isDisabled())
await foto(p, 'treinar-vazio')
out('subtítulo:', await p.locator('h1 + *').first().innerText().catch(() => ''))
// 2) Desempenho → toque na matéria Vendas
await irPara(p, 'Desempenho'); await p.locator('.folder', { hasText: 'Vendas' }).first().click(); await p.waitForTimeout(500)
out('após tocar matéria Vendas no Desempenho →', await onde(p), '| filtros:', await resumo(), '|', await p.locator('.btn.pri', { hasText: 'Começar' }).innerText(), '| subt:', (await texto(p)).split('\n')[1])
await foto(p, 'treinar-via-materia')
// 3) Início → Treino rápido ignora filtros?
// 4) espaço vazio
await irPara(p, 'Assistente'); await p.waitForTimeout(5200)
await p.getByRole('button', { name: 'Meus espaços de estudo', exact: true }).click(); await p.waitForTimeout(2500)
await p.getByRole('button', { name: 'Novo espaço', exact: true }).click(); await p.waitForTimeout(800)
await p.fill('#as-espaco', 'Vazio'); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForTimeout(3500)
out('espaço criado:', (await texto(p)).replace(/\n/g, ' | ').slice(-360))
for (const aba of ['Início', 'Treinar', 'Cards', 'Desempenho']) {
  await irPara(p, aba); await p.waitForTimeout(500)
  out(`\n[espaço vazio / ${aba}]`, (await texto(p)).replace(/\n/g, ' | ').slice(0, 420))
  out('botões desabilitados:', await p.locator('main button[disabled]').allInnerTexts())
  await foto(p, 'espaco-vazio-' + aba.toLowerCase().replace('í', 'i'))
}
await irPara(p, 'Início')
const t = p.locator('.tile', { hasText: 'Treino rápido' }); await t.click().catch(() => {}); await p.waitForTimeout(500)
out('Treino rápido no espaço vazio →', await onde(p), '| toast', await toast(p))
const s = p.locator('.tile', { hasText: 'Simulado' }); await s.click().catch(() => {}); await p.waitForTimeout(500)
out('Simulado no espaço vazio →', await onde(p), '| toast', await toast(p))
out('erros', erros)
await fechar()
