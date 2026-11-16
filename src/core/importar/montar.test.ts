import { describe, expect, it } from 'vitest'
import { linhasParaParagrafos, sugerirCartoes, textoParaParagrafos } from './cartoes'
import type { Linha } from './layout'
import { detectarProva, montarQuestoes, slug, type MetaProva } from './montar'
import type { QuestaoLida } from './prova'

const meta: MetaProva = { chave: 'bb-2021', rotulo: 'BB 2021', ano: 2021, bancoId: 'bb', bancoNome: 'BB' }
const lida = (n: number, o: Partial<QuestaoLida> = {}): QuestaoLida => ({
  numero: n, materia: 'Língua Portuguesa', bloco: 'B', apoio: '', enunciado: `Enunciado ${n}?`, alternativas: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, pagina: 1, regioes: [], avisos: [], ...o,
})

describe('nome do arquivo → prova', () => {
  it('banco, ano e o resto', () => {
    const m = detectarProva('BB_2021_Escriturario_AgenteComercial_prova.pdf')
    expect(m).toMatchObject({ chave: 'bb-2021', ano: 2021, bancoNome: 'BB' }); expect(m.rotulo).toBe('BB 2021 · Escriturario Agente Comercial')
  })
  it('banco de duas palavras e mês na frente do ano', () => {
    expect(detectarProva('Banco da Amazonia 2024 prova.pdf').chave).toBe('banco-da-amazonia-2024')
  })
  it('sem ano usa o ano de hoje; sem nome útil vira "Prova"', () => {
    expect(detectarProva('prova.pdf', new Date(2030, 0, 1))).toMatchObject({ chave: 'prova-2030' })
  })
  it('slug tira acento e símbolos', () => { expect(slug('Caixa Econômica & Cia!')).toBe('caixa-economica-cia') })
})

describe('montar questões do app', () => {
  it('gera ids por conteúdo, copia o gabarito e junta o texto-base', () => {
    const r = montarQuestoes([lida(1, { apoio: 'Texto base.' }), lida(2)], { 1: 'C', 2: 'A' }, meta)
    expect(r.questoes).toHaveLength(2)
    expect(r.questoes[0]).toMatchObject({ s: 'bb-2021', n: 1, y: 2021, g: 'C', m: 'Língua Portuguesa' })
    expect(r.questoes[0].id).toMatch(/^u/); expect(r.questoes[0].id).not.toBe(r.questoes[1].id)
    expect(Object.values(r.bases)).toEqual(['Texto base.']); expect(r.questoes[0].b).toBeTruthy(); expect(r.questoes[1].b).toBe('')
  })
  it('importar de novo dá os mesmos ids (progresso não se perde, nada duplica)', () => {
    const a = montarQuestoes([lida(1)], { 1: 'A' }, meta), b = montarQuestoes([lida(1)], { 1: 'A' }, meta)
    expect(a.questoes[0].id).toBe(b.questoes[0].id)
  })
  it('não entra: sem gabarito, anulada, poucas alternativas, letra inexistente', () => {
    const r = montarQuestoes([lida(1), lida(2), lida(3, { alternativas: { A: 'só uma' } }), lida(4, { alternativas: { A: 'a', B: 'b' } }), lida(5)], { 2: null, 3: 'A', 4: 'E', 5: 'B' }, meta)
    expect(r.questoes.map((q) => q.n)).toEqual([5])
    expect(Object.fromEntries(r.ignoradas.map((x) => [x.numero, x.motivo]))).toMatchObject({ 1: 'sem gabarito', 2: 'anulada', 3: 'faltam alternativas ou enunciado' })
    expect(r.ignoradas.find((x) => x.numero === 4)!.motivo).toContain('letra E')
  })
  it('só as questões escolhidas na prévia', () => {
    expect(montarQuestoes([lida(1), lida(2)], { 1: 'A', 2: 'B' }, meta, new Set([2])).questoes.map((q) => q.n)).toEqual([2])
  })
  it('aviso de figura marca a questão para conferir (f = 1)', () => {
    expect(montarQuestoes([lida(1, { avisos: ['menciona figura, gráfico ou tabela: confira a imagem'] })], { 1: 'A' }, meta).questoes[0].f).toBe(1)
  })
})

describe('cartões sem IA', () => {
  it('"Termo: definição", "Termo – definição" e pergunta/resposta', () => {
    const r = sugerirCartoes([
      'Juros simples: o rendimento é calculado só sobre o capital inicial, em cada período.',
      'Liquidez – facilidade de transformar um ativo em dinheiro sem perder valor.',
      'P: Qual a sigla do Banco Central? R: BACEN.',
    ])
    expect(r.cartoes.map((c) => c.tipo)).toEqual(['definicao', 'definicao', 'pergunta'])
    expect(r.cartoes[0]).toMatchObject({ f: 'Juros simples' }); expect(r.cartoes[2]).toMatchObject({ f: 'Qual a sigla do Banco Central?', v: 'BACEN.' })
  })
  it('"X é …" vira "O que é X?"; pronome solto não', () => {
    const r = sugerirCartoes(['A inflação é o aumento generalizado e contínuo dos preços em uma economia.', 'Isso é apenas uma frase qualquer sem termo definido aqui.'])
    expect(r.cartoes).toHaveLength(1); expect(r.cartoes[0].f).toBe('O que é A inflação?'); expect(r.sobraram).toBe(1)
  })
  it('título de markdown + parágrafo; lacuna com negrito', () => {
    const r = sugerirCartoes(['# Selic', 'Taxa básica de juros da economia brasileira, definida pelo Copom a cada 45 dias.', 'O órgão que define a Selic é o **Copom**, do Banco Central do Brasil.'])
    expect(r.cartoes.map((c) => c.tipo)).toEqual(['titulo', 'lacuna']); expect(r.cartoes[1].f).toContain('_____'); expect(r.cartoes[1].v).toBe('Copom')
  })
  it('título seguido de um parágrafo que já é uma definição: o parágrafo vale por si, o título não ganha um cartão errado (F3)', () => {
    const r = sugerirCartoes(['# Juros', 'Juros simples: o rendimento é calculado só sobre o capital inicial, em cada período.'])
    expect(r.cartoes.map((c) => [c.tipo, c.f])).toEqual([['definicao', 'Juros simples']])
  })
  it('não repete a mesma frente e respeita o tamanho', () => {
    const longo = 'x'.repeat(2000)
    const r = sugerirCartoes(['Termo: ' + longo, 'Termo: outra definição bem longa aqui para repetir a frente'])
    expect(r.cartoes).toHaveLength(1); expect(r.cartoes[0].v.length).toBeLessThanOrEqual(1200)
  })
  it('endereço e horário não viram definição', () => {
    expect(sugerirCartoes(['https://exemplo.com: página inicial do site oficial'], ).cartoes).toHaveLength(0)
  })
  it('texto puro: parágrafos por linha em branco e listas', () => {
    expect(textoParaParagrafos('# Título\n\nlinha 1\nlinha 2\n\n- item a\n- item b')).toEqual(['# Título', 'linha 1 linha 2', '- item a', '- item b'])
  })
  it('linhas de PDF: quebra por espaço vertical maior', () => {
    const L = (texto: string, y: number): Linha => ({ texto, x0: 28, x1: 200, y, pagina: 1, coluna: 0 })
    expect(linhasParaParagrafos([L('Primeira linha do', 700), L('parágrafo um.', 688), L('Segundo parágrafo.', 660)])).toEqual(['Primeira linha do parágrafo um.', 'Segundo parágrafo.'])
  })
})
