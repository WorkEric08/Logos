// Painel do dia e plano de estudo (F6). Puro: sem DOM, banco nem estado. O assistente "chega" com o resumo do dia (o que já estudou, o que está esperando, onde mais
// precisa) e UMA sugestão principal; e, se a pessoa diz quanto tempo tem, monta um plano que divide o tempo entre cartões, caderno de erros, matéria fraca e questões novas.
import type { Caderno } from './caderno'
import { materiasFracas, montarSemana, type Semana } from './caderno'
import { contar, type Ajustes, type Cartao } from './cards'
import { diaDe, type Hist } from './historico'
import type { ProgressMap, Question } from './types'
import type { Rng } from './weights'

/** Referência de um dia de estudo (questões respondidas). É só uma meta para mostrar o progresso: a pessoa pode estudar mais ou menos. */
export const META_DIA = 20
/** Quanto leva, em média, cada coisa (usado para dividir o tempo do plano). Cartão: ler, lembrar e dar a nota; questão: ler, marcar e ver a correção. */
export const MIN_POR_CARTAO = 0.5
export const MIN_POR_QUESTAO = 2
export const MIN_PLANO = 5, MAX_PLANO = 240
/** Quanto do tempo, no máximo, vai para os cartões (eles são rápidos, mas o resto também precisa de tempo). */
const FRACAO_CARTOES = 0.4
const MAX_ERROS_NA_SUGESTAO = 20

export interface EntradaPainel {
  agora: number
  cartoes: readonly Cartao[]
  ajustes: Ajustes
  /** Respostas a questões, por dia. */
  histQuestoes: Hist
  /** Cartões estudados, por dia. */
  histCartoes: Hist
  prog: ProgressMap
  bank: readonly Question[]
  caderno: Caderno
}

export type IdSugestaoDia = 'cartoes' | 'erros' | 'fraca' | 'novas' | 'semana' | 'importar'
export interface SugestaoDia { id: IdSugestaoDia; rotulo: string; motivo: string; materia?: string; n?: number }

export interface Painel {
  respondidasHoje: number
  acertosHoje: number
  cartoesHoje: number
  metaDia: number
  /** Dias seguidos estudando (questões ou cartões). Se hoje ainda não começou, a de ontem continua valendo. */
  sequencia: number
  cartoesParaEstudar: number
  erros: number
  fraca: { materia: string; acerto: number; n: number } | null
  novas: number
  semQuestoes: boolean
  sugestao: SugestaoDia
  alternativas: SugestaoDia[]
}

const voltaDia = (d: string, k: number) => { const [y, m, dd] = d.split('-').map(Number); return diaDe(new Date(y, m - 1, dd - k, 12)) }

/** Dias seguidos com estudo de qualquer tipo (questão ou cartão). Sem estudo hoje ainda, conta a partir de ontem. */
export function sequenciaJunta(q: Hist, c: Hist, agora: number): number {
  const estudou = (d: string) => !!(q.dias[d]?.n || c.dias[d]?.n)
  let dia = diaDe(agora)
  if (!estudou(dia)) dia = voltaDia(dia, 1)
  let s = 0
  while (estudou(dia)) { s++; dia = voltaDia(dia, 1) }
  return s
}

export function montarPainel(e: EntradaPainel): Painel {
  const hoje = diaDe(e.agora)
  const dq = e.histQuestoes.dias[hoje]
  const cartoesParaEstudar = contar(e.cartoes as Cartao[], e.ajustes, e.agora).hoje
  const erros = Object.keys(e.caderno).length
  const fraca = materiasFracas(e.prog, e.bank, 1)[0] ?? null
  const novas = e.bank.filter((q) => !e.prog[q.id]?.n).length
  const semQuestoes = e.bank.length === 0

  const todas: SugestaoDia[] = []
  if (cartoesParaEstudar > 0) todas.push({ id: 'cartoes', n: cartoesParaEstudar, rotulo: `Estudar cartões (${cartoesParaEstudar})`, motivo: 'revisar na hora certa é o que fixa o conteúdo' })
  if (erros > 0) todas.push({ id: 'erros', n: Math.min(erros, MAX_ERROS_NA_SUGESTAO), rotulo: `Rever o caderno de erros (${Math.min(erros, MAX_ERROS_NA_SUGESTAO)})`, motivo: 'o que você errou volta até acertar 3 vezes seguidas' })
  if (fraca) todas.push({ id: 'fraca', materia: fraca.materia, n: 10, rotulo: `Treinar ${fraca.materia}`, motivo: `é onde você mais erra (${Math.round(fraca.acerto * 100)} % de acerto)` })
  if (novas > 0 && !semQuestoes) todas.push({ id: 'novas', n: Math.min(10, novas), rotulo: `Questões novas (${Math.min(10, novas)})`, motivo: 'ainda não apareceram para você' })
  if (!semQuestoes) todas.push({ id: 'semana', rotulo: 'Simulado da semana', motivo: 'mistura erros, matérias fracas e questões novas' })
  if (semQuestoes && !todas.length) todas.push({ id: 'importar', rotulo: 'Importar uma prova', motivo: 'este espaço ainda não tem questões' })

  return {
    respondidasHoje: dq?.n ?? 0, acertosHoje: dq?.c ?? 0, cartoesHoje: e.histCartoes.dias[hoje]?.n ?? 0, metaDia: META_DIA,
    sequencia: sequenciaJunta(e.histQuestoes, e.histCartoes, e.agora),
    cartoesParaEstudar, erros, fraca, novas, semQuestoes,
    sugestao: todas[0], alternativas: todas.slice(1, 3),
  }
}

/** A saudação do assistente conforme a hora. */
export const saudacao = (agora: number) => { const h = new Date(agora).getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }

/** O texto do painel, em linhas curtas (cada uma começa com "•"), na primeira pessoa. */
export function textoDoPainel(p: Painel, agora: number): string {
  const linhas: string[] = [`${saudacao(agora)}! Aqui está o seu dia:`]
  const estudou = p.respondidasHoje + p.cartoesHoje
  if (!estudou) linhas.push(`• Hoje ainda não estudou${p.sequencia ? ` (sua sequência é de ${p.sequencia} ${p.sequencia === 1 ? 'dia' : 'dias'}: estude hoje para mantê-la)` : ''}.`)
  else {
    const partes: string[] = []
    if (p.respondidasHoje) partes.push(`${p.respondidasHoje} de ${p.metaDia} questões (${Math.round((p.acertosHoje / p.respondidasHoje) * 100)} % de acerto)`)
    if (p.cartoesHoje) partes.push(`${p.cartoesHoje} ${p.cartoesHoje === 1 ? 'cartão' : 'cartões'}`)
    linhas.push(`• Hoje: ${partes.join(' e ')}${p.sequencia > 1 ? ` · sequência de ${p.sequencia} dias` : ''}.`)
  }
  const esperando: string[] = []
  if (p.cartoesParaEstudar) esperando.push(`${p.cartoesParaEstudar} ${p.cartoesParaEstudar === 1 ? 'cartão' : 'cartões'} para estudar`)
  if (p.erros) esperando.push(`${p.erros} ${p.erros === 1 ? 'questão' : 'questões'} no caderno de erros`)
  if (esperando.length) linhas.push(`• Esperando por você: ${esperando.join(' e ')}.`)
  if (p.fraca) linhas.push(`• Onde mais precisa de treino: ${p.fraca.materia} (${Math.round(p.fraca.acerto * 100)} % de acerto).`)
  const metaBatida = p.respondidasHoje >= p.metaDia
  linhas.push(metaBatida ? `Meta do dia batida! Se quiser mais, sugiro: ${p.sugestao.rotulo.toLowerCase()}.` : `Sugiro começar por: ${p.sugestao.rotulo.toLowerCase()} — ${p.sugestao.motivo}.`)
  return linhas.join('\n')
}

// ---------------------------------------------------------------- plano por tempo

export interface Plano {
  minutos: number
  cartoes: number
  minutosCartoes: number
  questoes: Semana
  minutosQuestoes: number
  /** Sobrou tempo que não coube em nada (não há cartões nem questões suficientes). */
  folga: number
}

/**
 * Divide o tempo: primeiro os cartões vencidos (até 40 % do tempo, 30 s cada), depois questões (2 min cada) na mistura da semana: 40 % do caderno de erros,
 * 30 % de matérias fracas e o resto de questões novas. Ao menos uma questão, se o tempo der.
 */
export function montarPlano(e: EntradaPainel, minutos: number, tf: Record<string, number>, rng: Rng = Math.random): Plano {
  const m = Math.min(MAX_PLANO, Math.max(MIN_PLANO, Math.round(minutos)))
  const vencidos = contar(e.cartoes as Cartao[], e.ajustes, e.agora).hoje
  const cartoes = Math.min(vencidos, Math.floor((m * FRACAO_CARTOES) / MIN_POR_CARTAO))
  const minutosCartoes = cartoes * MIN_POR_CARTAO
  const nQuestoes = Math.max(e.bank.length ? 1 : 0, Math.floor((m - minutosCartoes) / MIN_POR_QUESTAO))
  const questoes = montarSemana(e.bank as Question[], e.prog, e.caderno, tf, nQuestoes, rng)
  const minutosQuestoes = questoes.ids.length * MIN_POR_QUESTAO
  return { minutos: m, cartoes, minutosCartoes, questoes, minutosQuestoes, folga: Math.max(0, Math.round(m - minutosCartoes - minutosQuestoes)) }
}

const arredonda = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))

/** O plano em palavras: o que fazer, em que ordem e quanto tempo cada parte leva. */
export function textoDoPlano(pl: Plano): string {
  const linhas = [`Plano de ${pl.minutos} minutos:`]
  let k = 1
  if (pl.cartoes) linhas.push(`${k++}. ${pl.cartoes} ${pl.cartoes === 1 ? 'cartão' : 'cartões'} (cerca de ${arredonda(pl.minutosCartoes)} min)`)
  const p = pl.questoes.partes
  if (pl.questoes.ids.length) {
    const partes = [p.erros && `${p.erros} do caderno de erros`, p.fracas && `${p.fracas} de matérias fracas (${pl.questoes.materiasFracas.join(', ')})`, p.novas && `${p.novas} novas`, p.outras && `${p.outras} para completar`].filter(Boolean)
    linhas.push(`${k++}. ${pl.questoes.ids.length} ${pl.questoes.ids.length === 1 ? 'questão' : 'questões'} (cerca de ${arredonda(pl.minutosQuestoes)} min): ${partes.join(', ')}`)
  }
  if (k === 1) linhas.push('Não há cartões nem questões para montar um plano neste espaço. Importe uma prova ou guarde um material primeiro.')
  else if (pl.folga >= 3) linhas.push(`Sobram uns ${pl.folga} min: dá para uma segunda rodada se quiser.`)
  return linhas.join('\n')
}

/** "30 min", "meia hora", "1 hora e meia", "2h", "uma hora": quantos minutos a pessoa disse ter. Sem número claro: undefined. */
export function acharMinutos(texto: string): number | undefined {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ' ').replace(/\s+/g, ' ')
  if (/\bmeia hora\b/.test(t)) return 30
  if (/\buma hora e meia\b|\b1 hora e meia\b|\b1h30\b/.test(t)) return 90
  const h = /\b(\d{1,2})\s*(?:h\b|horas?\b)/.exec(t)
  if (h) return Number(h[1]) * 60
  if (/\buma hora\b/.test(t)) return 60
  if (/\bduas horas\b/.test(t)) return 120
  const m = /\b(\d{1,3})\s*(?:min\b|mins\b|minutos?\b|m\b)/.exec(t)
  if (m) { const n = Number(m[1]); return n >= MIN_PLANO && n <= MAX_PLANO ? n : undefined }
  return undefined
}
