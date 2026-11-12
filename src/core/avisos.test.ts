import { describe, expect, it } from 'vitest'
import { AVISOS, todosOsAvisos } from './avisos'

// Aviso rápido = uma linha só. A medição de verdade (320 px, com o botão Desfazer) está em scripts/medir-avisos.mjs; aqui o tamanho
// em letras trava o que uma pessoa poderia escrever por engano numa mensagem nova.
describe('avisos rápidos', () => {
  it('todas as mensagens são curtas, sem quebra de linha e sem nome digitado pela pessoa', () => {
    for (const { texto, acao } of todosOsAvisos()) {
      expect(texto, texto).not.toMatch(/\n/)
      expect(texto.length, texto).toBeLessThanOrEqual(acao ? 30 : 38)
    }
  })
  it('a mensagem do banco atualizado concorda no singular e no plural', () => {
    expect(AVISOS.bancoAtualizado(0)).toBe('Banco atualizado; progresso mantido.')
    expect(AVISOS.bancoAtualizado(1)).toBe('Gabarito corrigido em 1 resposta.')
    expect(AVISOS.bancoAtualizado(12)).toBe('Gabarito corrigido em 12 respostas.')
  })
})
