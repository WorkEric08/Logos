import { describe, expect, it } from 'vitest'
import { linhasParaParagrafos } from './cartoes'
import { itensRepetidos, MIN_CITACOES, paginasParaLinhas, removerCitacoes, type ItemPdf, type Linha, type PaginaPdf } from './layout'

// Defeitos reais achados lendo um manual científico em PDF (24 páginas, duas colunas, números de citação, cabeçalho e rodapé): cada teste aqui reproduz um deles em miniatura.
const W = 595, H = 842
const item = (x: number, y: number, texto: string, w = texto.length * 5, h = 10.5): ItemPdf => ({ x, y, w, texto, h })
const pagina = (numero: number, itens: ItemPdf[]): PaginaPdf => ({ numero, largura: W, altura: H, itens })
const coluna = (x: number, y0: number, linhas: string[]): ItemPdf[] => linhas.map((t, i) => item(x, y0 - i * 15, t, 235))
const textos = (p: PaginaPdf[], o = {}) => paginasParaLinhas(p, o).map((l) => l.texto)
const linha = (texto: string, y: number, pagina = 1, coluna: 0 | 1 = 0, largura = 235): Linha => ({ texto, x0: 57, x1: 57 + largura, y, pagina, coluna })

describe('números de citação (sobrescritos)', () => {
  // o 2º item é pequeno (6 pt) e fica uns 3 pt acima da linha, como nos artigos científicos
  const sup = (x: number, y: number, t: string) => item(x, y + 3.4, t, t.length * 3.5, 6.1)

  it('tira os sobrescritos de só dígitos, vírgula e traço quando o documento tem várias citações', () => {
    const corpo = [...Array(8)].map((_, i) => item(57, 500 - i * 15, 'linha comum do corpo do texto', 150))
    const itens = [item(57, 700, 'sua exploração visual', 100), sup(157, 700, '2'), item(161, 700, '.', 3), ...corpo, ...[...Array(MIN_CITACOES)].map((_, i) => sup(57 + i * 20, 600 - i * 15, '3–5'))]
    const r = removerCitacoes([pagina(1, itens)])
    expect(r.removidas).toBe(MIN_CITACOES + 1)
    expect(r.paginas[0].itens.map((i) => i.texto).filter((t) => !t.startsWith('linha comum'))).toEqual(['sua exploração visual', '.'])
    expect(r.paginas[0].itens.some((i) => i.h === 6.1)).toBe(false)
  })
  it('sem citações suficientes (um "m²" solto) deixa tudo como está', () => {
    const itens = [item(57, 700, 'a área é de 30 m', 60), sup(117, 700, '2'), sup(200, 650, '3'), ...[...Array(8)].map((_, i) => item(57, 500 - i * 15, 'linha comum do corpo do texto', 150))]
    const r = removerCitacoes([pagina(1, itens)])
    expect(r.removidas).toBe(0)
    expect(r.paginas[0].itens).toHaveLength(11)
  })
  it('número do tamanho do texto nunca é citação, e letra pequena também não', () => {
    const itens = [item(57, 700, '12', 20, 10.5), ...[...Array(8)].map((_, i) => item(57, 650 - i * 15, 'texto de corpo normal', 100)), ...[...Array(MIN_CITACOES)].map((_, i) => sup(300, 500 - i * 15, 'etc'))]
    expect(removerCitacoes([pagina(1, itens)]).removidas).toBe(0)
  })
  it('depois de tirar o sobrescrito não sobra espaço antes do ponto, e a palavra partida com hífen se junta', () => {
    const itens = [
      item(57, 700, 'o autismo', 60), sup(117, 700, '12,13'), item(130, 700, '.', 3),
      item(57, 685, 'sugerindo um forte com', 100), item(157, 685, '-', 4), sup(165, 685, '14'),
      item(57, 670, 'ponente genético na etiologia do autismo.', 200),
      ...[...Array(8)].map((_, i) => item(57, 560 - i * 15, 'linha comum do corpo do texto', 150)),
      ...[...Array(MIN_CITACOES)].map((_, i) => sup(300, 500 - i * 15, '7')),
    ]
    const limpo = removerCitacoes([pagina(1, itens)]).paginas
    const linhas = paginasParaLinhas(limpo, { estudo: true })
    expect(linhas[0].texto).toBe('o autismo.')
    expect(linhasParaParagrafos(linhas)[0]).toBe('o autismo. sugerindo um forte componente genético na etiologia do autismo.')
  })
})

describe('cabeçalho e rodapé por repetição (textos de estudo)', () => {
  // o corpo começa em y=777, acima do corte fixo de 9 % (766): o corte fixo comeria a primeira linha de cada página
  const paginaDeManual = (n: number) => pagina(n, [
    item(57, 808, 'Transtorno do Espectro do Autismo', 160), item(300, 23, String(n), 8),
    ...coluna(57, 777, [`${['alfa', 'beta', 'gama', 'delta'][n - 1]} abre a página`, `${['um', 'dois', 'três', 'quatro'][n - 1]} vem depois`, `${['rio', 'mar', 'lago', 'mata'][n - 1]} na terceira`, `${['sol', 'lua', 'céu', 'vento'][n - 1]} na quarta`]),
  ])
  const quatro = [1, 2, 3, 4].map(paginaDeManual)

  it('tira o título que se repete no alto e o número da página no pé, e mantém a primeira linha do corpo', () => {
    const t = textos(quatro, { margens: 'repetidas' })
    expect(t).not.toContain('Transtorno do Espectro do Autismo')
    expect(t.some((x) => /^[1-4]$/.test(x))).toBe(false)
    expect(t).toContain('alfa abre a página')
    expect(t).toContain('delta abre a página')
  })
  it('o corte fixo de sempre (provas) continua cortando 9 % do alto: ele comia essa primeira linha', () => {
    expect(textos(quatro)).not.toContain('alfa abre a página')
  })
  it('com menos de 4 páginas não dá para saber o que se repete: volta ao corte fixo', () => {
    expect(textos(quatro.slice(0, 2), { margens: 'repetidas' })).not.toContain('Transtorno do Espectro do Autismo')
    expect(itensRepetidos(quatro.slice(0, 2)).size).toBe(0)
  })
  it('linha do corpo que não se repete nunca é tirada, mesmo no alto da página', () => {
    expect(itensRepetidos(quatro).size).toBe(8) // 4 títulos + 4 números de página
  })
})

describe('página de artigo com título, quadro e nota de rodapé de largura inteira', () => {
  it('ainda lê as duas colunas (até 35 % dos itens podem cruzar o corredor se há texto de verdade dos dois lados)', () => {
    const esq = coluna(28, 700, ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12']), dir = coluna(312, 700, ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12'])
    const largas = [...Array(10)].map((_, i) => item(60, 800 - i * 4, `bloco de autores ${i}`, 470)) // título e quadro: atravessam o corredor
    const t = textos([pagina(1, [...largas, ...esq, ...dir])], { estudo: true })
    expect(t.indexOf('E12')).toBeLessThan(t.indexOf('D1'))
  })
})

describe('parágrafos de um PDF de estudo', () => {
  it('um título curto sem ponto final fica sozinho (não gruda no parágrafo de baixo)', () => {
    const ls = [linha('Tratamento medicamentoso', 700, 1, 0, 110), linha('O pediatra é a figura central com atuação', 685), linha('decisiva para dar início ao processo terapêutico.', 670), linha('Outro parágrafo do mesmo assunto, em outro trecho.', 640), linha('com mais uma linha de texto comum do corpo.', 625)]
    expect(linhasParaParagrafos(ls)).toEqual(['Tratamento medicamentoso', 'O pediatra é a figura central com atuação decisiva para dar início ao processo terapêutico.', 'Outro parágrafo do mesmo assunto, em outro trecho. com mais uma linha de texto comum do corpo.'])
  })
  it('título que termina com a sigla entre parênteses também é título', () => {
    const ls = [linha('Childhood Autism Rating Scale (CARS)', 700, 1, 0, 150), linha('É a escala mais antiga e largamente utilizada e combina', 685), linha('as observações dos domínios principais, pelos pais em', 670), linha('atividades não estruturadas do dia a dia, podendo ser', 655), linha('utilizada durante a consulta pelo clínico.', 640, 1, 0, 150)]
    expect(linhasParaParagrafos(ls)[0]).toBe('Childhood Autism Rating Scale (CARS)')
  })
  it('palavra partida com hífen no pé da coluna continua no alto da coluna seguinte', () => {
    const ls = [linha('Quando é detectado qualquer atraso, a esti-', 700), linha('mulação precoce é a regra. Retardar a estimula-', 685), linha('ção significa perder o período ótimo de estimu-', 700, 1, 1), linha('lar a aquisição de cada habilidade da criança.', 685, 1, 1)]
    expect(linhasParaParagrafos(ls)).toEqual(['Quando é detectado qualquer atraso, a estimulação precoce é a regra. Retardar a estimulação significa perder o período ótimo de estimular a aquisição de cada habilidade da criança.'])
  })
  it('frase sem ponto final no pé da coluna continua (minúscula) no alto da outra', () => {
    const ls = [linha('Os pais também devem ser capacitados por esses profissionais para trabalhar com o', 700), linha('aprendizado e modificações comportamentais no âmbito domiciliar.', 700, 1, 1)]
    expect(linhasParaParagrafos(ls)).toEqual(['Os pais também devem ser capacitados por esses profissionais para trabalhar com o aprendizado e modificações comportamentais no âmbito domiciliar.'])
  })
  it('uma frase que terminou NÃO se junta ao parágrafo da outra coluna, mesmo começando em minúscula', () => {
    const ls = [linha('Este parágrafo já terminou aqui, com ponto final.', 700), linha('item solto da outra coluna', 700, 1, 1)]
    expect(linhasParaParagrafos(ls)).toHaveLength(2)
  })
  it('o hífen do composto repetido na quebra de linha ("M-" + "-CHAT-R") vira um só', () => {
    expect(linhasParaParagrafos([linha('repetir o M-', 700), linha('-CHAT-R em 24 meses, conforme o documento.', 685)])).toEqual(['repetir o M-CHAT-R em 24 meses, conforme o documento.'])
  })
  it('itens numerados ("2. …", "3. …") começam parágrafos novos, como os marcadores', () => {
    const ls = [linha('2. Sensibilidade tátil: reage ao toque;', 700), linha('3. Sensibilidade gustativa: come poucos sabores;', 685), linha('4. Sensibilidade auditiva: tampa os ouvidos.', 670)]
    expect(linhasParaParagrafos(ls)).toHaveLength(3)
  })
})
