// Sintaxe explícita dos resumos (a do Obsidian/RemNote/Anki): quando a pessoa MARCA o cartão, ele sai fiel, sem adivinhação.
//   Pergunta::Resposta          um cartão (frente → verso)
//   Termo:::Definição           dois cartões (ida e volta)
//   Pergunta ? Resposta         o "?" sozinho entre espaços (bloco de várias linhas do Obsidian)
//   ==lacuna==  {{lacuna}}  {{c1::lacuna}}     um cartão por lacuna (as outras ficam visíveis)
// (O **negrito** continua sendo a lacuna simples de antes: `core/importar/cartoes.ts`.) Puro.
import type { CartaoSugerido } from './tipos'

const MARCADOR = /^\s*(?:[-*•·▪■●○◦–]|\d+[.)])\s+(?=\S)/
const arruma = (t: string) => t.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
const LACUNA = /==(?!\s)([^=\n]{1,80}?)(?<!\s)==|\{\{(?:c\d+::)?([^{}\n]{1,80}?)(?:::[^{}\n]*)?\}\}/g

/** O parágrafo usa alguma marcação explícita? */
export function temSintaxe(bruto: string): boolean {
  const p = bruto.replace(MARCADOR, '')
  if (p.includes('`')) return false // trecho de código: "::" e "==" ali são da linguagem, não do cartão
  return /==(?!\s)[^=\n]{1,80}?(?<!\s)==|\{\{[^{}\n]{1,80}\}\}/.test(p) || /[^:\s]\s*::(?!:)\s*\S/.test(p) || /\S\s*:::\s*\S/.test(p) || /\S\s\?\s+\S/.test(p)
}

/** Os cartões que a marcação pede, exatamente com o texto que a pessoa escreveu (só tira o negrito e espaços repetidos). */
export function lerSintaxe(bruto: string): CartaoSugerido[] {
  const origem = bruto.trim()
  const p = bruto.replace(MARCADOR, '').trim()
  const card = (f: string, v: string): CartaoSugerido => ({ f: arruma(f), v: arruma(v), tipo: 'sintaxe', origem })

  const lacunas = [...p.matchAll(LACUNA)]
  if (lacunas.length) {
    return lacunas.map((alvo, k) => {
      let saida = '', pos = 0
      lacunas.forEach((m, j) => {
        saida += p.slice(pos, m.index) + (j === k ? '_____' : (m[1] ?? m[2]))
        pos = (m.index ?? 0) + m[0].length
      })
      return card(saida + p.slice(pos), alvo[1] ?? alvo[2])
    }).filter((c) => c.f && c.v)
  }
  const tres = p.indexOf(':::')
  if (tres >= 0) {
    const a = p.slice(0, tres), b = p.slice(tres + 3)
    if (arruma(a) && arruma(b)) return [card(a, b), card(b, a)]
    return []
  }
  const dois = /^(.+?)\s*::(?!:)\s*(.+)$/.exec(p)
  if (dois) return arruma(dois[1]) && arruma(dois[2]) ? [card(dois[1], dois[2])] : []
  const pergunta = /^(.+?)\s\?\s+(.+)$/.exec(p)
  if (pergunta) return [card(pergunta[1] + '?', pergunta[2])]
  return []
}
