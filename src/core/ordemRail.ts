// Ordem dos ícones da Navigation Rail e a conta do arrasto (puro: sem DOM nem armazenamento).

/** Lê a ordem guardada: só ids que existem, sem repetir; os que faltam entram no fim, na ordem padrão. */
export function limparOrdem(salvo: unknown, padrao: readonly string[]): string[] {
  const lista = Array.isArray(salvo) ? salvo.filter((x): x is string => typeof x === 'string' && padrao.includes(x)) : []
  const unica = [...new Set(lista)]
  return [...unica, ...padrao.filter((id) => !unica.includes(id))]
}

/** Coloca os itens na ordem guardada (itens fora da lista guardada ficam no fim, na ordem em que vieram). */
export function ordenarItens<T extends { id: string }>(itens: readonly T[], ordem: readonly string[]): T[] {
  const ids = limparOrdem(ordem, itens.map((i) => i.id))
  return ids.map((id) => itens.find((i) => i.id === id)!)
}

/** Tira o item de `de` e o coloca em `para` (índices na própria lista). */
export function moverIndice<T>(lista: readonly T[], de: number, para: number): T[] {
  const c = [...lista]
  if (de < 0 || de >= c.length) return c
  const [x] = c.splice(de, 1)
  c.splice(Math.max(0, Math.min(c.length, para)), 0, x)
  return c
}

/** Quanto o item arrastado pode andar (px) para cima e para baixo: ele não sai da lista. */
export const limitesDy = (de: number, passo: number, n: number) => ({ min: -de * passo, max: (n - 1 - de) * passo })

export const limitarDy = (dy: number, de: number, passo: number, n: number) => {
  const { min, max } = limitesDy(de, passo, n)
  return Math.max(min, Math.min(max, dy))
}

/** Posição em que o item ficaria se fosse solto agora (o mais próximo do centro dele). */
export function alvoDoArrasto(de: number, dy: number, passo: number, n: number): number {
  if (passo <= 0 || n <= 0) return de
  return Math.max(0, Math.min(n - 1, Math.round(de + dy / passo)))
}

/** Quanto (px) o item `i` (que NÃO é o arrastado) sai do lugar para abrir espaço enquanto `de` passa por cima dele rumo a `para`. */
export function deslocamentoDoVizinho(i: number, de: number, para: number, passo: number): number {
  if (de < para && i > de && i <= para) return -passo
  if (de > para && i >= para && i < de) return passo
  return 0
}

/** Texto para o leitor de tela depois de mover um item. */
export const descreverMovimento = (rotulo: string, para: number, n: number) => `${rotulo} movido para a posição ${para + 1} de ${n}`
