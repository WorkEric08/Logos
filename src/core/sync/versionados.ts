// Sincronização de itens que se EDITAM nos dois aparelhos (cartões, baralhos, marcações, ajustes): "a última alteração vence".
// Cada item tem `u` (quando mudou, em ms) e `dev` (qual aparelho mudou). Apagar não some com o item: ele vira uma "lápide" (`x: 1`) que se propaga,
// senão o aparelho que ainda tem o item o devolveria à nuvem. Funções puras: services/sync cuida de guardar e enviar.
export interface Versionado { id: string; u: number; dev: string; x?: 1 }

/** `a` vence `b`? Maior `u` vence; no empate vale o aparelho de id maior (decisão igual nos dois aparelhos, sem depender de quem sincroniza primeiro). */
export const vence = (a: Versionado, b: Versionado): boolean => (a.u !== b.u ? a.u > b.u : a.dev >= b.dev)

/** União por id; em cada id fica o item que vence. Mesmo resultado em qualquer ordem das listas e se uma se repetir; saída em ordem de id. */
export function mesclarVersionados<T extends Versionado>(...listas: readonly (readonly T[])[]): T[] {
  const por = new Map<string, T>()
  for (const lista of listas) for (const e of lista) {
    const atual = por.get(e.id)
    if (!atual || (vence(e, atual) && !(e.u === atual.u && e.dev === atual.dev))) por.set(e.id, e)
  }
  return [...por.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Os itens que a tela mostra (sem as lápides). */
export const vivos = <T extends Versionado>(lista: readonly T[]): T[] => lista.filter((e) => !e.x)

/** Item alterado agora, por este aparelho. */
export const alterado = <T extends Versionado>(e: T, mudancas: Partial<T>, u: number, dev: string): T => ({ ...e, ...mudancas, u, dev })

/** Item apagado agora: fica a lápide (mantém o id e a data para a exclusão chegar aos outros aparelhos). */
export const apagado = <T extends Versionado>(e: T, u: number, dev: string): T => ({ ...e, u, dev, x: 1 })

/** O que o aparelho precisa enviar: os itens locais que o outro lado ainda não tem ou tem mais antigos. */
export function aEnviar<T extends Versionado>(local: readonly T[], remoto: ReadonlyMap<string, Versionado>): T[] {
  return local.filter((e) => { const r = remoto.get(e.id); return !r || vence(e, r) && !(e.u === r.u && e.dev === r.dev) })
}
