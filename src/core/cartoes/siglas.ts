// Sigla ↔ expansão, nos dois sentidos: "Banco Central do Brasil (BACEN)", "BACEN (Banco Central do Brasil)", "BACEN – Banco Central do Brasil". Puro.
// Cuidado contra falso positivo: a sigla precisa começar com a mesma letra da expansão (BACEN/Banco, CMN/Conselho); senão não vira cartão.
import type { CartaoSugerido } from './tipos'

const MAI = 'A-ZÁÉÍÓÚÂÊÔÃÕÇ'
const PALAVRA = `[${MAI}][\\wÀ-ÿ'’-]*`
const LIGACAO = '(?:(?:d[aeo]s?|e|em|para|a|o|na|no)\\s+)'
/** "Banco Central do Brasil (BACEN)": várias palavras com inicial maiúscula (com "de/da/e" no meio) e a sigla entre parênteses. */
const EXPANSAO_SIGLA = new RegExp(`(${PALAVRA}(?:\\s+${LIGACAO}?${PALAVRA}){1,7})\\s*\\(([${MAI}][${MAI}0-9]{1,9})\\)`, 'g')
/** "BACEN (Banco Central do Brasil)". */
const SIGLA_EXPANSAO = new RegExp(`(?<![\\wÀ-ÿ])([${MAI}][${MAI}0-9]{1,9})\\s*\\((${PALAVRA}(?:\\s+${LIGACAO}?${PALAVRA}){1,7})\\)`, 'g')
/** Linha de glossário inteira: "BACEN – Banco Central do Brasil". */
const GLOSSARIO = new RegExp(`^([${MAI}][${MAI}0-9]{1,9})\\s*[:–—-]\\s*(${PALAVRA}(?:\\s+${LIGACAO}?${PALAVRA}){1,7})\\s*\\.?$`)

const inicial = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toLowerCase()
const ARTIGO_INICIAL = new Set(['o', 'a', 'os', 'as', 'um', 'uma'])

/** Tira palavras do começo ("Segundo o Banco Central" → "Banco Central") até a inicial bater com a da sigla. Sem acerto → null. */
function ajustar(expansao: string, sigla: string): string | null {
  let palavras = expansao.split(/\s+/)
  while (palavras.length >= 2 && (inicial(palavras[0]) !== inicial(sigla) || ARTIGO_INICIAL.has(palavras[0].toLowerCase()))) palavras = palavras.slice(1)
  const saida = palavras.join(' ')
  if (palavras.length < 2 || inicial(saida) !== inicial(sigla)) return null
  return saida
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
