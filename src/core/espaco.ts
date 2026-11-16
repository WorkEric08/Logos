// "Espaço de estudo": tudo o que o app precisa saber para treinar um assunto: as questões, as matérias (com peso), as provas/fontes, os bancos e,
// se houver, as regras do simulado. O Banco do Brasil é o primeiro espaço (embutido no app); os outros nascem de arquivos que a pessoa importa.
// Puro: sem DOM, banco de dados ou rede. A ativação (trocar o que o app mostra) está em store/espacos.ts.
import type { Question, Subject } from './types'

/** Regras de um simulado com nota e aprovação (as do edital do BB). Espaço sem isso faz simulado simples: só conta os acertos. */
export interface RegrasSimulado {
  plano: [string, number][]
  /** Pontos mínimos no total, nos básicos e nos específicos; e o total da prova (para o texto "x / 100"). */
  minTotal: number; minBasico: number; minEspecifico: number; pontosTotal: number
}

export interface Banco { id: string; nome: string }

export interface Espaco {
  id: string
  nome: string
  questoes: Question[]
  /** Textos-base compartilhados (Question.b → texto). */
  bases: Record<string, string>
  /** Chave da prova → rótulo ("Banco 2021 · prova"). */
  fontes: Record<string, string>
  materias: Subject[]
  /** Matérias fora do edital (só treino): ficam depois das do edital e nunca entram na nota. */
  extras: Subject[]
  simulado: RegrasSimulado | null
  bancos: Banco[]
  /** Vem junto com o app (não fica no banco do aparelho nem pode ser editado). */
  embutido?: boolean
}

export const ID_ESPACO_BB = 'bb'

/** Nome curto de uma matéria nova: "Direito Constitucional" → "Dir. Constitucional" só se for muito longo; senão o próprio nome. */
export function nomeCurto(nome: string): string {
  if (nome.length <= 18) return nome
  const p = nome.split(/\s+/)
  return p.length > 1 ? `${p[0].slice(0, 4)}. ${p.slice(1).join(' ')}`.slice(0, 22) : nome.slice(0, 18)
}

/** Uma matéria que o app ainda não conhecia: entra com peso médio no sorteio e sem pontuação própria (a nota é só a contagem de acertos). */
export const materiaNova = (n: string, bloco: 'B' | 'E' = 'E'): Subject => ({ n, s: nomeCurto(n), q: 5, pt: 1, bl: bloco, ed: false })

/** Todas as matérias que aparecem nas questões, na ordem das já conhecidas e depois por quantidade de questões. As novas ganham valores padrão. */
export function materiasDasQuestoes(qs: readonly Question[], conhecidas: readonly Subject[]): Subject[] {
  const conta = new Map<string, number>()
  for (const q of qs) conta.set(q.m, (conta.get(q.m) ?? 0) + 1)
  const sabidas = new Map(conhecidas.map((m) => [m.n, m]))
  const saida: Subject[] = conhecidas.filter((m) => conta.has(m.n))
  const novas = [...conta.keys()].filter((n) => !sabidas.has(n)).sort((a, b) => (conta.get(b) ?? 0) - (conta.get(a) ?? 0) || a.localeCompare(b, 'pt-BR'))
  for (const n of novas) saida.push(materiaNova(n))
  return saida
}

/** Plano de um simulado simples: `total` questões repartidas pelas matérias na proporção do que existe (cada matéria com ao menos 1, se couber). */
export function planoSimulado(qs: readonly Question[], materias: readonly Subject[], total = 30): [string, number][] {
  const por = materias.map((m) => [m.n, qs.filter((q) => q.m === m.n).length] as const).filter(([, n]) => n > 0)
  const soma = por.reduce((a, [, n]) => a + n, 0)
  if (!soma) return []
  const alvo = Math.min(total, soma)
  let plano = por.map(([m, n]) => [m, Math.min(n, Math.max(1, Math.round((alvo * n) / soma)))] as [string, number])
  // acerta a soma para bater com o alvo, tirando/pondo uma questão por vez das matérias maiores
  let falta = alvo - plano.reduce((a, [, n]) => a + n, 0)
  const ordem = [...plano].sort((a, b) => b[1] - a[1]).map(([m]) => m)
  for (let i = 0; falta !== 0 && i < 1000; i++) {
    const m = ordem[i % ordem.length], idx = plano.findIndex(([x]) => x === m), disp = por.find(([x]) => x === m)![1]
    if (falta > 0 && plano[idx][1] < disp) { plano[idx][1]++; falta-- }
    else if (falta < 0 && plano[idx][1] > 1) { plano[idx][1]--; falta++ }
  }
  plano = plano.filter(([, n]) => n > 0)
  return plano
}

/** Provas (fontes) que as questões citam e que ainda não têm rótulo: ganham o próprio código como nome. */
export const fontesDasQuestoes = (qs: readonly Question[], fontes: Record<string, string>): Record<string, string> => {
  const f = { ...fontes }
  for (const q of qs) if (!(q.s in f)) f[q.s] = q.s
  return f
}

/** Id estável (por conteúdo) de uma questão importada: importar de novo o mesmo arquivo dá os mesmos ids, então o progresso não se perde e nada duplica. */
export function idPorConteudo(q: { enunciado: string; alternativas: Partial<Record<string, string>>; origem?: string; numero?: number }): string {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')
  const texto = `${norm(q.enunciado)}|${['A', 'B', 'C', 'D', 'E'].map((l) => norm(q.alternativas[l] ?? '')).join('|')}`
  return 'u' + hashTexto(texto)
}

/** Dois hashes de 32 bits diferentes (FNV-1a e djb2) juntos: ~52 bits, colisão só de propósito. Estável: o mesmo texto dá sempre o mesmo resultado. */
export function hashTexto(texto: string): string {
  let a = 0x811c9dc5, b = 5381
  for (let i = 0; i < texto.length; i++) { const c = texto.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = (Math.imul(b, 33) + c) >>> 0 }
  return a.toString(36) + b.toString(36)
}

/** Junta questões novas às do espaço sem repetir (mesmo id = mesma questão: a nova substitui a velha, mantendo o resto). */
export function juntarQuestoes(atuais: readonly Question[], novas: readonly Question[]): { questoes: Question[]; adicionadas: number; repetidas: number } {
  const por = new Map(atuais.map((q) => [q.id, q]))
  let adicionadas = 0, repetidas = 0
  for (const q of novas) { if (por.has(q.id)) repetidas++; else adicionadas++; por.set(q.id, q) }
  return { questoes: [...por.values()], adicionadas, repetidas }
}

export const espacoVazio = (id: string, nome: string): Espaco => ({ id, nome, questoes: [], bases: {}, fontes: {}, materias: [], extras: [], simulado: null, bancos: [] })
