import Dexie, { type Table } from 'dexie'
import type { Progress, ProgressMap } from '../core/types'
import { limparHist, limparMarks, type Hist, type Marks } from '../core/historico'
import { limparCards, type Ajustes, type Baralho, type Cartao, type DadosCards } from '../core/cards'
import { derivar, tempoDe, type EvBase, type EvResposta, type EvSimulado, type EvZerar, type Evento } from '../core/sync/eventos'

interface Row extends Progress { id: string }
interface Meta { key: string; value: string }
/** Evento de sincronização como fica no banco: o `t` (quando aconteceu) vai na linha para o índice [dev+t] (o simulado guarda o seu em `sim.t`). */
type Linha = Evento & { t: number }
const linha = (e: Evento): Linha => ({ ...e, t: tempoDe(e) })

// Nome do banco fixo: renomear o produto nunca pode trocar este nome (abriria um banco vazio).
class TreinoDb extends Dexie {
  prog!: Table<Row, string>
  meta!: Table<Meta, string>
  decks!: Table<Baralho, string>
  cards!: Table<Cartao, string>
  eventos!: Table<Linha, string>
  constructor() {
    super('treino-bb')
    this.version(1).stores({ prog: 'id', meta: 'key' })
    // v2 (flashcards): só ACRESCENTA as tabelas decks e cards; prog e meta (o progresso) não são tocadas.
    this.version(2).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b' })
    // v3 (sincronização): só ACRESCENTA a tabela de eventos (respostas, simulados, zerar, evento-base); prog, meta, decks e cards não são tocadas.
    this.version(3).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b', eventos: 'id, [dev+t]' })
  }
}
const db = new TreinoDb()

/** Histórico e marcações ficam na tabela `meta` (JSON), então o esquema do banco não muda e nada do progresso antigo é tocado. */
const lerJson = async (key: string): Promise<unknown> => { try { const v = (await db.meta.get(key))?.value; return v ? JSON.parse(v) : null } catch { return null } }

export async function loadAll(): Promise<{ prog: ProgressMap; tema: string; hist: Hist; marks: Marks }> {
  const rows = await db.prog.toArray()
  const prog: ProgressMap = {}
  for (const { id, ...p } of rows) prog[id] = p
  const tema = (await db.meta.get('tema'))?.value ?? 'auto'
  return { prog, tema, hist: limparHist(await lerJson('hist')), marks: limparMarks(await lerJson('marks')) }
}
export const saveOne = (id: string, p: Progress) => db.prog.put({ id, ...p })
export async function replaceAll(prog: ProgressMap) {
  await db.transaction('rw', db.prog, async () => {
    await db.prog.clear()
    await db.prog.bulkPut(Object.entries(prog).map(([id, p]) => ({ id, ...p })))
  })
}
export const saveTema = (value: string) => db.meta.put({ key: 'tema', value })
export const saveHist = (h: Hist) => db.meta.put({ key: 'hist', value: JSON.stringify(h) })
export const saveMarks = (m: Marks) => db.meta.put({ key: 'marks', value: JSON.stringify(m) })

export function askPersist() {
  try { void navigator.storage?.persist?.() } catch { /* sem suporte: segue */ }
}

// ---------- flashcards ----------
export async function loadCards(): Promise<DadosCards> {
  const [baralhos, cartoes] = await Promise.all([db.decks.toArray(), db.cards.toArray()])
  return limparCards({ baralhos, cartoes, ajustes: await lerJson('fc'), hist: await lerJson('fchist') }, limparHist)
}
export const saveBaralho = (b: Baralho) => db.decks.put(b)
export const saveCartao = (c: Cartao) => db.cards.put(c)
export const saveCartoes = (cs: Cartao[]) => db.cards.bulkPut(cs)
export const deleteCartao = (id: string) => db.cards.delete(id)
export async function deleteBaralho(id: string) {
  await db.transaction('rw', db.decks, db.cards, async () => { await db.cards.where('b').equals(id).delete(); await db.decks.delete(id) })
}
export const saveAjustes = (a: Ajustes) => db.meta.put({ key: 'fc', value: JSON.stringify(a) })
export const saveFcHist = (h: Hist) => db.meta.put({ key: 'fchist', value: JSON.stringify(h) })
/** Troca tudo de uma vez (restaurar backup, desfazer): se falhar, o banco fica como estava. */
export async function replaceCards(d: DadosCards) {
  await db.transaction('rw', db.decks, db.cards, db.meta, async () => {
    await db.cards.clear(); await db.decks.clear()
    await db.decks.bulkPut(d.baralhos); await db.cards.bulkPut(d.cartoes)
    await db.meta.put({ key: 'fc', value: JSON.stringify(d.ajustes) }); await db.meta.put({ key: 'fchist', value: JSON.stringify(d.hist) })
  })
}

// ---------- sincronização: registro de eventos (core/sync/eventos.ts) ----------
// O progresso e o histórico que a tela usa continuam sendo gravados como sempre; JUNTO, na mesma transação, vai o evento. Assim os dois nunca se afastam
// (se o app fechar no meio, nenhum dos dois é gravado) e o progresso derivado dos eventos é igual ao da tela (conferido ao abrir: services/sync/preparar.ts).
const novoIdAparelho = () => { const b = new Uint8Array(6); try { crypto.getRandomValues(b) } catch { for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256) } return 'd' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('') }
let aparelhoCache: string | null = null
/** O id deste aparelho (criado uma vez e guardado): é o dono do seu registro de eventos. Não muda ao atualizar o app. */
export async function idDoAparelho(): Promise<string> {
  if (aparelhoCache) return aparelhoCache
  const v = (await db.meta.get('dev'))?.value
  if (v) return (aparelhoCache = v)
  const novo = novoIdAparelho(); await db.meta.put({ key: 'dev', value: novo }); return (aparelhoCache = novo)
}
export const lerEventos = async (): Promise<Evento[]> => (await db.eventos.toArray()) as Evento[]
export const gravarBase = (ev: EvBase) => db.eventos.put(linha(ev))
export const gravarConferencia = (valor: unknown) => db.meta.put({ key: 'sync:conferencia', value: JSON.stringify(valor) })
export const lerConferencia = () => lerJson('sync:conferencia')
/** Uma resposta: progresso da questão + histórico + evento, numa transação só. */
export const gravarResposta = (id: string, p: Progress, hist: Hist, ev: EvResposta) =>
  db.transaction('rw', db.prog, db.meta, db.eventos, async () => { await db.prog.put({ id, ...p }); await db.meta.put({ key: 'hist', value: JSON.stringify(hist) }); await db.eventos.put(linha(ev)) })
/** Um simulado entregue: histórico + evento. */
export const gravarSimulado = (hist: Hist, ev: EvSimulado) =>
  db.transaction('rw', db.meta, db.eventos, async () => { await db.meta.put({ key: 'hist', value: JSON.stringify(hist) }); await db.eventos.put(linha(ev)) })
/** "Zerar progresso": limpa o que a tela mostra e grava o evento de zerar (nada dos eventos antigos é apagado: é isso que permite desfazer). */
export const gravarZerar = (ev: EvZerar) =>
  db.transaction('rw', db.prog, db.meta, db.eventos, async () => { await db.prog.clear(); await db.meta.put({ key: 'hist', value: JSON.stringify({ dias: {}, sims: [] } satisfies Hist) }); await db.eventos.put(linha(ev)) })
/** Desfazer o zerar: apaga o evento e refaz o progresso e o histórico a partir dos eventos (respostas dadas depois do zerar não se perdem). */
export function desfazerZerar(idDoEvento: string): Promise<{ prog: ProgressMap; hist: Hist }> {
  return db.transaction('rw', db.prog, db.meta, db.eventos, async () => {
    await db.eventos.delete(idDoEvento)
    const d = derivar((await db.eventos.toArray()) as Evento[])
    await db.prog.clear(); await db.prog.bulkPut(Object.entries(d.prog).map(([id, p]) => ({ id, ...p })))
    await db.meta.put({ key: 'hist', value: JSON.stringify(d.hist) })
    return d
  })
}
/** Restaurar um backup troca o progresso inteiro: os eventos DESTE aparelho são refeitos como um evento-base do que foi restaurado. */
export const refazerEventosDoAparelho = (dev: string, base: EvBase | null) =>
  db.transaction('rw', db.eventos, async () => { await db.eventos.filter((e) => e.dev === dev).delete(); if (base) await db.eventos.put(linha(base)) })
