import { describe, expect, it } from 'vitest'
import type { Plano } from './dia'
import { lerPlanoAtivo, novoPlanoAtivo, planoVigente, prorrogar, statusDoPlano, textoDoStatus, type MedidasDoPlano, type PlanoAtivo } from './plano'

const plano = (cartoes: number, questoes: string[], minutos = 60): Plano => ({
  minutos, cartoes, minutosCartoes: cartoes / 2, questoes: { ids: questoes, partes: { erros: 0, fracas: 0, novas: questoes.length, outras: 0 }, materiasFracas: [] }, minutosQuestoes: questoes.length * 2, folga: 0,
} as unknown as Plano)
const ids = (n: number) => Array.from({ length: n }, (_, i) => 'q' + i)
const ativo = (c = 10, q = 12, base = 0): PlanoAtivo => novoPlanoAtivo(plano(c, ids(q)), '2026-11-17', 1000, base)
const med = (m: Partial<MedidasDoPlano> = {}): MedidasDoPlano => ({ cartoesHoje: 0, cartoesVencidos: 25, respondidas: new Set(), ...m })

describe('andamento do plano: cartões primeiro, depois as questões', () => {
  it('recém-montado: tudo falta e a fase é a dos cartões', () => {
    const s = statusDoPlano(ativo(), med())
    expect(s).toMatchObject({ fase: 'cartoes', cartoesTotal: 10, cartoesFeitos: 0, cartoesFaltam: 10, questoesTotal: 12, questoesFeitas: 0 })
    expect(s.questoesFaltam).toEqual(ids(12))
    expect(textoDoStatus(ativo(), s)).toBe('Seu plano de hoje: 10 cartões e depois 12 questões. Comece pelos cartões.')
  })
  it('saiu no cartão 7 de 10: faltam 3 (o que a pessoa fez antes do plano não conta)', () => {
    const p = ativo(10, 12, 4) // já tinha estudado 4 cartões hoje antes de pedir o plano
    const s = statusDoPlano(p, med({ cartoesHoje: 4 + 7 }))
    expect(s).toMatchObject({ fase: 'cartoes', cartoesFeitos: 7, cartoesFaltam: 3 })
    expect(textoDoStatus(p, s)).toBe('Faltam 3 de 10 cartões do seu plano (você já fez 7). Depois, 12 questões.')
  })
  it('estudar cartões ANTES de montar o plano não adianta o plano', () => {
    expect(statusDoPlano(ativo(10, 12, 30), med({ cartoesHoje: 30 })).cartoesFaltam).toBe(10)
  })
  it('terminou os cartões: a fase passa a ser a das questões (a posição em destaque muda)', () => {
    const p = ativo()
    const s = statusDoPlano(p, med({ cartoesHoje: 10 }))
    expect(s).toMatchObject({ fase: 'questoes', cartoesFaltam: 0, cartoesFeitos: 10, questoesFeitas: 0 })
    expect(textoDoStatus(p, s)).toBe('Cartões do plano concluídos! Agora as questões: 12 questões.')
  })
  it('questões respondidas pelo caminho que for contam; as que faltam são só as não respondidas', () => {
    const p = ativo()
    const s = statusDoPlano(p, med({ cartoesHoje: 10, respondidas: new Set(['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'fora-do-plano']) }))
    expect(s).toMatchObject({ fase: 'questoes', questoesFeitas: 7 }); expect(s.questoesFaltam).toEqual(['q7', 'q8', 'q9', 'q10', 'q11'])
    expect(textoDoStatus(p, s)).toBe('Cartões do plano concluídos! Agora as questões: faltam 5 de 12 questões.')
  })
  it('tudo feito: plano concluído', () => {
    const p = ativo()
    const s = statusDoPlano(p, med({ cartoesHoje: 10, respondidas: new Set(ids(12)) }))
    expect(s).toMatchObject({ fase: 'fim', questoesFaltam: [] })
    expect(textoDoStatus(p, s)).toBe('Plano de 60 minutos concluído: 10 cartões e 12 questões. Bom trabalho! Quer montar outro?')
  })
  it('a pessoa fez as questões antes dos cartões: os cartões continuam sendo o que vem agora', () => {
    const s = statusDoPlano(ativo(), med({ respondidas: new Set(ids(12)) }))
    expect(s).toMatchObject({ fase: 'cartoes', cartoesFaltam: 10, questoesFeitas: 12 })
  })
  it('nada mais vence (a fila acabou, p.ex. cartões que voltaram a esperar): o que falta de cartão some, sem inventar', () => {
    const s = statusDoPlano(ativo(), med({ cartoesHoje: 6, cartoesVencidos: 0 }))
    expect(s).toMatchObject({ cartoesFeitos: 6, cartoesFaltam: 0, fase: 'questoes' })
    expect(statusDoPlano(ativo(), med({ cartoesHoje: 6, cartoesVencidos: 2 })).cartoesFaltam).toBe(2) // faltariam 4, mas só 2 vencem
  })
  it('plano só de questões ou só de cartões', () => {
    const soQuestoes = novoPlanoAtivo(plano(0, ids(3)), '2026-11-17', 1, 0)
    expect(statusDoPlano(soQuestoes, med()).fase).toBe('questoes')
    expect(textoDoStatus(soQuestoes, statusDoPlano(soQuestoes, med()))).toBe('Agora as questões do seu plano: 3 questões.')
    const soCartoes = novoPlanoAtivo(plano(2, []), '2026-11-17', 1, 0)
    expect(textoDoStatus(soCartoes, statusDoPlano(soCartoes, med()))).toBe('Seu plano de hoje: 2 cartões. Comece pelos cartões.')
    expect(statusDoPlano(soCartoes, med({ cartoesHoje: 2 })).fase).toBe('fim')
    expect(textoDoStatus(soCartoes, statusDoPlano(soCartoes, med({ cartoesHoje: 2 })))).toMatch(/concluído: 2 cartões\./)
  })
  it('singular e plural', () => {
    const p = ativo(1, 1)
    expect(textoDoStatus(p, statusDoPlano(p, med()))).toBe('Seu plano de hoje: 1 cartão e depois 1 questão. Comece pelos cartões.')
  })
})

describe('plano guardado', () => {
  it('lê o que veio do banco e recusa o que não é plano', () => {
    const p = { ...ativo(), ultimoTexto: 'x' }
    expect(lerPlanoAtivo(JSON.parse(JSON.stringify(p)))).toEqual(p)
    expect(lerPlanoAtivo(null)).toBeNull(); expect(lerPlanoAtivo('lixo')).toBeNull(); expect(lerPlanoAtivo({ dia: 'ontem' })).toBeNull()
    expect(lerPlanoAtivo({ dia: '2026-11-17', cartoes: -3, questoes: ['a', 7, 'b'] })).toMatchObject({ cartoes: 0, questoes: ['a', 'b'], baseCartoes: 0 })
  })
})

describe('prazo do treino do plano', () => {
  const MIN = 60_000
  it('o prazo é o tempo que a pessoa disse ter, a partir de quando montou o plano', () => {
    const p = novoPlanoAtivo(plano(4, ids(5), 90), '2026-11-17', 1_000_000, 0)
    expect(p.validoAte).toBe(1_000_000 + 90 * MIN)
  })
  it('vale só no dia e dentro do prazo; lá dentro do treino não há prazo', () => {
    const p = novoPlanoAtivo(plano(0, ids(5), 60), '2026-11-17', 0, 0)
    expect(planoVigente(p, 59 * MIN, '2026-11-17', false)).toBe(true)
    expect(planoVigente(p, 60 * MIN, '2026-11-17', false)).toBe(true) // no último minuto ainda vale
    expect(planoVigente(p, 60 * MIN + 1, '2026-11-17', false)).toBe(false)
    expect(planoVigente(p, 5 * 3_600_000, '2026-11-17', true)).toBe(true) // dentro do treino: o tempo que precisar
    expect(planoVigente(p, 10 * MIN, '2026-11-18', false)).toBe(false) // outro dia: não vale
    expect(planoVigente(p, 10 * MIN, '2026-11-18', true)).toBe(false)
  })
  it('saiu antes do prazo: o prazo não muda; saiu depois: fica salvo pelo tempo das questões que faltam (2 min cada)', () => {
    const p = novoPlanoAtivo(plano(0, ids(5), 60), '2026-11-17', 0, 0)
    expect(prorrogar(p, 30 * MIN, 20)).toBe(p)
    expect(prorrogar(p, 60 * MIN, 20)).toBe(p) // exatamente no prazo ainda é "dentro"
    expect(prorrogar(p, 100 * MIN, 20).validoAte).toBe(100 * MIN + 40 * MIN)
    expect(prorrogar(p, 100 * MIN, 0).validoAte).toBe(100 * MIN)
  })
  it('um plano guardado antes de existir o prazo ganha um (o tempo dele a partir da criação)', () => {
    expect(lerPlanoAtivo({ dia: '2026-11-17', criado: 5000, minutos: 30 })!.validoAte).toBe(5000 + 30 * MIN)
    expect(lerPlanoAtivo({ dia: '2026-11-17', criado: 5000, minutos: 30, validoAte: 123 })!.validoAte).toBe(123)
  })
})
