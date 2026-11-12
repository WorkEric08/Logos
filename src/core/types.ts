export type Letter = 'A' | 'B' | 'C' | 'D' | 'E'
export interface Question {
  id: string; y: number; s: string; n: number
  m: string; t: string; a: string; e: string; b: string
  o: Record<Letter, string>; g: Letter
  p: number | null; bp: number | null; f: 0 | 1; ol: 0 | 1
  /** Banco Cesgranrio: nome do PNG da questão (em public/q/); a imagem é a fonte da verdade. */
  img?: string
  /** 1 = a imagem é uma página inteira da prova (várias questões); precisa de zoom no celular. */
  ig?: 1
  /** 1 = as alternativas em texto não são confiáveis: valem as letras A–E sobre a imagem. */
  ia?: 1
  /** 1 = questão de prova de TI reaproveitada porque o conteúdo serve ao Agente Comercial. */
  ti?: 1
  /** Avisos de extração do banco novo (ex.: texto pode ter perdido fórmulas). */
  rv?: string[]
  /** Prefixo das páginas da prova antiga (public/pages/p<ps>-NN.jpg), quando difere de s. */
  ps?: string
  /** 1 = veio do banco antigo e não tem par no novo; gabarito ainda não conferido. */
  ant?: 1
}
export interface Progress { n: number; c: number; ok: boolean | null; last?: Letter; t?: number }
export type ProgressMap = Record<string, Progress>
export interface Subject { n: string; s: string; q: number; pt: number; bl: 'B' | 'E'; ed?: false }
