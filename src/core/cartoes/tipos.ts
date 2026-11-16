// Tipos dos cartões sugeridos a partir de um texto de estudo (F3). Puro.
export type TipoCartao = 'definicao' | 'pergunta' | 'titulo' | 'verbo' | 'lacuna' | 'sintaxe' | 'sigla' | 'lista' | 'numero'

/** `aviso`: o cartão entra, mas a pessoa vê o porquê de olhar com atenção (verso longo, frente longa). */
export interface CartaoSugerido { f: string; v: string; tipo: TipoCartao; origem: string; aviso?: string }

/** Um cartão que as regras de qualidade barraram (aparece na contagem e fica disponível para conferir). */
export interface Descartado { f: string; motivo: string }

export interface Sugestoes { cartoes: CartaoSugerido[]; paragrafos: number; sobraram: number; descartados: Descartado[] }

export const ROTULO_TIPO_CARTAO: Record<TipoCartao, string> = {
  definicao: 'Definição', pergunta: 'Pergunta', titulo: 'Título', verbo: 'Conceito', lacuna: 'Lacuna', sintaxe: 'Sua marcação', sigla: 'Sigla', lista: 'Lista', numero: 'Número',
}
