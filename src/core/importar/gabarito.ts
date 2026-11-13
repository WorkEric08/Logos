// Do PDF do gabarito para "número da questão → letra". Puro. Aceita o formato das bancas ("1 - C  2 - D …") e a variante "1 C 2 D".
// O gabarito pode trazer várias provas/cadernos ("GABARITO 1", "GABARITO 2"…): por padrão vale o primeiro.
import type { Letter } from '../types'
import type { Linha } from './layout'

export type Respostas = Record<number, Letter | null> // null = questão anulada
export interface GabaritoLido { respostas: Respostas; secao: number; secoes: number[]; avisos: string[] }

const COM_TRACO = /(?<![\d.])(\d{1,3})\s*[-–—]\s*(ANULAD[AO]|[A-E])(?![A-Za-zÀ-ÿ])/g
const SEM_TRACO = /(?<![\d.])(\d{1,3})\s+(ANULAD[AO]|[A-E])(?![A-Za-zÀ-ÿ])/g

function pares(texto: string, re: RegExp): [number, Letter | null][] {
  const saida: [number, Letter | null][] = []
  for (const m of texto.matchAll(re)) saida.push([Number(m[1]), /^ANULAD/i.test(m[2]) ? null : (m[2].toUpperCase() as Letter)])
  return saida
}

export function lerGabarito(linhas: readonly Linha[], opcoes: { secao?: number } = {}): GabaritoLido {
  const avisos: string[] = []
  const porSecao = new Map<number, [number, Letter | null][]>()
  let secao = 1
  const todas: string[] = []
  for (const l of linhas) {
    const m = /GABARITO\s*(\d+)/i.exec(l.texto)
    if (m && !/\d\s*[-–]\s*[A-E]/.test(l.texto)) { secao = Number(m[1]); continue }
    todas.push(l.texto)
    const lista = porSecao.get(secao) ?? []
    lista.push(...pares(l.texto, COM_TRACO))
    porSecao.set(secao, lista)
  }
  // formato sem traço ("1 C 2 D"): só se o com traço não achou quase nada
  if ([...porSecao.values()].reduce((a, l) => a + l.length, 0) < 5) {
    porSecao.clear(); secao = 1
    for (const l of linhas) {
      const m = /GABARITO\s*(\d+)/i.exec(l.texto)
      if (m) { secao = Number(m[1]); continue }
      porSecao.set(secao, [...(porSecao.get(secao) ?? []), ...pares(l.texto, SEM_TRACO)])
    }
  }
  const secoes = [...porSecao.keys()].filter((k) => porSecao.get(k)!.length).sort((a, b) => a - b)
  const escolhida = opcoes.secao && secoes.includes(opcoes.secao) ? opcoes.secao : secoes[0] ?? 1
  const respostas: Respostas = {}
  for (const [n, l] of porSecao.get(escolhida) ?? []) {
    if (n in respostas && respostas[n] !== l) avisos.push(`a questão ${n} aparece com respostas diferentes no gabarito`)
    else respostas[n] = l
  }
  if (!Object.keys(respostas).length) avisos.push('nenhuma resposta encontrada: o gabarito pode ser uma imagem (escaneado)')
  if (secoes.length > 1) avisos.push(`o arquivo tem ${secoes.length} gabaritos (${secoes.join(', ')}); usei o ${escolhida}`)
  return { respostas, secao: escolhida, secoes, avisos }
}
