// PDFs de teste gerados pelo próprio Chrome (page.pdf), no jeito das provas de concurso: duas colunas, número da questão sozinho na linha,
// alternativas "(A)" a "(E)", título da matéria em maiúsculas, cabeçalho. Serve aos testes do assistente (importar prova + gabarito) sem depender de arquivos pessoais.
export const QUESTOES_TESTE = [
  { n: 1, m: 'LÍNGUA PORTUGUESA', e: 'Qual é a capital do Brasil, segundo a Constituição Federal de 1988?', a: ['Rio de Janeiro', 'Brasília', 'São Paulo', 'Salvador', 'Recife'], g: 'B' },
  { n: 2, m: 'LÍNGUA PORTUGUESA', e: 'Assinale a alternativa em que a concordância verbal está correta.', a: ['Fazem dois anos que ele partiu.', 'Houveram muitos problemas.', 'Existem várias razões para isso.', 'Devem haver soluções.', 'Haviam pessoas na sala.'], g: 'C' },
  { n: 3, m: 'LÍNGUA PORTUGUESA', e: 'O termo "porém" estabelece com a oração anterior uma relação de', a: ['causa', 'oposição', 'conclusão', 'tempo', 'finalidade'], g: 'B' },
  { n: 4, m: 'MATEMÁTICA', e: 'Quanto é 15% de 200?', a: ['20', '25', '30', '35', '40'], g: 'C' },
  { n: 5, m: 'MATEMÁTICA', e: 'Observe a figura abaixo, que mostra um triângulo retângulo de catetos 3 e 4. Qual é a hipotenusa?', a: ['4', '5', '6', '7', '8'], g: 'B' },
  { n: 6, m: 'MATEMÁTICA', e: 'Um capital de R$ 1.000,00 rende 10% ao ano a juros simples. Qual o montante após 2 anos?', a: ['R$ 1.100,00', 'R$ 1.150,00', 'R$ 1.200,00', 'R$ 1.210,00', 'R$ 1.300,00'], g: 'C' },
  { n: 7, m: 'CONHECIMENTOS BANCÁRIOS', e: 'O órgão responsável por definir a taxa Selic é o', a: ['Copom', 'CMN', 'CVM', 'BNDES', 'Febraban'], g: 'A' },
  { n: 8, m: 'CONHECIMENTOS BANCÁRIOS', e: 'A liquidez de um ativo é a facilidade de', a: ['valorizá-lo', 'convertê-lo em dinheiro', 'tributá-lo', 'comprá-lo no exterior', 'garanti-lo'], g: 'B' },
]

const html = (qs) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@page{size:A4;margin:100px 40px 90px 40px}
body{font:11px/1.35 Arial,sans-serif;margin:0}
.cab{position:fixed;top:-70px;left:0;right:0;text-align:center;font-weight:bold;font-size:12px}
.col{column-count:2;column-gap:28px}
.q{break-inside:avoid;margin:0 0 14px}
.n{font-weight:bold}
.t{font-weight:bold;margin:10px 0 8px;break-after:avoid}
</style></head><body><div class="cab">BANCO DE TESTE</div><div class="col">${(() => {
  let mat = ''
  return qs.map((q) => {
    const titulo = q.m !== mat ? `<div class="t">${q.m}</div>` : ''
    mat = q.m
    return `${titulo}<div class="q"><div class="n">${q.n}</div><div>${q.e}</div>${q.a.map((a, i) => `<div>(${'ABCDE'[i]}) ${a}</div>`).join('')}</div>`
  }).join('')
})()}</div></body></html>`

export async function pdfProva(navegador, qs = QUESTOES_TESTE) {
  const ctx = await navegador.newContext()
  const p = await ctx.newPage()
  await p.setContent(html(qs))
  const buf = await p.pdf({ format: 'A4', printBackground: true })
  await ctx.close()
  return Buffer.from(buf)
}

export async function pdfGabarito(navegador, qs = QUESTOES_TESTE) {
  const ctx = await navegador.newContext()
  const p = await ctx.newPage()
  const linhas = []
  for (let i = 0; i < qs.length; i += 5) linhas.push(qs.slice(i, i + 5).map((q) => `${q.n} - ${q.g}`).join('&nbsp;&nbsp;&nbsp;&nbsp;'))
  await p.setContent(`<!doctype html><meta charset="utf-8"><body style="font:14px Arial;margin:60px 40px"><h3>GABARITO 1</h3>${linhas.map((l) => `<p>${l}</p>`).join('')}</body>`)
  const buf = await p.pdf({ format: 'A4' })
  await ctx.close()
  return Buffer.from(buf)
}

export const TEXTO_RESUMO = [
  '# Juros',
  '',
  'Capital inicial aplicado em uma operação financeira rende uma taxa a cada período combinado entre as partes.',
  '',
  'Juros simples: o rendimento é calculado apenas sobre o capital inicial, em cada período da aplicação.',
  '',
  'Juros compostos – o rendimento de cada período é somado ao capital e passa a render juros também.',
  '',
  'P: Qual é a sigla do Banco Central do Brasil? R: BACEN.',
  '',
  'O órgão que define a taxa Selic é o **Copom**, que se reúne a cada quarenta e cinco dias.',
  '',
  'A inflação é o aumento generalizado e contínuo dos preços de bens e serviços em uma economia.',
].join('\n')
