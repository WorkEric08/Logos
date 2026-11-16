// Radical (stem) de uma palavra em português, para "banco", "bancos" e "bancária" se encontrarem. Usa o algoritmo Snowball (canônico) em português e arruma o que ele
// deixa de lado: o plural em "-ões/-ães/-ãos" (para "inflação" e "inflações" darem o mesmo radical) e palavras escritas SEM acento ("inflacao").
// O resultado sai sem acento. Puro e com cache (a mesma palavra aparece muito).
import PortugueseStemmer from 'snowball-stemmers-js/lib/portuguese-stemmer.js'
import { PALAVRAS_VAZIAS, palavras, semAcento } from './texto'

const stemmer = new PortugueseStemmer()
const cache = new Map<string, string>()

const TEM_ACENTO = /[áàâãéêíóôõúç]/
/** Palavra escrita sem acento: devolve os acentos que quase sempre existem no final ("inflacao" → "inflação", "questoes" → "questões"). */
function restaurarFinal(p: string): string {
  if (TEM_ACENTO.test(p)) return p
  return p.replace(/coes$/, 'ções').replace(/cao$/, 'ção').replace(/oes$/, 'ões').replace(/aes$/, 'ães').replace(/([^aeiou])ao$/, '$1ão')
}

/** Radical sem acento de UMA palavra (minúscula). Palavra vazia/curta/número volta como está. */
export function radical(palavra: string): string {
  const feito = cache.get(palavra)
  if (feito !== undefined) return feito
  let r: string
  if (palavra.length < 3 || /^\d+$/.test(palavra)) r = semAcento(palavra)
  else {
    const p = restaurarFinal(palavra).replace(/(ões|ães|ãos)$/, 'ão')
    r = semAcento(stemmer.stemWord(p))
  }
  if (cache.size > 50000) cache.clear()
  cache.set(palavra, r)
  return r
}

/** Radicais das palavras de um texto, sem as palavras vazias. */
export const radicais = (texto: string): string[] => palavras(texto, true).filter((p) => !PALAVRAS_VAZIAS.has(semAcento(p))).map(radical)
