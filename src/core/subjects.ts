import bank from '../data/bank.json'
import type { Subject } from './types'

// Estrutura da prova do BB (edital 2022/001): pontos por questão e bloco (B = básico, E = específico).
export const BB_SUBJECTS: Subject[] = [
  { n: 'Vendas e Negociação', s: 'Vendas', q: 15, pt: 1.5, bl: 'E' },
  { n: 'Conhecimentos de Informática', s: 'Informática', q: 15, pt: 1.5, bl: 'E' },
  { n: 'Língua Portuguesa', s: 'Português', q: 10, pt: 1.5, bl: 'B' },
  { n: 'Conhecimentos Bancários', s: 'Bancários', q: 10, pt: 1.5, bl: 'E' },
  { n: 'Matemática Financeira', s: 'Mat. Financeira', q: 5, pt: 1.5, bl: 'E' },
  { n: 'Matemática', s: 'Matemática', q: 5, pt: 1.5, bl: 'B' },
  { n: 'Língua Inglesa', s: 'Inglês', q: 5, pt: 1, bl: 'B' },
  { n: 'Atualidades do Mercado Financeiro', s: 'Atualidades', q: 5, pt: 1, bl: 'B' },
]
// Fora do edital do BB (2022/001): só treino, nunca entram no simulado nem na nota (por isso ficam fora de SUBJECTS).
// q = peso no sorteio, de propósito menor que o da menor matéria do edital (5); pt = 0 (não pontuam).
export const BB_EXTRA: Subject[] = [
  { n: 'Estatística', s: 'Estatística', q: 3, pt: 0, bl: 'E', ed: false },
  { n: 'Ética', s: 'Ética', q: 2, pt: 0, bl: 'E', ed: false },
  { n: 'Legislação', s: 'Legislação', q: 2, pt: 0, bl: 'E', ed: false },
  { n: 'Conhecimentos Digitais', s: 'Digitais', q: 2, pt: 0, bl: 'E', ed: false },
]
// As matérias e as provas que o app mostra são as do ESPAÇO ATIVO (core/espaco.ts). São "let" de propósito: trocar de espaço reatribui (store/espacos.ts) e quem
// importa vê o valor novo (ligação viva do módulo). Começam com as do Banco do Brasil, o espaço embutido.
export let SUBJECTS: Subject[] = BB_SUBJECTS
export let EXTRA_SUBJECTS: Subject[] = BB_EXTRA
export let ALL_SUBJECTS: Subject[] = [...SUBJECTS, ...EXTRA_SUBJECTS]
export let SUBJECT = Object.fromEntries(ALL_SUBJECTS.map((m) => [m.n, m])) as Record<string, Subject>

// Provas do banco (gerado por scripts/importar-banco.mjs): chave -> "Banco ano · prova".
export const BB_SOURCES: Record<string, string> = bank.sources
export let SOURCES: Record<string, string> = BB_SOURCES
export let SOURCE_KEYS = Object.keys(SOURCES)

/** Troca as matérias e as provas pelas de outro espaço. */
export function definirMaterias(materias: Subject[], extras: Subject[], fontes: Record<string, string>) {
  SUBJECTS = materias; EXTRA_SUBJECTS = extras; ALL_SUBJECTS = [...materias, ...extras]
  SUBJECT = Object.fromEntries(ALL_SUBJECTS.map((m) => [m.n, m])) as Record<string, Subject>
  SOURCES = fontes; SOURCE_KEYS = Object.keys(fontes)
}
/** Rótulo curto da prova para chips: "BB 2021", e "Banco da Amazônia 2021 (TI)" para as provas de TI. */
export const shortSource = (key: string) => {
  const [a, b = ''] = (SOURCES[key] ?? key).split(' · ')
  return b.endsWith('(TI)') ? `${a} (TI)` : a
}
