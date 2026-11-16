// O que entra no índice de busca: trechos de materiais, questões do espaço e cartões. Cada um vira um "documento" com título, texto e a fonte que a pessoa vê. Puro.
import type { Baralho, Cartao } from '../cards'
import type { Material, Trecho } from '../material'
import type { Question } from '../types'

export type TipoDoc = 'material' | 'questao' | 'cartao'
export interface DocBusca {
  /** Prefixo diz o tipo: m:<trecho> · q:<questão> · c:<cartão>. */
  id: string
  tipo: TipoDoc
  /** Nome do material, "BB 2021 · questão 12 · Português", nome do baralho. */
  titulo: string
  texto: string
  /** Para mostrar "de onde veio" (ex.: "Resumo de juros · trecho 12 de 40"). */
  fonte: string
  /** Id da questão/cartão (para abrir depois). */
  ref?: string
}

export function docsDeMateriais(materiais: readonly Material[], trechos: readonly Trecho[]): DocBusca[] {
  const por = new Map(materiais.map((m) => [m.id, m]))
  const docs: DocBusca[] = []
  for (const t of trechos) {
    const m = por.get(t.m)
    if (!m) continue // trecho sem material (apagado): não entra
    docs.push({ id: `m:${t.id}`, tipo: 'material', titulo: m.nome, texto: t.t, fonte: `${m.nome} · trecho ${t.i + 1} de ${m.trechos}` })
  }
  return docs
}

export function docsDeQuestoes(qs: readonly Question[], fontes: Readonly<Record<string, string>>): DocBusca[] {
  return qs.map((q) => ({
    id: `q:${q.id}`, tipo: 'questao', titulo: `${fontes[q.s] ?? q.s} · questão ${q.n} · ${q.m}`,
    texto: [q.e, ...(['A', 'B', 'C', 'D', 'E'] as const).map((l) => q.o[l])].filter(Boolean).join(' '),
    fonte: `${fontes[q.s] ?? q.s} · questão ${q.n}`, ref: q.id,
  }))
}

export function docsDeCartoes(cartoes: readonly Cartao[], baralhos: readonly Baralho[]): DocBusca[] {
  const por = new Map(baralhos.map((b) => [b.id, b.nome]))
  return cartoes.map((c) => ({ id: `c:${c.id}`, tipo: 'cartao', titulo: por.get(c.b) ?? 'Cartão', texto: `${c.f} ${c.v}`, fonte: `Cartão do baralho ${por.get(c.b) ?? ''}`.trim(), ref: c.id }))
}
