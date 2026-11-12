import { describe, expect, it } from 'vitest'
import { CAMADA_RESULTADO, camadaDaAba, camadaDaQuestao, sentidoDaQuestao, sentidoDaTroca, sentidoDoNivel } from './movimento'

describe('movimento entre telas', () => {
  const inicio = camadaDaAba('inicio', 0), treinar = camadaDaAba('treinar', 0)
  it('1ª pintura e mesma camada não animam', () => {
    expect(sentidoDaTroca(null, inicio)).toBeNull()
    expect(sentidoDaTroca(inicio, camadaDaAba('inicio', 0))).toBeNull()
    expect(sentidoDaTroca(camadaDaQuestao(false), camadaDaQuestao(false))).toBeNull()
  })
  it('trocar de aba (e tocar de novo no ícone da mesma aba) só faz a tela subir de leve', () => {
    expect(sentidoDaTroca(inicio, treinar)).toBe('troca')
    expect(sentidoDaTroca(inicio, camadaDaAba('inicio', 1))).toBe('troca') // o ícone do Início recomeça a tela
  })
  it('entrar na questão desliza pela direita; sair dela volta pela esquerda', () => {
    expect(sentidoDaTroca(treinar, camadaDaQuestao(false))).toBe('avanca')
    expect(sentidoDaTroca(camadaDaQuestao(false), inicio)).toBe('recua')
    expect(sentidoDaTroca(CAMADA_RESULTADO, inicio)).toBe('recua')
  })
  it('entregar a prova avança; ver uma questão do resultado avança; "Voltar ao resultado" recua', () => {
    expect(sentidoDaTroca(camadaDaQuestao(false), CAMADA_RESULTADO)).toBe('avanca')
    expect(sentidoDaTroca(CAMADA_RESULTADO, camadaDaQuestao(true))).toBe('avanca')
    expect(sentidoDaTroca(camadaDaQuestao(true), CAMADA_RESULTADO)).toBe('recua')
  })
  it('questão seguinte entra pela direita, anterior pela esquerda, a mesma não anima', () => {
    expect(sentidoDaQuestao(3, 4)).toBe('avanca')
    expect(sentidoDaQuestao(3, 2)).toBe('recua')
    expect(sentidoDaQuestao(3, 3)).toBeNull()
    expect(sentidoDaQuestao(0, 69)).toBe('avanca') // pular direto pelo cartão-resposta
  })
  it('níveis banco → cargo → provas', () => {
    expect(sentidoDoNivel(0, 1)).toBe('avanca')
    expect(sentidoDoNivel(2, 0)).toBe('recua') // trilha "Bancos" volta dois níveis de uma vez
    expect(sentidoDoNivel(1, 1)).toBeNull()
  })
})
