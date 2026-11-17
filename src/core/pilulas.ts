// Disposição das pílulas de sugestão no celular: as de texto curto vão em duplas (lado a lado, em duas colunas iguais) e as de texto
// longo ocupam a linha toda. Núcleo puro: a tela só aplica o resultado como classe CSS.

/** Quantas letras, no máximo, para uma pílula ser "curta" e poder ir em dupla (cabe em uma ou duas linhas da meia coluna de um celular). */
export const LIMITE_CURTA = 24

export type Largura = 'meia' | 'inteira'

/**
 * Para cada rótulo, `meia` (uma coluna) ou `inteira` (as duas). Curtas seguidas formam duplas na ordem em que aparecem; uma curta que
 * ficaria sozinha numa linha (a que sobra num grupo ímpar) ocupa a linha toda: nunca fica um buraco ao lado dela. Nada é reordenado.
 */
export function disposicaoPilulas(rotulos: readonly string[], limite = LIMITE_CURTA): Largura[] {
  const out: Largura[] = rotulos.map((r) => (r.trim().length <= limite ? 'meia' : 'inteira'))
  let i = 0
  while (i < out.length) {
    if (out[i] !== 'meia') { i++; continue }
    let j = i
    while (j < out.length && out[j] === 'meia') j++
    if ((j - i) % 2 === 1) out[j - 1] = 'inteira' // a última curta de um grupo ímpar fica sozinha: ocupa a linha
    i = j
  }
  return out
}
