// Mensagens do aviso rápido (o retângulo escuro que aparece na parte de baixo da tela). Regra do app: cada uma cabe numa LINHA SÓ,
// também a 320 px de largura; por isso são curtas e nenhuma leva nome digitado pela pessoa. `scripts/medir-avisos.mjs` mede todas
// (no pior caso de números) dentro do aviso de verdade; `avisos.test.ts` trava o tamanho.
const s = (n: number, um: string, varios: string) => (n === 1 ? um : varios)

export const AVISOS = {
  semQuestoes: 'Nenhuma questão nesses filtros.',
  bancoAtualizado: (corrigidas: number) => (corrigidas > 0 ? `Gabarito corrigido em ${corrigidas} ${s(corrigidas, 'resposta', 'respostas')}.` : 'Banco atualizado; progresso mantido.'),
  bancoFalhou: 'Não consegui atualizar o banco.',
  progressoRestaurado: 'Progresso restaurado.',
  progressoZerado: 'Progresso zerado.',
  voltarParaSair: 'Toque em voltar de novo para sair',
  flashcardCriado: 'Flashcard criado em “Das questões”.',
  flashcardExiste: 'Esta questão já tem um flashcard.',
  cardsNaoAbriu: 'Não consegui abrir os flashcards.',
  baralhoSemNome: 'Dê um nome ao baralho.',
  baralhoRepetido: 'Já existe baralho com esse nome.',
  baralhoExcluido: 'Baralho excluído.',
  cartaoIncompleto: 'Preencha a frente e o verso.',
  cartaoExcluido: 'Cartão excluído.',
} as const

/** Todas as mensagens no pior caso (números grandes), com o que vai ao lado (o botão "Desfazer", quando há). */
export function todosOsAvisos(): { texto: string; acao?: string }[] {
  const A = AVISOS
  return [
    { texto: A.semQuestoes }, { texto: A.bancoAtualizado(0) }, { texto: A.bancoAtualizado(99) }, { texto: A.bancoAtualizado(1) }, { texto: A.bancoFalhou },
    { texto: A.progressoRestaurado, acao: 'Desfazer' }, { texto: A.progressoZerado, acao: 'Desfazer' }, { texto: A.voltarParaSair },
    { texto: A.flashcardCriado }, { texto: A.flashcardExiste }, { texto: A.cardsNaoAbriu }, { texto: A.baralhoSemNome }, { texto: A.baralhoRepetido },
    { texto: A.baralhoExcluido, acao: 'Desfazer' }, { texto: A.cartaoIncompleto }, { texto: A.cartaoExcluido, acao: 'Desfazer' },
  ]
}
