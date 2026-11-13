import { describe, expect, it } from 'vitest'
import { entender, semAcento, type Intencao } from './conversa'

const acao = (t: string) => { const i = entender(t); return i.tipo === 'acao' ? i.id : i.tipo }

describe('entender o que a pessoa digitou', () => {
  it('tira acento, maiúscula e pontuação', () => { expect(semAcento('  Importar PROVA, por favor!! ')).toBe('importar prova por favor') })

  it.each([
    ['importar prova', 'prova'], ['quero importar uma prova em pdf', 'prova'], ['adicionar o gabarito', 'prova'], ['Importar PDF da prova da Caixa', 'prova'], ['subir prova', 'prova'],
    ['criar cartões', 'cartoes'], ['quero fazer flashcards do meu resumo', 'cartoes'], ['transformar apostila em cartão', 'cartoes'], ['cartoes', 'cartoes'],
    ['montar um simulado', 'simulado'], ['quero um simulado', 'simulado'], ['simulado de matemática', 'simulado'],
    ['meus espaços', 'espaco'], ['trocar de espaço', 'espaco'], ['criar um novo espaço', 'espaco'], ['espacos', 'espaco'],
    ['o que eu já tenho?', 'resumo'], ['quantas questões tenho', 'resumo'], ['status', 'resumo'],
    ['ligar a IA', 'ia'], ['colocar a minha chave', 'ia'], ['usar o claude', 'ia'],
  ])('"%s" → %s', (texto, esperado) => { expect(acao(texto)).toBe(esperado) })

  it.each([['ajuda', 'ajuda'], ['o que você sabe fazer?', 'ajuda'], ['como funciona', 'ajuda'], ['menu', 'ajuda'], ['comandos', 'ajuda'], ['cancelar', 'cancelar'], ['voltar', 'cancelar'], ['deixa pra lá', 'cancelar'], ['oi', 'oi'], ['bom dia', 'oi'], ['olá!', 'oi'], ['obrigado', 'obrigado'], ['valeu', 'obrigado']])('"%s" → %s', (texto, esperado) => {
    expect(entender(texto).tipo).toBe(esperado)
  })

  it('aceita um erro de digitação de uma letra', () => {
    expect(acao('importr prova')).toBe('prova'); expect(acao('criar cartaos')).toBe('cartoes'); expect(acao('smulaa')).toBe('nao-entendi') // dois erros: não adivinha
    expect(acao('simulado')).toBe('simulado'); expect(acao('flashcrds')).toBe('cartoes')
  })

  it('quando duas ações empatam, pergunta qual (e devolve as duas)', () => {
    const i = entender('quero cartões da prova') as Intencao
    expect(i.tipo).toBe('ambigua')
    if (i.tipo === 'ambigua') expect([...i.opcoes].sort()).toEqual(['cartoes', 'prova'])
  })

  it('o que não faz sentido não vira ação', () => {
    expect(entender('xyz qwerty').tipo).toBe('nao-entendi'); expect(entender('qual a capital da França').tipo).toBe('nao-entendi')
    expect(entender('   ').tipo).toBe('vazio'); expect(entender('').tipo).toBe('vazio')
  })

  it('"simulado" ganha de "prova" (prova simulada é simulado)', () => { expect(acao('fazer uma prova simulada')).toBe('simulado') })
})
