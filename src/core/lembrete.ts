// Lembrete diário de estudo (puro: sem DOM, banco, plugin nem relógio global — o `agora` vem de fora). O Android só faz o que este módulo manda:
// este módulo decide QUAIS avisos existem nos próximos dias, a QUE HORA e com QUE TEXTO; o plugin agenda e mostra.
//
// Decisões (2026-11-16):
//  - Um aviso por dia, na hora que a pessoa escolher, para os próximos DIAS_A_FRENTE dias; a lista é refeita a cada abertura do app e a cada mudança
//    (estudou, mudou a hora…). Por isso o texto de HOJE é concreto (o que está esperando) e os dos dias seguintes são frases gerais: o app não sabe
//    o que vai estar esperando daqui a 5 dias.
//  - Quem já estudou hoje (qualquer questão ou cartão) não recebe o aviso de hoje: o lembrete é para começar, não para cobrar.
//  - Se a pessoa para de abrir o app por DIAS_A_FRENTE dias, os avisos acabam (não fica cobrando para sempre).
// Períodos (2026-11-17): além do aviso de começo, a pessoa marca de zero a quatro PERÍODOS (manhã, tarde, noite, madrugada). Em cada período marcado há um aviso
// "ainda há cartões para revisar" NO HORÁRIO do período, mas só nos dias em que há mesmo cartão esperando (hoje: o que está vencido agora; dias seguintes: o que
// vencerá até lá se nada for estudado). O app refaz a lista ao abrir e ao estudar, então quem revisou tudo deixa de receber os avisos do resto do dia.
import { contar, type Ajustes, type Cartao } from './cards'
import type { Painel } from './dia'
import { diaDe } from './historico'

export type IdPeriodo = 'manha' | 'tarde' | 'noite' | 'madrugada'
export interface ConfigLembrete { ativo: boolean; hora: number; minuto: number; /** Períodos que avisam de cartões para revisar (zero a quatro, na ordem de PERIODOS). */ periodos: IdPeriodo[] }
/** De fábrica o lembrete está DESLIGADO (a permissão de notificação só é pedida quando a pessoa o liga) e o horário começa em 00:00. */
export const LEMBRETE_PADRAO: ConfigLembrete = { ativo: false, hora: 0, minuto: 0, periodos: [] }
/** Quantos dias à frente se agenda (o Android limita alarmes pendentes; a janela é refeita a cada abertura). */
export const DIAS_A_FRENTE = 14
/** Quanto cada toque em "mais"/"menos" muda o horário (segurando, repete o mesmo passo). */
export const PASSO_MINUTOS = 15
/** Folga: um aviso que cairia nos próximos segundos não é agendado (o Android o descartaria ou o mostraria atrasado). */
const FOLGA_MS = 10_000

/**
 * Os quatro períodos do dia (a faixa de cada um, definida pelo dono em 2026-11-17: manhã 06:00–11:59, tarde 12:00–17:59, noite 18:00–23:59, madrugada 00:00–05:59) e a hora em que cada
 * um avisa de cartões para revisar. O aviso é UM por período, em `hora:minuto`, que fica DENTRO da faixa (por volta do meio dela, para não cair na virada nem acordar quem dorme cedo).
 */
export interface Periodo { id: IdPeriodo; rotulo: string; /** Quando o período começa e termina (a faixa mostrada na tela). */ de: { hora: number; minuto: number }; ate: { hora: number; minuto: number }; /** A hora do aviso dentro da faixa. */ hora: number; minuto: number }
export const PERIODOS: readonly Periodo[] = [
  { id: 'manha', rotulo: 'Manhã', de: { hora: 6, minuto: 0 }, ate: { hora: 11, minuto: 59 }, hora: 9, minuto: 0 },
  { id: 'tarde', rotulo: 'Tarde', de: { hora: 12, minuto: 0 }, ate: { hora: 17, minuto: 59 }, hora: 15, minuto: 0 },
  { id: 'noite', rotulo: 'Noite', de: { hora: 18, minuto: 0 }, ate: { hora: 23, minuto: 59 }, hora: 21, minuto: 0 },
  { id: 'madrugada', rotulo: 'Madrugada', de: { hora: 0, minuto: 0 }, ate: { hora: 5, minuto: 59 }, hora: 2, minuto: 0 },
]
/** "06:00 às 11:59": a faixa do período, como aparece na tela. */
export const faixaDoPeriodo = (p: Pick<Periodo, 'de' | 'ate'>): string => `${horaTexto(p.de)} às ${horaTexto(p.ate)}`

const doisDigitos = (n: number) => String(n).padStart(2, '0')
const semAcentos = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * O horário que a pessoa escreveu ("20h", "20h30", "às 20:30", "8 da noite", "7 e meia da manhã", "meio-dia", "às 19 horas"). Undefined se não há horário
 * (e "30 minutos" não é horário: é o tempo que a pessoa tem). "da noite" e "da tarde" passam de 12 h: "8 da noite" = 20:00, "6 da tarde" = 18:00.
 * Só vale numa fala sobre o lembrete (quem decide isso é o entendedor de comandos); a hora vem sempre dentro de 0–23 e o minuto de 0–59.
 */
export function acharHorario(texto: string): { hora: number; minuto: number } | undefined {
  const t = semAcentos(texto).replace(/[,.;!?]+/g, ' ').replace(/\s+/g, ' ')
  if (/\bmeio[- ]?dia\b/.test(t)) return { hora: 12, minuto: 0 }
  if (/\bmeia[- ]?noite\b/.test(t)) return { hora: 0, minuto: 0 }
  let hora: number | undefined, minuto = 0
  let m: RegExpExecArray | null
  if ((m = /\b(\d{1,2})\s*:\s*(\d{2})\b/.exec(t))) { hora = Number(m[1]); minuto = Number(m[2]) } // 20:30
  else if ((m = /\b(\d{1,2})\s*h(?:oras?)?\s*(\d{2})?\b/.exec(t))) { hora = Number(m[1]); minuto = m[2] ? Number(m[2]) : 0 } // 20h, 20h30, 19 horas
  else if ((m = /\bas\s+(\d{1,2})(?:\s+e\s+(meia|\d{1,2}))?\b/.exec(t))) { hora = Number(m[1]); minuto = m[2] === 'meia' ? 30 : m[2] ? Number(m[2]) : 0 } // às 8, às 7 e meia
  else if ((m = /\b(\d{1,2})(?:\s+e\s+(meia|\d{1,2}))?\s+da\s+(?:manha|tarde|noite|madrugada)\b/.exec(t))) { hora = Number(m[1]); minuto = m[2] === 'meia' ? 30 : m[2] ? Number(m[2]) : 0 } // 8 da noite
  if (hora === undefined) return undefined
  if (/\bda\s+noite\b/.test(t) && hora >= 6 && hora <= 11) hora += 12
  else if (/\bda\s+tarde\b/.test(t) && hora >= 1 && hora <= 11) hora += 12
  return hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59 ? { hora, minuto } : undefined
}
export const horaTexto = (c: Pick<ConfigLembrete, 'hora' | 'minuto'>) => `${doisDigitos(c.hora)}:${doisDigitos(c.minuto)}`
const inteiro = (v: unknown, min: number, max: number, padrao: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : padrao)

/** Lê o que foi guardado (qualquer coisa vinda do banco) e devolve sempre uma configuração válida. */
export function lerConfig(guardado: unknown): ConfigLembrete {
  const o = guardado && typeof guardado === 'object' ? (guardado as Record<string, unknown>) : {}
  const marcados = Array.isArray(o.periodos) ? o.periodos : []
  const periodos = PERIODOS.filter((p) => marcados.includes(p.id)).map((p) => p.id) // só os conhecidos, sem repetir, na ordem do dia
  return { ativo: o.ativo === true, hora: inteiro(o.hora, 0, 23, LEMBRETE_PADRAO.hora), minuto: inteiro(o.minuto, 0, 59, LEMBRETE_PADRAO.minuto), periodos }
}

/** Marca ou desmarca um período (devolve a configuração nova; a ordem é sempre a do dia). */
export function alternarPeriodo(c: ConfigLembrete, id: IdPeriodo): ConfigLembrete {
  const marcado = c.periodos.includes(id)
  return { ...c, periodos: PERIODOS.filter((p) => (p.id === id ? !marcado : c.periodos.includes(p.id))).map((p) => p.id) }
}

/** Soma (ou tira) minutos ao horário, dando a volta no relógio de 24 h (23:50 + 15 = 00:05). */
export function somarMinutos(c: ConfigLembrete, delta: number): ConfigLembrete {
  const total = (((c.hora * 60 + c.minuto + delta) % 1440) + 1440) % 1440
  return { ...c, hora: Math.floor(total / 60), minuto: total % 60 }
}

/** O que importa do dia para decidir e escrever o aviso (vem do painel do dia da F6). */
export interface EstadoDoDia {
  respondidasHoje: number; cartoesHoje: number; cartoesParaEstudar: number; erros: number; sequencia: number
  /** Quantos cartões esperam em cada um dos próximos dias (índice 0 = hoje), se a pessoa não revisar nada até lá. Sem isto, só hoje tem aviso de cartões. */
  cartoesPorDia?: readonly number[]
}

/** Quantos cartões estarão esperando em cada dia da janela (hoje, amanhã…), supondo que nada seja estudado antes: é o que o aviso de cartões usa para saber em que dias avisar. */
export function cartoesPorDia(cartoes: readonly Cartao[], ajustes: Ajustes, agora: number, dias = DIAS_A_FRENTE): number[] {
  const d = new Date(agora)
  return Array.from({ length: dias }, (_, k) => contar(cartoes as Cartao[], ajustes, k === 0 ? agora : new Date(d.getFullYear(), d.getMonth(), d.getDate() + k, 12, 0, 0, 0).getTime()).hoje)
}

export const estadoDoDiaDe = (p: Pick<Painel, 'respondidasHoje' | 'cartoesHoje' | 'cartoesParaEstudar' | 'erros' | 'sequencia'>, porDia?: readonly number[]): EstadoDoDia => ({
  respondidasHoje: p.respondidasHoje, cartoesHoje: p.cartoesHoje, cartoesParaEstudar: p.cartoesParaEstudar, erros: p.erros, sequencia: p.sequencia, ...(porDia ? { cartoesPorDia: porDia } : {}),
})

/** Já estudou hoje (questão ou cartão)? Então o aviso de hoje não toca. */
export const jaEstudouHoje = (e: EstadoDoDia): boolean => e.respondidasHoje + e.cartoesHoje > 0

/** `inicio`: o aviso de começo do estudo (abre o Assistente). `cartoes`: o aviso de um período, de cartões para revisar (abre os Cards). */
export type TipoAviso = 'inicio' | 'cartoes'
export interface Aviso { id: number; em: number; titulo: string; corpo: string; tipo: TipoAviso }
export const TITULO = 'Hora de estudar'
export const TITULO_CARTOES = 'Cartões para revisar'

const s = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** O texto do aviso de HOJE: o que está esperando; sem nada vencido, convida para questões novas. A sequência de dias entra como incentivo. */
export function corpoDeHoje(e: EstadoDoDia): string {
  const partes: string[] = []
  if (e.cartoesParaEstudar > 0) partes.push(`${s(e.cartoesParaEstudar, 'cartão', 'cartões')} para revisar`)
  if (e.erros > 0) partes.push(`${s(e.erros, 'questão', 'questões')} no caderno de erros`)
  const base = partes.length ? `Esperando por você: ${partes.join(' e ')}.` : 'Que tal 10 questões novas para manter o ritmo?'
  return e.sequencia >= 2 ? `${base} Mantenha a sua sequência de ${e.sequencia} dias.` : base
}

/** Os textos dos dias seguintes: gerais (o app não sabe o que vai estar esperando) e variados, para o aviso não virar ruído. */
const GERAIS = [
  'Seus cartões e questões do dia estão esperando.',
  'Poucos minutos hoje já mantêm o ritmo.',
  'Abra o Logos e veja o painel do dia.',
  'Revisar na hora certa é o que fixa o conteúdo.',
] as const
export const corpoGeral = (idDia: number): string => GERAIS[((idDia % GERAIS.length) + GERAIS.length) % GERAIS.length]

/** O texto do aviso de cartões de HOJE (o número é o de agora: a lista é refeita quando a pessoa revisa) e os dos dias seguintes (sem número: ainda pode mudar). */
export const corpoCartoesHoje = (n: number): string => `Você ainda tem ${s(n, 'cartão', 'cartões')} para revisar hoje.`
const CARTOES_GERAIS = ['Seus cartões de hoje estão esperando por revisão.', 'Ainda dá tempo: revise os cartões de hoje.', 'Revisar na hora certa é o que fixa o conteúdo. Seus cartões esperam.'] as const
export const corpoCartoesGeral = (idDia: number): string => CARTOES_GERAIS[((idDia % CARTOES_GERAIS.length) + CARTOES_GERAIS.length) % CARTOES_GERAIS.length]

/** Número do dia (dias desde 1970 no calendário LOCAL): o id estável do aviso daquele dia. Cabe com folga no inteiro de 32 bits do Android. */
export const idDoDia = (ms: number): number => { const d = new Date(ms); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000) }

/** A hora marcada no dia `agora + k` (calendário local; `new Date(a, m, d + k, …)` acerta virada de mês, de ano e horário de verão). */
function momentoDoDia(agora: number, k: number, c: Pick<ConfigLembrete, 'hora' | 'minuto'>): number {
  const d = new Date(agora)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + k, c.hora, c.minuto, 0, 0).getTime()
}

/**
 * Os avisos dos próximos `dias` dias. Desligado: nenhum. O de hoje só entra se a hora ainda não passou e a pessoa ainda não estudou hoje.
 * Ids = número do dia: reagendar a janela inteira (o que o app faz toda vez) nunca duplica nem muda o horário de um aviso.
 */
export function planejarLembretes(c: ConfigLembrete, e: EstadoDoDia, agora: number, dias = DIAS_A_FRENTE): Aviso[] {
  if (!c.ativo) return []
  const out: Aviso[] = []
  for (let k = 0; k < dias; k++) {
    const em = momentoDoDia(agora, k, c)
    if (em <= agora + FOLGA_MS) continue
    if (k === 0 && jaEstudouHoje(e)) continue
    const id = idDoDia(em)
    out.push({ id, em, titulo: TITULO, corpo: k === 0 ? corpoDeHoje(e) : corpoGeral(id), tipo: 'inicio' })
  }
  // os avisos dos períodos marcados: só nos dias em que há cartão esperando e no horário do período (um que cairia na mesma hora do aviso de começo não é repetido)
  PERIODOS.forEach((p, i) => {
    if (!c.periodos.includes(p.id)) return
    for (let k = 0; k < dias; k++) {
      const n = e.cartoesPorDia?.[k] ?? (k === 0 ? e.cartoesParaEstudar : 0)
      if (n <= 0) continue
      const em = momentoDoDia(agora, k, p)
      if (em <= agora + FOLGA_MS || (p.hora === c.hora && p.minuto === c.minuto)) continue
      const dia = idDoDia(em)
      out.push({ id: dia * 10 + i + 1, em, titulo: TITULO_CARTOES, corpo: k === 0 ? corpoCartoesHoje(n) : corpoCartoesGeral(dia), tipo: 'cartoes' })
    }
  })
  return out.sort((a, b) => a.em - b.em || a.id - b.id)
}

/** O aviso de teste ("Enviar um teste"): chega em poucos segundos, com o texto de hoje, para a pessoa ver como fica e conferir que o aparelho deixa chegar. */
export const SEGUNDOS_DO_TESTE = 5
export function avisoDeTeste(e: EstadoDoDia, agora: number): Aviso {
  return { id: -1 - idDoDia(agora), em: agora + SEGUNDOS_DO_TESTE * 1000, titulo: TITULO, corpo: `Teste: ${corpoDeHoje(e)}`, tipo: 'inicio' }
}

/** "Hoje às 19:00", "Amanhã às 19:00" ou "Quinta-feira às 19:00": quando é o próximo aviso de COMEÇO do estudo, para a tela dizer (os de cartões não entram). */
export function proximoAviso(avisos: readonly Aviso[], agora: number): string | null {
  const a = avisos.find((x) => x.tipo === 'inicio')
  if (!a) return null
  const hoje = diaDe(agora), dia = diaDe(a.em)
  const hm = horaTexto({ hora: new Date(a.em).getHours(), minuto: new Date(a.em).getMinutes() })
  if (dia === hoje) return `hoje às ${hm}`
  if (dia === diaDe(momentoDoDia(agora, 1, { hora: 12, minuto: 0 }))) return `amanhã às ${hm}`
  const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date(a.em))
  return `${nome} às ${hm}`
}
