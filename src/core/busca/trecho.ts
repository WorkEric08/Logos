// Trechos: como um material vira pedaços buscáveis e como o resultado mostra "o pedaço certo, com a palavra em destaque". Puro.
import { radical } from './radical'
import { PALAVRAS_VAZIAS, palavras, semAcento } from './texto'

export const MAX_TRECHO = 700 // letras por trecho: mais que isso é partido em frases

/** Parágrafos → trechos de no máximo MAX_TRECHO letras (parágrafo grande é partido nas frases; frase gigante é partida no espaço mais próximo). Sem vazios. */
export function dividirEmTrechos(paragrafos: readonly string[], max = MAX_TRECHO): string[] {
  const saida: string[] = []
  for (const p0 of paragrafos) {
    const p = p0.replace(/\s+/g, ' ').trim()
    if (!p) continue
    if (p.length <= max) { saida.push(p); continue }
    let atual = ''
    const empurra = () => { if (atual.trim()) saida.push(atual.trim()); atual = '' }
    for (const frase of p.split(/(?<=[.!?;])\s+/)) {
      if (frase.length > max) { // frase gigante: parte onde houver espaço
        empurra()
        for (let i = 0; i < frase.length; i += max) {
          const fim = i + max >= frase.length ? frase.length : frase.lastIndexOf(' ', i + max) > i ? frase.lastIndexOf(' ', i + max) : i + max
          saida.push(frase.slice(i, fim).trim()); i = fim - max
        }
        continue
      }
      if ((atual + ' ' + frase).length > max) empurra()
      atual = atual ? `${atual} ${frase}` : frase
    }
    empurra()
  }
  return saida
}

export interface Destaque { inicio: number; fim: number }
export interface TrechoDestacado { texto: string; destaques: Destaque[]; cortouInicio: boolean; cortouFim: boolean }

/** As letras [início, fim) de cada palavra do texto cujo radical é um dos `radicais`. */
export function posicoesDasPalavras(texto: string, radicais: ReadonlySet<string>): Destaque[] {
  const achados: Destaque[] = []
  const re = /[\p{L}\p{N}]+/gu
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    const p = m[0].toLowerCase()
    if (PALAVRAS_VAZIAS.has(semAcento(p))) continue
    if (radicais.has(radical(p))) achados.push({ inicio: m.index, fim: m.index + m[0].length })
  }
  return achados
}

/**
 * O pedaço do texto (cerca de `tamanho` letras) onde mais palavras da consulta aparecem juntas, cortado em fim de palavra, com as posições a destacar.
 * Sem nenhuma palavra achada, devolve o começo do texto.
 */
export function trechoDestacado(texto: string, termos: readonly string[], tamanho = 240): TrechoDestacado {
  const alvo = new Set(termos.map((t) => radical(t.toLowerCase())))
  const todos = posicoesDasPalavras(texto, alvo)
  if (texto.length <= tamanho) return { texto, destaques: todos, cortouInicio: false, cortouFim: false }
  // janela que cobre mais achados: tenta começar em cada achado (um pouco antes dele)
  let melhor = { ini: 0, n: -1 }
  const candidatos = todos.length ? todos.map((d) => Math.max(0, d.inicio - 40)) : [0]
  for (const ini of candidatos) {
    const n = todos.filter((d) => d.inicio >= ini && d.fim <= ini + tamanho).length
    if (n > melhor.n) melhor = { ini, n }
  }
  let ini = melhor.ini, fim = Math.min(texto.length, ini + tamanho)
  if (ini > 0) { const e = texto.indexOf(' ', ini); if (e > 0 && e < ini + 30) ini = e + 1 }
  if (fim < texto.length) { const e = texto.lastIndexOf(' ', fim); if (e > ini + tamanho / 2) fim = e }
  const recorte = texto.slice(ini, fim)
  return {
    texto: recorte, cortouInicio: ini > 0, cortouFim: fim < texto.length,
    destaques: todos.filter((d) => d.inicio >= ini && d.fim <= fim).map((d) => ({ inicio: d.inicio - ini, fim: d.fim - ini })),
  }
}

/** Todas as palavras (sem acento, sem vazias) de um texto: base para contar e comparar. */
export const palavrasUteis = (t: string): string[] => palavras(t).filter((p) => !PALAVRAS_VAZIAS.has(p))
