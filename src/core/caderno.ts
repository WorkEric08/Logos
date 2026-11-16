// Caderno de erros e simulado da semana (F5). Puro: sem DOM, banco nem estado.
//
// CADERNO DE ERROS (como o dos sites de questões): toda questão errada entra; sai depois de 3 acertos SEGUIDOS. Quem sabe a ordem das respostas é o registro de
// eventos (core/sync/eventos.ts), que existe desde a sincronização: a sequência de cada questão é lida dali. Antes de haver eventos o app só guardava o
// agregado ("a última resposta foi errada?"); desse tempo vale só o que se sabe: última errada = no caderno (sem contar acertos seguidos).
import type { Evento } from './sync/eventos'
import { tempoDe } from './sync/eventos'
import { pick, shuffle, type Rng } from './weights'
import type { ProgressMap, Question } from './types'

export const SEGUIDOS_PARA_SAIR = 3

export interface ItemCaderno {
  id: string
  /** Quantas vezes errou desde que entrou (ou voltou) ao caderno. */
  erros: number
  /** Acertos seguidos desde o último erro (0, 1 ou 2: com 3 sai). */
  seguidos: number
  /** Quando errou pela última vez. */
  ultimoErro: number
}
export type Caderno = Record<string, ItemCaderno>

/** O caderno a partir dos eventos, na ordem do tempo. "Zerar progresso" apaga o que veio antes dele (igual a `derivar`). */
export function montarCaderno(eventos: readonly Evento[]): Caderno {
  let zt = 0
  for (const e of eventos) if (e.k === 'z' && e.t > zt) zt = e.t
  const vale = (t: number | undefined) => zt === 0 || (t ?? 0) > zt
  const ordenados = [...eventos].filter((e) => e.k === 'r' || e.k === 'b').sort((a, b) => tempoDe(a) - tempoDe(b) || (a.id < b.id ? -1 : 1))
  const c: Caderno = {}
  for (const e of ordenados) {
    if (e.k === 'b') {
      // o evento-base só guarda o agregado: a última resposta errada põe a questão no caderno; "n - c" é quantas vezes errou no total
      for (const [id, p] of Object.entries(e.prog)) if (vale(p.t) && p.ok === false) c[id] = { id, erros: Math.max(1, p.n - p.c), seguidos: 0, ultimoErro: p.t ?? 0 }
    } else if (e.k === 'r' && vale(e.t)) c_(c, e.q, e.ok, e.t)
  }
  return c
}

/** Registra UMA resposta no caderno (a mesma regra de `montarCaderno`, para atualizar sem reler tudo). Devolve o caderno novo. */
export function registrar(c: Caderno, id: string, ok: boolean, t: number): Caderno {
  const novo = { ...c }
  c_(novo, id, ok, t)
  return novo
}

function c_(c: Caderno, id: string, ok: boolean, t: number) {
  const atual = c[id]
  if (!ok) { c[id] = { id, erros: (atual?.erros ?? 0) + 1, seguidos: 0, ultimoErro: t }; return }
  if (!atual) return
  if (atual.seguidos + 1 >= SEGUIDOS_PARA_SAIR) delete c[id]
  else c[id] = { ...atual, seguidos: atual.seguidos + 1 }
}

/** Junta o caderno dos eventos com o que o progresso agregado já diz (última errada) e fica só com as questões do espaço atual. */
export function cadernoDoEspaco(eventos: readonly Evento[], prog: ProgressMap, bank: readonly Question[]): Caderno {
  const c = montarCaderno(eventos)
  const ids = new Set(bank.map((q) => q.id))
  const saida: Caderno = {}
  for (const id of Object.keys(c)) if (ids.has(id)) saida[id] = c[id]
  for (const q of bank) {
    const p = prog[q.id]
    if (p?.ok === false && !saida[q.id]) saida[q.id] = { id: q.id, erros: Math.max(1, p.n - p.c), seguidos: 0, ultimoErro: p.t ?? 0 }
  }
  return saida
}

export interface ResumoCaderno {
  total: number
  /** A última resposta foi errada. */
  naUltima: number
  /** Já acertaram 1 ou 2 vezes seguidas e saem com mais acertos. */
  recuperando: number
  porMateria: { materia: string; n: number }[]
}

export function resumirCaderno(c: Caderno, bank: readonly Question[]): ResumoCaderno {
  const por = new Map<string, number>()
  const mat = new Map(bank.map((q) => [q.id, q.m]))
  let naUltima = 0, recuperando = 0
  for (const it of Object.values(c)) {
    if (it.seguidos === 0) naUltima++; else recuperando++
    const m = mat.get(it.id)
    if (m) por.set(m, (por.get(m) ?? 0) + 1)
  }
  return { total: naUltima + recuperando, naUltima, recuperando, porMateria: [...por].map(([materia, n]) => ({ materia, n })).sort((a, b) => b.n - a.n || a.materia.localeCompare(b.materia, 'pt-BR')) }
}

/** As questões do caderno (filtradas pelo pool), as que mais erram primeiro; entre iguais, as que menos acertaram seguido e as erradas há menos tempo. */
export function dosErros(c: Caderno, pool: readonly Question[], n: number, rng: Rng = Math.random): Question[] {
  const sorteio = new Map(pool.map((q) => [q.id, rng()]))
  return pool.filter((q) => c[q.id])
    .sort((a, b) => c[b.id].erros - c[a.id].erros || c[a.id].seguidos - c[b.id].seguidos || c[b.id].ultimoErro - c[a.id].ultimoErro || sorteio.get(a.id)! - sorteio.get(b.id)!)
    .slice(0, n)
}

// ---------------------------------------------------------------- matérias fracas e simulado da semana

export const MIN_RESPOSTAS_MATERIA = 8

/** As matérias com pior taxa de acerto (só as que a pessoa já respondeu pelo menos 8 vezes, para não julgar por pouco). Da pior para a melhor. */
export function materiasFracas(prog: ProgressMap, bank: readonly Question[], k = 2): { materia: string; acerto: number; n: number }[] {
  const por = new Map<string, { n: number; c: number }>()
  for (const q of bank) {
    const p = prog[q.id]
    if (!p?.n) continue
    const x = por.get(q.m) ?? { n: 0, c: 0 }
    x.n += p.n; x.c += p.c
    por.set(q.m, x)
  }
  const lista = [...por].filter(([, x]) => x.n >= MIN_RESPOSTAS_MATERIA).map(([materia, x]) => ({ materia, acerto: x.c / x.n, n: x.n }))
  lista.sort((a, b) => a.acerto - b.acerto || b.n - a.n)
  const geral = [...por.values()].reduce((s, x) => s + x.c, 0) / Math.max(1, [...por.values()].reduce((s, x) => s + x.n, 0))
  return lista.filter((m) => m.acerto < geral || lista.length === 1).slice(0, k) // "fraca" = abaixo da média geral da própria pessoa
}

export interface Semana {
  ids: string[]
  /** De onde veio cada parte (para o assistente explicar a mistura). */
  partes: { erros: number; fracas: number; novas: number; outras: number }
  materiasFracas: string[]
}

/** Divisão do tamanho pedido: 40 % caderno de erros, 30 % matérias fracas, 30 % questões novas (o que faltar de uma parte passa para as outras). */
export function montarSemana(bank: readonly Question[], prog: ProgressMap, caderno: Caderno, tf: Record<string, number>, quantidade: number, rng: Rng = Math.random): Semana {
  const n = Math.min(quantidade, bank.length)
  const usadas = new Set<string>()
  const escolher = (qs: Question[]) => { for (const q of qs) usadas.add(q.id); return qs.length }

  const nErros = escolher(dosErros(caderno, bank.filter((q) => !usadas.has(q.id)), Math.round(n * 0.4), rng))
  const fracas = materiasFracas(prog, bank).map((m) => m.materia)
  const poolFracas = bank.filter((q) => fracas.includes(q.m) && !usadas.has(q.id))
  const nFracas = fracas.length ? escolher(pick(poolFracas, Math.round(n * 0.3), tf, prog, rng)) : 0
  const poolNovas = bank.filter((q) => !prog[q.id]?.n && !usadas.has(q.id))
  const nNovas = escolher(pick(poolNovas, n - usadas.size, tf, prog, rng)) // o que o caderno e as matérias fracas não preencheram vem das questões novas
  const faltam = n - usadas.size
  const nOutras = faltam > 0 ? escolher(pick(bank.filter((q) => !usadas.has(q.id)), faltam, tf, prog, rng)) : 0
  return { ids: shuffle([...usadas], rng), partes: { erros: nErros, fracas: nFracas, novas: nNovas, outras: nOutras }, materiasFracas: fracas }
}
