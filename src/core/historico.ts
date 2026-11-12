// Histórico de estudo (por dia e por simulado) e marcações/anotações por questão. Funções puras: o armazenamento fica em services/db.ts.
import type { ProgressMap } from './types'

/** n = respostas dadas no dia, c = certas. */
export interface Dia { n: number; c: number }
export interface Sim {
  t: number // quando foi entregue (ms)
  p: number // nota, de 0 a 100
  b: number; e: number // pontos nos básicos e nos específicos
  c: number; n: number // certas / total
  ok: boolean // passou em todas as regras do edital
  d?: number // tempo gasto, em segundos (cronômetro escondido; simulados antigos não têm)
}
export interface Hist { dias: Record<string, Dia>; sims: Sim[] }
export interface Marca { r?: boolean; a?: string; t: number }
export type Marks = Record<string, Marca>

export const HIST_VAZIO: Hist = { dias: {}, sims: [] }
export const MAX_SIMS = 100

const p2 = (n: number) => String(n).padStart(2, '0')
/** Dia no fuso do aparelho, "2026-11-08". */
export const diaDe = (t: number | Date) => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` }
const voltaDia = (d: string, k: number) => { const [y, m, dd] = d.split('-').map(Number); return diaDe(new Date(y, m - 1, dd - k, 12)) }

export function registrarResposta(h: Hist, certa: boolean, now: number): Hist {
  const k = diaDe(now), d = h.dias[k] ?? { n: 0, c: 0 }
  return { ...h, dias: { ...h.dias, [k]: { n: d.n + 1, c: d.c + (certa ? 1 : 0) } } }
}

export function registrarSimulado(h: Hist, s: Sim): Hist {
  return { ...h, sims: [...h.sims, s].slice(-MAX_SIMS) }
}

/** Os últimos `k` dias, do mais antigo ao de hoje (dias sem estudo vêm com zero). */
export function ultimosDias(h: Hist, k: number, hoje: number): { dia: string; n: number; c: number }[] {
  const fim = diaDe(hoje)
  return Array.from({ length: k }, (_, i) => { const dia = voltaDia(fim, k - 1 - i); const d = h.dias[dia]; return { dia, n: d?.n ?? 0, c: d?.c ?? 0 } })
}

/** Todos os dias do mês de `hoje` (do dia 1 ao último, inclusive os que ainda não chegaram, com zero). */
export function diasDoMes(h: Hist, hoje: number): { dia: string; n: number; c: number }[] {
  const t = new Date(hoje), y = t.getFullYear(), m = t.getMonth(), total = new Date(y, m + 1, 0).getDate()
  return Array.from({ length: total }, (_, i) => { const dia = `${y}-${p2(m + 1)}-${p2(i + 1)}`; const d = h.dias[dia]; return { dia, n: d?.n ?? 0, c: d?.c ?? 0 } })
}

/** Dias seguidos estudando. Se hoje ainda não tem resposta, a sequência de ontem continua valendo. */
export function sequencia(h: Hist, hoje: number): number {
  let dia = diaDe(hoje)
  if (!h.dias[dia]?.n) dia = voltaDia(dia, 1)
  let s = 0
  while (h.dias[dia]?.n) { s++; dia = voltaDia(dia, 1) }
  return s
}

const ehNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Lê o histórico guardado/backup, descartando o que não tem cara de histórico. */
export function limparHist(o: unknown): Hist {
  const h: Hist = { dias: {}, sims: [] }
  if (!o || typeof o !== 'object') return h
  const { dias, sims } = o as { dias?: unknown; sims?: unknown }
  if (dias && typeof dias === 'object') {
    for (const [k, v] of Object.entries(dias)) {
      const d = v as Dia
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && d && ehNum(d.n) && ehNum(d.c) && d.n >= 0 && d.c >= 0 && d.c <= d.n) h.dias[k] = { n: d.n, c: d.c }
    }
  }
  if (Array.isArray(sims)) {
    for (const v of sims) {
      const s = v as Sim
      if (s && ehNum(s.t) && ehNum(s.p) && ehNum(s.b) && ehNum(s.e) && ehNum(s.c) && ehNum(s.n) && typeof s.ok === 'boolean') h.sims.push({ t: s.t, p: s.p, b: s.b, e: s.e, c: s.c, n: s.n, ok: s.ok, ...(ehNum(s.d) && s.d >= 0 ? { d: Math.round(s.d) } : {}) })
    }
    h.sims.sort((a, b) => a.t - b.t); h.sims = h.sims.slice(-MAX_SIMS)
  }
  return h
}

export function limparMarks(o: unknown): Marks {
  const m: Marks = {}
  if (!o || typeof o !== 'object') return m
  for (const [id, v] of Object.entries(o)) {
    const x = v as Marca
    if (!x || typeof x !== 'object') continue
    const a = typeof x.a === 'string' ? x.a.slice(0, 2000) : ''
    if (x.r === true || a.trim()) m[id] = { ...(x.r === true ? { r: true } : {}), ...(a.trim() ? { a } : {}), t: ehNum(x.t) ? x.t : 0 }
  }
  return m
}

/** Liga/desliga "revisar depois". Sem marca e sem anotação, a entrada some. */
export function alternarMarca(m: Marks, id: string, now: number): Marks {
  const x = m[id], r = !x?.r
  return montar(m, id, { r, a: x?.a }, now)
}

/** Guarda a anotação. Anotar uma questão também a marca para revisar. */
export function salvarNota(m: Marks, id: string, texto: string, now: number): Marks {
  const x = m[id], a = texto.slice(0, 2000)
  return montar(m, id, { r: a.trim() ? true : x?.r, a }, now)
}

function montar(m: Marks, id: string, v: { r?: boolean; a?: string }, now: number): Marks {
  const { [id]: _antiga, ...resto } = m; void _antiga
  const a = v.a?.trim() ? v.a : undefined
  if (!v.r && !a) return resto
  return { ...resto, [id]: { ...(v.r ? { r: true } : {}), ...(a ? { a } : {}), t: now } }
}

export const marcadas = (m: Marks) => Object.keys(m).filter((id) => m[id].r)

/** Backup completo. Backups antigos (só `prog`) continuam valendo: hist e marks vêm como null e nada é apagado. */
export function parseBackupCompleto(text: string): { prog: ProgressMap; hist: Hist | null; marks: Marks | null; cards: unknown } | null {
  try {
    const o = JSON.parse(text) as { prog?: ProgressMap; hist?: unknown; marks?: unknown; cards?: unknown }
    if (!o || typeof o.prog !== 'object' || o.prog === null) return null
    const prog: ProgressMap = {}
    for (const [id, p] of Object.entries(o.prog)) if (p && typeof p.n === 'number' && typeof p.c === 'number') prog[id] = p
    return { prog, hist: o.hist === undefined ? null : limparHist(o.hist), marks: o.marks === undefined ? null : limparMarks(o.marks), cards: o.cards === undefined ? null : o.cards }
  } catch {
    return null
  }
}
