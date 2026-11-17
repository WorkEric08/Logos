// Lembrete diário de estudo (puro: sem DOM, banco, plugin nem relógio global — o `agora` vem de fora). O Android só faz o que este módulo manda:
// este módulo decide QUAIS avisos existem nos próximos dias, a QUE HORA e com QUE TEXTO; o plugin agenda e mostra.
//
// Decisões (2026-11-16):
//  - Um aviso por dia, na hora que a pessoa escolher, para os próximos DIAS_A_FRENTE dias; a lista é refeita a cada abertura do app e a cada mudança
//    (estudou, mudou a hora…). Por isso o texto de HOJE é concreto (o que está esperando) e os dos dias seguintes são frases gerais: o app não sabe
//    o que vai estar esperando daqui a 5 dias.
//  - Quem já estudou hoje (qualquer questão ou cartão) não recebe o aviso de hoje: o lembrete é para começar, não para cobrar.
//  - Se a pessoa para de abrir o app por DIAS_A_FRENTE dias, os avisos acabam (não fica cobrando para sempre).
import type { Painel } from './dia'
import { diaDe } from './historico'

export interface ConfigLembrete { ativo: boolean; hora: number; minuto: number }
/** De fábrica o lembrete está DESLIGADO (a permissão de notificação só é pedida quando a pessoa o liga). */
export const LEMBRETE_PADRAO: ConfigLembrete = { ativo: false, hora: 19, minuto: 0 }
/** Quantos dias à frente se agenda (o Android limita alarmes pendentes; a janela é refeita a cada abertura). */
export const DIAS_A_FRENTE = 14
/** Quanto cada toque em "mais"/"menos" muda o horário. */
export const PASSO_MINUTOS = 15
/** Folga: um aviso que cairia nos próximos segundos não é agendado (o Android o descartaria ou o mostraria atrasado). */
const FOLGA_MS = 10_000

export const HORARIOS_RAPIDOS: readonly { rotulo: string; hora: number; minuto: number }[] = [
  { rotulo: 'Manhã', hora: 7, minuto: 30 }, { rotulo: 'Almoço', hora: 12, minuto: 30 }, { rotulo: 'Fim da tarde', hora: 18, minuto: 0 }, { rotulo: 'Noite', hora: 21, minuto: 0 },
]

const doisDigitos = (n: number) => String(n).padStart(2, '0')
export const horaTexto = (c: Pick<ConfigLembrete, 'hora' | 'minuto'>) => `${doisDigitos(c.hora)}:${doisDigitos(c.minuto)}`
const inteiro = (v: unknown, min: number, max: number, padrao: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : padrao)

/** Lê o que foi guardado (qualquer coisa vinda do banco) e devolve sempre uma configuração válida. */
export function lerConfig(guardado: unknown): ConfigLembrete {
  const o = guardado && typeof guardado === 'object' ? (guardado as Record<string, unknown>) : {}
  return { ativo: o.ativo === true, hora: inteiro(o.hora, 0, 23, LEMBRETE_PADRAO.hora), minuto: inteiro(o.minuto, 0, 59, LEMBRETE_PADRAO.minuto) }
}

/** Soma (ou tira) minutos ao horário, dando a volta no relógio de 24 h (23:50 + 15 = 00:05). */
export function somarMinutos(c: ConfigLembrete, delta: number): ConfigLembrete {
  const total = (((c.hora * 60 + c.minuto + delta) % 1440) + 1440) % 1440
  return { ...c, hora: Math.floor(total / 60), minuto: total % 60 }
}

/** O que importa do dia para decidir e escrever o aviso (vem do painel do dia da F6). */
export interface EstadoDoDia { respondidasHoje: number; cartoesHoje: number; cartoesParaEstudar: number; erros: number; sequencia: number }

export const estadoDoDiaDe = (p: Pick<Painel, 'respondidasHoje' | 'cartoesHoje' | 'cartoesParaEstudar' | 'erros' | 'sequencia'>): EstadoDoDia => ({
  respondidasHoje: p.respondidasHoje, cartoesHoje: p.cartoesHoje, cartoesParaEstudar: p.cartoesParaEstudar, erros: p.erros, sequencia: p.sequencia,
})

/** Já estudou hoje (questão ou cartão)? Então o aviso de hoje não toca. */
export const jaEstudouHoje = (e: EstadoDoDia): boolean => e.respondidasHoje + e.cartoesHoje > 0

export interface Aviso { id: number; em: number; titulo: string; corpo: string }
export const TITULO = 'Hora de estudar'

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

/** Número do dia (dias desde 1970 no calendário LOCAL): o id estável do aviso daquele dia. Cabe com folga no inteiro de 32 bits do Android. */
export const idDoDia = (ms: number): number => { const d = new Date(ms); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000) }

/** A hora marcada no dia `agora + k` (calendário local; `new Date(a, m, d + k, …)` acerta virada de mês, de ano e horário de verão). */
function momentoDoDia(agora: number, k: number, c: ConfigLembrete): number {
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
    out.push({ id, em, titulo: TITULO, corpo: k === 0 ? corpoDeHoje(e) : corpoGeral(id) })
  }
  return out
}

/** O aviso de teste ("Enviar um teste"): chega em poucos segundos, com o texto de hoje, para a pessoa ver como fica e conferir que o aparelho deixa chegar. */
export const SEGUNDOS_DO_TESTE = 5
export function avisoDeTeste(e: EstadoDoDia, agora: number): Aviso {
  return { id: -1 - idDoDia(agora), em: agora + SEGUNDOS_DO_TESTE * 1000, titulo: TITULO, corpo: `Teste: ${corpoDeHoje(e)}` }
}

/** "Hoje às 19:00", "Amanhã às 19:00" ou "Quinta-feira às 19:00": quando é o próximo aviso, para a tela dizer. */
export function proximoAviso(avisos: readonly Aviso[], agora: number): string | null {
  const a = avisos[0]
  if (!a) return null
  const hoje = diaDe(agora), dia = diaDe(a.em)
  const hm = horaTexto({ hora: new Date(a.em).getHours(), minuto: new Date(a.em).getMinutes() })
  if (dia === hoje) return `hoje às ${hm}`
  if (dia === diaDe(momentoDoDia(agora, 1, { ativo: true, hora: 12, minuto: 0 }))) return `amanhã às ${hm}`
  const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date(a.em))
  return `${nome} às ${hm}`
}
