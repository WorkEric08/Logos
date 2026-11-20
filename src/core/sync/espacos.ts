// Espaços de estudo, questões e materiais na nuvem (F6.1): o modelo, os pacotes e as regras de aplicar. PURO: sem banco, sem rede, sem DOM.
//
// O desenho (docs/plano-sync-espacos.md): em vez de um documento por questão ou trecho, o conteúdo vai em PACOTES (≤ 500 KB de JSON, texto em UM campo `d`):
//   users/{uid}/itens/e:{eid}   o ESPAÇO     {u, dev, x?, v:{nome, criado, usaBB?, local?}}                (o motor de hoje: a última alteração vence, lápide)
//   users/{uid}/itens/p:{pid}   o CATÁLOGO   {u, dev, x?, v:{e, k:'q'|'m', n, b, de, nome?, im?}}          (idem; pequeno, ouvido ao vivo)
//   users/{uid}/corpo/{pid}     o CORPO      {e, k, d:'<JSON em texto>'}                                   (pesado, imutável, baixado à parte)
// (Atenção: `Question.e` é o ENUNCIADO. O espaço NÃO vai dentro da questão: vai no catálogo do pacote.)
// O pacote é IMUTÁVEL: mudou o conteúdo, é outro id. O id de um pacote de questões vem do conjunto de ids das questões (mesmo conjunto = mesmo pacote: importar a mesma prova em
// dois aparelhos, no mesmo espaço, cai no mesmo documento). Aplicar um pacote que chega é UNIÃO: nunca reduz o que já existe.
import type { Banco } from '../espaco'
import { hashTexto } from '../espaco'
import type { Material, TipoMaterial, Trecho } from '../material'
import type { Letter, Question } from '../types'

// ---------- limites (valores de partida decididos pelo dono) ----------
export const LIMITES_SYNC = {
  /** O JSON de um pacote (o limite do documento é 1 MiB; acento conta 2 bytes: sobra folga). */
  pacoteBytes: 500_000,
  /** O que as regras do Firestore aceitam no campo `d` (um pouco acima do pacote, para a conta de bytes do servidor). */
  corpoBytes: 600_000,
  imagemBytes: 600_000,
  espacoBytes: 25 * 1024 * 1024,
  contaBytes: 100 * 1024 * 1024,
}

// ---------- chaves ----------
export const chaveEspaco = (eid: string) => `e:${eid}`
export const chavePacote = (pid: string) => `p:${pid}`
const ID_OK = /^[A-Za-z0-9_-]{1,80}$/
export const pidValido = (pid: string) => /^[qm]-[A-Za-z0-9_-]{1,80}$/.test(pid)

/** Tamanho em bytes do texto em UTF-8 (acento conta 2: é como o Firestore conta). Sem TextEncoder, para valer em qualquer ambiente. */
export function bytesDe(texto: string): number {
  let n = 0
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++ } // par substituto = 1 caractere de 4 bytes
    else n += 3
  }
  return n
}

// ---------- tipos ----------
export interface ValorEspaco { nome: string; criado: number; usaBB?: boolean; local?: boolean }
export interface ValorPacote {
  /** Espaço a que pertence. */ e: string
  /** 'q' = questões; 'm' = material. */ k: 'q' | 'm'
  /** Quantos itens (questões, ou trechos da parte). */ n: number
  /** Bytes do JSON do corpo. */ b: number
  /** Quando o conteúdo nasceu (ms). */ de: number
  /** Material: o nome (para a lista antes de baixar). */ nome?: string
  /** Pacote de material: qual parte (0, 1…) e de quantas. */ parte?: number; partes?: number
  /** Ids das questões deste pacote que têm imagem na nuvem (F6.6). */ im?: string[]
}
export interface Corpo { e: string; k: 'q' | 'm'; d: string }
/** `ids`: das questões do pacote (para saber que pacote cada questão veio); `m`: do material do pacote. */
export interface Empacotado { pid: string; catalogo: ValorPacote; corpo: Corpo; ids?: string[]; m?: string }

export interface ConteudoQ { questoes: Question[]; bases: Record<string, string>; fontes: Record<string, string>; bancos: Banco[] }
export interface ConteudoM { material?: { id: string; nome: string; tipo: TipoMaterial; criado: number; trechos: number; caracteres: number }; m: string; parte: number; partes: number; trechos: { i: number; t: string }[] }

// ---------- empacotar ----------
const json = (x: unknown) => JSON.stringify(x)
const ids = (qs: readonly Question[]) => qs.map((q) => q.id).sort()
/** O id do pacote de questões: espaço + hash dos ids ordenados (a ordem em que as questões chegam não muda o pacote). */
export const pidDeQuestoes = (eid: string, qs: readonly Question[]) => `q-${eid}-${hashTexto(ids(qs).join('|'))}`

/** Parte as questões em grupos cujo JSON cabe no limite (cada questão inteira em um grupo só). */
function grupos(qs: readonly Question[], bases: Record<string, string>, limite: number): Question[][] {
  const saida: Question[][] = []
  let atual: Question[] = [], tam = 0
  for (const q of qs) {
    const t = bytesDe(json(q)) + (q.b && bases[q.b] ? bytesDe(bases[q.b]) : 0) + 2
    if (atual.length && tam + t > limite) { saida.push(atual); atual = []; tam = 0 }
    atual.push(q); tam += t
  }
  if (atual.length) saida.push(atual)
  return saida
}

/**
 * Empacota as questões de UM espaço (importadas ou geradas) em pacotes de questões. `embutidos` = ids das questões que já vêm com o app (nunca sobem). Pacote por prova (`s`)
 * e, se uma prova passar do limite, em partes: assim cada importação vira um pacote e o mesmo conjunto dá sempre o mesmo id.
 */
export function empacotarQuestoes(eid: string, questoes: readonly Question[], bases: Record<string, string>, fontes: Record<string, string>, bancos: readonly Banco[], embutidos: ReadonlySet<string> = new Set(), agora = 0): Empacotado[] {
  const proprias = questoes.filter((q) => !embutidos.has(q.id))
  const porProva = new Map<string, Question[]>()
  for (const q of proprias) { const l = porProva.get(q.s) ?? []; l.push(q); porProva.set(q.s, l) }
  const saida: Empacotado[] = []
  for (const [, lista] of [...porProva.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const g of grupos(lista, bases, LIMITES_SYNC.pacoteBytes - 20_000)) { // folga para as fontes, os bancos e o envelope
      const b: Record<string, string> = {}, f: Record<string, string> = {}
      for (const q of g) { if (q.b && bases[q.b] !== undefined) b[q.b] = bases[q.b]; if (q.s in fontes) f[q.s] = fontes[q.s] }
      const conteudo: ConteudoQ = { questoes: g, bases: b, fontes: f, bancos: [...bancos] }
      const d = json(conteudo)
      const pid = pidDeQuestoes(eid, g)
      saida.push({ pid, catalogo: { e: eid, k: 'q', n: g.length, b: bytesDe(d), de: agora }, corpo: { e: eid, k: 'q', d }, ids: g.map((q) => q.id) })
    }
  }
  return saida
}

/** Empacota um material (metadados + trechos) em uma ou mais partes de até o limite. A parte 0 leva os metadados. */
export function empacotarMaterial(material: Material, trechos: readonly Trecho[]): Empacotado[] {
  const ordenados = [...trechos].sort((a, b) => a.i - b.i).map((t) => ({ i: t.i, t: t.t }))
  const lotes: { i: number; t: string }[][] = []
  let atual: { i: number; t: string }[] = [], tam = 0
  const reserva = 2_000 + bytesDe(material.nome)
  for (const t of ordenados) {
    const x = bytesDe(json(t)) + 1
    if (atual.length && tam + x + reserva > LIMITES_SYNC.pacoteBytes) { lotes.push(atual); atual = []; tam = 0 }
    atual.push(t); tam += x
  }
  if (atual.length || !lotes.length) lotes.push(atual)
  return lotes.map((lote, parte) => {
    const c: ConteudoM = { ...(parte === 0 ? { material: { id: material.id, nome: material.nome, tipo: material.tipo, criado: material.criado, trechos: material.trechos, caracteres: material.caracteres } } : {}), m: material.id, parte, partes: lotes.length, trechos: lote }
    const d = json(c)
    return { pid: `m-${material.id}-${parte}`, catalogo: { e: material.e, k: 'm' as const, n: lote.length, b: bytesDe(d), de: material.criado, nome: material.nome, parte, partes: lotes.length }, corpo: { e: material.e, k: 'm' as const, d }, m: material.id }
  })
}

// ---------- validar (nunca confiar no que chega da nuvem) ----------
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const txt = (x: unknown): x is string => typeof x === 'string'
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const LETRAS: Letter[] = ['A', 'B', 'C', 'D', 'E']

export function valorEspacoValido(v: unknown): ValorEspaco | null {
  if (!obj(v) || !txt(v.nome) || !v.nome.trim() || v.nome.length > 80 || !num(v.criado)) return null
  return { nome: v.nome, criado: v.criado, ...(v.usaBB === true ? { usaBB: true } : {}), ...(v.local === true ? { local: true } : {}) }
}
export function valorPacoteValido(pid: string, v: unknown): ValorPacote | null {
  if (!pidValido(pid) || !obj(v) || !txt(v.e) || !ID_OK.test(v.e) || (v.k !== 'q' && v.k !== 'm') || !num(v.n) || v.n < 0 || !num(v.b) || v.b < 0 || v.b > LIMITES_SYNC.corpoBytes || !num(v.de)) return null
  if (pid[0] !== v.k) return null
  const saida: ValorPacote = { e: v.e, k: v.k, n: v.n, b: v.b, de: v.de }
  if (v.nome !== undefined) { if (!txt(v.nome) || v.nome.length > 200) return null; saida.nome = v.nome }
  if (v.parte !== undefined || v.partes !== undefined) { if (!num(v.parte) || !num(v.partes) || v.parte < 0 || v.partes < 1 || v.parte >= v.partes) return null; saida.parte = v.parte; saida.partes = v.partes }
  if (v.im !== undefined) { if (!Array.isArray(v.im) || !v.im.every(txt) || v.im.length > 5000) return null; saida.im = v.im as string[] }
  return saida
}

function questaoValida(x: unknown): Question | null {
  if (!obj(x) || !txt(x.id) || !x.id || x.id.length > 80 || !txt(x.e) || !txt(x.m) || !txt(x.s) || !num(x.n) || !num(x.y) || !txt(x.t) || !txt(x.a) || !txt(x.b)) return null
  if (!obj(x.o) || !LETRAS.every((l) => txt((x.o as Record<string, unknown>)[l]))) return null
  if (!LETRAS.includes(x.g as Letter)) return null
  return x as unknown as Question
}

export type CorpoLido = { ok: true; k: 'q'; conteudo: ConteudoQ; descartadas: number } | { ok: true; k: 'm'; conteudo: ConteudoM } | { ok: false; erro: string }

/** Lê o corpo de um pacote vindo da nuvem. Forma errada ou grande demais = recusado; questão estragada dentro de um pacote bom é descartada (e contada). */
export function lerCorpo(pid: string, c: unknown): CorpoLido {
  if (!pidValido(pid)) return { ok: false, erro: 'id de pacote inválido' }
  if (!obj(c) || !txt(c.e) || !ID_OK.test(c.e) || (c.k !== 'q' && c.k !== 'm') || !txt(c.d)) return { ok: false, erro: 'corpo mal formado' }
  if (pid[0] !== c.k) return { ok: false, erro: 'tipo do pacote não bate com o id' }
  if (bytesDe(c.d) > LIMITES_SYNC.corpoBytes) return { ok: false, erro: 'pacote grande demais' }
  let o: unknown
  try { o = JSON.parse(c.d) } catch { return { ok: false, erro: 'conteúdo ilegível' } }
  if (!obj(o)) return { ok: false, erro: 'conteúdo ilegível' }
  if (c.k === 'q') {
    if (!Array.isArray(o.questoes)) return { ok: false, erro: 'faltam as questões' }
    const questoes = o.questoes.map(questaoValida).filter((q): q is Question => !!q)
    const bases: Record<string, string> = {}, fontes: Record<string, string> = {}
    if (obj(o.bases)) for (const [k, v] of Object.entries(o.bases)) if (txt(v)) bases[k] = v
    if (obj(o.fontes)) for (const [k, v] of Object.entries(o.fontes)) if (txt(v)) fontes[k] = v
    const bancos = (Array.isArray(o.bancos) ? o.bancos : []).filter((b): b is Banco => obj(b) && txt(b.id) && txt(b.nome))
    return { ok: true, k: 'q', conteudo: { questoes, bases, fontes, bancos }, descartadas: o.questoes.length - questoes.length }
  }
  if (!txt(o.m) || !ID_OK.test(o.m) || !num(o.parte) || !num(o.partes) || !Array.isArray(o.trechos)) return { ok: false, erro: 'material mal formado' }
  const trechos = o.trechos.filter((t): t is { i: number; t: string } => obj(t) && num(t.i) && txt(t.t))
  let material: ConteudoM['material']
  if (o.parte === 0) {
    const mm = o.material
    if (!obj(mm) || !txt(mm.id) || mm.id !== o.m || !txt(mm.nome) || (mm.tipo !== 'pdf' && mm.tipo !== 'texto') || !num(mm.criado) || !num(mm.trechos) || !num(mm.caracteres)) return { ok: false, erro: 'material sem metadados' }
    material = { id: mm.id, nome: mm.nome, tipo: mm.tipo, criado: mm.criado, trechos: mm.trechos, caracteres: mm.caracteres }
  }
  return { ok: true, k: 'm', conteudo: { ...(material ? { material } : {}), m: o.m, parte: o.parte, partes: o.partes, trechos } }
}

// ---------- aplicar (do lado de quem recebe): UNIÃO, nunca reduz ----------
export interface EstadoQuestoes { questoes: Question[]; bases: Record<string, string>; fontes: Record<string, string>; bancos: Banco[] }

/** Junta um pacote de questões ao que o espaço já tem. Por id: a questão que já está fica; se a que chega tem `img` e a local não, ganha a imagem. Bases, fontes e bancos: união.
 *  `embutidos` (ids do banco que vem com o app) nunca entram. Aplicar duas vezes, ou em outra ordem, dá o mesmo resultado. */
export function aplicarPacoteQ(local: EstadoQuestoes, chega: ConteudoQ, embutidos: ReadonlySet<string> = new Set()): { estado: EstadoQuestoes; adicionadas: number } {
  const por = new Map(local.questoes.map((q) => [q.id, q]))
  let adicionadas = 0
  for (const q of chega.questoes) {
    if (embutidos.has(q.id)) continue
    const atual = por.get(q.id)
    if (!atual) { por.set(q.id, q); adicionadas++ }
    else if (!atual.img && q.img) por.set(q.id, { ...atual, img: q.img, ...(q.ig ? { ig: q.ig } : {}) })
  }
  const bases = { ...chega.bases, ...local.bases }, fontes = { ...chega.fontes, ...local.fontes }
  const bancos = [...local.bancos]
  for (const b of chega.bancos) if (!bancos.some((x) => x.id === b.id)) bancos.push(b)
  return { estado: { questoes: [...por.values()], bases, fontes, bancos }, adicionadas }
}

/** Junta uma parte de material ao que já se tem dele (os trechos por posição `i`; os metadados vêm da parte 0). */
export interface EstadoMaterial { material: Material | null; trechos: Trecho[] }
export function aplicarParteM(eid: string, local: EstadoMaterial, chega: ConteudoM): { estado: EstadoMaterial; adicionados: number } {
  const por = new Map(local.trechos.map((t) => [t.i, t]))
  let adicionados = 0
  for (const t of chega.trechos) if (!por.has(t.i)) { por.set(t.i, { id: `${chega.m}:${t.i}`, m: chega.m, e: eid, i: t.i, t: t.t }); adicionados++ }
  const material = local.material ?? (chega.material ? { ...chega.material, e: eid } : null)
  return { estado: { material, trechos: [...por.values()].sort((a, b) => a.i - b.i) }, adicionados }
}
/** O material está completo (todas as partes chegaram)? */
export const materialCompleto = (m: Material | null, trechos: readonly Trecho[]) => !!m && trechos.length >= m.trechos

// ---------- referências (desfazer/apagar um pacote sem tirar a questão que outro pacote também traz) ----------
/** Ids das questões que SÓ o pacote `pid` traz (nenhum outro pacote do espaço as tem): são as que podem sair quando ele sai. */
export function questoesSoDoPacote(pid: string, idsPorPacote: ReadonlyMap<string, readonly string[]>): string[] {
  const dele = idsPorPacote.get(pid) ?? []
  const outros = new Set<string>()
  for (const [p, l] of idsPorPacote) if (p !== pid) for (const id of l) outros.add(id)
  return dele.filter((id) => !outros.has(id))
}

// ---------- limites de tamanho ----------
/** Soma de bytes dos pacotes de um espaço (catálogo) e confere o limite por espaço e por conta. */
export function confereCotas(bytesDoEspaco: number, bytesDaConta: number, novos: number, limites: { espacoBytes: number; contaBytes: number } = LIMITES_SYNC): { ok: true } | { ok: false; motivo: 'espaco' | 'conta' } {
  if (bytesDoEspaco + novos > limites.espacoBytes) return { ok: false, motivo: 'espaco' }
  if (bytesDaConta + novos > limites.contaBytes) return { ok: false, motivo: 'conta' }
  return { ok: true }
}
