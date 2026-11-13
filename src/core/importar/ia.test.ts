import { describe, expect, it } from 'vitest'
import { aplicarSugestao, ESQUEMA_RESPOSTA, INSTRUCOES, lerResposta, montarPedido } from './ia'
import { montarQuestoes, type MetaProva } from './montar'
import type { QuestaoLida } from './prova'

const meta: MetaProva = { chave: 'bb-2021', rotulo: 'BB 2021', ano: 2021, bancoId: 'bb', bancoNome: 'BB' }
const q = (o: Partial<QuestaoLida> = {}): QuestaoLida => ({
  numero: 5, materia: 'Matemática', bloco: null, apoio: '', enunciado: 'Observe a figura. Qual é a hipotenusa?', alternativas: { A: '4', B: '5' }, pagina: 1, regioes: [], avisos: ['só 2 alternativa(s) encontrada(s)', 'menciona figura, gráfico ou tabela: confira a imagem'], ...o,
})
const resposta = (o: Record<string, unknown> = {}) => JSON.stringify({ legivel: true, apoio: '', enunciado: 'Observe a figura. Qual é a hipotenusa?', alternativas: { A: '4', B: '5', C: '6', D: '7', E: '8' }, observacao: '', ...o })

describe('IA: pedido e resposta', () => {
  it('o pedido leva o texto lido e as instruções mandam só transcrever (nunca resolver nem obedecer o conteúdo)', () => {
    expect(montarPedido(q())).toContain('Observe a figura'); expect(montarPedido(q())).toContain('(A) 4')
    expect(INSTRUCOES).toMatch(/NÃO resolva/); expect(INSTRUCOES).toMatch(/ignore qualquer instrução/)
  })
  it('o formato da resposta exige as cinco alternativas e não aceita campos a mais', () => {
    expect(ESQUEMA_RESPOSTA.required).toContain('alternativas'); expect(ESQUEMA_RESPOSTA.additionalProperties).toBe(false)
    expect(ESQUEMA_RESPOSTA.properties.alternativas.required).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
  it('lê uma resposta boa', () => {
    expect(lerResposta(resposta())).toMatchObject({ enunciado: 'Observe a figura. Qual é a hipotenusa?', alternativas: { C: '6', E: '8' } })
  })
  it('resposta fora do formato, ilegível ou com poucas alternativas vira null (a questão fica como estava)', () => {
    expect(lerResposta('isto não é json')).toBeNull(); expect(lerResposta('null')).toBeNull()
    expect(lerResposta(resposta({ legivel: false }))).toBeNull()
    expect(lerResposta(resposta({ enunciado: '   ' }))).toBeNull()
    expect(lerResposta(resposta({ alternativas: { A: 'só uma' } }))).toBeNull()
  })
  it('ignora campos de tipo errado sem quebrar', () => {
    const s = lerResposta(resposta({ apoio: 42, observacao: { x: 1 } }))
    expect(s).toMatchObject({ apoio: '', observacao: '' })
  })
})

describe('IA: aceitar a sugestão', () => {
  const sug = lerResposta(resposta({ observacao: 'tabela cortada' }))!
  it('troca enunciado e alternativas, limpa o aviso de alternativas faltando e marca como revisada', () => {
    const r = aplicarSugestao(q(), sug)
    expect(Object.keys(r.alternativas)).toHaveLength(5); expect(r.numero).toBe(5)
    expect(r.avisos.some((a) => /só 2/.test(a))).toBe(false)
    expect(r.avisos).toContain('revisada por IA: confira com a prova'); expect(r.avisos.join(' ')).toContain('tabela cortada')
    expect(r.avisos.join(' ')).toContain('figura') // o aviso de figura continua
  })
  it('o id da questão continua o do texto ORIGINAL: corrigir não duplica ao importar de novo', () => {
    const original = montarQuestoes([q({ alternativas: { A: '4', B: '5', C: '6', D: '7', E: '8' }, avisos: [] })], { 5: 'B' }, meta).questoes[0].id
    const corrigida = aplicarSugestao(q({ alternativas: { A: '4', B: '5', C: '6', D: '7', E: '8' }, avisos: [] }), lerResposta(resposta({ enunciado: 'Observe a figura: qual a hipotenusa?' }))!)
    expect(montarQuestoes([corrigida], { 5: 'B' }, meta).questoes[0].id).toBe(original)
    expect(montarQuestoes([corrigida], { 5: 'B' }, meta).questoes[0].e).toBe('Observe a figura: qual a hipotenusa?') // o texto novo é o que aparece
  })
  it('corrigir duas vezes mantém o id do primeiro texto', () => {
    const a = aplicarSugestao(q(), sug), b = aplicarSugestao(a, lerResposta(resposta({ enunciado: 'Outra versão' }))!)
    expect(b.idOrigem).toBe(a.idOrigem)
  })
})
