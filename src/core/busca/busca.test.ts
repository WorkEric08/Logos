import { describe, expect, it } from 'vitest'
import { extrairConsulta, termosDaConsulta } from './consulta'
import { radical, radicais } from './radical'
import { palavras, semAcento } from './texto'
import { dividirEmTrechos, MAX_TRECHO, trechoDestacado } from './trecho'
import { LIMITES, prepararMaterial } from '../material'

describe('texto', () => {
  it('tira acento e minúsculas; mantém os acentos quando pedido', () => {
    expect(semAcento('INFLAÇÃO Ótima')).toBe('inflacao otima'); expect(palavras('Inflação, juros!')).toEqual(['inflacao', 'juros']); expect(palavras('Inflação', true)).toEqual(['inflação'])
  })
  it('número com ponto de milhar vira um número só; ordinal não atrapalha', () => {
    expect(palavras('Lei 4.595/64, art. 5º')).toEqual(['lei', '4595', '64', 'art', '5'])
  })
})

describe('radical (Snowball português + plural -ões)', () => {
  it.each([
    ['banco', 'bancos'], ['taxa', 'taxas'], ['inflação', 'inflações'], ['questão', 'questões'], ['inflação', 'inflacao'], ['inflações', 'inflacoes'], ['aplicação', 'aplicações'],
    ['financeiro', 'financeira'], ['financeiro', 'financeiros'], ['simulado', 'simulados'], ['crédito', 'créditos'], ['cartão', 'cartões'], ['juro', 'juros'], ['responsabilidade', 'responsabilidades'],
  ])('"%s" e "%s" dão o mesmo radical', (a, b) => { expect(radical(a)).toBe(radical(b)) })
  it('palavras diferentes não se misturam', () => {
    expect(radical('banco')).not.toBe(radical('bancário') + 'x'); expect(radical('juros')).not.toBe(radical('selic')); expect(radical('taxa')).not.toBe(radical('tabela'))
  })
  it('curtas, números e siglas ficam como estão (sem acento)', () => { expect(radical('pix')).toBe('pix'); expect(radical('4595')).toBe('4595'); expect(radical('Copom'.toLowerCase())).toBe('copom') })
  it('o resultado não tem acento e radicais tiram as palavras vazias', () => {
    expect(radical('inflação')).not.toMatch(/[^\x00-\x7f]/); expect(radicais('o que é a inflação dos bancos')).toEqual([radical('inflação'), radical('bancos')])
  })
})

describe('consulta: do que a pessoa escreveu ao que se procura', () => {
  it.each([
    ['o que é Copom?', 'copom'], ['O que significa inflação', 'inflacao'], ['onde fala de poupança?', 'poupanca'], ['me explique, o que é a selic', 'a selic'], ['procure por consignado', 'consignado'],
    ['quero saber sobre lavagem de dinheiro', 'lavagem de dinheiro'], ['juros compostos', 'juros compostos'], ['definição de amortização', 'amortizacao'],
  ])('"%s" → "%s"', (texto, esperado) => { expect(extrairConsulta(texto)).toBe(esperado) })
  it('só o começo da pergunta dá consulta vazia', () => { expect(extrairConsulta('o que é?')).toBe(''); expect(termosDaConsulta('')).toEqual([]) })
  it('termos tiram as palavras vazias', () => { expect(termosDaConsulta('a selic e o copom')).toEqual(['selic', 'copom']) })
})

describe('trechos', () => {
  it('parágrafo pequeno fica inteiro; vazio some', () => { expect(dividirEmTrechos(['  curto  ', '', '   '])).toEqual(['curto']) })
  it('parágrafo grande é partido nas frases, sem passar do máximo', () => {
    const frase = 'Esta é uma frase de tamanho médio para o teste do corte. '
    const t = dividirEmTrechos([frase.repeat(40)], 300)
    expect(t.length).toBeGreaterThan(3); expect(t.every((x) => x.length <= 300)).toBe(true); expect(t.join(' ').replace(/\s+/g, ' ')).toContain('Esta é uma frase')
  })
  it('frase gigante sem pontuação é partida no espaço mais próximo, sem perder texto', () => {
    const t = dividirEmTrechos(['palavra '.repeat(500)], 200)
    expect(t.every((x) => x.length <= 200)).toBe(true); expect(t.join(' ').split(/\s+/).filter(Boolean).length).toBe(500)
  })
  it('o destaque cai nas palavras da consulta (inclusive plural/sem acento)', () => {
    const r = trechoDestacado('A inflação é o aumento dos preços. Os bancos acompanham as inflações.', ['inflacao'])
    expect(r.destaques.map((d) => r.texto.slice(d.inicio, d.fim))).toEqual(['inflação', 'inflações'])
  })
  it('texto longo: a janela fica onde as palavras aparecem e corta em fim de palavra', () => {
    const longo = 'palavra comum e sem graça. '.repeat(30) + 'Aqui a taxa Selic é definida pelo Copom. ' + 'palavra comum e sem graça. '.repeat(30)
    const r = trechoDestacado(longo, ['selic', 'copom'], 200)
    expect(r.texto.length).toBeLessThanOrEqual(215); expect(r.cortouInicio && r.cortouFim).toBe(true)
    expect(r.destaques.map((d) => r.texto.slice(d.inicio, d.fim))).toEqual(['Selic', 'Copom'])
    expect(/^\S/.test(r.texto) && /\S$/.test(r.texto)).toBe(true)
  })
  it('sem nenhuma palavra achada devolve o começo do texto', () => {
    const r = trechoDestacado('x'.repeat(30) + ' ' + 'y'.repeat(600), ['zzz'], 100)
    expect(r.destaques).toEqual([]); expect(r.texto.startsWith('xxx')).toBe(true); expect(MAX_TRECHO).toBeGreaterThan(300)
  })
})

describe('material: do arquivo para trechos', () => {
  const par = ['Primeiro parágrafo do resumo.', 'Segundo parágrafo do resumo.']
  it('gera material e trechos ligados por id, com o nome limpo', () => {
    const r = prepararMaterial('e1', 'Resumo_juros.final.pdf', 'pdf', par, 1000)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.material).toMatchObject({ e: 'e1', nome: 'Resumo juros.final', tipo: 'pdf', criado: 1000, trechos: 2 }); expect(r.trechos.map((t) => t.id)).toEqual([`${r.material.id}:0`, `${r.material.id}:1`])
      expect(r.trechos.every((t) => t.m === r.material.id && t.e === 'e1')).toBe(true)
    }
  })
  it('o id vem do conteúdo: o mesmo texto dá o mesmo id, em outro espaço dá outro', () => {
    const a = prepararMaterial('e1', 'a', 'texto', par), b = prepararMaterial('e1', 'outro nome', 'texto', par), c = prepararMaterial('e2', 'a', 'texto', par)
    expect(a.ok && b.ok && c.ok && a.material.id === b.material.id && a.material.id !== c.material.id).toBe(true)
  })
  it('sem texto, grande demais e trechos demais são recusados com mensagem', () => {
    const vazio = prepararMaterial('e', 'x', 'pdf', ['  ', ''])
    expect(!vazio.ok && vazio.erro).toMatch(/escaneado/)
    const gigante = prepararMaterial('e', 'x', 'texto', ['a'.repeat(100000)].concat(Array(Math.ceil(LIMITES.caracteres / 600)).fill('b'.repeat(600))))
    expect(!gigante.ok && gigante.erro).toMatch(/grande demais/)
    const muitos = prepararMaterial('e', 'x', 'texto', Array.from({ length: LIMITES.trechos + 1 }, (_, i) => `t${i}`))
    expect(!muitos.ok && muitos.erro).toMatch(/trechos demais/)
  })
})
