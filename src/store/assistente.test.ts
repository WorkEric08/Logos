// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A conversa do assistente: o que ele responde ao que a pessoa escreve ou toca. (Os arquivos e o movimento têm os seus próprios testes: e2e-assistente*.mjs.)
type Loja = typeof import('./assistente')
let loja: Loja
beforeEach(async () => { await Dexie.delete('treino-bb'); vi.resetModules(); loja = await import('./assistente') })

const estado = () => loja.useAssistente.getState()
const fala = (i = -1) => estado().mensagens.at(i)!
const dela = () => estado().mensagens.filter((m) => m.de === 'a')

describe('assistente: conversa por escrito', () => {
  it('a primeira vez ele se apresenta (uma vez só)', () => {
    estado().iniciarConversa(); estado().iniciarConversa()
    expect(estado().mensagens).toHaveLength(1); expect(fala().de).toBe('a'); expect(fala().texto).toMatch(/assistente do Logos/)
  })
  it('mensagem vazia não faz nada', () => { estado().enviar('   '); expect(estado().mensagens).toEqual([]) })
  it('um pedido escrito vira a fala da pessoa e leva ao mesmo fluxo da sugestão', () => {
    estado().enviar('quero importar uma prova')
    expect(estado().mensagens[0]).toMatchObject({ de: 'v', texto: 'quero importar uma prova' })
    expect(estado().etapa).toBe('espaco-novo') // o espaço do BB não recebe arquivos: pede um espaço seu
    expect(estado().depois).toBe('prova'); expect(fala().texto).toMatch(/espaço seu/)
  })
  it('tocar na sugestão e escrever dão o mesmo resultado', () => {
    estado().escolher('cartoes'); const a = estado().etapa
    estado().voltarAoInicio(); estado().enviar('criar cartões')
    expect(estado().etapa).toBe(a); expect(a).toBe('cartoes-arquivo')
  })
  it('pedido que pode ser duas coisas: pergunta qual e guarda as duas opções', () => {
    estado().enviar('quero cartões da prova')
    expect(fala().texto).toMatch(/Quer .* ou .*\?/); expect(estado().desambiguar.sort()).toEqual(['cartoes', 'prova']); expect(estado().etapa).toBe('inicio')
    estado().escolher('prova'); expect(estado().desambiguar).toEqual([]) // escolher limpa a pergunta (o voltarAoInicio também)
  })
  it('o que não entende não inventa: convida a tentar e nada muda', () => {
    estado().enviar('qual a capital da França')
    expect(fala().texto).toMatch(/Não entendi/); expect(estado().etapa).toBe('inicio')
  })
  it('cumprimento, agradecimento, cancelar e ajuda têm resposta própria', () => {
    estado().enviar('bom dia'); expect(fala().texto).toMatch(/^Oi!/)
    estado().enviar('obrigado'); expect(fala().texto).toMatch(/De nada/)
    estado().enviar('cancelar'); expect(fala().texto).toMatch(/não há nada em andamento/)
    estado().enviar('o que você sabe fazer?'); expect(fala().texto).toMatch(/Importar uma prova em PDF/)
  })
  it('"o que eu já tenho?" responde com os números do espaço', () => {
    estado().enviar('o que eu já tenho?'); expect(fala().texto).toMatch(/1168 questões/)
  })
  it('limita o tamanho do que é escrito', () => {
    estado().enviar('importar prova ' + 'x'.repeat(500)); expect(estado().mensagens[0].texto.length).toBeLessThanOrEqual(200)
  })
  it('erros e sucessos têm tipo (o balão muda de cor e de movimento); conversa normal não tem', () => {
    estado().enviar('ajuda'); expect(dela().every((m) => m.tipo === undefined)).toBe(true)
  })
})

describe('assistente: o que a tela já mostrou', () => {
  it('a contagem de mensagens mostradas só sobe', () => {
    estado().marcarVistas(3); estado().marcarVistas(1); expect(estado().vistas).toBe(3); estado().marcarVistas(5); expect(estado().vistas).toBe(5)
  })
})
