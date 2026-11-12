// Sincronização entre aparelhos (celular fora de casa, PC em casa): o PROGRESSO e o HISTÓRICO viram um registro de eventos que só se acrescenta.
// Cada aparelho escreve só no seu próprio registro (um dono por registro: nunca há conflito de escrita) e os outros só leem; juntar os registros é uma
// união, que dá o mesmo resultado em qualquer ordem e quantas vezes for repetida (idempotente). O progresso e o histórico que a tela usa são DERIVADOS dos eventos.
// Funções puras (sem DOM, banco nem rede): services/sync cuida de guardar e enviar. Regra de ouro: derivar(eventos) tem de dar o mesmo que as contas atuais
// do app (recordAnswer, registrarResposta, registrarSimulado): o teste em eventos.test.ts compara as duas.
import { diaDe, MAX_SIMS, type Dia, type Hist, type Sim } from '../historico'
import type { Letter, ProgressMap } from '../types'

/** Uma resposta dada (treino, revisão de erros ou simulado entregue). */
export interface EvResposta { k: 'r'; id: string; dev: string; q: string; l: Letter; ok: boolean; t: number }
/** Um simulado entregue (nota e tempo). */
export interface EvSimulado { k: 's'; id: string; dev: string; sim: Sim }
/** O que o aparelho já tinha ANTES de existir sincronização (progresso agregado e histórico): entra uma vez só, por aparelho. */
export interface EvBase { k: 'b'; id: string; dev: string; t: number; prog: ProgressMap; dias: Record<string, Dia>; sims: Sim[] }
/** "Zerar progresso": tudo o que é anterior a `t`, de qualquer aparelho, deixa de valer. Desfazer = apagar este evento (nada foi apagado de verdade). */
export interface EvZerar { k: 'z'; id: string; dev: string; t: number }
export type Evento = EvResposta | EvSimulado | EvBase | EvZerar

// Os ids são determinísticos: enviar o mesmo evento duas vezes grava o mesmo documento (sem duplicar).
export const idResposta = (dev: string, t: number, q: string) => `r:${dev}:${t}:${q}`
export const idSimulado = (dev: string, t: number) => `s:${dev}:${t}`
export const idBase = (dev: string) => `b:${dev}`
export const idZerar = (dev: string, t: number) => `z:${dev}:${t}`

export const resposta = (dev: string, q: string, l: Letter, ok: boolean, t: number): EvResposta => ({ k: 'r', id: idResposta(dev, t, q), dev, q, l, ok, t })
export const simulado = (dev: string, sim: Sim): EvSimulado => ({ k: 's', id: idSimulado(dev, sim.t), dev, sim })
export const zerar = (dev: string, t: number): EvZerar => ({ k: 'z', id: idZerar(dev, t), dev, t })
/** Foto do que o aparelho já tinha: vira o evento-base (guarda cópias, não referências). */
export const baseDe = (dev: string, t: number, prog: ProgressMap, hist: Hist): EvBase =>
  ({ k: 'b', id: idBase(dev), dev, t, prog: structuredClone(prog), dias: structuredClone(hist.dias), sims: structuredClone(hist.sims) })

/** Quando o evento aconteceu (para ordenar). */
export const tempoDe = (e: Evento): number => (e.k === 's' ? e.sim.t : e.t)
const ordem = (a: Evento, b: Evento) => tempoDe(a) - tempoDe(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * União dos registros de vários aparelhos (e do que já está no local). Mesmo id = mesmo evento (fica um só); se o evento-base de um aparelho foi
 * refeito, vale o mais recente. O resultado vem em ordem de tempo, igual em qualquer ordem das listas e se uma lista se repetir.
 */
export function mesclarEventos(...listas: readonly (readonly Evento[])[]): Evento[] {
  const por = new Map<string, Evento>()
  for (const lista of listas) for (const e of lista) {
    const antigo = por.get(e.id)
    if (!antigo || (e.k === 'b' && antigo.k === 'b' && e.t > antigo.t)) por.set(e.id, e)
  }
  return [...por.values()].sort(ordem)
}

const mesmaSim = (a: Sim, b: Sim) => a.t === b.t && a.p === b.p && a.b === b.b && a.e === b.e && a.c === b.c && a.n === b.n

/** O progresso (por questão) e o histórico (por dia e simulados) que a tela mostra, calculados a partir dos eventos. */
export function derivar(eventos: readonly Evento[]): { prog: ProgressMap; hist: Hist } {
  let zt = 0 // o último "zerar" vence: o que vem antes dele não conta
  for (const e of eventos) if (e.k === 'z' && e.t > zt) zt = e.t
  const vale = (t: number | undefined) => zt === 0 || (t ?? 0) > zt
  const diaZ = zt ? diaDe(zt) : ''
  const prog: ProgressMap = {}
  const dias: Record<string, Dia> = {}
  const sims: Sim[] = []
  const ultimo: Record<string, { t: number; id: string }> = {} // qual evento é o "último" de cada questão (para ok, last e t)
  const soma = (q: string, n: number, c: number, ok: boolean | null, last: Letter | undefined, t: number | undefined, id: string) => {
    const p = prog[q] ?? { n: 0, c: 0, ok: null }
    p.n += n; p.c += c
    const chave = { t: t ?? 0, id }, u = ultimo[q]
    if (!u || chave.t > u.t || (chave.t === u.t && chave.id > u.id)) {
      ultimo[q] = chave; p.ok = ok
      if (last !== undefined) p.last = last; else delete p.last
      if (t !== undefined) p.t = t; else delete p.t
    }
    prog[q] = p
  }
  const somaDia = (dia: string, n: number, c: number) => { const d = dias[dia] ?? { n: 0, c: 0 }; d.n += n; d.c += c; dias[dia] = d }
  const addSim = (s: Sim) => { if (vale(s.t) && !sims.some((x) => mesmaSim(x, s))) sims.push({ ...s }) }
  for (const e of eventos) {
    if (e.k === 'r') {
      if (!vale(e.t)) continue
      soma(e.q, 1, e.ok ? 1 : 0, e.ok, e.l, e.t, e.id); somaDia(diaDe(e.t), 1, e.ok ? 1 : 0)
    } else if (e.k === 's') addSim(e.sim)
    else if (e.k === 'b') {
      for (const [q, p] of Object.entries(e.prog)) if (vale(p.t)) soma(q, p.n, p.c, p.ok, p.last, p.t, e.id)
      for (const [dia, d] of Object.entries(e.dias)) if (zt === 0 || dia > diaZ) somaDia(dia, d.n, d.c)
      for (const s of e.sims) addSim(s)
    }
  }
  sims.sort((a, b) => a.t - b.t)
  return { prog, hist: { dias, sims: sims.slice(-MAX_SIMS) } }
}
