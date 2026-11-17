// Alternativas erradas para uma lacuna numérica ("a cada 45 dias", "R$ 250 mil", "em 1994", "15%"): números PARECIDOS na mesma forma, nunca absurdos
// (45 dias → 30, 35, 55, 70 dias; 1994 → 1992, 1996, 1990, 1998). Puro.
import type { Rng } from '../weights'

const NUM = /^(R\$\s?)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(.*)$/

const formata = (n: number, casas: number) => {
  const [int, dec] = n.toFixed(casas).split('.')
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + dec : '')
}

/** Arredonda para um "número de gente": 22,5 → 25; 67,5 → 70; 135 → 140; 1.350 → 1.400. */
function bonito(x: number): number {
  if (x < 20) return Math.round(x)
  if (x < 100) return Math.round(x / 5) * 5
  if (x < 300) return Math.round(x / 10) * 10
  if (x < 1000) return Math.round(x / 50) * 50
  const mag = 10 ** (Math.floor(Math.log10(x)) - 1)
  return Math.round(x / mag) * mag
}

/** Limites impostos pela frase: numa faixa ("entre 12 e _____") a resposta é MAIOR que o número que vem antes; em "_____ e 30" é MENOR que o que vem depois. */
export interface LimitesNumericos { acima?: number; abaixo?: number }

/**
 * Os números que a frase deixa em volta da lacuna, para as alternativas respeitarem a faixa: "entre 12 e _____" → acima 12 ("12 meses" e "10 meses" seriam absurdos).
 * Só olha o número colado à lacuna por "e", "a", "ou", "até" ou traço.
 */
export function limitesDaFrase(frase: string): LimitesNumericos {
  const num = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'))
  const antes = /(\d+(?:\.\d{3})*(?:,\d+)?)\s*(?:e|a|ou|até|-|–|—)\s*_____/.exec(frase)
  const depois = /_____\s*(?:e|a|ou|até|-|–|—)\s*(\d+(?:\.\d{3})*(?:,\d+)?)/.exec(frase)
  return { ...(antes ? { acima: num(antes[1]) } : {}), ...(depois ? { abaixo: num(depois[1]) } : {}) }
}

/** Quatro valores diferentes do original, na mesma forma (mesma unidade e mesmas casas decimais). Null se não for um número simples. */
export function perturbar(valor: string, rng: Rng, limites: LimitesNumericos = {}): string[] | null {
  const m = NUM.exec(valor.trim())
  if (!m) return null
  const [, moeda = '', inteiro, dec = '', resto] = m
  const casas = dec.length
  const n = Number(inteiro.replace(/\./g, '') + (dec ? '.' + dec : ''))
  if (!Number.isFinite(n) || n <= 1) return null // "1 ano" muda de plural ao variar: não gero
  const ano = !moeda && !casas && !resto.trim() && n >= 1500 && n <= 2100
  const plural = /s\s*$/.test(resto.trim()) // "3 anos": "1 anos" não existe
  const candidatos = new Set<number>()
  const poe = (x: number) => { const v = casas ? Math.round(x * 10 ** casas) / 10 ** casas : Math.round(x); if (v > (plural ? 1 : 0) && v !== n && (limites.acima === undefined || v > limites.acima) && (limites.abaixo === undefined || v < limites.abaixo)) candidatos.add(v) }
  if (ano) { for (const d of [-10, -5, -3, -2, -1, 1, 2, 3, 5, 10]) poe(n + d) }
  else if (!casas && n <= 12) { for (const d of [-3, -2, -1, 1, 2, 3, 4, 6]) poe(n + d) } // contagens pequenas: vizinhos
  else for (const f of [0.5, 0.67, 0.8, 1.2, 1.5, 2]) poe(casas ? n * f : bonito(n * f)) // degraus em volta: metade, dois terços, ±20 %, 1,5×, dobro
  const lista = [...candidatos]
  if (lista.length < 4) return null
  // fica com os mais próximos do original (em proporção) e sorteia 4 deles
  const proximos = lista.sort((a, b) => Math.abs(Math.log(a / n)) - Math.abs(Math.log(b / n))).slice(0, 6)
  const saida: number[] = []
  while (saida.length < 4) saida.push(proximos.splice(Math.floor(rng() * proximos.length), 1)[0])
  return saida.map((v) => `${moeda}${ano ? String(v) : formata(v, casas)}${resto}`)
}
