// Lacuna em números, datas e valores ("a cada 45 dias", "25%", "em 1964", "R$ 250 mil"): a frase com o número escondido. Só para frases curtas e inteiras,
// com no máximo dois valores (mais que isso vira confusão). Serve de último recurso: parágrafos que nenhuma outra regra aproveitou. Puro.
import type { CartaoSugerido } from './tipos'

const UNIDADE = '(?:%|por cento|dias?|meses|mês|anos?|horas?|reais|mil|milhões|milhão|bilhões|bilhão|vezes|pontos percentuais)'
const NUMERO = new RegExp(`(?<![\\wÀ-ÿ])(\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?\\s?${UNIDADE})(?![\\wÀ-ÿ])|(R\\$\\s?\\d[\\d.,]*(?:\\s(?:mil|milhões|bilhões))?)`, 'gi')
const ANO = /(?:^|[\s(])(?:em|de|desde|até|no ano de)\s+((?:1[5-9]|20)\d{2})(?![\d])/gi

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
