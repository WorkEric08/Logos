// Largura do painel da direita na tela da questão (só em tela larga, >= 1180 px), que a pessoa alarga arrastando a borda esquerda.
// Contas puras; guardar e aplicar fica em services/painel.ts. O limite vale também no CSS (.slot:has(.pgside), styles.css): mantenha os dois iguais.

/** Menor largura do painel: abaixo disso a página da prova fica pequena demais para ler. */
export const PAINEL_MIN = 320
/** Espaço que sempre sobra para a questão: trilho de navegação (96 px) + 460 px de enunciado e alternativas. */
export const PAINEL_RESERVA = 556

/** Maior largura possível numa janela de `janela` px (nunca menor que o mínimo). */
export const painelMax = (janela: number) => Math.max(PAINEL_MIN, janela - PAINEL_RESERVA)

/** Largura pedida, presa entre o mínimo e o que deixa a questão com espaço. */
export function limitarLargura(pedida: number, janela: number): number {
  if (!Number.isFinite(pedida)) return PAINEL_MIN
  return Math.round(Math.min(painelMax(janela), Math.max(PAINEL_MIN, pedida)))
}

/** Lê o valor guardado: só aceita número finito e positivo (qualquer outra coisa volta ao padrão). */
export function larguraGuardada(texto: string | null): number | null {
  if (texto == null || !/^\d{2,4}$/.test(texto.trim())) return null
  const n = Number(texto)
  return n >= PAINEL_MIN ? n : null
}
