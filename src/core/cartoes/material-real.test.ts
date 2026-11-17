import { describe, expect, it } from 'vitest'
import { sugerirCartoes } from '../importar/cartoes'
import { gerarQuestoes } from '../questoes/gerar'
import { limitesDaFrase, perturbar } from '../questoes/numeros'
import { rngDe } from '../questoes/distratores'
import { lerConceito, primeiraFrase } from './conceito'
import { lacunasDeFrases } from './lacunas'
import { avaliar, ehListaDeNomes, rotuloValido } from './qualidade'
import { acharSiglas, formaASigla } from './siglas'

// Medido com um manual científico real (PDF de 24 páginas sobre o autismo, da Sociedade Brasileira de Pediatria): antes destas regras só ~40 % dos cartões e ~20 % das questões
// eram aproveitáveis (meta: 80 % e 70 %). Cada teste abaixo é um defeito de verdade, em miniatura.

describe('"X é …" só é conceito quando define', () => {
  it('define: "O pediatra é a figura central…" → "O que é o pediatra?" (artigo em minúscula, só a 1ª frase no verso)', () => {
    const c = lerConceito('O pediatra é a figura central com atuação decisiva para dar início ao processo terapêutico. Geralmente o paciente demanda tratamento psicofarmacológico para controlar sintomas.')!
    expect(c.frente).toBe('O que é o pediatra?')
    expect(c.verso).toBe('O pediatra é a figura central com atuação decisiva para dar início ao processo terapêutico.')
  })
  it('"é" + adjetivo ou particípio NÃO define: "A avaliação formal é fundamental…", "O TEA é causado por…"', () => {
    expect(lerConceito('A avaliação formal do Desenvolvimento Neuropsicomotor é fundamental e indispensável e faz parte da consulta pediátrica.')).toBeNull()
    expect(lerConceito('O TEA é causado por uma combinação de fatores genéticos e fatores ambientais, como mostram os estudos.')).toBeNull()
  })
  it('sujeito que é pedaço de frase não vira cartão ("Não é surpreendente…", "Existe uma variedade de testes que são…", "Os principais pilares são…")', () => {
    expect(lerConceito('Não é surpreendente, portanto, que a busca por sinais precoces continua sendo uma área de investigação.')).toBeNull()
    expect(lerConceito('Existe uma variedade de testes que são utilizados para o diagnóstico, alguns baseados em informação dos pais.')).toBeNull()
    expect(lerConceito('Os principais pilares são a família, a equipe de educação e a de saúde para a condução das crianças.')).toBeNull()
  })
  it('uma definição de glossário continua valendo, com "significa", "consiste em" e artigo', () => {
    expect(lerConceito('A inflação é o aumento generalizado e contínuo dos preços em uma economia.')!.frente).toBe('O que é a inflação?')
    expect(lerConceito('O ABA consiste em um programa comportamental amplamente utilizado e reconhecido.')!.frente).toBe('O ABA: o que significa?')
    expect(lerConceito('M-CHAT é uma entrevista estruturada realizada com os pais e utilizada de 16 a 30 meses.')!.frente).toBe('O que é M-CHAT?')
  })
  it('primeiraFrase não corta em abreviações ("n. 13.438", "ex.", "Dr.")', () => {
    expect(primeiraFrase('A Lei n. 13.438 obriga a avaliação. Depois vem outra frase.')).toBe('A Lei n. 13.438 obriga a avaliação.')
    expect(primeiraFrase('Veja o Dr. Silva no ex. anterior. Fim.')).toBe('Veja o Dr. Silva no ex. anterior.')
  })
})

describe('siglas: as letras têm de ser os começos das palavras', () => {
  it('nomes de pessoas com o estado entre parênteses NÃO são siglas ("Santos Vilela (SP)")', () => {
    expect(acharSiglas('Maria Marluce dos Santos Vilela (SP)')).toEqual([])
    // (um nome que por acaso forma a sigla, como "Reverbel da Silveira" = RS, só é barrado pela higiene, que tira os créditos: ver higiene.test.ts)
    expect(acharSiglas('Fábio Ancona Lopez (SP) Julia Dutra Rossetto (RJ)')).toEqual([])
  })
  it('as siglas de verdade continuam: TEA, SBP, ASHA (com hífen), ICMS (pulando "sobre/de/e"), BACEN (BA+CEN)', () => {
    expect(acharSiglas('O Transtorno do Espectro do Autismo (TEA) é um transtorno do desenvolvimento.')[0]).toEqual({ sigla: 'TEA', expansao: 'Transtorno do Espectro do Autismo' })
    expect(acharSiglas('a Sociedade Brasileira de Pediatria (SBP) orienta')[0].sigla).toBe('SBP')
    expect(acharSiglas('a American Speech-Language-Hearing Association (ASHA) chama atenção')[0].expansao).toBe('American Speech-Language-Hearing Association')
    expect(acharSiglas('o Imposto sobre Circulação de Mercadorias e Serviços (ICMS) incide')[0].sigla).toBe('ICMS')
    expect(acharSiglas('O Banco Central do Brasil (BACEN) regula as instituições.')[0].sigla).toBe('BACEN')
  })
  it('formaASigla: ordem, ligações e sobra no fim', () => {
    expect(formaASigla('CSC', ['Caderneta', 'de', 'Saúde', 'da', 'Criança'])).toBe(true)
    expect(formaASigla('CSC', ['Saúde', 'Criança'])).toBe(false)
    expect(formaASigla('ADOS', ['Autism', 'Diagnostic', 'Observation', 'Schedule'])).toBe(true)
    expect(formaASigla('SP', ['Santos', 'Vilela'])).toBe(false)
  })
})

describe('qualidade: o que nunca vira cartão', () => {
  const def = (f: string, v: string) => avaliar({ f, v, tipo: 'definicao', origem: '' })
  it('rótulo que não é termo: aviso, instrução, frase com "-se", pedaço cortado', () => {
    for (const r of ['Atenção', 'Fazer um fluxograma', 'Deve-se identificar possíveis fatores de risco para TEA', 'co para TEA', 'nais adaptadas para crianças com TEA', 'Acesso à']) expect(rotuloValido(r), r).toBe(false)
    for (const r of ['Hiporresponsividade', 'Baixa energia/fraqueza', '“Coaching Parental”', 'Modelo Denver de Intervenção Precoce para Crianças Autistas', 'Postergação diagnóstica']) expect(rotuloValido(r), r).toBe(true)
  })
  it('verso que termina no meio de uma palavra (texto cortado do PDF) é barrado', () => {
    expect(def('Baixa energia', 'parece ter músculos fracos, não consegue carregar objetos pesa-').descartar).toMatch(/meio de uma palavra/)
  })
  it('verso só com sublinhados (linha para preencher) ou só com um endereço da internet é barrado', () => {
    expect(def('Pontuação Total', '__________________').descartar).toMatch(/não tem conteúdo/)
    expect(def('Acesso à Escala', '• http://www.mchatscreen.com').descartar).toMatch(/endereço/)
  })
  it('verso que é lista de nomes de pessoas (créditos) é barrado, e uma definição comum não', () => {
    expect(ehListaDeNomes('Adriana Auzier Loureiro, Ana Márcia Guimarães Alves, João Coloriano Rego Barros')).toBe(true)
    expect(ehListaDeNomes('Livio Francisco da Silva Chaves')).toBe(true)
    expect(ehListaDeNomes('parece ter músculos fracos, não consegue carregar objetos pesados')).toBe(false)
    expect(def('Secretário', 'Livio Francisco da Silva Chaves').descartar).toMatch(/lista de nomes/)
    expect(def('Escola', 'Adequações escolares em relação ao conteúdo e planejamento pedagógico.').descartar).toBeUndefined()
  })
  it('lista que começa num pedaço de frase ("se não alcançou os marcos:") e número que começa no meio da frase são barrados', () => {
    expect(avaliar({ f: 'se não alcançou os marcos:\n• a\n• _____', v: 'b', tipo: 'lista', origem: '' }).descartar).toMatch(/pedaço de frase/)
    expect(avaliar({ f: 'temente identificados entre os 12 e _____ de idade.', v: '24 meses', tipo: 'numero', origem: '' }).descartar).toMatch(/começa no meio/)
  })
})

describe('lacunas em números, frase por frase', () => {
  const par = 'Estima-se que em torno de 30% dos casos apresentam deficiência intelectual. O TEA é também frequentemente associado a outros transtornos psiquiátricos. Aos 12 meses de idade já aparecem sinais como o manuseio atípico de objetos.'
  it('um parágrafo comprido rende uma lacuna por frase que tem número', () => {
    const c = lacunasDeFrases(par)!
    expect(c.map((x) => x.v)).toEqual(['30%', '12 meses'])
    expect(c[0].f).toBe('Estima-se que em torno de _____ dos casos apresentam deficiência intelectual.')
    expect(c[0].origem).toBe(par)
  })
  it('frase que depende do que veio antes ("Esse aumento…", "Por outro lado…") não vira cartão', () => {
    expect(lacunasDeFrases('Esse aumento chegou a 58% em 2014 entre as crianças avaliadas no período.')).toBeNull()
    expect(lacunasDeFrases('Por outro lado, a prevalência chegou a 92% no segundo estudo realizado.')).toBeNull()
  })
  it('o título da seção logo acima dá o assunto da frase', () => {
    const c = lacunasDeFrases('A sensibilidade da última versão foi de 65% e a especificidade 81%.', 'GARS Gilliam Autism Rating Scale')!
    expect(c[0].f).toBe('GARS Gilliam Autism Rating Scale: A sensibilidade da última versão foi de _____ e a especificidade 81%.')
  })
  it('no máximo 3 por parágrafo', () => {
    const muitas = [...Array(6)].map((_, i) => `A fase ${i + 1} dura ${10 + i} dias no calendário do projeto todo.`).join(' ')
    expect(lacunasDeFrases(muitas)).toHaveLength(3)
  })
})

describe('questões numéricas respeitam a faixa da frase', () => {
  it('"entre 12 e _____": as erradas são MAIORES que 12 (nada de "12 meses" nem "10 meses")', () => {
    const lim = limitesDaFrase('Alterações entre 12 e _____ têm sido propostas como marcadores.')
    expect(lim).toEqual({ acima: 12 })
    const erradas = perturbar('24 meses', rngDe('faixa'), lim)!
    expect(erradas).toHaveLength(4)
    for (const e of erradas) expect(parseInt(e)).toBeGreaterThan(12)
  })
  it('"dos 18-_____" e "de 16 a _____" também; "_____ e 30" limita por cima', () => {
    expect(limitesDaFrase('dos 18-_____ os sinais já estão evidentes')).toEqual({ acima: 18 })
    expect(limitesDaFrase('crianças de 16 a _____ de vida')).toEqual({ acima: 16 })
    expect(limitesDaFrase('entre _____ e 30 meses')).toEqual({ abaixo: 30 })
    expect(limitesDaFrase('aos _____ de idade')).toEqual({})
    for (const e of perturbar('20 meses', rngDe('x'), { abaixo: 30 }) ?? []) expect(parseInt(e)).toBeLessThan(30)
  })
})

// um trecho do manual (resumido) como o app o recebe depois de ler o PDF: com os defeitos que sobram mesmo depois da leitura
const MANUAL = [
  'Transtorno do Espectro do Autismo',
  'O Transtorno do Espectro do Autismo (TEA) é um transtorno do desenvolvimento neurológico, caracterizado por dificuldades de comunicação e interação social.',
  'Estima-se que em torno de 30% dos casos apresentam deficiência intelectual. O TEA é também frequentemente associado a outros transtornos psiquiátricos e médicos.',
  'A Sociedade Brasileira de Pediatria (SBP) orienta que toda criança seja triada entre 18 e 24 meses de idade para o TEA.',
  'O pediatra é a figura central com atuação potencialmente decisiva para dar início ao processo terapêutico do paciente com TEA.',
  'A avaliação formal do Desenvolvimento Neuropsicomotor é fundamental e indispensável e faz parte da consulta pediátrica.',
  'Escola: Adequações escolares em relação ao conteúdo e planejamento pedagógico, inclusão escolar com possibilidade de monitor individual.',
  'Hiporresponsividade: parece não notar quando o rosto e mãos estão sujos; não responde quando o nome é chamado, apesar da audição estar boa.',
  'Sensibilidade gustativa/olfativa: come apenas alguns sabores; escolhe alimentos pela textura; evita alguns sabores e cheiros comuns.',
  'Procura sensorial/distraibilidade: fica muito excitado durante atividades com movimento; pula de uma atividade para outra; toca pessoas ou objetos.',
  'Baixa energia/fraqueza: parece ter músculos fracos, não consegue carregar objetos pesados, tem preensão fraca, etc.',
  'Atenção: Sim/Não foram substituídos por Passa/Falha.',
  'Fazer um fluxograma: Criança com atraso do DNPM OU MCHAT-R alterado • orientar os pais • reavaliar em um mês',
  'Pontuação Total: __________________',
  'Secretário: Livio Francisco da Silva Chaves',
  'Conselho Científico: Adriana Auzier Loureiro, Ana Márcia Guimarães Alves, Ana Maria Costa da Silva Lopes, João Coloriano Rego Barros',
  '1. Bailey A, Le Couteur A, Gottesman I, et al. Autism as a strongly genetic disorder. Psychol Med. 1995;25(1):63–77.',
  '2. Sandin S, Lichtenstein P, Kuja-Halkola R, et al. The familial risk of autism. JAMA. 2014;311(17):1770–7.',
  '3. Mandy W, Lai M-C. The role of the environment in autism. J Child Psychol Psychiatry. 2016;57(3):271–92.',
  '4. Zwaigenbaum L, Bauman ML, Stone WL, et al. Early identification of autism spectrum disorder. Pediatrics. 2015;136:S10-40.',
  'Paulo Cesar Koch Nogueira (SP)', 'Emanuel Sávio Cavalcanti Sarinho (PE)', 'Joel Alves Lamounier (MG)', 'Fábio Ancona Lopez (SP)',
]

describe('conjunto-ouro do material real (manual científico em miniatura)', () => {
  const r = sugerirCartoes(MANUAL)
  const frentes = r.cartoes.map((c) => c.f)
  const tudo = r.cartoes.map((c) => `${c.f} ${c.v}`).join('\n')

  it('gera o que presta: siglas, números, termos definidos e o conceito do pediatra', () => {
    expect(frentes).toContain('O que significa a sigla TEA?')
    expect(frentes).toContain('Qual é a sigla de Sociedade Brasileira de Pediatria?')
    expect(frentes).toContain('Estima-se que em torno de _____ dos casos apresentam deficiência intelectual.')
    expect(frentes).toContain('O que é o pediatra?')
    expect(frentes).toEqual(expect.arrayContaining(['Escola', 'Hiporresponsividade', 'Baixa energia/fraqueza']))
  })
  it('NÃO gera o que atrapalha: referências, créditos, avisos, instruções, linhas em branco, frase "é fundamental"', () => {
    expect(tudo).not.toMatch(/Bailey|Sandin|Psychol|JAMA|Pediatrics/)
    expect(tudo).not.toMatch(/Nogueira|Sarinho|Lamounier|Lopez|Livio|Loureiro|Silva Chaves/)
    expect(frentes).not.toContain('Atenção')
    expect(frentes).not.toContain('Fazer um fluxograma')
    expect(frentes).not.toContain('Pontuação Total')
    expect(frentes.join('\n')).not.toMatch(/avaliação formal/)
    expect(tudo).not.toMatch(/sigla (SP|PE|MG|RS)\b/)
  })
  it('o que foi ignorado é dito (nada some em silêncio) e não entra na conta dos parágrafos', () => {
    expect(r.ignorados).toBeGreaterThanOrEqual(8)
    expect(r.motivosIgnorados.join(' ')).toMatch(/referências/)
    expect(r.paragrafos).toBe(MANUAL.length - r.ignorados)
  })
  it('nenhum cartão sai com o artigo em maiúscula na frente ("O que é O TEA?") nem com verso de parágrafo inteiro', () => {
    for (const c of r.cartoes) { expect(c.f).not.toMatch(/^O que (?:é|são) (?:O|A|Os|As) /); expect(c.v.length).toBeLessThan(450) }
  })

  const g = gerarQuestoes(MANUAL, { id: 'Mmanual', nome: 'Manual TEA' }, { ano: 2026 })
  it('as questões geradas: sem referências nem créditos, sem termo com artigo, definições erradas com a mesma "cara" da certa', () => {
    const textos = g.questoes.flatMap(({ q }) => [q.e, ...Object.values(q.o)]).join('\n')
    expect(textos).not.toMatch(/Bailey|Sandin|Nogueira|Sarinho|Livio/)
    for (const { q, tipo } of g.questoes.filter((x) => x.tipo === 'definicao')) {
      const certaMinuscula = /^[a-zà-ÿ]/.test(q.o[q.g])
      for (const t of Object.values(q.o)) expect(/^[a-zà-ÿ]/.test(t), `${tipo}: ${t}`).toBe(certaMinuscula)
    }
    for (const { q } of g.questoes) expect(q.e).not.toMatch(/definição de "(?:O|A) /)
    expect(g.questoes.length).toBeGreaterThanOrEqual(5)
  })
})
