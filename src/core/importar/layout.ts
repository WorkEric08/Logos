// Do PDF para linhas de texto em ordem de leitura. Puro: recebe os itens de texto que o leitor de PDF (pdf.js) entrega (posição + texto) e
// devolve as linhas, já sem cabeçalho/rodapé e com as duas colunas (provas de concurso) uma depois da outra.
// Não conhece pdf.js nem o navegador: o adaptador fica em services/importar/pdf.ts.

/** Um pedaço de texto da página. `y` cresce para CIMA (como no PDF): o topo da página tem o maior y. */
export interface ItemPdf {
  x: number; y: number; w: number; texto: string
  /** Altura da letra (pt), quando o leitor de PDF informa: os números de citação ("...autismo¹²") são bem menores que o texto. */
  h?: number
}
export interface PaginaPdf { numero: number; largura: number; altura: number; itens: ItemPdf[] }
/** Uma linha de texto. `coluna` 0 = esquerda (ou página de uma coluna só), 1 = direita. */
export interface Linha { texto: string; x0: number; x1: number; y: number; pagina: number; coluna: 0 | 1 }

const MARGEM_TOPO = 0.09 // fração da altura: cabeçalho (nome do banco, marca d'água)
const MARGEM_PE = 0.075 // rodapé (número da página, "GABARITO 1")
const TOL_Y = 2.2 // itens com y parecido estão na mesma linha

/** Junta os itens de uma mesma linha, da esquerda para a direita, pondo espaço só onde há folga. */
function juntar(itens: ItemPdf[], estudo = false): string {
  const o = [...itens].sort((a, b) => a.x - b.x)
  let s = ''
  let fim = -Infinity
  for (const it of o) {
    if (!it.texto) continue
    const folga = it.x - fim
    if (s && !s.endsWith(' ') && !it.texto.startsWith(' ') && folga > 0.9) s += ' '
    s += it.texto
    fim = Math.max(fim, it.x + it.w)
  }
  const limpo = s.replace(/\s+/g, ' ')
  // modo estudo: sem espaço antes da pontuação (sobra quando um sobrescrito entre a palavra e o ponto é tirado). As provas ficam como sempre foram.
  return (estudo ? limpo.replace(/\s+([.,;:!?)\]])/g, '$1') : limpo).trim()
}

function agruparPorLinha(itens: ItemPdf[]): ItemPdf[][] {
  const o = [...itens].sort((a, b) => b.y - a.y || a.x - b.x)
  const grupos: ItemPdf[][] = []
  for (const it of o) {
    const g = grupos[grupos.length - 1]
    if (g && Math.abs(g[0].y - it.y) <= TOL_Y) g.push(it)
    else grupos.push([it])
  }
  return grupos
}

/** Acha o corredor entre as duas colunas: um x no meio da página que poucos itens atravessam e com texto dos dois lados. */
export function acharCorredor(itens: ItemPdf[], largura: number, estudo = false): number | null {
  const uteis = itens.filter((i) => i.texto.trim())
  if (uteis.length < 12) return null
  const cruzam = (x: number) => uteis.filter((i) => i.x < x - 1 && i.x + i.w > x + 1).length
  let min = Infinity
  for (let x = Math.round(largura * 0.4); x <= Math.round(largura * 0.6); x++) min = Math.min(min, cruzam(x))
  // o meio da faixa onde o número de itens que cruzam é o mínimo (o corte fica longe das bordas do texto)
  const xs: number[] = []
  for (let x = Math.round(largura * 0.4); x <= Math.round(largura * 0.6); x++) if (cruzam(x) === min) xs.push(x)
  const g = (xs[0] + xs[xs.length - 1]) / 2
  const esq = uteis.filter((i) => i.x + i.w <= g + 1).length
  const dir = uteis.filter((i) => i.x >= g - 1).length
  if (esq < uteis.length * 0.15 || dir < uteis.length * 0.15) return null
  // até 15 % dos itens podem cruzar o corredor (tabelas e figuras que ocupam a página inteira)...
  // ...ou até 35 % se há bastante texto de verdade dos dois lados (uma página de artigo com título, quadro de autores e nota de rodapé de largura inteira)
  const corpo = estudo && esq >= 12 && dir >= 12 // (só nos textos de estudo: nas provas vale a regra de sempre, de 15 %)
  if (min > uteis.length * (corpo ? 0.35 : 0.15)) return null
  return g
}

const linhasDe = (itens: ItemPdf[], pagina: number, coluna: 0 | 1, estudo = false): Linha[] => {
  const saida: Linha[] = []
  for (const g of agruparPorLinha(itens)) {
    const texto = juntar(g, estudo)
    if (texto) saida.push({ texto, x0: Math.min(...g.map((i) => i.x)), x1: Math.max(...g.map((i) => i.x + i.w)), y: g[0].y, pagina, coluna })
  }
  return saida
}

export interface OpcoesLayout {
  /** false = não separa as colunas (gabaritos e tabelas). */
  colunas?: boolean
  /**
   * false = não corta cabeçalho e rodapé (gabaritos: a última linha da tabela fica perto da borda). 'repetidas' = para textos de estudo (manuais, apostilas): em vez de
   * cortar uma faixa fixa de cada página (que pode comer a primeira ou a última linha do corpo), tira só as linhas que se REPETEM em várias páginas, no mesmo lugar
   * (o título do documento no alto, o número da página no pé).
   */
  margens?: boolean | 'repetidas'
  /** Itens a ignorar (os cabeçalhos e rodapés repetidos, calculados para o documento todo). */
  ignorar?: ReadonlySet<ItemPdf>
  /** Texto de estudo (manual, apostila, artigo), não prova: aceita página de duas colunas com título e nota de rodapé de largura inteira e tira o espaço antes da pontuação. Ligado sozinho por `margens: 'repetidas'`; fora dele o leitor de PROVAS fica exatamente como era (medido com `scripts/medir-extracao.mjs`). */
  estudo?: boolean
}

/**
 * Uma página → linhas em ordem de leitura. Duas colunas: a da esquerda de cima a baixo, depois a da direita. Tabela ou figura que atravessa as duas
 * colunas forma uma FAIXA de largura inteira: acima dela vão as duas colunas, depois a faixa, depois as duas colunas de novo.
 */
export function paginaParaLinhas(p: PaginaPdf, opcoes: OpcoesLayout = {}): Linha[] {
  const semMargem = opcoes.margens === false || opcoes.margens === 'repetidas'
  const topo = semMargem ? Infinity : p.altura * (1 - MARGEM_TOPO), pe = semMargem ? -Infinity : p.altura * MARGEM_PE
  const itens = p.itens.filter((i) => i.texto.trim() && i.y < topo && i.y > pe && !opcoes.ignorar?.has(i))
  const g = opcoes.colunas === false ? null : acharCorredor(itens, p.largura, opcoes.estudo)
  if (g == null) return linhasDe(itens, p.numero, 0, opcoes.estudo)
  const cruza = (i: ItemPdf) => i.x < g - 1 && i.x + i.w > g + 1
  // faixas de largura inteira: do y mais alto ao mais baixo dos itens que cruzam, juntando as que ficam a menos de 18 pt
  const ys = itens.filter(cruza).map((i) => i.y).sort((a, b) => b - a)
  const faixas: { topo: number; base: number }[] = []
  for (const y of ys) {
    const f = faixas[faixas.length - 1]
    if (f && f.base - y <= 18) f.base = y
    else faixas.push({ topo: y, base: y })
  }
  const faixasY = faixas.map((f) => ({ topo: f.topo + 10, base: f.base - 4 }))
  const dentro = (i: ItemPdf, f: { topo: number; base: number }) => i.y <= f.topo && i.y >= f.base
  const saida: Linha[] = []
  const colunas = (lista: ItemPdf[]) => {
    saida.push(...linhasDe(lista.filter((i) => i.x + i.w / 2 < g), p.numero, 0, opcoes.estudo), ...linhasDe(lista.filter((i) => i.x + i.w / 2 >= g), p.numero, 1, opcoes.estudo))
  }
  let limite = Infinity
  for (const f of faixasY) {
    colunas(itens.filter((i) => i.y < limite && i.y > f.topo))
    saida.push(...linhasDe(itens.filter((i) => dentro(i, f)), p.numero, 0, opcoes.estudo))
    limite = f.base
  }
  colunas(itens.filter((i) => i.y < limite))
  return saida
}

const SOBRESCRITO = /^\s*\d[\d,\s–-]{0,11}\s*$/ // "2", "3–5", "12,13", "25,26,30"
const mediana = (v: number[]) => { const o = [...v].sort((a, b) => a - b); return o.length ? o[Math.floor(o.length / 2)] : 0 }
/** Citações mínimas no documento para valer a limpeza: um sobrescrito solto ("m²", "10³") não é citação e fica. */
export const MIN_CITACOES = 6

/**
 * Tira os NÚMEROS DE CITAÇÃO (sobrescritos como o 12,13 de "…do autismo¹²,¹³.") dos artigos e manuais: o leitor de PDF os entrega como texto solto, e eles
 * se enfiam no meio das frases, partem palavras com hífen e estragam cartões e questões ("aos 4 ou 5 anos de 3–5 idade"). Reconhece pelo tamanho da letra
 * (bem menor que a do texto) e por só ter dígitos, vírgula e traço. Só atua se o documento tem pelo menos MIN_CITACOES deles (é um texto com referências);
 * senão deixa tudo como está, porque um expoente ("m²") faz parte do texto. Devolve quantos tirou, para a tela avisar.
 */
export function removerCitacoes(paginas: readonly PaginaPdf[], minimo = MIN_CITACOES): { paginas: PaginaPdf[]; removidas: number } {
  const marcados = paginas.map((p) => {
    const ref = mediana(p.itens.filter((i) => i.h && i.texto.trim().length >= 3 && !SOBRESCRITO.test(i.texto)).map((i) => i.h as number)) // (o tamanho do TEXTO: os sobrescritos não entram na conta)
    return new Set(p.itens.filter((i) => ref > 0 && i.h !== undefined && i.h <= ref * 0.75 && SOBRESCRITO.test(i.texto)))
  })
  const total = marcados.reduce((n, s) => n + s.size, 0)
  if (total < minimo) return { paginas: [...paginas], removidas: 0 }
  return { paginas: paginas.map((p, k) => ({ ...p, itens: p.itens.filter((i) => !marcados[k].has(i)) })), removidas: total }
}

const FAIXA_REPETIDA = 0.15 // fração da altura, no alto e no pé, onde se procuram cabeçalho e rodapé
/** Páginas mínimas para valer a detecção por repetição (com menos, o corte fixo ainda é o melhor palpite). */
const MIN_PAGINAS_REPETIDAS = 4

/**
 * Os itens de cabeçalho e rodapé de um documento: linhas no alto ou no pé da página cujo texto (com os números trocados por "#": "Página 3" = "Página 4") se repete, no mesmo
 * lugar, em pelo menos 30 % das páginas (e em 3 ou mais). Linha do corpo nunca se repete igual em várias páginas.
 */
export function itensRepetidos(paginas: readonly PaginaPdf[]): Set<ItemPdf> {
  const fora = new Set<ItemPdf>()
  if (paginas.length < MIN_PAGINAS_REPETIDAS) return fora
  const linhas: { chave: string; itens: ItemPdf[] }[] = []
  const contagem = new Map<string, number>()
  for (const p of paginas) {
    const todas = agruparPorLinha(p.itens.filter((i) => i.texto.trim()))
    // só as DUAS linhas das pontas, e só dentro da faixa do alto e do pé: cabeçalho e rodapé são as linhas mais externas (o corpo, mesmo no alto da página, vem depois delas)
    const pontas = new Set([...todas.slice(0, 2), ...todas.slice(-2)])
    const vistas = new Set<string>()
    for (const g of todas) {
      if (!pontas.has(g) || !(g[0].y > p.altura * (1 - FAIXA_REPETIDA) || g[0].y < p.altura * FAIXA_REPETIDA)) continue
      const chave = `${juntar(g, true).toLowerCase().replace(/\d+/g, '#')}|${Math.round(g[0].y / 3)}`
      linhas.push({ chave, itens: g })
      if (!vistas.has(chave)) { vistas.add(chave); contagem.set(chave, (contagem.get(chave) ?? 0) + 1) }
    }
  }
  const minimo = Math.max(3, Math.ceil(paginas.length * 0.3))
  for (const l of linhas) if ((contagem.get(l.chave) ?? 0) >= minimo) for (const i of l.itens) fora.add(i)
  return fora
}

/** Todas as páginas → linhas em ordem de leitura. */
/** Para gabaritos use `{ colunas: false, margens: false }`: a linha "1 - C   2 - D …" não pode ser cortada ao meio nem perder a última linha da tabela. */
export function paginasParaLinhas(paginas: readonly PaginaPdf[], opcoes: OpcoesLayout = {}): Linha[] {
  if (opcoes.margens === 'repetidas') {
    const ignorar = itensRepetidos(paginas)
    // poucas páginas para saber o que se repete: volta ao corte fixo de sempre
    const o: OpcoesLayout = paginas.length < MIN_PAGINAS_REPETIDAS ? { ...opcoes, margens: true, estudo: true } : { ...opcoes, ignorar, estudo: true }
    return paginas.flatMap((p) => paginaParaLinhas(p, o))
  }
  return paginas.flatMap((p) => paginaParaLinhas(p, opcoes))
}
