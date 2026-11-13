// Do que o leitor achou (QuestaoLida + gabarito) para o formato do app (Question). Puro. Questão sem gabarito, anulada ou com menos de 2 alternativas
// NÃO entra (vai para `ignoradas` com o motivo): é melhor faltar uma questão do que treinar com resposta inventada.
import { idPorConteudo } from '../espaco'
import type { Letter, Question } from '../types'
import type { Respostas } from './gabarito'
import { LETRAS, type QuestaoLida } from './prova'

export interface MetaProva {
  /** Chave da prova, no formato que o Início entende: "<banco>-<ano>" (ex.: "bb-2021"). */
  chave: string
  /** Rótulo que aparece nas telas: "BB 2021 · Escriturário". */
  rotulo: string
  ano: number
  bancoId: string
  bancoNome: string
}
export interface Ignorada { numero: number; motivo: string }
export interface Montagem { questoes: Question[]; bases: Record<string, string>; ignoradas: Ignorada[] }

export const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const PALAVRAS_SOLTAS = /^(prova|gabarito|gabaritos|final|preliminar|definitivo|caderno|pdf|1|2|3)$/i
/** Prova e ano a partir do nome do arquivo ("BB_2021_Escriturario_AgenteComercial_prova.pdf" → BB 2021 · Escriturario Agente Comercial). O usuário pode corrigir na tela. */
export function detectarProva(nomeArquivo: string, agora = new Date()): MetaProva {
  const base = nomeArquivo.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const ano = Number(/(?:^|[^\d])((?:19|20)\d{2})(?!\d)/.exec(base)?.[1]) || agora.getFullYear()
  const partes = base.split(/[\s]+/).filter((p) => p && !PALAVRAS_SOLTAS.test(p))
  const iAno = partes.findIndex((p) => p.includes(String(ano)))
  const banco = (iAno > 0 ? partes.slice(0, iAno) : partes.slice(0, 1)).join(' ').replace(/[-]+$/, '') || 'Prova'
  const resto = partes.slice(iAno >= 0 ? iAno + 1 : 1).join(' ').replace(/([a-zà-ÿ])([A-ZÀ-Ý])/g, '$1 $2')
  const bancoId = slug(banco) || 'prova'
  return { chave: `${bancoId}-${ano}`, rotulo: `${banco} ${ano}${resto ? ` · ${resto}` : ''}`, ano, bancoId, bancoNome: banco }
}

export function montarQuestoes(lidas: readonly QuestaoLida[], respostas: Respostas, meta: MetaProva, escolhidas?: ReadonlySet<number>): Montagem {
  const questoes: Question[] = []
  const bases: Record<string, string> = {}
  const ignoradas: Ignorada[] = []
  for (const l of lidas) {
    if (escolhidas && !escolhidas.has(l.numero)) continue
    const alts = LETRAS.filter((x) => l.alternativas[x]?.trim())
    if (alts.length < 2 || !l.enunciado.trim()) { ignoradas.push({ numero: l.numero, motivo: 'faltam alternativas ou enunciado' }); continue }
    if (!(l.numero in respostas)) { ignoradas.push({ numero: l.numero, motivo: 'sem gabarito' }); continue }
    const g = respostas[l.numero]
    if (g === null) { ignoradas.push({ numero: l.numero, motivo: 'anulada' }); continue }
    if (!l.alternativas[g]) { ignoradas.push({ numero: l.numero, motivo: `o gabarito aponta a letra ${g}, que não foi lida` }); continue }
    const o = Object.fromEntries(LETRAS.map((x) => [x, l.alternativas[x] ?? ''])) as Record<Letter, string>
    const id = l.idOrigem ?? idPorConteudo({ enunciado: `${l.apoio} ${l.enunciado}`, alternativas: o })
    let b = ''
    if (l.apoio) { b = idPorConteudo({ enunciado: l.apoio, alternativas: {} }).slice(1, 9); bases[b] = l.apoio }
    const figura = l.avisos.some((a) => a.includes('figura'))
    questoes.push({
      id, y: meta.ano, s: meta.chave, n: l.numero, m: l.materia || 'Geral', t: 'Geral', a: '', e: l.enunciado, b, o, g,
      p: null, bp: null, f: figura ? 1 : 0, ol: 0,
      ...(l.avisos.length ? { rv: l.avisos } : {}),
    })
  }
  return { questoes, bases, ignoradas }
}
