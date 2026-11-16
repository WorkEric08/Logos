// Texto para busca: normalização, palavras e as "palavras vazias" do português. Puro (sem DOM nem banco).

/** Sem acento, minúsculo. */
export const semAcento = (t: string): string => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Palavras muito comuns que não ajudam a achar nada (já sem acento). */
export const PALAVRAS_VAZIAS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'pra', 'com', 'sem', 'sob', 'sobre',
  'entre', 'e', 'ou', 'mas', 'que', 'se', 'ao', 'aos', 'as', 'pelo', 'pela', 'pelos', 'pelas', 'qual', 'quais', 'quem', 'como', 'onde', 'quando', 'ser', 'sao', 'foi',
  'eh', 'eu', 'voce', 'me', 'meu', 'minha', 'meus', 'minhas', 'isso', 'isto', 'esse', 'essa', 'este', 'esta', 'esses', 'essas', 'aquele', 'aquela', 'ja', 'mais', 'menos',
  'muito', 'tambem', 'ha', 'ter', 'tem', 'seu', 'sua', 'seus', 'suas', 'ate', 'sao', 'esta', 'estao', 'foram', 'sera', 'pode', 'podem', 'deve', 'devem', 'ele', 'ela', 'eles', 'elas',
])

/**
 * As palavras de um texto, minúsculas e SEM acento, prontas para virar radical. Números com ponto de milhar viram um número só ("4.595/64" → "4595", "64"),
 * e símbolos de ordinal ("5º", "nº") não atrapalham. Mantém os acentos se `comAcento` (o radical precisa deles para acertar o sufixo).
 */
export function palavras(texto: string, comAcento = false): string[] {
  const t = texto.toLowerCase().replace(/(\d)\.(?=\d{3}\b)/g, '$1').replace(/[ºª°]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const lista = t ? t.split(' ') : []
  return comAcento ? lista : lista.map(semAcento)
}
