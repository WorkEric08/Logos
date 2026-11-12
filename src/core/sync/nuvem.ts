// Itens que se EDITAM nos dois aparelhos, vistos como "chave → valor versionado" (cartões, baralhos, marcações, ajustes). Puro: sem banco nem rede.
// A chave diz o tipo: `b:<id>` baralho, `c:<id>` cartão, `m:<id da questão>` marcação/anotação, `fc` ajustes dos Cards, `fch` histórico dos Cards.
// "A última alteração vence" (versionados.ts); apagar vira lápide (`x: 1`) para a exclusão chegar ao outro aparelho.
import { vence, type Versionado } from './versionados'

export interface ItemNuvem { key: string; u: number; dev: string; x?: 1; v?: unknown }
/** O que o aparelho guarda sobre cada item para sincronizar (sem o valor, que mora nas tabelas de sempre). */
export interface Sinc { id: string; u: number; dev: string; x?: 1 }

export type TipoItem = 'baralho' | 'cartao' | 'marca' | 'ajustes' | 'histCards'
export const chaveBaralho = (id: string) => `b:${id}`
export const chaveCartao = (id: string) => `c:${id}`
export const chaveMarca = (id: string) => `m:${id}`
export const CHAVE_AJUSTES = 'fc'
export const CHAVE_HIST_CARDS = 'fch'

export function tipoDe(key: string): { tipo: TipoItem; id: string } | null {
  if (key === CHAVE_AJUSTES) return { tipo: 'ajustes', id: '' }
  if (key === CHAVE_HIST_CARDS) return { tipo: 'histCards', id: '' }
  const t = key.slice(0, 2), id = key.slice(2)
  if (!id) return null
  if (t === 'b:') return { tipo: 'baralho', id }
  if (t === 'c:') return { tipo: 'cartao', id }
  if (t === 'm:') return { tipo: 'marca', id }
  return null
}

/** O id do documento no Firestore (não pode ter "/"). */
export const docId = (key: string) => key.replace(/\//g, '|')
export const chaveDeDoc = (id: string) => id.replace(/\|/g, '/')

const v = (s: { id: string; u: number; dev: string }): Versionado => ({ id: s.id, u: s.u, dev: s.dev })
const igual = (a: { u: number; dev: string }, b: { u: number; dev: string }) => a.u === b.u && a.dev === b.dev

/** O lado `a` tem uma versão mais nova que `b` (igual não conta)? */
export const maisNovo = (a: { id: string; u: number; dev: string }, b: { id: string; u: number; dev: string }) => !igual(a, b) && vence(v(a), v(b))

/** O que o aparelho tem de ENVIAR: itens locais que a nuvem não tem ou tem mais antigos. */
export function aEnviarItens(locais: readonly Sinc[], remotos: ReadonlyMap<string, { u: number; dev: string }>): Sinc[] {
  return locais.filter((l) => { const r = remotos.get(l.id); return !r || maisNovo(l, { id: l.id, ...r }) })
}

/** O que o aparelho tem de APLICAR: itens da nuvem que o local não tem ou tem mais antigos. */
export function aAplicarItens<T extends { key: string; u: number; dev: string }>(remotos: readonly T[], locais: ReadonlyMap<string, { u: number; dev: string }>): T[] {
  return remotos.filter((r) => { const l = locais.get(r.key); return !l || maisNovo({ id: r.key, u: r.u, dev: r.dev }, { id: r.key, ...l }) })
}

/** Confere o formato de um documento vindo da nuvem (nunca confiar no que chega: pode ser de uma versão antiga ou ter sido mexido à mão). */
export function itemValido(key: string, d: unknown): ItemNuvem | null {
  if (!tipoDe(key) || !d || typeof d !== 'object') return null
  const o = d as Record<string, unknown>
  if (typeof o.u !== 'number' || !Number.isFinite(o.u) || typeof o.dev !== 'string') return null
  if (o.x === 1) return { key, u: o.u, dev: o.dev, x: 1 }
  if (o.v === undefined || o.v === null || typeof o.v !== 'object') return null
  return { key, u: o.u, dev: o.dev, v: o.v }
}

// ---------- eventos vindos da nuvem ----------
import type { Evento } from './eventos'
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const LETRAS = ['A', 'B', 'C', 'D', 'E']
const simOk = (s: unknown): boolean => {
  if (!s || typeof s !== 'object') return false
  const o = s as Record<string, unknown>
  return num(o.t) && num(o.p) && num(o.b) && num(o.e) && num(o.c) && num(o.n) && typeof o.ok === 'boolean' && (o.d === undefined || num(o.d))
}
/** Confere um evento vindo da nuvem (o id do documento tem de ser o do evento). Lixo vira null e é ignorado, nunca quebra a abertura. */
export function eventoValido(id: string, d: unknown): Evento | null {
  if (!d || typeof d !== 'object') return null
  const o = d as Record<string, unknown>
  if (o.id !== id || typeof o.dev !== 'string') return null
  if (o.k === 'r') return typeof o.q === 'string' && typeof o.l === 'string' && LETRAS.includes(o.l) && typeof o.ok === 'boolean' && num(o.t) ? (o as unknown as Evento) : null
  if (o.k === 's') return simOk(o.sim) ? (o as unknown as Evento) : null
  if (o.k === 'z') return num(o.t) ? (o as unknown as Evento) : null
  if (o.k === 'b') {
    if (!num(o.t) || !o.prog || typeof o.prog !== 'object' || !o.dias || typeof o.dias !== 'object' || !Array.isArray(o.sims)) return null
    const prog = Object.fromEntries(Object.entries(o.prog).filter(([, p]) => !!p && typeof p === 'object' && num((p as { n?: unknown }).n) && num((p as { c?: unknown }).c)))
    const dias = Object.fromEntries(Object.entries(o.dias).filter(([, p]) => !!p && typeof p === 'object' && num((p as { n?: unknown }).n) && num((p as { c?: unknown }).c)))
    return { ...(o as object), prog, dias, sims: o.sims.filter(simOk) } as unknown as Evento
  }
  return null
}
