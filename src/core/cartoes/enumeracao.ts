// Enumeração → um cartão por item (lacuna num item, com os outros visíveis). Duas formas:
//  - lista com marcadores depois de uma introdução que termina em ":" ("Os poderes da União:" + "- Legislativo" …);
//  - frase com a lista dentro ("Os princípios da administração são: legalidade, impessoalidade, moralidade e publicidade.").
// Só quando a introdução é de verdade uma lista (tipos, etapas, princípios…): "Termo: definição, com vírgulas" NÃO é enumeração. Puro.
import type { CartaoSugerido } from './tipos'

const MARCADOR = /^\s*(?:[-*•·▪■●○◦–]|\d+[.)])\s+(?=\S)/
const MAX_ITENS = 8, MAX_TAM_ITEM = 80
const PALAVRAS_DE_LISTA = /\b(tipos?|especies?|elementos?|caracteristicas?|principios?|etapas?|fases?|requisitos?|pilares?|funcoes|funcao|objetivos?|modalidades?|classificacoes|poderes|fontes|instrumentos?|componentes?|categorias?|niveis|formas?|criterios?|regimes?|orgaos|passos?)\b/
const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export const ehItemDeLista = (p: string) => MARCADOR.test(p)
export const itemLimpo = (p: string) => p.replace(MARCADOR, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').replace(/[.;,]+$/, '').trim()
/** O parágrafo apresenta uma lista que vem logo depois? ("Os poderes da União:") */
export const ehIntroducao = (p: string) => /:\s*$/.test(p.trim()) && p.trim().length <= 140 && p.trim().length >= 6

/** Itens que servem de cartão: de 2 a 8, curtos e sem repetição. */
export function itensValidos(itens: readonly string[]): boolean {
  if (itens.length < 2 || itens.length > MAX_ITENS) return false
  if (itens.some((i) => i.length < 2 || i.length > MAX_TAM_ITEM)) return false
  return new Set(itens.map(semAcento)).size === itens.length
}

/** Um cartão por item: a introdução e a lista com o item da vez escondido. */
export function cartoesDeLista(intro: string, itens: readonly string[], origem: string): CartaoSugerido[] {
  const titulo = intro.replace(/:\s*$/, '').replace(/\*\*/g, '').trim()
  return itens.map((alvo, k) => ({
    f: `${titulo}:\n${itens.map((x, j) => `• ${j === k ? '_____' : x}`).join('\n')}`,
    v: alvo, tipo: 'lista' as const, origem,
  }))
}

/** "Os princípios são: a, b e c." → cartões; null se não for uma lista de verdade. */
export function lerEnumeracaoInline(bruto: string): CartaoSugerido[] | null {
  const p = bruto.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  const m = /^(.{6,120}?)\s*(:|\bsão\b|\bsao\b)\s+(.+)$/.exec(p)
  if (!m || !PALAVRAS_DE_LISTA.test(semAcento(m[1]))) return null
  const resto = m[3].replace(/[.;]+$/, '')
  if (/[.!?]\s+\S/.test(resto)) return null // mais de uma frase: não é uma lista
  const partes = resto.split(/\s*[,;]\s*|\s+e\s+(?=[^,;]+$)/).map((x) => x.trim()).filter(Boolean)
  if (partes.length < 3 || partes.some((x) => x.split(/\s+/).length > 6) || !itensValidos(partes)) return null
  return cartoesDeLista(`${m[1].trim()}${m[2] === ':' ? '' : ' ' + m[2]}:`, partes, p)
}
