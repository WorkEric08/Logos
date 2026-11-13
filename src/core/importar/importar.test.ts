import { describe, expect, it } from 'vitest'
import { lerGabarito } from './gabarito'
import { paginasParaLinhas, type ItemPdf, type PaginaPdf } from './layout'
import { juntarLinhas, lerProva, tituloBonito } from './prova'

// PDFs de mentira: cada linha vira um item de texto na posição certa (x, y), como o leitor de PDF entrega.
const W = 595, H = 842
const item = (x: number, y: number, texto: string, w = texto.length * 5): ItemPdf => ({ x, y, w, texto })
/** Uma coluna de linhas de cima para baixo a partir de y0 (12 pt entre linhas). */
const coluna = (x: number, y0: number, linhas: string[]): ItemPdf[] => linhas.map((t, i) => item(x, y0 - i * 12, t, 235))
const pagina = (numero: number, itens: ItemPdf[]): PaginaPdf => ({ numero, largura: W, altura: H, itens })
const texto = (p: PaginaPdf[], o = {}) => paginasParaLinhas(p, o).map((l) => l.texto)

describe('layout: colunas, faixas e margens', () => {
  it('lê a coluna da esquerda inteira e depois a da direita', () => {
    const esq = coluna(28, 700, ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']), dir = coluna(312, 700, ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'])
    expect(texto([pagina(1, [...dir, ...esq])])).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'])
  })
  it('tira o cabeçalho e o rodapé', () => {
    const itens = [item(240, 790, 'BANCO DO BRASIL'), item(30, 41, 'GABARITO 1'), ...coluna(28, 700, ['meio', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze'])]
    expect(texto([pagina(1, itens)])).not.toContain('BANCO DO BRASIL')
    expect(texto([pagina(1, itens)])).not.toContain('GABARITO 1')
    expect(texto([pagina(1, itens)], { margens: false })).toContain('GABARITO 1')
  })
  it('tabela de largura inteira no meio: acima, a faixa e abaixo cada coluna no seu lugar', () => {
    const topoE = coluna(28, 760, ['E-alto-1', 'E-alto-2', 'E-alto-3']), topoD = coluna(312, 760, ['D-alto-1', 'D-alto-2', 'D-alto-3'])
    const faixa = [item(60, 600, 'Linha 1 da tabela larga', 300), item(60, 588, 'Linha 2 da tabela larga', 300)] // atravessa o corredor (x ≈ 297)
    const baixoE = coluna(28, 500, ['E-baixo-1', 'E-baixo-2', 'E-baixo-3', 'E-baixo-4']), baixoD = coluna(312, 500, ['D-baixo-1', 'D-baixo-2', 'D-baixo-3', 'D-baixo-4'])
    const t = texto([pagina(1, [...topoE, ...topoD, ...faixa, ...baixoE, ...baixoD])])
    expect(t.indexOf('E-alto-3')).toBeLessThan(t.indexOf('D-alto-1'))
    expect(t.indexOf('D-alto-3')).toBeLessThan(t.indexOf('Linha 1 da tabela larga'))
    expect(t.indexOf('Linha 2 da tabela larga')).toBeLessThan(t.indexOf('E-baixo-1'))
    expect(t.indexOf('E-baixo-4')).toBeLessThan(t.indexOf('D-baixo-1'))
  })
  it('junta pedaços da mesma linha com espaço só onde há folga', () => {
    const p = pagina(1, [item(28, 700, 'Em', 10), item(40, 700, 'outubro', 35), item(75, 700, ',', 3)])
    expect(texto([p])).toEqual(['Em outubro,'])
  })
})

describe('prova: questões', () => {
  const q = (n: number, enun: string[], alts: string[]) => [String(n), ...enun, ...alts.map((a, i) => `(${'ABCDE'[i]}) ${a}`)]
  const pg = (...blocos: string[][]) => pagina(1, coluna(28, 740, blocos.flat()))
  const ler = (...blocos: string[][]) => lerProva(paginasParaLinhas([pg(...blocos)]))

  it('lê número, enunciado e cinco alternativas', () => {
    const r = ler(q(1, ['Qual é a capital', 'do Brasil?'], ['Rio', 'Brasília', 'São Paulo', 'Salvador', 'Recife']), q(2, ['Quanto é 2 + 2?'], ['1', '2', '3', '4', '5']))
    expect(r.questoes.map((x) => x.numero)).toEqual([1, 2])
    expect(r.questoes[0].enunciado).toBe('Qual é a capital do Brasil?')
    expect(r.questoes[0].alternativas).toEqual({ A: 'Rio', B: 'Brasília', C: 'São Paulo', D: 'Salvador', E: 'Recife' })
    expect(r.questoes[1].avisos).toEqual([])
  })
  it('junta a alternativa que quebra em duas linhas e desfaz a hifenização', () => {
    const r = ler(['1', 'Enunciado', '(A) uma resposta muito com-', 'prida', '(B) b', '(C) c', '(D) d', '(E) e'])
    expect(r.questoes[0].alternativas.A).toBe('uma resposta muito comprida')
  })
  it('alternativas na mesma linha são separadas', () => {
    const r = lerProva(paginasParaLinhas([pagina(1, coluna(28, 740, ['1', 'Analise.', '(A) I, apenas. (B) II, apenas. (C) I e II. (D) II e III. (E) Todas.']))]))
    expect(r.questoes[0].alternativas).toEqual({ A: 'I, apenas.', B: 'II, apenas.', C: 'I e II.', D: 'II e III.', E: 'Todas.' })
  })
  it('numeração de linhas do texto (5, 10, 15) não vira questão', () => {
    const r = ler(['Texto base com linhas numeradas', '5', 'mais texto', '10', 'mais texto', '15'], q(1, ['Pergunta'], ['a', 'b', 'c', 'd', 'e']), q(2, ['Outra'], ['a', 'b', 'c', 'd', 'e']))
    expect(r.questoes.map((x) => x.numero)).toEqual([1, 2])
  })
  it('número solto dentro de uma tabela (fora da margem) não corta a questão', () => {
    const itens = [...coluna(28, 740, ['1', 'Veja a tabela.']), item(150, 704, '2', 6), ...coluna(28, 692, ['(A) a', '(B) b', '(C) c', '(D) d', '(E) e'])]
    const r = lerProva(paginasParaLinhas([pagina(1, itens)]))
    expect(r.questoes).toHaveLength(1)
    expect(Object.keys(r.questoes[0].alternativas)).toHaveLength(5)
  })
  it('título em maiúsculas vira matéria; CONHECIMENTOS BÁSICOS vira bloco', () => {
    const r = ler(['CONHECIMENTOS BÁSICOS', 'LÍNGUA PORTUGUESA'], q(1, ['x'], ['a', 'b', 'c', 'd', 'e']), ['MATEMÁTICA FINANCEIRA'], q(2, ['y'], ['a', 'b', 'c', 'd', 'e']))
    expect(r.questoes.map((x) => [x.materia, x.bloco])).toEqual([['Língua Portuguesa', 'B'], ['Matemática Financeira', 'B']])
  })
  it('texto-base antes das questões vale para o intervalo "questões 1 a 2"', () => {
    const r = ler(['Leia o texto para responder às questões 1 a 2.', 'Era uma vez um texto.'], q(1, ['a'], ['a', 'b', 'c', 'd', 'e']), q(2, ['b'], ['a', 'b', 'c', 'd', 'e']), ['Texto de outra parte.'], q(3, ['c'], ['a', 'b', 'c', 'd', 'e']))
    expect(r.questoes[0].apoio).toContain('Era uma vez um texto')
    expect(r.questoes[1].apoio).toContain('Era uma vez um texto')
    expect(r.questoes[2].apoio).toBe('Texto de outra parte.')
  })
  it('questão que falta no meio vira aviso e não perde as seguintes', () => {
    const r = ler(q(1, ['a'], ['a', 'b', 'c', 'd', 'e']), q(3, ['c'], ['a', 'b', 'c', 'd', 'e']), q(4, ['d'], ['a', 'b', 'c', 'd', 'e']))
    expect(r.questoes.map((x) => x.numero)).toEqual([1, 3, 4]); expect(r.avisos.join(' ')).toContain('faltam as questões 2')
  })
  it('alternativas faltando e menção a figura geram aviso na questão', () => {
    const r = ler(q(1, ['Veja a figura abaixo.'], ['a', 'b', 'c']))
    expect(r.questoes[0].avisos.join(' ')).toMatch(/3 alternativa|só 3/); expect(r.questoes[0].avisos.join(' ')).toContain('figura')
  })
  it('PDF sem texto (escaneado) avisa em vez de inventar', () => {
    const r = lerProva(paginasParaLinhas([pagina(1, [])]))
    expect(r.questoes).toEqual([]); expect(r.avisos[0]).toContain('escaneado')
  })
  it('guarda a região da página de cada questão (para recortar a imagem)', () => {
    const r = ler(q(1, ['a'], ['a', 'b', 'c', 'd', 'e']))
    expect(r.questoes[0].regioes).toHaveLength(1); expect(r.questoes[0].regioes[0].yTopo).toBeGreaterThan(r.questoes[0].regioes[0].yBase)
  })
  it('funções auxiliares', () => {
    expect(juntarLinhas('ruí-', 'dos')).toBe('ruídos'); expect(juntarLinhas('ex-', 'Aluno')).toBe('ex- Aluno'); expect(juntarLinhas('a', 'b')).toBe('a b')
    expect(tituloBonito('LÍNGUA PORTUGUESA')).toBe('Língua Portuguesa'); expect(tituloBonito('MATEMÁTICA DE ENSINO')).toBe('Matemática de Ensino')
  })
})

describe('gabarito', () => {
  const linhas = (...l: string[]) => paginasParaLinhas([pagina(1, coluna(28, 700, l))], { colunas: false, margens: false })
  it('lê "1 - C  2 - D …" e a questão anulada', () => {
    const g = lerGabarito(linhas('GABARITO 1', '1 - C 2 - D 3 - ANULADA 4 - A 5 - B'))
    expect(g.respostas).toEqual({ 1: 'C', 2: 'D', 3: null, 4: 'A', 5: 'B' })
  })
  it('vários gabaritos no arquivo: vale o primeiro e avisa', () => {
    const g = lerGabarito(linhas('GABARITO 1', '1 - A 2 - B 3 - C 4 - D 5 - E', 'GABARITO 2', '1 - B 2 - C 3 - D 4 - E 5 - A'))
    expect(g.respostas[1]).toBe('A'); expect(g.avisos.join(' ')).toContain('2 gabaritos')
    expect(lerGabarito(linhas('GABARITO 1', '1 - A 2 - B 3 - C 4 - D 5 - E', 'GABARITO 2', '1 - B 2 - C 3 - D 4 - E 5 - A'), { secao: 2 }).respostas[1]).toBe('B')
  })
  it('formato sem traço', () => { expect(lerGabarito(linhas('1 A 2 B 3 C 4 D 5 E 6 A')).respostas[6]).toBe('A') })
  it('arquivo sem nada legível avisa', () => { expect(lerGabarito(linhas('texto qualquer')).avisos[0]).toContain('nenhuma resposta') })
})
