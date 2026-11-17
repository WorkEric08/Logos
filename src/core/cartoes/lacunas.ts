// Lacuna em números, datas e valores ("a cada 45 dias", "25%", "em 1964", "R$ 250 mil"): a frase com o número escondido. Só para frases curtas e inteiras,
// com no máximo dois valores (mais que isso vira confusão). Serve de último recurso: parágrafos que nenhuma outra regra aproveitou. Puro.
import { primeiraFrase } from './conceito'
import type { CartaoSugerido } from './tipos'

const UNIDADE = '(?:%|por cento|dias?|meses|mês|anos?|horas?|reais|mil|milhões|milhão|bilhões|bilhão|vezes|pontos percentuais)'
const NUMERO = new RegExp(`(?<![\\wÀ-ÿ])(\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?\\s?${UNIDADE})(?![\\wÀ-ÿ])|(R\\$\\s?\\d[\\d.,]*(?:\\s(?:mil|milhões|bilhões))?)`, 'gi')
const ANO = /(?:^|[\s(])(?:em|de|desde|até|no ano de)\s+((?:1[5-9]|20)\d{2})(?![\d])/gi

/** Frases que dependem do que veio antes ("Isso mostra…", "Esse aumento…", "Além disso…", "Por outro lado…"): sozinhas na frente de um cartão não dizem de quê falam. */
const DEPENDE_DO_CONTEXTO = /^(?:isso|isto|esse|essa|esses|essas|este|esta|estes|estas|aquele|aquela|ele|ela|eles|elas|dessa|desse|nessa|nesse|neste|nesta|além|por outro|portanto|assim|então|contudo|entretanto|porém|mas|ou seja|nesses|nessas|desses|dessas|tal|tais|o mesmo|a mesma|ambos|ambas|trata-se|é um|é uma|são os|são as|foi|foram)\b/i
/** Um demonstrativo no meio da frase ("essas crianças", "destas escalas", "essa evidência") também aponta para o que veio antes: sozinha, a frase perde o sentido. */
const ANAFORA = /\b(?:essas?|esses?|destas?|destes?|dessas?|desses?|nessas?|nesses?)\s+[a-zà-ÿ]/i
const MAX_FRASES_POR_PARAGRAFO = 3

/**
 * Lacunas em números, frase por frase, para parágrafos de qualquer tamanho (um parágrafo de artigo tem várias frases e a regra de cima só aceita parágrafos curtos): cada frase
 * inteira com um ou dois números vira um cartão, desde que se entenda sozinha (não começa com "Isso…", "Esse…", "Por outro lado…"). Devolve até 3 por parágrafo. `titulo`: o título da seção logo acima (contexto da frase).
 */
export function lacunasDeFrases(bruto: string, titulo = ''): CartaoSugerido[] | null {
  if (titulo.split(/\s+/).length < 3) titulo = '' // dois pedaços de palavra ("Second Edition", sobra de um título quebrado em duas linhas) não são assunto
  const saida: CartaoSugerido[] = []
  let resto = bruto.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  while (resto && saida.length < MAX_FRASES_POR_PARAGRAFO) {
    const frase = primeiraFrase(resto)
    resto = resto.slice(frase.length).trim()
    if (DEPENDE_DO_CONTEXTO.test(frase) || ANAFORA.test(frase) || /\bet al\b/i.test(frase)) continue
    const c = lacunaNumerica(frase)
    // o título da seção, quando o parágrafo vem logo depois dele, dá o assunto da frase ("Childhood Autism Rating Scale (CARS): A sensibilidade é de _____…")
    if (c) for (const x of c) if (saida.length < MAX_FRASES_POR_PARAGRAFO) saida.push({ ...x, f: titulo ? `${titulo}: ${x.f}` : x.f, origem: bruto.trim() })
  }
  return saida.length ? saida : null
}

export function lacunaNumerica(bruto: string): CartaoSugerido[] | null {
  const p = bruto.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  if (p.length < 40 || p.length > 300 || !/[.!]$/.test(p) || /^#/.test(p)) return null
  const achados: { ini: number; fim: number; texto: string }[] = []
  for (const m of p.matchAll(NUMERO)) { const t = m[1] ?? m[2]; const ini = (m.index ?? 0) + m[0].indexOf(t); achados.push({ ini, fim: ini + t.length, texto: t }) }
  for (const m of p.matchAll(ANO)) { const t = m[1]; const ini = (m.index ?? 0) + m[0].lastIndexOf(t); if (!achados.some((a) => ini >= a.ini && ini < a.fim)) achados.push({ ini, fim: ini + t.length, texto: t }) }
  if (!achados.length || achados.length > 2) return null
  achados.sort((a, b) => a.ini - b.ini)
  return achados.map((a) => ({ f: p.slice(0, a.ini) + '_____' + p.slice(a.fim), v: a.texto, tipo: 'numero' as const, origem: bruto.trim() }))
}
