// Posição da aba da barra de navegação do celular: em qual lado da tela (esquerda/direita) e a que altura (do alto ao pé). Puro: sem DOM.
export type Lado = 'esq' | 'dir'
export interface PosicaoAba { lado: Lado; pos: number } // pos: 0 = encostada no alto, 1 = no pé, 0,5 = no meio
export const ABA_PADRAO: PosicaoAba = { lado: 'esq', pos: 0.5 }
export const ALTURA_ABA = 46 // px (a mesma do CSS: a área de toque da aba; o quadrado visível tem 34)
export const MARGEM_ABA = 8 // px de folga até as barras do sistema
export const PASSO_TECLADO = 0.1

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ehNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Lê o que veio do armazenamento; qualquer coisa estranha vira o padrão (nunca derruba o app). */
export function limparAba(o: unknown): PosicaoAba {
  const a = o as Partial<PosicaoAba> | null
  if (!a || typeof a !== 'object') return ABA_PADRAO
  return { lado: a.lado === 'dir' ? 'dir' : 'esq', pos: ehNum(a.pos) ? clamp01(a.pos) : ABA_PADRAO.pos }
}

/** Lado da tela em que o dedo está: a aba "gruda" na metade onde o dedo estiver. */
export const ladoDoToque = (x: number, larguraTela: number): Lado => (x < larguraTela / 2 ? 'esq' : 'dir')

/** Limites verticais (px) do topo da aba, descontando as barras do sistema (sat/sab = áreas seguras de cima e de baixo). */
export function limitesTopo(altura: number, sat = 0, sab = 0) {
  const min = sat + MARGEM_ABA, max = altura - sab - MARGEM_ABA - ALTURA_ABA
  return { min, max: Math.max(min, max) }
}

/** Posição (0–1) que deixa o CENTRO da aba no Y do dedo, sem sair dos limites. */
export function posDoToque(y: number, altura: number, sat = 0, sab = 0): number {
  const { min, max } = limitesTopo(altura, sat, sab)
  return max === min ? 0 : clamp01((y - ALTURA_ABA / 2 - min) / (max - min))
}

/** Topo da aba em px para uma posição. */
export function topoDaAba(pos: number, altura: number, sat = 0, sab = 0): number {
  const { min, max } = limitesTopo(altura, sat, sab)
  return min + clamp01(pos) * (max - min)
}

/** Alt + seta (teclado): ← → trocam de lado; ↑ ↓ sobem e descem a aba. */
export function moverPorTecla(p: PosicaoAba, tecla: string): PosicaoAba {
  if (tecla === 'ArrowLeft') return { ...p, lado: 'esq' }
  if (tecla === 'ArrowRight') return { ...p, lado: 'dir' }
  if (tecla === 'ArrowUp') return { ...p, pos: clamp01(Math.round((p.pos - PASSO_TECLADO) * 100) / 100) }
  if (tecla === 'ArrowDown') return { ...p, pos: clamp01(Math.round((p.pos + PASSO_TECLADO) * 100) / 100) }
  return p
}

/** Texto para o leitor de tela e para a tela Mais: "na direita, no alto". */
export function descreverAba(p: PosicaoAba): string {
  const altura = p.pos <= 0.05 ? 'no alto' : p.pos >= 0.95 ? 'no pé da tela' : p.pos < 0.4 ? 'na parte de cima' : p.pos > 0.6 ? 'na parte de baixo' : 'no meio'
  return `${p.lado === 'dir' ? 'na direita' : 'na esquerda'}, ${altura}`
}

// ---- onde ficam os ÍCONES dentro da barra aberta (celular): em cima (padrão), no meio ou embaixo ----
export type Icones = 'cima' | 'meio' | 'baixo'
export const ICONES_PADRAO: Icones = 'cima'
export const ICONES: Record<Icones, string> = { cima: 'Em cima', meio: 'No meio', baixo: 'Embaixo' }
/** Lê o valor guardado; qualquer coisa que não seja uma das três opções volta ao padrão. */
export const limparIcones = (x: unknown): Icones => (x === 'meio' || x === 'baixo' ? x : ICONES_PADRAO)
