// O plano de estudo EM ANDAMENTO (puro: sem DOM, banco nem relógio). Quando a pessoa pede um plano ("tenho 1 hora"), o assistente guarda o que combinou (quantos
// cartões e quais questões) e, a cada vez que ela volta ao assistente, conta o que já foi feito e o que ainda falta: primeiro os cartões, depois as questões.
// "Feito" vem do que o app viu desde que o plano foi montado: cartões estudados hoje (acima do que já havia no início) e respostas às questões do plano
// (eventos de resposta depois do início). Cartão que vence e não é estudado continua faltando; cartão que sumiu da fila (nada mais vence) não falta mais.
import type { Plano } from './dia'

export interface PlanoAtivo {
  /** O dia do plano (AAAA-MM-DD, calendário local): amanhã ele deixa de valer. */
  dia: string
  /** Quando foi montado (ms). Só respostas depois disto contam para as questões. */
  criado: number
  minutos: number
  /** Quantos cartões o plano pediu. */
  cartoes: number
  /** As questões do plano, na ordem. */
  questoes: string[]
  /** Quantos cartões já tinham sido estudados hoje quando o plano foi montado. */
  baseCartoes: number
  /** O texto do último balão de andamento (para não repetir o mesmo balão a cada volta ao assistente). */
  ultimoTexto?: string
}

export type FasePlano = 'cartoes' | 'questoes' | 'fim'

export interface StatusPlano {
  /** O que vem agora: cartões primeiro; quando acabam, as questões; depois nada. */
  fase: FasePlano
  cartoesTotal: number
  cartoesFeitos: number
  cartoesFaltam: number
  questoesTotal: number
  questoesFeitas: number
  /** Os ids das questões do plano que ainda não foram respondidas. */
  questoesFaltam: string[]
}

/** O que o app sabe agora (vem dos estados do app). */
export interface MedidasDoPlano {
  /** Cartões estudados hoje (todas as notas contam, inclusive "Errei" que volta à fila). */
  cartoesHoje: number
  /** Cartões que ainda estão para estudar agora (o mesmo número do painel: `contar(...).hoje`). */
  cartoesVencidos: number
  /** Ids das questões respondidas depois de o plano ter sido montado. */
  respondidas: ReadonlySet<string>
}

export const novoPlanoAtivo = (pl: Plano, dia: string, agora: number, cartoesHoje: number): PlanoAtivo => ({
  dia, criado: agora, minutos: pl.minutos, cartoes: pl.cartoes, questoes: [...pl.questoes.ids], baseCartoes: cartoesHoje,
})

export function statusDoPlano(p: PlanoAtivo, m: MedidasDoPlano): StatusPlano {
  const feitos = Math.max(0, m.cartoesHoje - p.baseCartoes)
  const cartoesFeitos = Math.min(p.cartoes, feitos)
  // o que falta é o que o plano pediu e ainda não foi feito, mas nunca mais do que há para estudar (não adianta pedir cartão que nenhum vence mais)
  const cartoesFaltam = Math.min(Math.max(0, p.cartoes - feitos), Math.max(0, m.cartoesVencidos))
  const questoesFaltam = p.questoes.filter((id) => !m.respondidas.has(id))
  const fase: FasePlano = cartoesFaltam > 0 ? 'cartoes' : questoesFaltam.length > 0 ? 'questoes' : 'fim'
  return { fase, cartoesTotal: p.cartoes, cartoesFeitos, cartoesFaltam, questoesTotal: p.questoes.length, questoesFeitas: p.questoes.length - questoesFaltam.length, questoesFaltam }
}

const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** O balão de andamento do assistente (o que já foi feito e o que falta, na ordem do plano). */
export function textoDoStatus(p: PlanoAtivo, s: StatusPlano): string {
  const q = s.questoesFaltam.length
  if (s.fase === 'cartoes') {
    const nada = s.cartoesFeitos === 0 && s.questoesFeitas === 0
    if (nada) return `Seu plano de hoje: ${pl(s.cartoesTotal, 'cartão', 'cartões')}${s.questoesTotal ? ` e depois ${pl(s.questoesTotal, 'questão', 'questões')}` : ''}. Comece pelos cartões.`
    return `Faltam ${s.cartoesFaltam} de ${pl(s.cartoesTotal, 'cartão', 'cartões')} do seu plano${s.cartoesFeitos ? ` (você já fez ${s.cartoesFeitos})` : ''}.${q ? ` Depois, ${pl(q, 'questão', 'questões')}.` : ''}`
  }
  if (s.fase === 'questoes') {
    const comeco = s.cartoesTotal > 0 ? 'Cartões do plano concluídos! Agora as questões' : 'Agora as questões do seu plano'
    return s.questoesFeitas === 0 ? `${comeco}: ${pl(q, 'questão', 'questões')}.` : `${comeco}: faltam ${q} de ${pl(s.questoesTotal, 'questão', 'questões')}.`
  }
  const partes = [s.cartoesTotal && pl(s.cartoesTotal, 'cartão', 'cartões'), s.questoesTotal && pl(s.questoesTotal, 'questão', 'questões')].filter(Boolean)
  return `Plano de ${p.minutos} minutos concluído${partes.length ? `: ${partes.join(' e ')}` : ''}. Bom trabalho! Quer montar outro?`
}

const texto = (x: unknown) => (typeof x === 'string' ? x : undefined)
/** Lê o plano guardado (qualquer coisa vinda do banco); devolve null se não for um plano válido. */
export function lerPlanoAtivo(x: unknown): PlanoAtivo | null {
  const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : null
  if (!o || typeof o.dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.dia)) return null
  const n = (v: unknown, padrao = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : padrao)
  const questoes = Array.isArray(o.questoes) ? o.questoes.filter((id): id is string => typeof id === 'string') : []
  const ultimoTexto = texto(o.ultimoTexto)
  return { dia: o.dia, criado: n(o.criado), minutos: n(o.minutos), cartoes: n(o.cartoes), questoes, baseCartoes: n(o.baseCartoes), ...(ultimoTexto ? { ultimoTexto } : {}) }
}
