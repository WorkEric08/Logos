import Dexie, { type Table } from 'dexie'
import type { Progress, ProgressMap, Question, Subject } from '../core/types'
import type { Banco, RegrasSimulado } from '../core/espaco'
import type { Material, Trecho } from '../core/material'
import { limparHist, limparMarks, type Hist, type Marks } from '../core/historico'
import { limparCards, type Ajustes, type Baralho, type Cartao, type DadosCards } from '../core/cards'
import { chaveBaralho, chaveCartao, chaveMarca, CHAVE_AJUSTES, CHAVE_HIST_CARDS, maisNovo, tipoDe, type ItemNuvem, type Sinc } from '../core/sync/nuvem'
import { aplicarPacoteQ, aplicarParteM, chaveEspaco, chavePacote, empacotarMaterial, empacotarQuestoes, questoesSoDoPacote, type CorpoLido, type Corpo, type Empacotado, type ValorEspaco, type ValorPacote } from '../core/sync/espacos'
import { derivar, desfeito, tempoDe, type EvBase, type EvResposta, type EvSimulado, type EvZerar, type Evento } from '../core/sync/eventos'

/** Uma fala da conversa do assistente como fica guardada (para o histórico voltar na próxima abertura do app). */
export interface MensagemSalva { id: number; de: 'a' | 'v'; texto: string; tipo?: 'erro' | 'ok' | 'painel' | 'plano'; achados?: unknown[] }

/** Espaço de estudo criado pela pessoa (as questões ficam na tabela `questoes`, ligadas por `e`). */
export interface EspacoRow { id: string; nome: string; criado: number; fontes: Record<string, string>; bases: Record<string, string>; materias: Subject[]; extras: Subject[]; bancos: Banco[]; simulado: RegrasSimulado | null
  /** Começa com as questões do Banco do Brasil embutidas no app (e as suas próprias somam). */
  usaBB?: boolean
  /** "Só neste aparelho" (F6): nada deste espaço sobe para a conta Google. */
  local?: boolean }
/** A linha da tabela `questoes`. ATENÇÃO: `Question.e` é o ENUNCIADO, mas aqui `e` é o id do ESPAÇO (índice). Por isso o enunciado vai em `enun` (C-10, 2026-11-20: antes ele era sobrescrito pelo id do
 *  espaço e se perdia ao gravar). Linha antiga (sem `enun`) é lida sem quebrar, com o enunciado vazio, e conta como "sem enunciado" (contarSemEnunciado). */
export type QuestaoRow = Omit<Question, 'e'> & { e: string; enun?: string }
const paraLinha = (q: Question, espaco: string): QuestaoRow => { const { e: enunciado, ...resto } = q; return { ...resto, e: espaco, enun: enunciado } }
const deLinha = (r: QuestaoRow): Question => { const { e, enun, ...resto } = r; void e; return { ...resto, e: enun ?? '' } as Question }
export interface ImagemRow { id: string; e: string; blob: Blob }
/** v8: a questão de um espaço, com a Question INTEIRA em `q` (sem colisão com o `e` do espaço) e chave composta: a mesma questão em dois espaços são duas linhas. */
export interface QuestaoE { e: string; id: string; q: Question }
/** v8: o registro local de cada PACOTE da nuvem (questões ou material). `estado`: 'subir' = conteúdo daqui que ainda não está na nuvem (`d` guarda o corpo até subir);
 *  'baixar' = o catálogo chegou e o corpo ainda não; 'ok' = o corpo está aplicado e na nuvem. `ids`: das questões do pacote; `m`: do material. */
export interface PacoteRow { id: string; e: string; k: 'q' | 'm'; n: number; b: number; de: number; estado: 'subir' | 'baixar' | 'ok' | 'invalido' | 'cota'; ids?: string[]; m?: string; nome?: string; parte?: number; partes?: number; d?: string }
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
  questoesE!: Table<QuestaoE, [string, string]>
  imagensE!: Table<ImagemRow, [string, string]>
  pacotes!: Table<PacoteRow, string>
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
    // v8 (espaços na nuvem, F6.2): SÓ ACRESCENTA `questoesE` e `imagensE` (chave composta [e+id]: a mesma questão em dois espaços são duas linhas; a Question inteira em `q`) e `pacotes`
    // (o registro dos pacotes da nuvem). As tabelas antigas `questoes` e `imagens` NÃO são tocadas nem apagadas (ficam como cópia de segurança do que existia); as linhas são COPIADAS.
    this.version(8).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b', eventos: 'id, [dev+t]', sinc: 'id', espacos: 'id', questoes: 'id, e', imagens: 'id, e', materiais: 'id, e', trechos: 'id, m, e', conversa: 'id',
      questoesE: '[e+id], e, id', imagensE: '[e+id], e, id', pacotes: 'id, e, estado' }).upgrade(async (tx) => {
      const velhas = (await tx.table('questoes').toArray()) as QuestaoRow[]
      await tx.table('questoesE').bulkPut(velhas.map((r) => ({ e: r.e, id: r.id, q: deLinha(r) } satisfies QuestaoE)))
      const imgs = (await tx.table('imagens').toArray()) as ImagemRow[]
      await tx.table('imagensE').bulkPut(imgs.map((i) => ({ id: i.id, e: i.e, blob: i.blob })))
    })
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
/** Desfazer o zerar: grava o evento "desfeito" (o de zerar fica: uma exclusão não chegaria a um aparelho que lê só o que é novo, F6.3a) e refaz o progresso e o histórico a partir
 *  dos eventos (respostas dadas depois do zerar não se perdem). */
export async function desfazerZerar(idDoEvento: string): Promise<{ prog: ProgressMap; hist: Hist }> {
  const dev = await idDoAparelho()
  return avisa(db.transaction('rw', db.prog, db.meta, db.eventos, async () => {
    await db.eventos.put(linha(desfeito(dev, Date.now(), idDoEvento)))
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
  return db.transaction('rw', [db.decks, db.cards, db.meta, db.sinc, db.espacos, db.questoesE, db.materiais, db.trechos, db.pacotes], async () => {
    const tem = new Set((await db.sinc.toCollection().primaryKeys()) as string[])
    const dev = aparelhoCache ?? ''
    const novos: Sinc[] = []
    const poe = (id: string, u: number) => { if (!tem.has(id)) novos.push({ id, u: Math.max(1, Math.floor(u) || 1), dev }) }
    for (const b of await db.decks.toArray()) poe(chaveBaralho(b.id), b.criado)
    for (const c of await db.cards.toArray()) poe(chaveCartao(c.id), Math.max(c.criado || 0, c.ult || 0))
    for (const [id, x] of Object.entries(limparMarks(await lerJson('marks')))) poe(chaveMarca(id), x.t)
    if (await db.meta.get('fc')) poe(CHAVE_AJUSTES, 1)
    if (await db.meta.get('fchist')) poe(CHAVE_HIST_CARDS, 1)
    // espaços, questões e materiais que o aparelho já tinha antes da conta: ganham pacotes e carimbo para poder subir (só os que não são "só neste aparelho")
    for (const e of await db.espacos.toArray()) { if (e.local) continue; poe(chaveEspaco(e.id), e.criado); for (const k of await registrarQuestoesSemPacote(e)) poe(chavePacote(k.id), k.de) }
    for (const m of await db.materiais.toArray()) {
      const dono = m.e === 'bb' ? null : await db.espacos.get(m.e)
      if (dono?.local) continue
      for (const k of await registrarMaterialSemPacote(m)) poe(chavePacote(k.id), k.de)
    }
    if (novos.length) await db.sinc.bulkPut(novos)
    return novos.length
  })
}
export const lerSinc = () => db.sinc.toArray()

/** Os itens completos (com valor) dos carimbos pedidos, prontos para enviar. Lápide leva só o carimbo. */
export async function valoresDe(sincs: readonly Sinc[]): Promise<ItemNuvem[]> {
  const ids = (tipo: string) => sincs.filter((s) => !s.x && tipoDe(s.id)?.tipo === tipo).map((s) => tipoDe(s.id)!.id)
  const [decks, cards, marks, fc, fch, espacos, pacotes] = await Promise.all([
    db.decks.bulkGet(ids('baralho')), db.cards.bulkGet(ids('cartao')), lerJson('marks').then(limparMarks), lerJson('fc'), lerJson('fchist'),
    db.espacos.bulkGet(ids('espaco')), db.pacotes.bulkGet(ids('pacote')),
  ])
  const valor = new Map<string, unknown>()
  for (const d of decks) if (d) valor.set(chaveBaralho(d.id), d)
  for (const c of cards) if (c) valor.set(chaveCartao(c.id), c)
  for (const [id, m] of Object.entries(marks)) valor.set(chaveMarca(id), m)
  if (fc) valor.set(CHAVE_AJUSTES, fc)
  if (fch) valor.set(CHAVE_HIST_CARDS, fch)
  for (const e of espacos) if (e && !e.local) valor.set(chaveEspaco(e.id), { nome: e.nome, criado: e.criado, ...(e.usaBB ? { usaBB: true } : {}) })
  for (const k of pacotes) if (k) valor.set(chavePacote(k.id), catalogoDe(k))
  const saida: ItemNuvem[] = []
  for (const s of sincs) {
    if (s.x) saida.push({ key: s.id, u: s.u, dev: s.dev, x: 1 })
    else if (valor.has(s.id)) saida.push({ key: s.id, u: s.u, dev: s.dev, v: valor.get(s.id) })
  }
  return saida
}

/** Aplica o que veio da nuvem (só o que é mais novo que o local). Devolve o que mudou, para a tela recarregar. */
export async function aplicarItens(itens: readonly ItemNuvem[]): Promise<{ cartoes: boolean; marcas: boolean; espacos: boolean }> {
  const mudou = { cartoes: false, marcas: false, espacos: false }
  if (!itens.length) return mudou
  await db.transaction('rw', [db.decks, db.cards, db.meta, db.sinc, db.espacos, db.pacotes, db.questoesE, db.imagensE, db.materiais, db.trechos, db.questoes, db.imagens], async () => {
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
      } else if (t.tipo === 'ajustes' || t.tipo === 'histCards') { await db.meta.put({ key: t.tipo === 'ajustes' ? 'fc' : 'fchist', value: JSON.stringify(i.v) }); mudou.cartoes = true }
      else if (t.tipo === 'espaco') { if (await aplicarEspacoRemoto(t.id, i)) mudou.espacos = true }
      else if (t.tipo === 'pacote') { if (await aplicarPacoteRemoto(t.id, i)) mudou.espacos = true }
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

// ---------- espaços e pacotes que chegam da nuvem (F6.3) ----------
// Tudo aqui roda DENTRO da transação de aplicarItens/aplicarCorpoBaixado e NUNCA carimba em `sinc` (o que veio da nuvem não sobe de novo; a exclusão que veio como lápide não gera outra).
/** Tira do aparelho o espaço apagado em outro aparelho: questões, imagens, materiais, trechos e pacotes dele (inclusive as cópias antigas). O progresso fica. */
async function removerEspacoLocal(id: string) {
  await db.questoesE.where('e').equals(id).delete(); await db.imagensE.where('e').equals(id).delete(); await db.questoes.where('e').equals(id).delete(); await db.imagens.where('e').equals(id).delete()
  await db.trechos.where('e').equals(id).delete(); await db.materiais.where('e').equals(id).delete(); await db.pacotes.where('e').equals(id).delete(); await db.espacos.delete(id); versaoMat++
}
async function aplicarEspacoRemoto(id: string, i: ItemNuvem): Promise<boolean> {
  if (i.x) { const tinha = await db.espacos.get(id); await removerEspacoLocal(id); return !!tinha }
  const v = i.v as ValorEspaco, ja = await db.espacos.get(id)
  if (!ja) { await db.espacos.put({ id, nome: v.nome, criado: v.criado, fontes: {}, bases: {}, materias: [], extras: [], bancos: [], simulado: null, ...(v.usaBB ? { usaBB: true } : {}) }); return true }
  if (ja.nome !== v.nome || !!ja.usaBB !== !!v.usaBB) { await db.espacos.put({ ...ja, nome: v.nome, ...(v.usaBB ? { usaBB: true } : { usaBB: undefined }) }); return true }
  return false
}
/** O catálogo de um pacote chegou: guarda o registro "a baixar" (o corpo vem à parte); lápide tira o pacote (e as questões que SÓ ele trazia). */
async function aplicarPacoteRemoto(pid: string, i: ItemNuvem): Promise<boolean> {
  const k = await db.pacotes.get(pid)
  if (i.x) {
    if (!k) return false
    if (k.k === 'q') {
      const todos = await db.pacotes.where('e').equals(k.e).toArray()
      const soDele = questoesSoDoPacote(pid, new Map(todos.filter((x) => x.k === 'q').map((x) => [x.id, x.ids ?? []])))
      const chaves = soDele.map((q) => [k.e, q] as [string, string])
      await db.questoesE.bulkDelete(chaves); await db.imagensE.bulkDelete(chaves); await db.pacotes.delete(pid)
    } else if (k.m) { // lápide de uma parte de material: o material sai inteiro (todas as partes são apagadas juntas)
      await db.trechos.where('m').equals(k.m).delete(); await db.materiais.delete(k.m)
      await db.pacotes.filter((x) => x.m === k.m || x.id === pid).delete(); versaoMat++
    } else await db.pacotes.delete(pid)
    return true
  }
  if (k) return false
  const v = i.v as ValorPacote
  await db.pacotes.put({ id: pid, e: v.e, k: v.k, n: v.n, b: v.b, de: v.de, estado: 'baixar', ...(v.nome !== undefined ? { nome: v.nome } : {}), ...(v.parte !== undefined ? { parte: v.parte, partes: v.partes } : {}) })
  return true
}

// ---------- aviso da primeira subida e "só neste aparelho" (F6.5) ----------
/** A pessoa já foi avisada do que sobe? 'enviar' = escolheu enviar; 'manter' = escolheu manter o que já existia só aqui; `null` = ainda não viu o aviso (nada de espaço sobe antes). */
export const lerAvisoEspacos = async (): Promise<'enviar' | 'manter' | null> => { const v = (await db.meta.get('sync:espacos:aviso'))?.value; return v === 'enviar' || v === 'manter' ? v : null }
/** Responde ao aviso da primeira subida. "Manter só aqui" deixa os espaços e materiais que existem AGORA só neste aparelho (nada deles sobe; o que for criado depois sobe normalmente). */
export async function gravarAvisoEspacos(modo: 'enviar' | 'manter'): Promise<void> {
  await db.transaction('rw', [db.meta, db.espacos, db.pacotes, db.sinc, db.materiais], async () => {
    await db.meta.put({ key: 'sync:espacos:aviso', value: modo })
    if (modo !== 'manter') return
    const espacos = await db.espacos.toArray()
    for (const e of espacos) if (!e.local) await db.espacos.put({ ...e, local: true })
    const subir = await db.pacotes.where('estado').equals('subir').toArray()
    const mats = (await db.materiais.toArray()).filter((m) => subir.some((k) => k.m === m.id) && !espacos.some((e) => e.id === m.e)).map((m) => m.id) // materiais do espaço embutido (sem linha de espaço)
    await db.meta.put({ key: 'sync:locais', value: JSON.stringify([...new Set([...(((await lerJson('sync:locais')) as string[] | null) ?? []), ...mats])]) })
    await db.pacotes.bulkDelete(subir.map((k) => k.id))
    await db.sinc.bulkDelete([...subir.map((k) => chavePacote(k.id)), ...espacos.map((e) => chaveEspaco(e.id))])
  })
}
/** Liga ou desliga "só neste aparelho" de um espaço. Só vale enquanto o espaço NÃO está na conta (nenhum pacote já enviado/recebido): tirar da nuvem um espaço que outros aparelhos já têm
 *  apagaria o dele lá (a exclusão chega como lápide). Ligar para um espaço que já subiu é recusado (devolve false). Desligar ("enviar para a conta") cria os pacotes e carimba. */
export async function definirEspacoLocal(id: string, local: boolean): Promise<boolean> {
  return avisa(db.transaction('rw', [db.espacos, db.pacotes, db.questoesE, db.sinc, db.materiais, db.trechos], async () => {
    const e = await db.espacos.get(id)
    if (!e) return false
    if (local) {
      if ((await db.pacotes.where('e').equals(id).filter((k) => k.estado === 'ok').count()) > 0) return false // já está na conta (ou veio dela): para tirar, apague o espaço
      const subir = await db.pacotes.where('e').equals(id).toArray()
      await db.pacotes.bulkDelete(subir.map((k) => k.id)); await db.sinc.bulkDelete([chaveEspaco(id), ...subir.map((k) => chavePacote(k.id))])
      await db.espacos.put({ ...e, local: true }); return true
    }
    const novo = { ...e }; delete novo.local
    await db.espacos.put(novo)
    const marcas = [chaveEspaco(id)]
    for (const k of await registrarQuestoesSemPacote(novo)) marcas.push(chavePacote(k.id))
    for (const m of await db.materiais.where('e').equals(id).toArray()) for (const k of await registrarMaterialSemPacote(m)) marcas.push(chavePacote(k.id))
    await marcar(marcas)
    return true
  }))
}

/** Pacotes com conteúdo daqui que ainda não estão na nuvem (o corpo vai antes do catálogo). */
export const pacotesParaSubir = () => db.pacotes.where('estado').equals('subir').toArray()
/** O corpo subiu: o pacote passa a "ok" e o texto guardado em `d` pode sair (o conteúdo está nas tabelas de sempre). */
export const marcarPacoteEnviado = (pid: string) => db.transaction('rw', db.pacotes, async () => { const k = await db.pacotes.get(pid); if (k) { const { d, ...resto } = k; void d; await db.pacotes.put({ ...resto, estado: 'ok' }) } })
/** Os pacotes cujo catálogo chegou e o corpo ainda não (a fila de download). */
export const pacotesABaixar = () => db.pacotes.where('estado').equals('baixar').toArray()
export const contarPacotes = async (): Promise<{ total: number; baixar: number; subir: number; cota: number; bytesBaixar: number; bytesTotal: number }> => {
  const todos = await db.pacotes.toArray()
  const baixar = todos.filter((k) => k.estado === 'baixar'), subir = todos.filter((k) => k.estado === 'subir')
  return { total: todos.length, baixar: baixar.length, subir: subir.length, cota: todos.filter((k) => k.estado === 'cota').length, bytesBaixar: baixar.reduce((a, k) => a + k.b, 0), bytesTotal: todos.reduce((a, k) => a + k.b, 0) }
}
/** Pacotes do espaço com o estado de cada um (para os selos da lista de espaços). */
export const pacotesDoEspaco = (e: string) => db.pacotes.where('e').equals(e).toArray()
export const bytesDosPacotes = async (): Promise<{ porEspaco: Record<string, number>; total: number }> => {
  const porEspaco: Record<string, number> = {}; let total = 0
  for (const k of await db.pacotes.toArray()) { if (k.estado === 'baixar') continue; porEspaco[k.e] = (porEspaco[k.e] ?? 0) + k.b; total += k.b }
  return { porEspaco, total }
}
export const atualizarEstadoPacote = (pid: string, estado: PacoteRow['estado']) => db.pacotes.update(pid, { estado })
/** Marca o pacote como inválido (corpo recusado: forma errada, grande demais): não é baixado de novo à toa. */
export const marcarPacoteInvalido = (pid: string) => db.pacotes.update(pid, { estado: 'invalido' })
/** O corpo de um pacote chegou e foi conferido: junta ao espaço (UNIÃO: nunca reduz o que existe) e marca o pacote "ok". Devolve `false` se o espaço dele ainda não chegou (fica para depois). */
export async function aplicarCorpoBaixado(pid: string, lido: Extract<CorpoLido, { ok: true }>): Promise<boolean> {
  return db.transaction('rw', [db.pacotes, db.espacos, db.questoesE, db.materiais, db.trechos], async () => {
    const k = await db.pacotes.get(pid)
    if (!k || k.estado === 'ok') return true
    const espaco = k.e === 'bb' ? null : await db.espacos.get(k.e)
    if (k.e !== 'bb' && !espaco) return false // o catálogo do espaço ainda não chegou: espera
    if (lido.k === 'q') {
      if (!espaco) return true
      const locais = await db.questoesE.where('e').equals(k.e).toArray()
      const { estado, adicionadas } = aplicarPacoteQ({ questoes: locais.map((r) => r.q), bases: espaco.bases, fontes: espaco.fontes, bancos: espaco.bancos }, lido.conteudo)
      void adicionadas
      await db.questoesE.bulkPut(estado.questoes.map((q) => ({ e: k.e, id: q.id, q } satisfies QuestaoE)))
      await db.espacos.put({ ...espaco, bases: estado.bases, fontes: estado.fontes, bancos: estado.bancos })
      const { d, ...resto } = k; void d
      await db.pacotes.put({ ...resto, estado: 'ok', ids: lido.conteudo.questoes.map((q) => q.id) })
    } else {
      const c = lido.conteudo
      const material = (await db.materiais.get(c.m)) ?? null
      const trechos = await db.trechos.where('m').equals(c.m).toArray()
      const { estado } = aplicarParteM(k.e, { material, trechos }, c)
      if (estado.material) await db.materiais.put(estado.material)
      await db.trechos.bulkPut(estado.trechos); versaoMat++
      const { d, ...resto } = k; void d
      await db.pacotes.put({ ...resto, estado: 'ok', m: c.m })
    }
    return true
  })
}
/** O corpo (texto) de um pacote que ainda vai subir: guardado em `d` no registro. */
export const corpoParaSubir = (k: PacoteRow): Corpo | null => (k.d ? { e: k.e, k: k.k, d: k.d } : null)

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
/** F6.3a: até onde o aparelho já leu da nuvem (o maior `u` de item / `t` de evento visto do SERVIDOR). A leitura seguinte pede só o que veio depois (menos uma margem). Só aumenta; nunca passa de 1 dia
 *  no futuro (um relógio errado não pode empurrar o cursor para longe). Sem cursor = lê tudo uma vez (primeira vez no aparelho, ou "Sincronizar tudo de novo"). */
export type NomeCursor = 'itens' | 'eventos'
export async function lerCursor(nome: NomeCursor): Promise<number | null> { const v = Number((await db.meta.get(`sync:cursor:${nome}`))?.value); return Number.isFinite(v) && v > 0 ? v : null }
export async function gravarCursor(nome: NomeCursor, valor: number): Promise<void> {
  const teto = Date.now() + 24 * 3_600_000, v = Math.min(valor, teto)
  await db.transaction('rw', db.meta, async () => { const atual = (await lerCursor(nome)) ?? 0; if (v > atual) await db.meta.put({ key: `sync:cursor:${nome}`, value: String(Math.floor(v)) }) })
}
export const limparCursores = () => db.transaction('rw', db.meta, async () => { await db.meta.delete('sync:cursor:itens'); await db.meta.delete('sync:cursor:eventos') })
export const lerUidSync = async () => (await db.meta.get('sync:uid'))?.value ?? null
export const gravarUidSync = (uid: string) => db.meta.put({ key: 'sync:uid', value: uid })

// ---------- espaços de estudo (importados pela pessoa) ----------
export const lerEspacoAtivoId = async () => (await db.meta.get('espaco:ativo'))?.value ?? null
export const gravarEspacoAtivoId = (id: string) => db.meta.put({ key: 'espaco:ativo', value: id })
/** O valor do catálogo de um pacote (o que vai no item `p:`): só metadados pequenos, nunca o corpo. */
const catalogoDe = (k: PacoteRow): ValorPacote => ({ e: k.e, k: k.k, n: k.n, b: k.b, de: k.de, ...(k.nome !== undefined ? { nome: k.nome } : {}), ...(k.parte !== undefined ? { parte: k.parte, partes: k.partes } : {}) })
/** Guarda o registro de um pacote novo (se ainda não existe) e devolve os que foram criados agora. O corpo fica em `d` até subir. */
async function guardarPacotes(lista: readonly Empacotado[]): Promise<PacoteRow[]> {
  const criados: PacoteRow[] = []
  for (const x of lista) {
    if (await db.pacotes.get(x.pid)) continue
    const k: PacoteRow = { id: x.pid, e: x.corpo.e, k: x.corpo.k, n: x.catalogo.n, b: x.catalogo.b, de: x.catalogo.de, estado: 'subir', d: x.corpo.d, ...(x.ids ? { ids: x.ids } : {}), ...(x.m ? { m: x.m } : {}), ...(x.catalogo.nome !== undefined ? { nome: x.catalogo.nome } : {}), ...(x.catalogo.parte !== undefined ? { parte: x.catalogo.parte, partes: x.catalogo.partes } : {}) }
    await db.pacotes.put(k); criados.push(k)
  }
  return criados
}
/** Dentro de uma transação: as questões do espaço que ainda não estão em nenhum pacote viram pacotes (um por prova) e os pacotes novos são carimbados. */
async function registrarQuestoesSemPacote(row: EspacoRow, agora = Date.now()): Promise<PacoteRow[]> {
  const jaEmPacote = new Set((await db.pacotes.where('e').equals(row.id).toArray()).flatMap((k) => k.ids ?? []))
  const soltas = (await db.questoesE.where('e').equals(row.id).toArray()).map((r) => r.q).filter((q) => !jaEmPacote.has(q.id))
  const criados = soltas.length ? await guardarPacotes(empacotarQuestoes(row.id, soltas, row.bases, row.fontes, row.bancos, new Set(), agora)) : []
  if (criados.length) await marcar(criados.map((k) => chavePacote(k.id)))
  return criados
}
async function registrarMaterialSemPacote(m: Material): Promise<PacoteRow[]> {
  if ((await db.pacotes.filter((k) => k.m === m.id).count()) > 0) return []
  if (((await lerJson('sync:locais')) as string[] | null)?.includes(m.id)) return [] // "Manter só aqui": este material ficou só no aparelho
  return guardarPacotes(empacotarMaterial(m, await db.trechos.where('m').equals(m.id).toArray()))
}
/** Lista os espaços criados pela pessoa, com a quantidade de questões de cada um. */
export async function listarEspacos(): Promise<(EspacoRow & { n: number })[]> {
  const linhas = await db.espacos.toArray()
  return Promise.all(linhas.map(async (r) => ({ ...r, n: await db.questoesE.where('e').equals(r.id).count() })))
}
export async function lerEspaco(id: string): Promise<{ row: EspacoRow; questoes: Question[] } | null> {
  const row = await db.espacos.get(id)
  if (!row) return null
  const q = await db.questoesE.where('e').equals(id).toArray()
  return { row, questoes: q.map((r) => r.q) }
}
/** Grava o espaço e as questões dele numa transação só (se falhar, nada fica pela metade). Na MESMA transação: o registro dos pacotes novos e o carimbo da sincronização
 *  (espaço e pacotes), exceto em espaço "só neste aparelho". */
export const salvarEspaco = (row: EspacoRow, questoes: Question[]) => avisa(db.transaction('rw', db.espacos, db.questoesE, db.pacotes, db.sinc, async () => {
  await db.espacos.put(row)
  if (questoes.length) await db.questoesE.bulkPut(questoes.map((q) => ({ e: row.id, id: q.id, q } satisfies QuestaoE)))
  if (row.local) return
  const criados = questoes.length ? await guardarPacotes(empacotarQuestoes(row.id, questoes, row.bases, row.fontes, row.bancos, new Set(), Date.now())) : []
  await marcar([chaveEspaco(row.id), ...criados.map((k) => chavePacote(k.id))])
}))
/** Quantas questões importadas ficaram sem enunciado por causa do defeito anterior (linhas antigas, sem `enun`), no total e por espaço. Importar a prova de novo conserta (o id é por conteúdo). */
export async function contarSemEnunciado(): Promise<{ total: number; porEspaco: Record<string, number> }> {
  const porEspaco: Record<string, number> = {}
  await db.questoesE.filter((r) => !r.q.e).each((r) => { porEspaco[r.e] = (porEspaco[r.e] ?? 0) + 1 }) // enunciado vazio = linha antiga que perdeu o enunciado (uma questão importada nunca tem enunciado vazio)
  return { total: Object.values(porEspaco).reduce((a, n) => a + n, 0), porEspaco }
}
/** Apaga o espaço, as questões e as imagens dele. O progresso das questões fica (ids por conteúdo: voltar a importar o mesmo arquivo recupera). Os pacotes dele viram lápide
 *  (a exclusão chega aos outros aparelhos), como o próprio espaço. */
export const apagarEspaco = (id: string) => avisa(
  db.transaction('rw', [db.espacos, db.questoesE, db.imagensE, db.materiais, db.trechos, db.pacotes, db.sinc, db.questoes, db.imagens], async () => {
    const pids = (await db.pacotes.where('e').equals(id).primaryKeys()) as string[]
    await db.questoesE.where('e').equals(id).delete(); await db.imagensE.where('e').equals(id).delete()
    await db.questoes.where('e').equals(id).delete(); await db.imagens.where('e').equals(id).delete() // as cópias antigas (v7, mantidas só como segurança da migração) de um espaço apagado também saem: apagar é apagar
    await db.trechos.where('e').equals(id).delete(); await db.materiais.where('e').equals(id).delete(); await db.pacotes.where('e').equals(id).delete()
    const era = await db.espacos.get(id)
    await db.espacos.delete(id); versaoMat++
    if (!era?.local) await marcar([chaveEspaco(id), ...pids.map(chavePacote)], true)
  }))
/** Desfazer uma importação: tira SÓ as questões (e as imagens delas) que aquela importação trouxe e devolve o espaço ao que era (fontes, bancos, matérias). O resto do espaço fica.
 *  O pacote que só tinha essas questões vira lápide; pacote que ainda tem questões de outra importação fica. */
export const removerQuestoesDoEspaco = (ids: string[], rowAntes: EspacoRow) =>
  avisa(db.transaction('rw', db.espacos, db.questoesE, db.imagensE, db.pacotes, db.sinc, async () => {
    const chaves = ids.map((id) => [rowAntes.id, id] as [string, string])
    await db.questoesE.bulkDelete(chaves); await db.imagensE.bulkDelete(chaves); await db.espacos.put(rowAntes)
    if (rowAntes.local) return
    const fora = new Set(ids), apagados: string[] = []
    for (const k of await db.pacotes.where('e').equals(rowAntes.id).toArray()) {
      if (k.k !== 'q' || !k.ids) continue
      const resta = k.ids.filter((id) => !fora.has(id))
      if (resta.length === k.ids.length) continue
      if (resta.length === 0) { await db.pacotes.delete(k.id); apagados.push(k.id) } else await db.pacotes.put({ ...k, ids: resta })
    }
    await marcar([chaveEspaco(rowAntes.id)]); if (apagados.length) await marcar(apagados.map(chavePacote), true)
  }))
export const gravarImagem = (id: string, e: string, blob: Blob) => db.imagensE.put({ id, e, blob })

// ---------- cópia de segurança do que só existe neste aparelho (core/copia.ts) ----------
export interface ConteudoDoAparelho { espacos: EspacoRow[]; questoes: QuestaoRow[]; imagens: ImagemRow[]; materiais: Material[]; trechos: Trecho[] }
/** Tudo o que a pessoa trouxe para o aparelho e a conta Google não sincroniza: espaços criados, questões importadas, imagens das provas, materiais e trechos. */
export async function lerConteudoDoAparelho(): Promise<ConteudoDoAparelho> {
  const qs = await db.questoesE.toArray()
  return { espacos: await db.espacos.toArray(), questoes: qs.map((r) => paraLinha(r.q, r.e)), imagens: await db.imagensE.toArray(), materiais: await db.materiais.toArray(), trechos: await db.trechos.toArray() }
}
/** Só os ids (para a restauração saber o que já existe sem carregar as imagens). */
export async function idsDoAparelho(): Promise<Record<keyof ConteudoDoAparelho, Set<string>>> {
  const ids = async (t: Table<{ id: string }, string>) => new Set((await t.toCollection().primaryKeys()) as string[])
  const compostas = async (t: Table<unknown, [string, string]>) => new Set(((await t.toCollection().primaryKeys()) as [string, string][]).map(([e, id]) => `${e}|${id}`)) // espaço + id (core/copia.ts chaveLinha)
  return { espacos: await ids(db.espacos), questoes: await compostas(db.questoesE), imagens: await compostas(db.imagensE), materiais: await ids(db.materiais), trechos: await ids(db.trechos) }
}
/** Restaura SÓ ACRESCENTANDO, numa transação (se falhar, nada fica pela metade). `put` por id: o que já existia com o mesmo id (mesmo conteúdo) não é duplicado. */
export const acrescentarConteudoDoAparelho = (c: ConteudoDoAparelho) =>
  avisa(db.transaction('rw', [db.espacos, db.questoesE, db.imagensE, db.materiais, db.trechos, db.pacotes, db.sinc], async () => {
    await db.espacos.bulkPut(c.espacos); await db.questoesE.bulkPut(c.questoes.map((r) => ({ e: r.e, id: r.id, q: deLinha(r) } satisfies QuestaoE))); await db.imagensE.bulkPut(c.imagens)
    await db.materiais.bulkPut(c.materiais); await db.trechos.bulkPut(c.trechos); versaoMat++
    // o que voltou também vira pacote e ganha carimbo (para subir à conta quando ela estiver ligada)
    const marcas: string[] = []
    for (const e of await db.espacos.bulkGet([...new Set(c.questoes.map((r) => r.e).concat(c.espacos.map((x) => x.id)))])) {
      if (!e || e.local) continue
      marcas.push(chaveEspaco(e.id)); for (const k of await registrarQuestoesSemPacote(e)) marcas.push(chavePacote(k.id))
    }
    for (const m of c.materiais) { const dono = m.e === 'bb' ? null : await db.espacos.get(m.e); if (!dono?.local) for (const k of await registrarMaterialSemPacote(m)) marcas.push(chavePacote(k.id)) }
    if (marcas.length) await marcar([...new Set(marcas)])
  }))
/** Restaurar uma cópia: ACRESCENTA baralhos e cartões que faltam (nunca troca nem apaga os que existem), com o carimbo da sincronização na mesma transação. */
export const acrescentarCartoes = (baralhos: Baralho[], cartoes: Cartao[]) => avisa(db.transaction('rw', db.decks, db.cards, db.sinc, async () => {
  await db.decks.bulkPut(baralhos); await db.cards.bulkPut(cartoes)
  await marcar([...baralhos.map((b) => chaveBaralho(b.id)), ...cartoes.map((c) => chaveCartao(c.id))])
}))
const CHAVE_ULTIMA_COPIA = 'copia:ultima'
export const lerUltimaCopia = async (): Promise<number | null> => { const v = Number((await db.meta.get(CHAVE_ULTIMA_COPIA))?.value); return Number.isFinite(v) && v > 0 ? v : null }
export const gravarUltimaCopia = (em: number) => db.meta.put({ key: CHAVE_ULTIMA_COPIA, value: String(em) })
export const lerImagem = async (id: string): Promise<Blob | null> => (await db.imagensE.where('id').equals(id).first())?.blob ?? null

// ---------- materiais de estudo (core/material.ts) ----------
/** Sobe a cada material guardado/apagado: o índice de busca em memória usa isto para saber que ficou velho. */
let versaoMat = 0
export const versaoMateriais = () => versaoMat
/** Guarda o material e os trechos numa transação só (ou nada). Devolve false se esse mesmo material (mesmo conteúdo) já estava guardado neste espaço. */
export const salvarMaterial = (m: Material, trechos: Trecho[]): Promise<boolean> =>
  avisa(db.transaction('rw', db.materiais, db.trechos, db.espacos, db.pacotes, db.sinc, async () => {
    if (await db.materiais.get(m.id)) return false
    await db.materiais.put(m); await db.trechos.bulkPut(trechos); versaoMat++
    const dono = m.e === 'bb' ? null : await db.espacos.get(m.e)
    if (!dono?.local) { const criados = await guardarPacotes(empacotarMaterial(m, trechos)); if (criados.length) await marcar(criados.map((k) => chavePacote(k.id))) }
    return true
  }))
export const listarMateriais = async (e: string): Promise<Material[]> => (await db.materiais.where('e').equals(e).toArray()).sort((a, b) => b.criado - a.criado)
export const lerTrechos = (e: string): Promise<Trecho[]> => db.trechos.where('e').equals(e).toArray()
/** Apaga o material e todos os trechos dele. */
export const apagarMaterial = (id: string) =>
  avisa(db.transaction('rw', db.materiais, db.trechos, db.pacotes, db.sinc, async () => {
    const pids = (await db.pacotes.filter((k) => k.m === id).primaryKeys()) as string[]
    await db.trechos.where('m').equals(id).delete(); await db.materiais.delete(id); await db.pacotes.bulkDelete(pids); versaoMat++
    if (pids.length) await marcar(pids.map(chavePacote), true)
  }))

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
