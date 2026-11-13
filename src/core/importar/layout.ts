// Do PDF para linhas de texto em ordem de leitura. Puro: recebe os itens de texto que o leitor de PDF (pdf.js) entrega (posição + texto) e
// devolve as linhas, já sem cabeçalho/rodapé e com as duas colunas (provas de concurso) uma depois da outra.
// Não conhece pdf.js nem o navegador: o adaptador fica em services/importar/pdf.ts.

/** Um pedaço de texto da página. `y` cresce para CIMA (como no PDF): o topo da página tem o maior y. */
export interface ItemPdf { x: number; y: number; w: number; texto: string }
export interface PaginaPdf { numero: number; largura: number; altura: number; itens: ItemPdf[] }
/** Uma linha de texto. `coluna` 0 = esquerda (ou página de uma coluna só), 1 = direita. */
export interface Linha { texto: string; x0: number; x1: number; y: number; pagina: number; coluna: 0 | 1 }

const MARGEM_TOPO = 0.09 // fração da altura: cabeçalho (nome do banco, marca d'água)
const MARGEM_PE = 0.075 // rodapé (número da página, "GABARITO 1")
const TOL_Y = 2.2 // itens com y parecido estão na mesma linha

/** Junta os itens de uma mesma linha, da esquerda para a direita, pondo espaço só onde há folga. */
function juntar(itens: ItemPdf[]): string {
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
  return s.replace(/\s+/g, ' ').trim()
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
export function acharCorredor(itens: ItemPdf[], largura: number): number | null {
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
  // até 15 % dos itens podem cruzar o corredor (tabelas e figuras que ocupam a página inteira)
  if (min > uteis.length * 0.15 || esq < uteis.length * 0.15 || dir < uteis.length * 0.15) return null
  return g
}

const linhasDe = (itens: ItemPdf[], pagina: number, coluna: 0 | 1): Linha[] => {
  const saida: Linha[] = []
  for (const g of agruparPorLinha(itens)) {
    const texto = juntar(g)
    if (texto) saida.push({ texto, x0: Math.min(...g.map((i) => i.x)), x1: Math.max(...g.map((i) => i.x + i.w)), y: g[0].y, pagina, coluna })
  }
  return saida
}

export interface OpcoesLayout {
  /** false = não separa as colunas (gabaritos e tabelas). */
  colunas?: boolean
  /** false = não corta cabeçalho e rodapé (gabaritos: a última linha da tabela fica perto da borda). */
  margens?: boolean
}

/**
 * Uma página → linhas em ordem de leitura. Duas colunas: a da esquerda de cima a baixo, depois a da direita. Tabela ou figura que atravessa as duas
 * colunas forma uma FAIXA de largura inteira: acima dela vão as duas colunas, depois a faixa, depois as duas colunas de novo.
 */
export function paginaParaLinhas(p: PaginaPdf, opcoes: OpcoesLayout = {}): Linha[] {
  const topo = opcoes.margens === false ? Infinity : p.altura * (1 - MARGEM_TOPO), pe = opcoes.margens === false ? -Infinity : p.altura * MARGEM_PE
  const itens = p.itens.filter((i) => i.texto.trim() && i.y < topo && i.y > pe)
  const g = opcoes.colunas === false ? null : acharCorredor(itens, p.largura)
  if (g == null) return linhasDe(itens, p.numero, 0)
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
    saida.push(...linhasDe(lista.filter((i) => i.x + i.w / 2 < g), p.numero, 0), ...linhasDe(lista.filter((i) => i.x + i.w / 2 >= g), p.numero, 1))
  }
  let limite = Infinity
  for (const f of faixasY) {
    colunas(itens.filter((i) => i.y < limite && i.y > f.topo))
    saida.push(...linhasDe(itens.filter((i) => dentro(i, f)), p.numero, 0))
    limite = f.base
  }
  colunas(itens.filter((i) => i.y < limite))
  return saida
}

/** Todas as páginas → linhas em ordem de leitura. */
/** Para gabaritos use `{ colunas: false, margens: false }`: a linha "1 - C   2 - D …" não pode ser cortada ao meio nem perder a última linha da tabela. */
export const paginasParaLinhas = (paginas: readonly PaginaPdf[], opcoes: OpcoesLayout = {}): Linha[] => paginas.flatMap((p) => paginaParaLinhas(p, opcoes))
