// Flashcards: baralhos, cartões e repetição espaçada. Tudo puro (sem DOM, banco nem framework); o armazenamento fica em services/db.ts.
//
// Agendamento (parecido com o SM-2 / Anki, 4 botões):
//  - cartão novo ou "aprendendo":  Errei 10 min (volta na mesma sessão) · Difícil 1 dia · Bom 2 dias · Fácil 5 dias
//  - cartão em revisão (já aprendido): Errei volta a "aprendendo" (facilidade −0,20, +1 lapso) ·
//      Difícil = ×1,2 (facilidade −0,15) · Bom = ×facilidade · Fácil = ×facilidade×1,3 (facilidade +0,15); sempre ao menos +1 dia.
//  - facilidade começa em 2,5 e nunca passa de 1,3 para baixo; intervalo máximo de 365 dias.
import type { Hist } from './historico'

export interface Baralho { id: string; nome: string; criado: number }
export type Estado = 'novo' | 'aprendendo' | 'revisao'
export interface Cartao {
  id: string; b: string // baralho
  f: string; v: string // frente e verso
  q?: string // id da questão de onde veio (se veio)
  criado: number
  estado: Estado
  due: number // quando volta (ms). Em revisão, sempre a meia-noite local do dia marcado
  ivl: number // intervalo atual, em dias
  fac: number // facilidade
  reps: number // acertos seguidos
  lapsos: number
  ult: number // último estudo (0 = nunca)
}
export type Nota = 0 | 1 | 2 | 3 // Errei · Difícil · Bom · Fácil
export const NOTAS: { n: Nota; rotulo: string }[] = [{ n: 0, rotulo: 'Errei' }, { n: 1, rotulo: 'Difícil' }, { n: 2, rotulo: 'Bom' }, { n: 3, rotulo: 'Fácil' }]

/** Ajustes e contador de novos do dia. */
export interface Ajustes { limite: number; dia: string; novos: number } // limite 0 = sem limite
export const AJUSTES_PADRAO: Ajustes = { limite: 10, dia: '', novos: 0 }
export const LIMITES_NOVOS = [5, 10, 20, 0]

export const MIN = 60_000
export const DIA = 86_400_000
export const MAX_IVL = 365
export const TAM_MAX = 2000 // caracteres por face
export const NOME_MAX = 60

const p2 = (n: number) => String(n).padStart(2, '0')
export const diaDe = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` }
/** Meia-noite local de hoje + n dias. */
export const meiaNoite = (agora: number, n = 0) => { const d = new Date(agora); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime() }

export function criarBaralho(nome: string, agora: number, id: string): Baralho {
  return { id, nome: nome.trim().replace(/\s+/g, ' ').slice(0, NOME_MAX), criado: agora }
}

export function criarCartao(d: { b: string; f: string; v: string; q?: string }, agora: number, id: string): Cartao {
  return { id, b: d.b, f: d.f.trim().slice(0, TAM_MAX), v: d.v.trim().slice(0, TAM_MAX), ...(d.q ? { q: d.q } : {}), criado: agora, estado: 'novo', due: agora, ivl: 0, fac: 2.5, reps: 0, lapsos: 0, ult: 0 }
}

/** Id curto e único o bastante para dados pessoais (tempo + sorteio). `rnd` entra só para testar. */
export const novoId = (agora: number, rnd: () => number = Math.random) => agora.toString(36) + Math.floor(rnd() * 36 ** 4).toString(36).padStart(4, '0')

/** Aplica a nota ao cartão e devolve o cartão com o novo agendamento. */
export function agendar(c: Cartao, nota: Nota, agora: number): Cartao {
  const emRevisao = c.estado === 'revisao'
  if (nota === 0) {
    return { ...c, estado: 'aprendendo', reps: 0, ivl: 0, due: agora + 10 * MIN, ult: agora, fac: emRevisao ? Math.max(1.3, c.fac - 0.2) : c.fac, lapsos: c.lapsos + (emRevisao ? 1 : 0) }
  }
  let ivl: number, fac = c.fac
  if (!emRevisao) ivl = nota === 1 ? 1 : nota === 2 ? 2 : 5
  else {
    const mais1 = c.ivl + 1
    if (nota === 1) { ivl = Math.max(mais1, Math.round(c.ivl * 1.2)); fac = Math.max(1.3, c.fac - 0.15) }
    else if (nota === 2) ivl = Math.max(mais1, Math.round(c.ivl * c.fac))
    else { ivl = Math.max(mais1, Math.round(c.ivl * c.fac * 1.3)); fac = c.fac + 0.15 }
  }
  ivl = Math.min(MAX_IVL, ivl)
  return { ...c, estado: 'revisao', reps: c.reps + 1, ivl, fac: Math.round(fac * 100) / 100, due: meiaNoite(agora, ivl), ult: agora }
}

/** "10 min", "3 d", "2 m", "1 a": quanto falta para o cartão voltar com cada nota (rótulo dos botões). */
export function rotuloIntervalo(c: Cartao): string {
  if (c.estado !== 'revisao') return c.ivl === 0 ? '10 min' : ''
  return rotuloDias(c.ivl)
}
export function rotuloDias(d: number): string {
  if (d < 30) return `${d} d`
  if (d < 365) return `${Math.round(d / 30)} m`
  return `${Math.round((d / 365) * 10) / 10} a`.replace('.', ',')
}
export const rotulosDasNotas = (c: Cartao, agora: number): string[] => NOTAS.map(({ n }) => rotuloIntervalo(agendar(c, n, agora)))

/** O cartão entra na revisão de hoje? (aprendendo: sempre; em revisão: venceu até o fim de hoje). */
export const devido = (c: Cartao, agora: number) => c.estado === 'aprendendo' || (c.estado === 'revisao' && c.due < meiaNoite(agora, 1))

/** Quantos novos ainda podem entrar hoje. */
export function novosRestantes(a: Ajustes, agora: number): number {
  if (a.limite === 0) return Infinity
  return Math.max(0, a.limite - (a.dia === diaDe(agora) ? a.novos : 0))
}

export interface Contagem { novos: number; aprender: number; revisar: number; total: number; aprendidos: number; maduros: number; hoje: number }
export function contar(cs: Cartao[], a: Ajustes, agora: number): Contagem {
  let novos = 0, aprender = 0, revisar = 0, aprendidos = 0, maduros = 0
  for (const c of cs) {
    if (c.estado === 'novo') novos++
    else if (c.estado === 'aprendendo') aprender++
    else { aprendidos++; if (c.ivl >= 21) maduros++; if (devido(c, agora)) revisar++ }
  }
  const novosHoje = Math.min(novos, novosRestantes(a, agora))
  return { novos: novosHoje, aprender, revisar, total: cs.length, aprendidos, maduros, hoje: novosHoje + aprender + revisar }
}

/** Ordem do estudo: o que está aprendendo, depois as revisões vencidas (as mais atrasadas primeiro), depois os novos (até o limite). */
export function montarFila(cs: Cartao[], a: Ajustes, agora: number): string[] {
  const ap = cs.filter((c) => c.estado === 'aprendendo').sort((x, y) => x.due - y.due)
  const rev = cs.filter((c) => c.estado === 'revisao' && devido(c, agora)).sort((x, y) => x.due - y.due || x.criado - y.criado)
  const lim = novosRestantes(a, agora)
  const novos = cs.filter((c) => c.estado === 'novo').sort((x, y) => x.criado - y.criado).slice(0, Number.isFinite(lim) ? lim : undefined)
  return [...ap, ...rev, ...novos].map((c) => c.id)
}

/** Registra que um cartão novo foi apresentado hoje (para o limite de novos por dia). */
export function contarNovo(a: Ajustes, agora: number): Ajustes {
  const hoje = diaDe(agora)
  return { ...a, dia: hoje, novos: (a.dia === hoje ? a.novos : 0) + 1 }
}

/** O que um dia de estudo conta no histórico: cada resposta, e "certa" quando não foi Errei. */
export const lembrou = (nota: Nota) => nota > 0

// ---------- validação do que vem do banco/backup ----------
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
export function limparCartao(o: unknown): Cartao | null {
  const c = o as Partial<Cartao> | null
  if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !c.id || typeof c.b !== 'string' || typeof c.f !== 'string' || typeof c.v !== 'string') return null
  if (!c.f.trim() || !c.v.trim()) return null
  const estado: Estado = c.estado === 'aprendendo' || c.estado === 'revisao' ? c.estado : 'novo'
  return {
    id: c.id, b: c.b, f: c.f.slice(0, TAM_MAX), v: c.v.slice(0, TAM_MAX), ...(typeof c.q === 'string' ? { q: c.q } : {}),
    criado: num(c.criado) ? c.criado : 0, estado, due: num(c.due) ? c.due : 0, ivl: num(c.ivl) && c.ivl >= 0 ? Math.min(MAX_IVL, c.ivl) : 0,
    fac: num(c.fac) && c.fac >= 1.3 && c.fac <= 5 ? c.fac : 2.5, reps: num(c.reps) && c.reps >= 0 ? c.reps : 0, lapsos: num(c.lapsos) && c.lapsos >= 0 ? c.lapsos : 0, ult: num(c.ult) ? c.ult : 0,
  }
}
export function limparBaralho(o: unknown): Baralho | null {
  const b = o as Partial<Baralho> | null
  if (!b || typeof b !== 'object' || typeof b.id !== 'string' || !b.id || typeof b.nome !== 'string' || !b.nome.trim()) return null
  return { id: b.id, nome: b.nome.trim().slice(0, NOME_MAX), criado: num(b.criado) ? b.criado : 0 }
}
export interface DadosCards { baralhos: Baralho[]; cartoes: Cartao[]; ajustes: Ajustes; hist: Hist }
export function limparAjustes(o: unknown): Ajustes {
  const a = o as Partial<Ajustes> | null
  return { limite: a && LIMITES_NOVOS.includes(a.limite as number) ? (a.limite as number) : AJUSTES_PADRAO.limite, dia: a && typeof a.dia === 'string' ? a.dia : '', novos: a && num(a.novos) && a.novos >= 0 ? a.novos : 0 }
}
/** Backup/banco → dados limpos. Cartão cujo baralho não existe é descartado (não haveria onde mostrá-lo). */
export function limparCards(o: unknown, limparHistFn: (x: unknown) => Hist): DadosCards {
  const r = (o && typeof o === 'object' ? o : {}) as { baralhos?: unknown; cartoes?: unknown; ajustes?: unknown; hist?: unknown }
  const baralhos = (Array.isArray(r.baralhos) ? r.baralhos : []).map(limparBaralho).filter((x): x is Baralho => !!x)
  const ids = new Set(baralhos.map((b) => b.id))
  const vistos = new Set<string>()
  const cartoes = (Array.isArray(r.cartoes) ? r.cartoes : []).map(limparCartao).filter((c): c is Cartao => !!c && ids.has(c.b) && !vistos.has(c.id) && !!vistos.add(c.id))
  return { baralhos, cartoes, ajustes: limparAjustes(r.ajustes), hist: limparHistFn(r.hist) }
}
