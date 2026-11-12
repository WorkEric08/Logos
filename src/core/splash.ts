// Abertura animada (splash): 3 arquivos em pé, azuis (o da frente com marcador laranja), em fundo preto. 2 s no total.
// Tudo aqui é puro (tempo → quadro); o desenho está em ui/Splash.tsx. Medidas em "u": 1u = min(largura/168,75 ; altura/300).

export const DURACAO = 2 // segundos
export const ARQUIVO = { w: 48, h: 64 }
export const CAMINHO = 'M6 0H34L48 14V58A6 6 0 0 1 42 64H6A6 6 0 0 1 0 58V6A6 6 0 0 1 6 0Z'
export const DOBRA = 'M34 0L48 14H34Z'
export const CORES = {
  tras: { corpo: '#1B2D45', dobra: '#122136' },
  meio: { corpo: '#3A5578', dobra: '#2D4463' },
  frente: { corpo: '#7F96B5', dobra: '#62799A' },
  linhas: '#16283F',
  marcador: '#F28C28',
}
/** Canto superior esquerdo de cada arquivo na posição final (u, medidas do desenho original). */
export const POS = { tras: { x: -49.25, y: -35.25 }, meio: { x: -23.25, y: -25.25 }, frente: { x: 2.75, y: -15.25 } }
/** Linhas de texto do arquivo da frente (coordenadas locais; x = 9, altura 4, pontas redondas). */
export const LINHAS = [{ y: 30, w: 30 }, { y: 40, w: 30 }, { y: 50, w: 18 }]
/** Marcador laranja no topo do arquivo da frente (coordenadas locais). */
export const MARCADOR = 'M9 0H21V20L15 15L9 20Z'
export const LINHA = { x: 9, h: 4 }

/** Caixa da composição (100 × 84u) e o centro dela. As posições acima, tomadas ao pé da letra, deixam a composição 0,75u à direita
 *  e 6,75u abaixo do centro; a abertura desconta esse deslocamento para ficar centralizada de verdade (o ícone oficial tem o deslocamento). */
export const CAIXA = { x0: POS.tras.x, y0: POS.tras.y, x1: POS.frente.x + ARQUIVO.w, y1: POS.frente.y + ARQUIVO.h }
export const CENTRO = { x: (CAIXA.x0 + CAIXA.x1) / 2, y: (CAIXA.y0 + CAIXA.y1) / 2 }

export const unidade = (largura: number, altura: number) => Math.min(largura / 168.75, altura / 300)

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const outCubic = (x: number) => 1 - (1 - x) ** 3
export const outBack = (x: number) => 1 + 2.3 * (x - 1) ** 3 + 1.3 * (x - 1) ** 2
const p = (t: number, ini: number, dur: number) => clamp((t - ini) / dur)

export interface Quadro {
  frente: { escala: number; opacidade: number }
  meio: { visivel: boolean; dx: number; dy: number }
  tras: { visivel: boolean; dx: number; dy: number }
  /** Largura de cada linha de texto, de 0 a 1. */
  linhas: [number, number, number]
}

export function quadro(t: number): Quadro {
  const f = p(t, 0, 0.4)
  const desliza = (ini: number, dur: number, fim: { x: number; y: number }) => {
    const k = 1 - outBack(p(t, ini, dur)) // 1 = empilhado atrás do arquivo da frente; 0 = no lugar
    return { visivel: t >= ini, dx: k * (POS.frente.x - fim.x), dy: k * (POS.frente.y - fim.y) }
  }
  return {
    frente: { escala: 0.6 + 0.4 * outBack(f), opacidade: clamp(f * 3) },
    meio: desliza(0.35, 0.6, POS.meio),
    tras: desliza(0.5, 0.6, POS.tras),
    linhas: [0, 1, 2].map((i) => outCubic(p(t, 1.0 + 0.12 * i, 0.3))) as [number, number, number],
  }
}
