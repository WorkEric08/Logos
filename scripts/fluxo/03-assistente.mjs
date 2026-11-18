// Assistente: toca em cada pílula num app novo e anota o que aparece (texto, botões), voltar do sistema, tema
import { abrirApp, irPara, onde, voltar, texto, foto } from './_base.mjs'
const out = (...a) => console.log(...a)
const PILULAS = ['Questões novas (10)', 'Simulado da semana', 'Importar uma prova em PDF', 'Criar cartões de um resumo', 'Montar um simulado', 'Treinar questões', 'Caderno de erros', 'Painel do dia e plano de estudo', 'Gerar questões do meu material', 'Lembrete diário', 'Meus materiais', 'Meus espaços de estudo', 'O que eu já tenho?', 'O que você sabe fazer?']
const nome = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 24)
for (const pil of PILULAS) {
  const { p, erros, fechar } = await abrirApp({})
  await irPara(p, 'Assistente'); await p.waitForTimeout(5500)
  await p.getByRole('button', { name: pil, exact: true }).click(); await p.waitForTimeout(3500)
  const t = (await texto(p)).replace(/\n/g, ' | ')
  const i = t.indexOf(pil)
  out(`\n##### ${pil}  (onde: ${await onde(p)})`)
  out(t.slice(t.lastIndexOf(pil) + pil.length, t.lastIndexOf(pil) + pil.length + 600))
  out('botões no fim:', (await p.locator('main button').allInnerTexts()).slice(-8))
  await foto(p, 'as-' + nome(pil))
  await voltar(p)
  out('após voltar do sistema →', await onde(p))
  if (erros.length) out('ERROS', erros)
  await fechar()
}
