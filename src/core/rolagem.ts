// A "câmera" do chat do assistente (núcleo puro, em pixels da tela, de cima para baixo).
// Quando o teclado abre (ou a caixa de mensagem cresce com o texto), a caixa fica logo acima do teclado e pode cobrir o fim da conversa.
// Aqui se decide quanto rolar para o fim da conversa continuar à vista, como nos apps de mensagem.

export interface MedidasChat {
  /** Borda de baixo do último conteúdo da conversa (a última fala ou as sugestões abaixo dela). */
  fimDoConteudo: number
  /** Borda de cima da caixa de mensagem, já na posição nova. */
  topoDaCaixa: number
  /** Até onde a tela era visível ANTES da mudança (borda de baixo da área sem o teclado de antes). */
  baseVisivelAntes: number
  /** Respiro entre o fim do conteúdo e a caixa. */
  folga?: number
}

/**
 * Quantos pixels rolar para baixo para o fim da conversa não ficar embaixo da caixa. Só rola se a pessoa estava vendo o fim da conversa
 * (quem subiu para reler algo continua onde estava: a caixa sobe sozinha, presa acima do teclado). Nunca devolve negativo.
 */
export function quantoRolar({ fimDoConteudo, topoDaCaixa, baseVisivelAntes, folga = 8 }: MedidasChat): number {
  if (fimDoConteudo > baseVisivelAntes + 1) return 0 // o fim da conversa não estava à vista
  return Math.max(0, Math.ceil(fimDoConteudo + folga - topoDaCaixa))
}

/** Dentro da última sequência de falas do assistente, qual é a primeira? (índice) — é daí que a leitura da resposta começa. -1 se a última fala é da pessoa. */
export function inicioDaResposta(autores: readonly ('a' | 'v')[]): number {
  let i = autores.length
  while (i > 0 && autores[i - 1] === 'a') i--
  return i < autores.length ? i : -1
}
