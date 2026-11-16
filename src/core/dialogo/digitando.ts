// Sugestões que se filtram ENQUANTO a pessoa digita (como a paleta de comandos do Linear/Raycast): quem escreve "simu" já vê "Montar um simulado". Puro.
import { termosDaAcao, type Alvo } from '../conversa'
import { semAcento } from '../busca/texto'

export interface SugestaoDigitando { tipo: 'acao' | 'busca'; id: string; rotulo: string }
const MAX_ACOES = 4

/** Nota de uma ação para o que já foi digitado: começo de palavra-chave (peso maior quanto mais letras), ou o texto todo como começo de uma frase-chave. */
function nota(texto: string, termos: readonly string[]): number {
  const palavras = texto.split(' ')
  const ultima = palavras[palavras.length - 1]
  let n = 0
  for (const termo of termos) {
    if (termo === texto) n = Math.max(n, 6)
    else if (texto.length >= 3 && termo.startsWith(texto)) n = Math.max(n, 5 - (termo.length - texto.length) / 100) // empate: a palavra mais curta (mais parecida) vence
    else if (ultima.length >= 2 && termo.split(' ').some((p) => p.startsWith(ultima))) n = Math.max(n, ultima.length >= 4 ? 4 : ultima.length >= 3 ? 3 : 1)
  }
  return n
}

/**
 * As ações que combinam com o que foi digitado (até 4) e, no fim, "Procurar … no meu material" quando nenhuma combina bem: o texto digitado também é uma busca
 * (mesma ideia de "criar a partir do que foi digitado" das paletas de comandos). Menos de 2 letras: nada.
 */
export function sugerirDigitando(bruto: string, acoes: readonly { id: string; sugestao: string }[]): SugestaoDigitando[] {
  const texto = semAcento(bruto).replace(/\s+/g, ' ').trim()
  if (texto.length < 2) return []
  const ordenadas = acoes
    .map((a) => ({ a, n: Math.max(nota(texto, termosDaAcao(a.id as Alvo)), nota(texto, semAcento(a.sugestao).split(' ').filter((p) => p.length >= 3))) }))
    .filter((x) => x.n > 0).sort((x, y) => y.n - x.n)
  const saida: SugestaoDigitando[] = ordenadas.slice(0, MAX_ACOES).map(({ a }) => ({ tipo: 'acao', id: a.id, rotulo: a.sugestao }))
  if (texto.length >= 3 && !(ordenadas[0]?.n >= 5)) saida.push({ tipo: 'busca', id: 'busca', rotulo: `Procurar “${bruto.trim().slice(0, 40)}” no meu material` })
  return saida
}
