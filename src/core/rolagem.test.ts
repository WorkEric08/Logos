import { describe, expect, it } from 'vitest'
import { inicioDaResposta, quantoRolar } from './rolagem'

describe('rolagem do chat quando o teclado abre', () => {
  it('rola o que falta para o fim da conversa ficar acima da caixa (com folga)', () => {
    // o fim da conversa estava à vista (base 700) e a caixa subiu para 500: faltam 200 + folga de 8
    expect(quantoRolar({ fimDoConteudo: 650, topoDaCaixa: 500, baseVisivelAntes: 700 })).toBe(158)
  })
  it('conversa curta (fim bem acima da caixa): não rola, o conteúdo fica onde está', () => {
    expect(quantoRolar({ fimDoConteudo: 200, topoDaCaixa: 500, baseVisivelAntes: 800 })).toBe(0)
  })
  it('quem subiu para reler (fim fora da tela): não rola, a caixa sobe sozinha', () => {
    expect(quantoRolar({ fimDoConteudo: 1500, topoDaCaixa: 500, baseVisivelAntes: 800 })).toBe(0)
  })
  it('o fim exatamente na borda da tela ainda conta como à vista (tolerância de 1 px)', () => {
    expect(quantoRolar({ fimDoConteudo: 801, topoDaCaixa: 600, baseVisivelAntes: 800 })).toBe(209)
    expect(quantoRolar({ fimDoConteudo: 803, topoDaCaixa: 600, baseVisivelAntes: 800 })).toBe(0)
  })
  it('a folga pode ser mudada e nunca devolve negativo', () => {
    expect(quantoRolar({ fimDoConteudo: 490, topoDaCaixa: 500, baseVisivelAntes: 800, folga: 0 })).toBe(0)
    expect(quantoRolar({ fimDoConteudo: 500, topoDaCaixa: 500, baseVisivelAntes: 800, folga: 20 })).toBe(20)
  })
})

describe('onde começa a resposta do assistente', () => {
  it('é a primeira fala da última sequência do assistente', () => {
    expect(inicioDaResposta(['a', 'v', 'a'])).toBe(2)
    expect(inicioDaResposta(['a', 'v', 'a', 'a', 'a'])).toBe(2)
    expect(inicioDaResposta(['a'])).toBe(0)
    expect(inicioDaResposta(['a', 'a'])).toBe(0)
  })
  it('se a última fala é da pessoa, a resposta ainda não chegou (-1)', () => {
    expect(inicioDaResposta(['a', 'v'])).toBe(-1)
    expect(inicioDaResposta(['v'])).toBe(-1)
    expect(inicioDaResposta([])).toBe(-1)
  })
})
