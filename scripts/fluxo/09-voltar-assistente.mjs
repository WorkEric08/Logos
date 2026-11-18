// F-07/C-6: voltar do aparelho com painel/pergunta aberta no Assistente; depois um 2º voltar
import { abrirApp, irPara, onde, voltar } from './_base.mjs'
const PIL = ['Simulado da semana', 'Importar uma prova em PDF', 'Criar cartões de um resumo', 'Montar um simulado', 'Treinar questões', 'Painel do dia e plano de estudo', 'Gerar questões do meu material', 'Lembrete diário', 'Meus materiais', 'Meus espaços de estudo']
for (const pil of PIL) {
  const { p, fechar } = await abrirApp({})
  await irPara(p, 'Assistente'); await p.waitForTimeout(5200)
  await p.getByRole('button', { name: pil, exact: true }).click(); await p.waitForTimeout(3000)
  const temCancelar = await p.getByRole('button', { name: /^(Cancelar|Voltar)$/ }).count()
  await voltar(p); await p.waitForTimeout(500)
  const a = await onde(p), sug = await p.getByRole('button', { name: pil, exact: true }).count(), cancel2 = await p.getByRole('button', { name: /^(Cancelar|Voltar)$/ }).count()
  await voltar(p); const b = await onde(p)
  console.log(`${/^Assistente$/.test(a) && cancel2 === 0 && b === 'Início' ? 'OK     ' : 'FALHOU '} ${pil}: painel(c/ botão)=${temCancelar} | 1º voltar→${a} painelAberto=${cancel2} | 2º voltar→${b}`)
  await fechar()
}
