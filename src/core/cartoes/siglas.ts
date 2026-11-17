// Sigla ↔ expansão, nos dois sentidos: "Banco Central do Brasil (BACEN)", "BACEN (Banco Central do Brasil)", "BACEN – Banco Central do Brasil". Puro.
// Cuidado contra falso positivo: as letras da sigla precisam ser os começos das palavras da expansão, em ordem (BA+CEN = Banco Central, CMN = Conselho Monetário Nacional,
// ASHA = American Speech-Language-Hearing Association), senão não vira cartão: "Maria Souza Pinto (SP)" no meio de uma lista de nomes NÃO é a sigla SP.
import type { CartaoSugerido } from './tipos'

const MAI = 'A-ZÁÉÍÓÚÂÊÔÃÕÇ'
const PALAVRA = `[${MAI}][\\wÀ-ÿ'’-]*`
const LIGACAO = '(?:(?:d[aeo]s?|e|em|para|a|o|na|no|sobre|sob|entre|por|com|ao|aos|pelo|pela)\\s+)'
/** "Banco Central do Brasil (BACEN)": várias palavras com inicial maiúscula (com "de/da/e" no meio) e a sigla entre parênteses. */
const EXPANSAO_SIGLA = new RegExp(`(${PALAVRA}(?:\\s+${LIGACAO}?${PALAVRA}){1,7})\\s*\\(([${MAI}][${MAI}0-9]{1,9})\\)`, 'g')
/** "BACEN (Banco Central do Brasil)". */
const SIGLA_EXPANSAO = new RegExp(`(?<![\\wÀ-ÿ])([${MAI}][${MAI}0-9]{1,9})\\s*\\((${PALAVRA}(?:\\s+${LIGACAO}?${PALAVRA}){1,7})\\)`, 'g')
/** Linha de glossário inteira: "BACEN – Banco Central do Brasil". */
const GLOSSARIO = new RegExp(`^([${MAI}][${MAI}0-9]{1,9})\\s*[:–—-]\\s*(${PALAVRA}(?:\\s+${LIGACAO}?${PALAVRA}){1,7})\\s*\\.?$`)

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const ARTIGO_INICIAL = new Set(['o', 'a', 'os', 'as', 'um', 'uma'])
/** Palavras de ligação que a sigla pula ("Imposto sobre Circulação de Mercadorias e Serviços" = ICMS). */
const LIGACOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'a', 'o', 'as', 'os', 'na', 'no', 'nas', 'nos', 'por', 'com', 'ao', 'aos', 'sobre', 'sob', 'entre', 'sem', 'contra', 'pelo', 'pela'])
/** Quantas palavras de conteúdo podem sobrar no fim sem entrar na sigla ("Banco Central do Brasil" = BACEN). */
const SOBRA_MAX = 2

/** As letras da sigla são os começos das palavras da expansão, em ordem? (palavras ligadas por hífen contam separadas; ligações como "de" podem ser puladas) */
export function formaASigla(sigla: string, palavras: readonly string[]): boolean {
  const letras = semAcento(sigla).replace(/[^a-z0-9]/g, '')
  // cada palavra ligada por hífen vira várias; o do MEIO de um composto de 3 ou mais partes pode ficar fora (ASHA = American Speech-Language-Hearing Association: sem o "L")
  const toks = palavras.flatMap((w) => { const ps = semAcento(w).split(/[-/]/).map((x) => x.replace(/[^a-z0-9]/g, '')).filter(Boolean); return ps.map((t, k) => ({ t, meio: ps.length >= 3 && k > 0 && k < ps.length - 1 })) }).filter((x) => x.t)
  const casa = (j: number, i: number): boolean => {
    if (j === letras.length) return toks.slice(i).filter((x) => !LIGACOES.has(x.t) && !x.meio).length <= SOBRA_MAX
    if (i >= toks.length) return false
    if ((LIGACOES.has(toks[i].t) || toks[i].meio) && casa(j, i + 1)) return true
    for (let k = Math.min(toks[i].t.length, letras.length - j); k >= 1; k--) if (toks[i].t.startsWith(letras.slice(j, j + k)) && casa(j + k, i + 1)) return true
    return false
  }
  return casa(0, 0)
}

/** Tira palavras do começo ("Segundo o Banco Central" → "Banco Central") até a expansão formar a sigla. Sem acerto → null. */
function ajustar(expansao: string, sigla: string): string | null {
  let palavras = expansao.split(/\s+/)
  while (palavras.length >= 2 && (ARTIGO_INICIAL.has(palavras[0].toLowerCase()) || !formaASigla(sigla, palavras))) palavras = palavras.slice(1)
  if (palavras.length < 2 || !formaASigla(sigla, palavras)) return null
  return palavras.join(' ')
}

export interface ParSigla { sigla: string; expansao: string }

export function acharSiglas(texto: string): ParSigla[] {
  const achados: ParSigla[] = []
  const ver = (sigla: string, expansao: string) => {
    const e = ajustar(expansao, sigla)
    if (e && !achados.some((a) => a.sigla === sigla)) achados.push({ sigla, expansao: e })
  }
  for (const m of texto.matchAll(EXPANSAO_SIGLA)) ver(m[2], m[1])
  for (const m of texto.matchAll(SIGLA_EXPANSAO)) ver(m[1], m[2])
  const g = GLOSSARIO.exec(texto.trim())
  if (g) ver(g[1], g[2])
  return achados
}

/** Dois cartões por sigla: o que significa e qual é a sigla. */
export function cartoesDeSiglas(texto: string): CartaoSugerido[] {
  return acharSiglas(texto).flatMap(({ sigla, expansao }): CartaoSugerido[] => [
    { f: `O que significa a sigla ${sigla}?`, v: expansao, tipo: 'sigla', origem: texto },
    { f: `Qual é a sigla de ${expansao}?`, v: sigla, tipo: 'sigla', origem: texto },
  ])
}
