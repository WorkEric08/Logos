import { describe, expect, it } from 'vitest'
import { sugerirCartoes, textoParaParagrafos } from '../importar/cartoes'
import { acharSiglas } from './siglas'
import { lacunaNumerica } from './lacunas'
import { lerEnumeracaoInline } from './enumeracao'
import { avaliar } from './qualidade'
import { lerSintaxe, temSintaxe } from './sintaxe'

const gera = (texto: string) => sugerirCartoes(textoParaParagrafos(texto))
const pares = (texto: string) => gera(texto).cartoes.map((c) => [c.f, c.v])

describe('sintaxe explícita (fidelidade total)', () => {
  it('Pergunta::Resposta e Termo:::Definição (ida e volta)', () => {
    expect(pares('Selic::Taxa básica de juros da economia')).toEqual([['Selic', 'Taxa básica de juros da economia']])
    expect(pares('COPOM:::Comitê de Política Monetária')).toEqual([['COPOM', 'Comitê de Política Monetária'], ['Comitê de Política Monetária', 'COPOM']])
  })
  it('o "?" sozinho numa linha (bloco do Obsidian) separa pergunta e resposta, mesmo em várias linhas', () => {
    expect(pares('Qual órgão define a Selic\n?\nO Copom')).toEqual([['Qual órgão define a Selic?', 'O Copom']])
    expect(pares('Qual órgão define a Selic ? O Copom')).toEqual([['Qual órgão define a Selic?', 'O Copom']])
  })
  it('==lacuna==, {{lacuna}} e {{c1::lacuna}}: um cartão por lacuna, as outras ficam visíveis', () => {
    expect(pares('O ==Copom== se reúne a cada ==45 dias==.')).toEqual([['O _____ se reúne a cada 45 dias.', 'Copom'], ['O Copom se reúne a cada _____.', '45 dias']])
    expect(pares('{{c1::IPCA}} mede a inflação oficial')).toEqual([['_____ mede a inflação oficial', 'IPCA']])
    expect(pares('A {{taxa Selic}} é a básica.')).toEqual([['A _____ é a básica.', 'taxa Selic']])
  })
  it('marcador de lista na frente não atrapalha', () => { expect(pares('- Selic::taxa básica')).toEqual([['Selic', 'taxa básica']]) })
  it('texto comum, URL e horário não são sintaxe', () => {
    for (const t of ['A Selic é a taxa básica de juros da economia.', 'Veja https://exemplo.com/a em dois sites', 'A reunião é às 10:30 na sala dois']) expect(temSintaxe(t)).toBe(false)
  })
  it('o que a pessoa marcou nunca é barrado por gosto: sem pronome, sem lacuna "óbvia"', () => {
    expect(lerSintaxe('Isso::Aquilo que ela quis')).toHaveLength(1)
    expect(gera('Isso::Aquilo que ela quis').cartoes).toHaveLength(1)
    expect(gera('O ==Copom== e o Copom').cartoes).toHaveLength(1)
  })
  it('código e títulos de console ("== 3. Imagens ==") não são sintaxe', () => {
    for (const t of ['use `a::b` para separar', '== 3. Imagens (arquivos) ==', 'if (a == b) e c == d']) expect(temSintaxe(t)).toBe(false)
    expect(temSintaxe('o ==Copom== decide')).toBe(true)
  })
  it('lado vazio não vira cartão', () => { expect(lerSintaxe('Selic::')).toEqual([]); expect(lerSintaxe(':::Algo')).toEqual([]) })
})

describe('siglas', () => {
  it('"Expansão (SIGLA)", "SIGLA (Expansão)" e linha de glossário, nos dois sentidos', () => {
    expect(acharSiglas('O Banco Central do Brasil (BACEN) regula o sistema.')).toEqual([{ sigla: 'BACEN', expansao: 'Banco Central do Brasil' }])
    expect(acharSiglas('O CMN (Conselho Monetário Nacional) é o órgão normativo.')).toEqual([{ sigla: 'CMN', expansao: 'Conselho Monetário Nacional' }])
    expect(acharSiglas('FGC – Fundo Garantidor de Créditos')).toEqual([{ sigla: 'FGC', expansao: 'Fundo Garantidor de Créditos' }])
    expect(pares('FGC – Fundo Garantidor de Créditos')).toEqual([['O que significa a sigla FGC?', 'Fundo Garantidor de Créditos'], ['Qual é a sigla de Fundo Garantidor de Créditos?', 'FGC']])
  })
  it('palavras de abertura de frase não entram na expansão ("Segundo o Banco Central (BC)")', () => {
    expect(acharSiglas('Segundo o Banco Central (BC) a taxa subiu.')).toEqual([{ sigla: 'BC', expansao: 'Banco Central' }])
  })
  it('a sigla precisa começar com a letra da expansão: "Taxa Selic (CMN)" não vira cartão', () => {
    expect(acharSiglas('A Taxa Referencial (CMN) mudou.')).toEqual([])
  })
  it('uma palavra só, ou minúscula, não é expansão', () => {
    expect(acharSiglas('O Brasil (BR) é grande.')).toEqual([])
    expect(acharSiglas('o regime geral (RGPS) cobre')).toEqual([])
  })
  it('várias siglas no mesmo parágrafo', () => {
    expect(acharSiglas('O Banco Central do Brasil (BACEN) segue o Conselho Monetário Nacional (CMN).').map((s) => s.sigla)).toEqual(['BACEN', 'CMN'])
  })
})

describe('enumeração: um cartão por item', () => {
  it('lista com marcadores depois de uma introdução com ":"', () => {
    const r = gera('Os poderes da União:\n\n- Legislativo\n\n- Executivo\n\n- Judiciário')
    expect(r.cartoes.map((c) => [c.tipo, c.v])).toEqual([['lista', 'Legislativo'], ['lista', 'Executivo'], ['lista', 'Judiciário']])
    expect(r.cartoes[1].f).toBe('Os poderes da União:\n• Legislativo\n• _____\n• Judiciário')
    expect(r.sobraram).toBe(0)
  })
  it('lista dentro da frase, só quando a introdução fala de uma lista (tipos, princípios, etapas…)', () => {
    const c = lerEnumeracaoInline('Os princípios da administração pública são: legalidade, impessoalidade, moralidade, publicidade e eficiência.')!
    expect(c.map((x) => x.v)).toEqual(['legalidade', 'impessoalidade', 'moralidade', 'publicidade', 'eficiência'])
    expect(c[0].f.startsWith('Os princípios da administração pública são:')).toBe(true)
  })
  it('"Termo: definição, com vírgulas" NÃO é enumeração', () => {
    expect(lerEnumeracaoInline('Juros: rendimento do capital, calculado por período, pago ao fim.')).toBeNull()
    expect(pares('Juros: rendimento do capital, calculado por período, pago ao fim.')).toEqual([['Juros', 'rendimento do capital, calculado por período, pago ao fim.']])
  })
  it('lista com menos de 3 itens na frase, itens longos ou repetidos não viram cartões', () => {
    expect(lerEnumeracaoInline('Os tipos de risco são: crédito e mercado.')).toBeNull()
    expect(lerEnumeracaoInline('As etapas são: uma etapa muito longa que continua falando bastante, outra etapa também enorme e cheia de palavras, mais outra assim.')).toBeNull()
    expect(lerEnumeracaoInline('Os tipos são: risco, risco, risco e outro.')).toBeNull()
  })
  it('lista longa demais (mais de 8) fica de fora', () => {
    const itens = Array.from({ length: 9 }, (_, i) => `- item ${i + 1}`).join('\n\n')
    expect(gera('Etapas do processo:\n\n' + itens).cartoes.filter((c) => c.tipo === 'lista')).toEqual([])
  })
})

describe('lacuna em números, datas e valores', () => {
  it('prazos, porcentagens, valores e anos', () => {
    expect(lacunaNumerica('O Copom se reúne a cada 45 dias para definir a taxa Selic.')!.map((c) => [c.f, c.v])).toEqual([['O Copom se reúne a cada _____ para definir a taxa Selic.', '45 dias']])
    expect(lacunaNumerica('O FGC garante até R$ 250 mil por CPF em cada instituição.')![0].v).toBe('R$ 250 mil')
    expect(lacunaNumerica('O Plano Real foi lançado em 1994 e estabilizou a moeda brasileira.')![0].v).toBe('1994')
    expect(lacunaNumerica('A tributação é de 15% sobre o rendimento da aplicação financeira.')![0].v).toBe('15%')
  })
  it('número solto (item 3, página 45, questão 12) não é fato', () => {
    expect(lacunaNumerica('O item 3 do edital trata de matemática financeira básica.')).toBeNull()
    expect(lacunaNumerica('Veja a página 45 e a questão 12 do caderno de exercícios.')).toBeNull()
  })
  it('frase curta demais, sem ponto final ou com 3 valores ou mais fica de fora', () => {
    expect(lacunaNumerica('Prazo de 45 dias.')).toBeNull()
    expect(lacunaNumerica('O prazo mínimo é de 45 dias e pode chegar a 90 dias, e em casos raros a 180 dias de espera')).toBeNull()
    expect(lacunaNumerica('Prazos de 45 dias, 90 dias e 180 dias valem conforme o caso concreto do contrato.')).toBeNull()
  })
})

describe('regras de qualidade', () => {
  const c = (tipo: Parameters<typeof avaliar>[0]['tipo'], f: string, v: string) => avaliar({ tipo, f, v, origem: '' })
  it('pronome solto, pedaço de frase, frente igual ao verso, vazio', () => {
    expect(c('definicao', 'Isso', 'algo vago')).toHaveProperty('descartar')
    expect(c('verbo', 'O que é Ele?', 'algo vago')).toHaveProperty('descartar')
    expect(c('definicao', 'Mas também', 'alguma coisa que sobrou da frase')).toHaveProperty('descartar')
    expect(c('definicao', 'Selic', 'selic')).toHaveProperty('descartar')
    expect(c('definicao', 'Selic', '  ')).toHaveProperty('descartar')
    expect(c('definicao', 'Selic', 'Taxa básica de juros')).toEqual({})
  })
  it('lacuna óbvia (a resposta está na frente) e lacuna longa', () => {
    expect(c('lacuna', 'O Copom define e o _____ se reúne', 'Copom')).toHaveProperty('descartar')
    expect(c('lacuna', 'O órgão que define a Selic é o _____', 'Copom')).toEqual({})
    expect(c('numero', 'Reúne-se a cada _____', 'x'.repeat(70))).toHaveProperty('descartar')
    expect(c('lacuna', '_____ PDF com texto ou arquivo md.', 'Preciso de:')).toHaveProperty('descartar')
  })
  it('verso e frente longos só avisam (o cartão entra)', () => {
    expect(c('definicao', 'Termo', 'x'.repeat(500)).aviso).toMatch(/verso longo/)
    expect(c('definicao', 'x'.repeat(200), 'curto').aviso).toMatch(/frente longa/)
  })
  it('o que é barrado volta em `descartados` com o motivo', () => {
    const r = gera('Isso: algo que ninguém sabe dizer direito aqui.')
    expect(r.cartoes).toEqual([]); expect(r.descartados).toEqual([{ f: 'Isso', motivo: expect.stringMatching(/pronome/) }])
  })
})

// O CONJUNTO-OURO: textos de resumo com os cartões que uma pessoa esperaria (escrito por mim, não por uma pessoa estudando: ver docs/assistente.md "Não verificado").
// Mede PRECISÃO (do que foi gerado, quanto era esperado) e COBERTURA (do que era esperado, quanto foi gerado). Mexeu no gerador? Não piore os dois.
type Par = [string, string]
const OURO: { nome: string; texto: string; esperado: Par[] }[] = [
  { nome: 'siglas do sistema financeiro', texto: 'O Banco Central do Brasil (BACEN) regula o sistema financeiro nacional.\n\nCMN (Conselho Monetário Nacional) é o órgão normativo máximo do sistema financeiro nacional.\n\nFGC – Fundo Garantidor de Créditos',
    esperado: [['O que significa a sigla BACEN?', 'Banco Central do Brasil'], ['Qual é a sigla de Banco Central do Brasil?', 'BACEN'], ['O que significa a sigla CMN?', 'Conselho Monetário Nacional'], ['Qual é a sigla de Conselho Monetário Nacional?', 'CMN'], ['O que significa a sigla FGC?', 'Fundo Garantidor de Créditos'], ['Qual é a sigla de Fundo Garantidor de Créditos?', 'FGC']] },
  { nome: 'marcação explícita', texto: 'Selic::Taxa básica de juros da economia\n\nCOPOM:::Comitê de Política Monetária\n\nO ==Copom== se reúne a cada ==45 dias==.',
    esperado: [['Selic', 'Taxa básica de juros da economia'], ['COPOM', 'Comitê de Política Monetária'], ['Comitê de Política Monetária', 'COPOM'], ['O _____ se reúne a cada 45 dias.', 'Copom'], ['O Copom se reúne a cada _____.', '45 dias']] },
  { nome: 'listas', texto: 'Os poderes da União:\n\n- Legislativo\n\n- Executivo\n\n- Judiciário\n\nOs princípios da administração pública são: legalidade, impessoalidade, moralidade, publicidade e eficiência.',
    esperado: [['Os poderes da União:\n• _____\n• Executivo\n• Judiciário', 'Legislativo'], ['Os poderes da União:\n• Legislativo\n• _____\n• Judiciário', 'Executivo'], ['Os poderes da União:\n• Legislativo\n• Executivo\n• _____', 'Judiciário'],
      ['Os princípios da administração pública são:\n• _____\n• impessoalidade\n• moralidade\n• publicidade\n• eficiência', 'legalidade'], ['Os princípios da administração pública são:\n• legalidade\n• _____\n• moralidade\n• publicidade\n• eficiência', 'impessoalidade'],
      ['Os princípios da administração pública são:\n• legalidade\n• impessoalidade\n• _____\n• publicidade\n• eficiência', 'moralidade'], ['Os princípios da administração pública são:\n• legalidade\n• impessoalidade\n• moralidade\n• _____\n• eficiência', 'publicidade'],
      ['Os princípios da administração pública são:\n• legalidade\n• impessoalidade\n• moralidade\n• publicidade\n• _____', 'eficiência']] },
  { nome: 'números e datas', texto: 'O Copom se reúne a cada 45 dias para definir a taxa Selic.\n\nO FGC garante até R$ 250 mil por CPF em cada instituição.\n\nO Plano Real foi lançado em 1994 e estabilizou a moeda brasileira.',
    esperado: [['O Copom se reúne a cada _____ para definir a taxa Selic.', '45 dias'], ['O FGC garante até _____ por CPF em cada instituição.', 'R$ 250 mil'], ['O Plano Real foi lançado em _____ e estabilizou a moeda brasileira.', '1994']] },
  { nome: 'definições comuns (como antes)', texto: 'Juros simples: o rendimento é calculado só sobre o capital inicial, em cada período.\n\nLiquidez – facilidade de transformar um ativo em dinheiro sem perder valor.\n\nP: Qual a sigla do Banco Central? R: BACEN.\n\nA inflação é o aumento generalizado e contínuo dos preços em uma economia.',
    esperado: [['Juros simples', 'o rendimento é calculado só sobre o capital inicial, em cada período.'], ['Liquidez', 'facilidade de transformar um ativo em dinheiro sem perder valor.'], ['Qual a sigla do Banco Central?', 'BACEN.'], ['O que é A inflação?', 'A inflação é o aumento generalizado e contínuo dos preços em uma economia.']] },
  { nome: 'o que NÃO pode virar cartão', texto: 'O item 3 do edital trata de matemática financeira básica.\n\nVeja a página 45 e a questão 12.\n\nIsso: algo que ninguém sabe dizer direito aqui.\n\nO Copom define a Selic, e o **Copom** se reúne todo mês no Banco Central.\n\nMas também: situação em que algo acontece de forma inesperada.\n\nhttps://exemplo.com: página inicial do site oficial\n\nJuros: rendimento do capital, calculado por período, pago ao fim.',
    esperado: [['Juros', 'rendimento do capital, calculado por período, pago ao fim.']] },
]

describe('conjunto-ouro dos cartões (precisão e cobertura)', () => {
  const chave = (f: string, v: string) => `${f}\u0001${v}`
  let gerados = 0, certos = 0, esperados = 0, achados = 0
  for (const caso of OURO) {
    const r = gera(caso.texto)
    const saida = new Set(r.cartoes.map((c) => chave(c.f, c.v)))
    const alvo = new Set(caso.esperado.map(([f, v]) => chave(f, v)))
    gerados += saida.size; esperados += alvo.size
    for (const k of saida) if (alvo.has(k)) certos++
    for (const k of alvo) if (saida.has(k)) achados++
    it(`${caso.nome}: gera exatamente o esperado`, () => {
      expect([...saida].filter((k) => !alvo.has(k)).map((k) => k.split('\u0001')[0])).toEqual([]) // nada a mais
      expect([...alvo].filter((k) => !saida.has(k)).map((k) => k.split('\u0001')[0])).toEqual([]) // nada a menos
    })
  }
  it('precisão e cobertura de 100 % neste conjunto (o conjunto é pequeno e escrito para as regras; use medir-cartoes.mjs com os seus resumos)', () => {
    expect(certos / gerados).toBeGreaterThanOrEqual(0.95)
    expect(achados / esperados).toBeGreaterThanOrEqual(0.95)
  })
})

describe('cartão de questão com o trecho do material', () => {
  it('acrescenta "Do seu material (fonte): trecho", curto', async () => {
    const { versoComMaterial } = await import('./material')
    expect(versoComMaterial('Gabarito: B', 'Resumo moeda', 'A Selic é a taxa básica.')).toBe('Gabarito: B\n\nDo seu material (Resumo moeda): A Selic é a taxa básica.')
    expect(versoComMaterial('Gabarito: B', 'x', '   ')).toBe('Gabarito: B')
    const longo = versoComMaterial('V', 'f', 'palavra '.repeat(100))
    expect(longo.length).toBeLessThan(340); expect(longo.endsWith('…')).toBe(true)
  })
})
