import { describe, expect, it } from 'vitest'
import { inicioDaResposta, quantoRevelar, quantoRolar } from './rolagem'

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

describe('câmera: mostrar inteiro o que se abriu (quantoRevelar)', () => {
  const tela = { topoVisivel: 60, baseVisivel: 700 } // a área rolável vai de 60 a 700 (o pé ou o teclado cobre o resto)
  it('já cabe: não rola', () => {
    expect(quantoRevelar({ ...tela, topo: 300, base: 500 })).toBe(0)
    expect(quantoRevelar({ ...tela, topo: 100, base: 688 })).toBe(0) // dentro da folga de 12
  })
  it('passou da base (o caso do "Sim, excluir"): rola o que falta mais a folga', () => {
    expect(quantoRevelar({ ...tela, topo: 600, base: 820 })).toBe(132) // 820 + 12 − 700
    expect(quantoRevelar({ ...tela, topo: 640, base: 701 })).toBe(13)
  })
  it('ficou atrás do pé (a base visível já desconta os botões fixos)', () => {
    expect(quantoRevelar({ topoVisivel: 60, baseVisivel: 640, topo: 500, base: 650 })).toBe(22)
  })
  it('maior que a tela: mostra o COMEÇO dele (quem lê começa por cima)', () => {
    expect(quantoRevelar({ ...tela, topo: 400, base: 1400 })).toBe(328) // topo vai para 60 + 12
    expect(quantoRevelar({ ...tela, topo: 30, base: 1400 })).toBe(-42)
  })
  it('ficou acima do que se vê: volta o suficiente', () => {
    expect(quantoRevelar({ ...tela, topo: 20, base: 200 })).toBe(-52)
  })
  it('a folga é opcional', () => {
    expect(quantoRevelar({ ...tela, topo: 600, base: 720, folga: 0 })).toBe(20)
  })
})
