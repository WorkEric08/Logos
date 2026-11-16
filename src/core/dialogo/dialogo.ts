// O motor do diálogo: dado o pedido (o que a pessoa quer + o que já disse), decide o próximo passo: EXECUTAR ou PERGUNTAR o que falta (com opções para tocar).
// É o "slot filling" dos chatbots por regras: o que a pessoa não disse o assistente pergunta; o que ela já disse ele não repete. Puro e determinístico.
import { acharMateria, acharQuantidade, type Contexto, type CtxProva, type Entidades } from './entidades'
import { semAcento } from '../busca/texto'
import type { IdAcao } from '../assistente'
import type { Intencao } from '../conversa'

export type AcaoPedido = 'simulado' | 'treinar'
/** `materia`: o nome de uma matéria, "todas" ou "edital" (só o simulado do edital: 70 questões com nota). */
export interface Pedido { acao: AcaoPedido; materia?: string; quantidade?: number; provas?: CtxProva[] }
export type Slot = 'materia' | 'quantidade'
export interface Opcao { rotulo: string; valor: string | number }
export type Passo =
  | { tipo: 'executar'; pedido: Pedido }
  | { tipo: 'perguntar'; slot: Slot; texto: string; opcoes: Opcao[]; pedido: Pedido }

export const QUANTIDADES = [10, 20, 30, 40]
export const TREINO_PADRAO = 10

const PALAVRAS_DE_IMPORTAR = /\b(importar|importa|importe|pdf|gabarito|gabaritos|adicionar|adiciona|subir|enviar|carregar|arquivo|arquivos)\b/

/**
 * Quando a fala traz matéria, prova ou quantidade, "prova" quase sempre quer dizer QUAL prova treinar, não "importar uma prova": uma dúvida entre importar e treinar/simulado
 * se resolve para o treino ou o simulado, e "fazer a prova do BB 2021" (uma prova que já existe, sem falar de arquivo) vira treino.
 */
export function ajustarPelasEntidades(i: Intencao, e: Entidades, bruto: string): Intencao {
  const comDetalhe = !!(e.materia || e.provas?.length || e.quantidade || e.todas)
  if (i.tipo === 'ambigua') {
    const tem = (id: IdAcao) => i.opcoes.includes(id)
    if (comDetalhe && tem('simulado')) return { tipo: 'acao', id: 'simulado' }
    if (comDetalhe && tem('treinar')) return { tipo: 'acao', id: 'treinar' }
    if ((e.nome || e.espaco) && tem('espaco')) return { tipo: 'acao', id: 'espaco' } // "criar espaço Pesquisa": o nome não é uma pesquisa
    if ((e.materia || e.provas?.length) && tem('resumo')) return { tipo: 'acao', id: 'resumo' } // "quantas questões tem a prova X"
    return i
  }
  if (i.tipo === 'acao' && i.id === 'prova' && e.provas?.length && !PALAVRAS_DE_IMPORTAR.test(semAcento(bruto))) return { tipo: 'acao', id: 'treinar' }
  return i
}

/** Do que a pessoa disse ao pedido (matéria, quantidade e prova já ditas ficam; "todas" vira a matéria "todas"). */
export function pedidoDe(acao: AcaoPedido, e: Entidades): Pedido {
  return { acao, ...(e.materia ? { materia: e.materia } : e.todas ? { materia: 'todas' } : {}), ...(e.quantidade ? { quantidade: e.quantidade } : {}), ...(e.provas?.length ? { provas: e.provas } : {}) }
}

const opcoesDeMateria = (ctx: Contexto, comEdital: boolean): Opcao[] => [
  ...(comEdital ? [{ rotulo: 'Simulado do edital (70 questões)', valor: 'edital' }] : []),
  { rotulo: 'Todas as matérias', valor: 'todas' },
  ...ctx.materias.map((m) => ({ rotulo: m.curto, valor: m.nome })),
]

export function proximoPasso(p: Pedido, ctx: Contexto): Passo {
  const semAssunto = !p.materia && !p.provas?.length
  if (p.acao === 'simulado') {
    if (p.materia === 'edital') return { tipo: 'executar', pedido: p }
    if (semAssunto) {
      const edital = ctx.temRegras && !p.quantidade
      return { tipo: 'perguntar', slot: 'materia', pedido: p, opcoes: opcoesDeMateria(ctx, edital), texto: edital ? 'Qual simulado? O do edital (com nota e regras) ou de uma matéria?' : 'De qual matéria?' }
    }
    if (!p.quantidade) return { tipo: 'perguntar', slot: 'quantidade', pedido: p, opcoes: QUANTIDADES.map((n) => ({ rotulo: `${n} questões`, valor: n })), texto: 'Quantas questões?' }
    return { tipo: 'executar', pedido: p }
  }
  // treino: sem nada dito pergunta a matéria; com a matéria (ou a quantidade) usa o padrão do que falta, sem perguntar mais
  if (semAssunto && !p.quantidade) return { tipo: 'perguntar', slot: 'materia', pedido: p, opcoes: opcoesDeMateria(ctx, false), texto: 'Treinar o quê? Escolha a matéria (ou "todas" para um treino misto).' }
  return { tipo: 'executar', pedido: { ...p, materia: p.materia ?? 'todas', quantidade: p.quantidade ?? TREINO_PADRAO } }
}

/** Põe a resposta no lugar que faltava. */
export const preencher = (p: Pedido, slot: Slot, valor: string | number): Pedido => (slot === 'materia' ? { ...p, materia: String(valor) } : { ...p, quantidade: Number(valor) })

/** Lê o que a pessoa ESCREVEU em resposta a uma pergunta de slot ("matemática", "vinte", "edital"). Undefined = não entendeu a resposta. */
export function entenderResposta(slot: Slot, texto: string, ctx: Contexto): string | number | undefined {
  if (slot === 'quantidade') return acharQuantidade(texto) ?? (/^\s*\d{1,3}\s*$/.test(texto) && Number(texto) > 0 ? Number(texto) : undefined)
  const sem = semAcento(texto)
  if (/\bedital\b|\boficial\b/.test(sem) && ctx.temRegras) return 'edital'
  if (/\b(todas|todos|qualquer|geral|misturad[oa]s?|tudo)\b/.test(sem)) return 'todas'
  return acharMateria(texto, ctx.materias)
}

const rotuloProva = (p: CtxProva) => p.rotulo.split(' · ')[0]
/** "simulado de 20 questões de Matemática", "treino de 10 questões da prova BB 2021". */
export function descrever(p: Pedido): string {
  const o = p.acao === 'simulado' ? 'simulado' : 'treino'
  if (p.materia === 'edital') return 'simulado do edital (70 questões, com nota e regras)'
  const n = p.quantidade ? ` de ${p.quantidade} questões` : ''
  const m = p.materia && p.materia !== 'todas' ? ` de ${p.materia}` : p.provas?.length ? '' : ' de todas as matérias'
  const pr = p.provas?.length ? ` da prova ${[...new Set(p.provas.map(rotuloProva))].join(' e ')}` : ''
  return `${o}${n}${m}${pr}`
}

/** Para o teste e a tela: o texto de uma pergunta de slot cabe como mensagem (sem opções repetidas). */
export const resumoPergunta = (passo: Extract<Passo, { tipo: 'perguntar' }>): string => `${passo.texto} (${passo.opcoes.map((o) => o.rotulo).join(', ')})`
