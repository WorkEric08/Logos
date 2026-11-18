import Dexie, { type Table } from 'dexie'
import type { Progress, ProgressMap, Question, Subject } from '../core/types'
import type { Banco, RegrasSimulado } from '../core/espaco'
import type { Material, Trecho } from '../core/material'
import { limparHist, limparMarks, type Hist, type Marks } from '../core/historico'
import { limparCards, type Ajustes, type Baralho, type Cartao, type DadosCards } from '../core/cards'
import { chaveBaralho, chaveCartao, chaveMarca, CHAVE_AJUSTES, CHAVE_HIST_CARDS, maisNovo, tipoDe, type ItemNuvem, type Sinc } from '../core/sync/nuvem'
import { derivar, tempoDe, type EvBase, type EvResposta, type EvSimulado, type EvZerar, type Evento } from '../core/sync/eventos'

/** Uma fala da conversa do assistente como fica guardada (para o histórico voltar na próxima abertura do app). */
export interface MensagemSalva { id: number; de: 'a' | 'v'; texto: string; tipo?: 'erro' | 'ok' | 'painel' | 'plano'; achados?: unknown[] }

/** Espaço de estudo criado pela pessoa (as questões ficam na tabela `questoes`, ligadas por `e`). */
export interface EspacoRow { id: string; nome: string; criado: number; fontes: Record<string, string>; bases: Record<string, string>; materias: Subject[]; extras: Subject[]; bancos: Banco[]; simulado: RegrasSimulado | null
  /** Começa com as questões do Banco do Brasil embutidas no app (e as suas próprias somam). */
  usaBB?: boolean }
export type QuestaoRow = Question & { e: string }
export interface ImagemRow { id: string; e: string; blob: Blob }
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
  sinc!: Table<Sinc, string>
  espacos!: Table<EspacoRow, string>
  questoes!: Table<QuestaoRow, string>
  imagens!: Table<ImagemRow, string>
  materiais!: Table<Material, string>
  trechos!: Table<Trecho, string>
  conversa!: Table<MensagemSalva, number>
  constructor() {
    super('treino-bb')
    this.version(1).stores({ prog: 'id', meta: 'key' })
    // v2 (flashcards): só ACRESCENTA as tabelas decks e cards; prog e meta (o progresso) não são tocadas.
    this.version(2).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b' })
    // v3 (sincronização): só ACRESCENTA a tabela de eventos (respostas, simulados, zerar, evento-base); prog, meta, decks e cards não são tocadas.
    this.version(3).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b', eventos: 'id, [dev+t]' })
    // v4 (conta Google): só ACRESCENTA a tabela `sinc` (quando e por qual aparelho cada cartão, baralho, marcação e ajuste mudou, e as lápides de exclusão).
    // Os dados continuam nas tabelas de sempre; `sinc` só diz o que precisa subir ou descer.
    this.version(4).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b', eventos: 'id, [dev+t]', sinc: 'id' })
    // v5 (espaços de estudo): só ACRESCENTA as tabelas dos espaços criados pela pessoa (o do Banco do Brasil vem embutido no app e não mora aqui),
    // das questões importadas (índice por espaço) e das imagens recortadas dos PDFs.
    this.version(5).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b', eventos: 'id, [dev+t]', sinc: 'id', espacos: 'id', questoes: 'id, e', imagens: 'id, e' })
    // v6 (biblioteca de materiais): só ACRESCENTA `materiais` (um por arquivo entregue) e `trechos` (o texto em pedaços buscáveis, ligados por `m`; `e` = espaço).
    this.version(6).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b', eventos: 'id, [dev+t]', sinc: 'id', espacos: 'id', questoes: 'id, e', imagens: 'id, e', materiais: 'id, e', trechos: 'id, m, e' })
    // v7 (histórico da conversa): só ACRESCENTA `conversa` (as falas do assistente, em ordem de id). Nada do que já existe é tocado.
    this.version(7).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b', eventos: 'id, [dev+t]', sinc: 'id', espacos: 'id', questoes: 'id, e', imagens: 'id, e', materiais: 'id, e', trechos: 'id, m, e', conversa: 'id' })
  }
}
const db = new TreinoDb()

// ---------- conta Google: carimbo de alteração (quando e por qual aparelho) ----------
let aparelhoCache: string | null = null
let ultimoU = 0
/** Quando alguma coisa que a sincronização envia muda: a sincronização se inscreve aqui (só um ouvinte). */
let ouvinte: (() => void) | null = null
export const aoMudarLocal = (fn: (() => void) | null) => { ouvinte = fn }
const avisa = <T>(p: Promise<T>): Promise<T> => p.then((r) => { try { ouvinte?.() } catch { /* quem escuta não pode derrubar a gravação */ } return r })
/** Carimbo crescente: duas alterações no mesmo milissegundo ainda se distinguem (senão a segunda não subiria). */
const novoU = () => (ultimoU = Math.max(Date.now(), ultimoU + 1))
const marcar = (chaves: string[], apagado = false) =>
  db.sinc.bulkPut(chaves.map((id) => ({ id, u: novoU(), dev: aparelhoCache ?? '', ...(apagado ? { x: 1 as const } : {}) })))

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
/** Lembrete diário: fica só neste aparelho (a permissão e o alarme também são do aparelho), na tabela meta: o esquema do banco não muda. */
export const lerLembreteGuardado = () => lerJson('lembrete')
/** O plano de estudo em andamento (assistente): fica só neste aparelho, na tabela meta: o esquema do banco não muda. */
export const lerPlanoGuardado = () => lerJson('plano:ativo')
export const gravarPlanoGuardado = (p: unknown) => db.meta.put({ key: 'plano:ativo', value: JSON.stringify(p) })
export const gravarLembreteGuardado = (c: unknown) => db.meta.put({ key: 'lembrete', value: JSON.stringify(c) })
export const saveHist = (h: Hist) => db.meta.put({ key: 'hist', value: JSON.stringify(h) })
/** Marcações: grava e carimba só o que mudou (uma chave por questão), para a sincronização enviar só isso. */
export const saveMarks = (m: Marks) => avisa(db.transaction('rw', db.meta, db.sinc, async () => {
  const antes = limparMarks(await lerJson('marks'))
  const mudou = Object.entries(m).filter(([id, x]) => JSON.stringify(antes[id]) !== JSON.stringify(x)).map(([id]) => chaveMarca(id))
  const sumiu = Object.keys(antes).filter((id) => !(id in m)).map(chaveMarca)
  await db.meta.put({ key: 'marks', value: JSON.stringify(m) })
  await marcar(mudou); await marcar(sumiu, true)
}))

export function askPersist() {
  try { void navigator.storage?.persist?.() } catch { /* sem suporte: segue */ }
}

// ---------- flashcards ----------
export async function loadCards(): Promise<DadosCards> {
  const [baralhos, cartoes] = await Promise.all([db.decks.toArray(), db.cards.toArray()])
  return limparCards({ baralhos, cartoes, ajustes: await lerJson('fc'), hist: await lerJson('fchist') }, limparHist)
}
export const saveBaralho = (b: Baralho) => avisa(db.transaction('rw', db.decks, db.sinc, async () => { await db.decks.put(b); await marcar([chaveBaralho(b.id)]) }))
export const saveCartao = (c: Cartao) => avisa(db.transaction('rw', db.cards, db.sinc, async () => { await db.cards.put(c); await marcar([chaveCartao(c.id)]) }))
export const saveCartoes = (cs: Cartao[]) => avisa(db.transaction('rw', db.cards, db.sinc, async () => { await db.cards.bulkPut(cs); await marcar(cs.map((c) => chaveCartao(c.id))) }))
export const deleteCartao = (id: string) => avisa(db.transaction('rw', db.cards, db.sinc, async () => { await db.cards.delete(id); await marcar([chaveCartao(id)], true) }))
export const deleteBaralho = (id: string) => avisa(db.transaction('rw', db.decks, db.cards, db.sinc, async () => {
  const seus = (await db.cards.where('b').equals(id).primaryKeys()) as string[]
  await db.cards.bulkDelete(seus); await db.decks.delete(id)
  await marcar([...seus.map(chaveCartao), chaveBaralho(id)], true) // cada exclusão vira lápide: é ela que chega ao outro aparelho
}))
const gravarJsonVersionado = (key: string, valor: unknown, chave: string) => avisa(db.transaction('rw', db.meta, db.sinc, async () => { await db.meta.put({ key, value: JSON.stringify(valor) }); await marcar([chave]) }))
export const saveAjustes = (a: Ajustes) => gravarJsonVersionado('fc', a, CHAVE_AJUSTES)
export const saveFcHist = (h: Hist) => gravarJsonVersionado('fchist', h, CHAVE_HIST_CARDS)
/** Troca tudo de uma vez (restaurar backup, desfazer): se falhar, o banco fica como estava. O que sumiu vira lápide; o que ficou é carimbado de novo. */
export const replaceCards = (d: DadosCards) => avisa(db.transaction('rw', db.decks, db.cards, db.meta, db.sinc, async () => {
  const antigos = [...((await db.decks.toCollection().primaryKeys()) as string[]).map(chaveBaralho), ...((await db.cards.toCollection().primaryKeys()) as string[]).map(chaveCartao)]
  await db.cards.clear(); await db.decks.clear()
  await db.decks.bulkPut(d.baralhos); await db.cards.bulkPut(d.cartoes)
  await db.meta.put({ key: 'fc', value: JSON.stringify(d.ajustes) }); await db.meta.put({ key: 'fchist', value: JSON.stringify(d.hist) })
  const novos = [...d.baralhos.map((b) => chaveBaralho(b.id)), ...d.cartoes.map((c) => chaveCartao(c.id)), CHAVE_AJUSTES, CHAVE_HIST_CARDS]
  const fica = new Set(novos)
  await marcar(antigos.filter((k) => !fica.has(k)), true); await marcar(novos)
}))

// ---------- sincronização: registro de eventos (core/sync/eventos.ts) ----------
// O progresso e o histórico que a tela usa continuam sendo gravados como sempre; JUNTO, na mesma transação, vai o evento. Assim os dois nunca se afastam
// (se o app fechar no meio, nenhum dos dois é gravado) e o progresso derivado dos eventos é igual ao da tela (conferido ao abrir: services/sync/preparar.ts).
const novoIdAparelho = () => { const b = new Uint8Array(6); try { crypto.getRandomValues(b) } catch { for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256) } return 'd' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('') }
/** O id deste aparelho (criado uma vez e guardado): é o dono do seu registro de eventos. Não muda ao atualizar o app. */
export async function idDoAparelho(): Promise<string> {
  if (aparelhoCache) return aparelhoCache
  const v = (await db.meta.get('dev'))?.value
  if (v) return (aparelhoCache = v)
  const novo = novoIdAparelho(); await db.meta.put({ key: 'dev', value: novo }); return (aparelhoCache = novo)
}
export const lerEventos = async (): Promise<Evento[]> => (await db.eventos.toArray()) as Evento[]
export const gravarBase = (ev: EvBase) => avisa(db.eventos.put(linha(ev)))
export const gravarConferencia = (valor: unknown) => db.meta.put({ key: 'sync:conferencia', value: JSON.stringify(valor) })
export const lerConferencia = () => lerJson('sync:conferencia')
/** Uma resposta: progresso da questão + histórico + evento, numa transação só. */
export const gravarResposta = (id: string, p: Progress, hist: Hist, ev: EvResposta) =>
  avisa(db.transaction('rw', db.prog, db.meta, db.eventos, async () => { await db.prog.put({ id, ...p }); await db.meta.put({ key: 'hist', value: JSON.stringify(hist) }); await db.eventos.put(linha(ev)) }))
/** Um simulado entregue: histórico + evento. */
export const gravarSimulado = (hist: Hist, ev: EvSimulado) =>
  avisa(db.transaction('rw', db.meta, db.eventos, async () => { await db.meta.put({ key: 'hist', value: JSON.stringify(hist) }); await db.eventos.put(linha(ev)) }))
/** "Zerar progresso": limpa o que a tela mostra e grava o evento de zerar (nada dos eventos antigos é apagado: é isso que permite desfazer). */
export const gravarZerar = (ev: EvZerar) =>
  avisa(db.transaction('rw', db.prog, db.meta, db.eventos, async () => { await db.prog.clear(); await db.meta.put({ key: 'hist', value: JSON.stringify({ dias: {}, sims: [] } satisfies Hist) }); await db.eventos.put(linha(ev)) }))
/** Desfazer o zerar: apaga o evento e refaz o progresso e o histórico a partir dos eventos (respostas dadas depois do zerar não se perdem). */
export function desfazerZerar(idDoEvento: string): Promise<{ prog: ProgressMap; hist: Hist }> {
  return avisa(db.transaction('rw', db.prog, db.meta, db.eventos, async () => {
    await db.eventos.delete(idDoEvento)
    const d = derivar((await db.eventos.toArray()) as Evento[])
    await db.prog.clear(); await db.prog.bulkPut(Object.entries(d.prog).map(([id, p]) => ({ id, ...p })))
    await db.meta.put({ key: 'hist', value: JSON.stringify(d.hist) })
    return d
  }))
}
/** Restaurar um backup troca o progresso inteiro: os eventos DESTE aparelho são refeitos como um evento-base do que foi restaurado. */
export const refazerEventosDoAparelho = (dev: string, base: EvBase | null) =>
  db.transaction('rw', db.eventos, async () => { await db.eventos.filter((e) => e.dev === dev).delete(); if (base) await db.eventos.put(linha(base)) })

// ---------- conta Google: o que sobe e o que desce ----------
// Nada aqui apaga dado do aparelho por conta própria: juntar é sempre uma união (o mais recente de cada item vence) e a exclusão só chega pela lápide
// que a pessoa mesma criou ao apagar. Os dados ficam nas tabelas de sempre; `sinc` só marca quando e por quem cada item mudou.
export const syncAtivo = async () => (await db.meta.get('sync:ativo'))?.value === '1'
export const marcarSyncAtivo = () => db.meta.put({ key: 'sync:ativo', value: '1' })

/** Primeiro login: o que o aparelho já tinha antes da sincronização (sem carimbo) ganha um carimbo com a data do próprio item, para poder subir. */
export async function semearSinc(): Promise<number> {
  return db.transaction('rw', db.decks, db.cards, db.meta, db.sinc, async () => {
    const tem = new Set((await db.sinc.toCollection().primaryKeys()) as string[])
    const dev = aparelhoCache ?? ''
    const novos: Sinc[] = []
    const poe = (id: string, u: number) => { if (!tem.has(id)) novos.push({ id, u: Math.max(1, Math.floor(u) || 1), dev }) }
    for (const b of await db.decks.toArray()) poe(chaveBaralho(b.id), b.criado)
    for (const c of await db.cards.toArray()) poe(chaveCartao(c.id), Math.max(c.criado || 0, c.ult || 0))
    for (const [id, x] of Object.entries(limparMarks(await lerJson('marks')))) poe(chaveMarca(id), x.t)
    if (await db.meta.get('fc')) poe(CHAVE_AJUSTES, 1)
    if (await db.meta.get('fchist')) poe(CHAVE_HIST_CARDS, 1)
    if (novos.length) await db.sinc.bulkPut(novos)
    return novos.length
  })
}
export const lerSinc = () => db.sinc.toArray()

/** Os itens completos (com valor) dos carimbos pedidos, prontos para enviar. Lápide leva só o carimbo. */
export async function valoresDe(sincs: readonly Sinc[]): Promise<ItemNuvem[]> {
  const ids = (tipo: string) => sincs.filter((s) => !s.x && tipoDe(s.id)?.tipo === tipo).map((s) => tipoDe(s.id)!.id)
  const [decks, cards, marks, fc, fch] = await Promise.all([
    db.decks.bulkGet(ids('baralho')), db.cards.bulkGet(ids('cartao')), lerJson('marks').then(limparMarks), lerJson('fc'), lerJson('fchist'),
  ])
  const valor = new Map<string, unknown>()
  for (const d of decks) if (d) valor.set(chaveBaralho(d.id), d)
  for (const c of cards) if (c) valor.set(chaveCartao(c.id), c)
  for (const [id, m] of Object.entries(marks)) valor.set(chaveMarca(id), m)
  if (fc) valor.set(CHAVE_AJUSTES, fc)
  if (fch) valor.set(CHAVE_HIST_CARDS, fch)
  const saida: ItemNuvem[] = []
  for (const s of sincs) {
    if (s.x) saida.push({ key: s.id, u: s.u, dev: s.dev, x: 1 })
    else if (valor.has(s.id)) saida.push({ key: s.id, u: s.u, dev: s.dev, v: valor.get(s.id) })
  }
  return saida
}

/** Aplica o que veio da nuvem (só o que é mais novo que o local). Devolve o que mudou, para a tela recarregar. */
export async function aplicarItens(itens: readonly ItemNuvem[]): Promise<{ cartoes: boolean; marcas: boolean }> {
  const mudou = { cartoes: false, marcas: false }
  if (!itens.length) return mudou
  await db.transaction('rw', db.decks, db.cards, db.meta, db.sinc, async () => {
    const locais = new Map((await db.sinc.bulkGet(itens.map((i) => i.key))).filter(Boolean).map((s) => [s!.id, s!]))
    const novos = itens.filter((i) => { const l = locais.get(i.key); return !l || maisNovo({ id: i.key, u: i.u, dev: i.dev }, l) })
    if (!novos.length) return
    let marks: Marks | null = null
    for (const i of [...novos].sort((a, b) => (a.key < b.key ? -1 : 1))) { // baralhos (b:) antes dos cartões (c:)
      const t = tipoDe(i.key)!
      if (t.tipo === 'baralho') { if (i.x) await db.decks.delete(t.id); else await db.decks.put(i.v as Baralho); mudou.cartoes = true }
      else if (t.tipo === 'cartao') { if (i.x) await db.cards.delete(t.id); else await db.cards.put(i.v as Cartao); mudou.cartoes = true }
      else if (t.tipo === 'marca') {
        marks ??= limparMarks(await lerJson('marks'))
        if (i.x) delete marks[t.id]; else Object.assign(marks, limparMarks({ [t.id]: i.v }))
        mudou.marcas = true
      } else { await db.meta.put({ key: t.tipo === 'ajustes' ? 'fc' : 'fchist', value: JSON.stringify(i.v) }); mudou.cartoes = true }
    }
    if (marks) await db.meta.put({ key: 'marks', value: JSON.stringify(marks) })
    if (mudou.cartoes) { // cartão que chegou de um baralho que não existe (apagado aqui) não fica solto
      const decks = new Set((await db.decks.toCollection().primaryKeys()) as string[])
      const soltos = (await db.cards.filter((c) => !decks.has(c.b)).primaryKeys()) as string[]
      if (soltos.length) await db.cards.bulkDelete(soltos)
    }
    await db.sinc.bulkPut(novos.map((i) => ({ id: i.key, u: i.u, dev: i.dev, ...(i.x ? { x: 1 as const } : {}) })))
  })
  return mudou
}

/** Aplica eventos de outros aparelhos (e apaga os que a nuvem apagou): refaz o progresso e o histórico a partir de todos os eventos. Devolve se algo mudou. */
export async function aplicarEventos(novos: readonly Evento[], removidos: readonly string[]): Promise<boolean> {
  if (!novos.length && !removidos.length) return false
  return db.transaction('rw', db.prog, db.meta, db.eventos, async () => {
    const atuais = new Map((await db.eventos.bulkGet([...novos.map((e) => e.id), ...removidos])).filter(Boolean).map((e) => [e!.id, e!]))
    const poe = novos.filter((e) => { const a = atuais.get(e.id); return !a || (e.k === 'b' && a.k === 'b' && e.t > a.t) })
    const tira = removidos.filter((id) => atuais.has(id))
    if (!poe.length && !tira.length) return false
    await db.eventos.bulkPut(poe.map(linha)); await db.eventos.bulkDelete(tira)
    const d = derivar((await db.eventos.toArray()) as Evento[])
    await db.prog.clear(); await db.prog.bulkPut(Object.entries(d.prog).map(([id, p]) => ({ id, ...p })))
    await db.meta.put({ key: 'hist', value: JSON.stringify(d.hist) })
    return true
  })
}
/** A conta (uid) a que este aparelho está ligado: depois da primeira vez, outra conta não entra (misturaria dados de pessoas diferentes). */
export const lerUidSync = async () => (await db.meta.get('sync:uid'))?.value ?? null
export const gravarUidSync = (uid: string) => db.meta.put({ key: 'sync:uid', value: uid })

// ---------- espaços de estudo (importados pela pessoa) ----------
export const lerEspacoAtivoId = async () => (await db.meta.get('espaco:ativo'))?.value ?? null
export const gravarEspacoAtivoId = (id: string) => db.meta.put({ key: 'espaco:ativo', value: id })
/** Lista os espaços criados pela pessoa, com a quantidade de questões de cada um. */
export async function listarEspacos(): Promise<(EspacoRow & { n: number })[]> {
  const linhas = await db.espacos.toArray()
  return Promise.all(linhas.map(async (r) => ({ ...r, n: await db.questoes.where('e').equals(r.id).count() })))
}
export async function lerEspaco(id: string): Promise<{ row: EspacoRow; questoes: Question[] } | null> {
  const row = await db.espacos.get(id)
  if (!row) return null
  const q = await db.questoes.where('e').equals(id).toArray()
  return { row, questoes: q.map(({ e, ...resto }) => { void e; return resto as Question }) }
}
/** Grava o espaço e as questões dele numa transação só (se falhar, nada fica pela metade). */
export const salvarEspaco = (row: EspacoRow, questoes: Question[]) =>
  db.transaction('rw', db.espacos, db.questoes, async () => { await db.espacos.put(row); await db.questoes.bulkPut(questoes.map((q) => ({ ...q, e: row.id }))) })
/** Apaga o espaço, as questões e as imagens dele. O progresso das questões fica (ids por conteúdo: voltar a importar o mesmo arquivo recupera). */
export const apagarEspaco = (id: string) =>
  db.transaction('rw', db.espacos, db.questoes, db.imagens, db.materiais, db.trechos, async () => {
    await db.questoes.where('e').equals(id).delete(); await db.imagens.where('e').equals(id).delete()
    await db.trechos.where('e').equals(id).delete(); await db.materiais.where('e').equals(id).delete()
    await db.espacos.delete(id); versaoMat++
  })
export const gravarImagem = (id: string, e: string, blob: Blob) => db.imagens.put({ id, e, blob })

// ---------- cópia de segurança do que só existe neste aparelho (core/copia.ts) ----------
export interface ConteudoDoAparelho { espacos: EspacoRow[]; questoes: QuestaoRow[]; imagens: ImagemRow[]; materiais: Material[]; trechos: Trecho[] }
/** Tudo o que a pessoa trouxe para o aparelho e a conta Google não sincroniza: espaços criados, questões importadas, imagens das provas, materiais e trechos. */
export async function lerConteudoDoAparelho(): Promise<ConteudoDoAparelho> {
  return { espacos: await db.espacos.toArray(), questoes: await db.questoes.toArray(), imagens: await db.imagens.toArray(), materiais: await db.materiais.toArray(), trechos: await db.trechos.toArray() }
}
/** Só os ids (para a restauração saber o que já existe sem carregar as imagens). */
export async function idsDoAparelho(): Promise<Record<keyof ConteudoDoAparelho, Set<string>>> {
  const ids = async (t: Table<{ id: string }, string>) => new Set((await t.toCollection().primaryKeys()) as string[])
  return { espacos: await ids(db.espacos), questoes: await ids(db.questoes), imagens: await ids(db.imagens), materiais: await ids(db.materiais), trechos: await ids(db.trechos) }
}
/** Restaura SÓ ACRESCENTANDO, numa transação (se falhar, nada fica pela metade). `put` por id: o que já existia com o mesmo id (mesmo conteúdo) não é duplicado. */
export const acrescentarConteudoDoAparelho = (c: ConteudoDoAparelho) =>
  db.transaction('rw', db.espacos, db.questoes, db.imagens, db.materiais, db.trechos, async () => {
    await db.espacos.bulkPut(c.espacos); await db.questoes.bulkPut(c.questoes); await db.imagens.bulkPut(c.imagens)
    await db.materiais.bulkPut(c.materiais); await db.trechos.bulkPut(c.trechos); versaoMat++
  })
const CHAVE_ULTIMA_COPIA = 'copia:ultima'
export const lerUltimaCopia = async (): Promise<number | null> => { const v = Number((await db.meta.get(CHAVE_ULTIMA_COPIA))?.value); return Number.isFinite(v) && v > 0 ? v : null }
export const gravarUltimaCopia = (em: number) => db.meta.put({ key: CHAVE_ULTIMA_COPIA, value: String(em) })
export const lerImagem = async (id: string): Promise<Blob | null> => (await db.imagens.get(id))?.blob ?? null

// ---------- materiais de estudo (core/material.ts) ----------
/** Sobe a cada material guardado/apagado: o índice de busca em memória usa isto para saber que ficou velho. */
let versaoMat = 0
export const versaoMateriais = () => versaoMat
/** Guarda o material e os trechos numa transação só (ou nada). Devolve false se esse mesmo material (mesmo conteúdo) já estava guardado neste espaço. */
export const salvarMaterial = (m: Material, trechos: Trecho[]): Promise<boolean> =>
  db.transaction('rw', db.materiais, db.trechos, async () => {
    if (await db.materiais.get(m.id)) return false
    await db.materiais.put(m); await db.trechos.bulkPut(trechos); versaoMat++
    return true
  })
export const listarMateriais = async (e: string): Promise<Material[]> => (await db.materiais.where('e').equals(e).toArray()).sort((a, b) => b.criado - a.criado)
export const lerTrechos = (e: string): Promise<Trecho[]> => db.trechos.where('e').equals(e).toArray()
/** Apaga o material e todos os trechos dele. */
export const apagarMaterial = (id: string) =>
  db.transaction('rw', db.materiais, db.trechos, async () => { await db.trechos.where('m').equals(id).delete(); await db.materiais.delete(id); versaoMat++ })

// ---------- histórico da conversa do assistente ----------
/** Quantas falas ficam guardadas: as mais antigas saem sozinhas (a conversa é um apoio, não um arquivo). */
export const LIMITE_CONVERSA = 300
export const lerConversa = async (): Promise<MensagemSalva[]> => (await db.conversa.orderBy('id').toArray()).slice(-LIMITE_CONVERSA)
export const gravarConversa = (novas: MensagemSalva[]) =>
  db.transaction('rw', db.conversa, async () => {
    await db.conversa.bulkPut(novas)
    const n = await db.conversa.count()
    if (n > LIMITE_CONVERSA) await db.conversa.orderBy('id').limit(n - LIMITE_CONVERSA).delete()
  })
export const limparConversaSalva = () => db.conversa.clear()
/** Os trechos de UM material (para desfazer a exclusão dele). */
export const trechosDoMaterial = (id: string): Promise<Trecho[]> => db.trechos.where('m').equals(id).toArray()
