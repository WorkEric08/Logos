// Movimento entre as telas do app (o mesmo vocabulário dos Cards): entrar mais fundo desliza pela direita ("avanca"), voltar desliza pela
// esquerda ("recua") e trocar de aba só aparece com um leve subir ("troca"). Aqui fica só a decisão (sem DOM); a animação é CSS (styles.css, ".fc-tela").

export type Sentido = 'avanca' | 'recua' | 'troca'

/** A "camada" em que o app está: uma aba, a questão (treino/simulado, ou a revisão de uma questão do resultado) ou o resultado. */
export type Camada =
  | { tipo: 'aba'; id: string }
  | { tipo: 'questao'; revisao: boolean; id: 'questao' }
  | { tipo: 'resultado'; id: 'resultado' }

export const camadaDaAba = (aba: string, reinicio: number): Camada => ({ tipo: 'aba', id: `aba-${aba}-${reinicio}` })
export const camadaDaQuestao = (revisao: boolean): Camada => ({ tipo: 'questao', revisao, id: 'questao' })
export const CAMADA_RESULTADO: Camada = { tipo: 'resultado', id: 'resultado' }

/**
 * Como a tela nova entra, vista de quem sai de `de` para `para`. Devolve null quando não há o que animar (mesma camada, ou 1ª pintura).
 * - aba → aba: "troca"; aba → questão ou resultado: "avanca"; questão ou resultado → aba: "recua";
 * - questão → resultado: "avanca" (entregar/ver resultado) mas "recua" se era a revisão de uma questão do resultado ("Voltar ao resultado");
 * - resultado → questão: "avanca" (abrir a revisão de uma questão).
 */
export function sentidoDaTroca(de: Camada | null, para: Camada): Sentido | null {
  if (!de || de.id === para.id) return null
  if (de.tipo === 'aba') return para.tipo === 'aba' ? 'troca' : 'avanca'
  if (para.tipo === 'aba') return 'recua'
  if (de.tipo === 'questao' && para.tipo === 'resultado') return de.revisao ? 'recua' : 'avanca'
  return 'avanca'
}

/** Entre as questões de uma sessão: a seguinte entra pela direita, a anterior pela esquerda. */
export const sentidoDaQuestao = (de: number, para: number): 'avanca' | 'recua' | null => (para === de ? null : para > de ? 'avanca' : 'recua')

/** Entre os níveis banco → cargo → provas do Início: descer entra pela direita, subir pela esquerda. */
export const sentidoDoNivel = (de: number, para: number): 'avanca' | 'recua' | null => sentidoDaQuestao(de, para)
