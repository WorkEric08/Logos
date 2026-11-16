import { describe, expect, it } from 'vitest'
import type { Caderno } from './caderno'
import { AJUSTES_PADRAO, criarCartao, type Cartao } from './cards'
import { acharMinutos, META_DIA, MIN_POR_CARTAO, MIN_POR_QUESTAO, montarPainel, montarPlano, sequenciaJunta, saudacao, textoDoPainel, textoDoPlano, type EntradaPainel } from './dia'
import { diaDe, HIST_VAZIO, type Hist } from './historico'
import type { ProgressMap, Question } from './types'
import { rngDe } from './questoes/distratores'

const agora = new Date(2026, 10, 16, 10, 0).getTime() // segunda, 10h
const dia = (k: number) => diaDe(new Date(2026, 10, 16 - k, 12))
const hist = (dias: Record<number, [number, number]>): Hist => ({ sims: [], dias: Object.fromEntries(Object.entries(dias).map(([k, [n, c]]) => [dia(Number(k)), { n, c }])) })
const q = (id: string, m: string): Question => ({ id, m, t: 't', y: 2021, s: 'bb-2021', n: 1, a: '', e: '', b: '', o: { A: '', B: '', C: '', D: '', E: '' }, g: 'A', p: null, bp: null, f: 0, ol: 0 })
const bank = [...Array.from({ length: 30 }, (_, i) => q('m' + i, 'Matemática')), ...Array.from({ length: 30 }, (_, i) => q('p' + i, 'Português'))]
const vencido = (id: string): Cartao => ({ ...criarCartao({ b: 'b', f: 'f' + id, v: 'v' }, agora - 9e8, id), estado: 'revisao', due: agora - 1000, ivl: 3, reps: 2 })
const entrada = (extra: Partial<EntradaPainel> = {}): EntradaPainel => ({ agora, cartoes: [], ajustes: AJUSTES_PADRAO, histQuestoes: HIST_VAZIO, histCartoes: HIST_VAZIO, prog: {}, bank, caderno: {}, ...extra })
const erros = (n: number): Caderno => Object.fromEntries(Array.from({ length: n }, (_, i) => ['m' + i, { id: 'm' + i, erros: 1, seguidos: 0, ultimoErro: 1 }]))
/** Progresso em que Matemática é a matéria fraca (30 % de acerto) e Português a forte (90 %). */
const progFraca = (): ProgressMap => { const p: ProgressMap = {}; for (let i = 0; i < 10; i++) { p['m' + i] = { n: 2, c: i < 3 ? 2 : 0, ok: true }; p['p' + i] = { n: 2, c: i < 9 ? 2 : 0, ok: true } } return p }

describe('sequência de dias (questões ou cartões)', () => {
  it('conta dias seguidos com qualquer estudo; sem estudo hoje, a de ontem continua', () => {
    expect(sequenciaJunta(hist({ 0: [3, 2], 1: [5, 4], 2: [1, 1] }), HIST_VAZIO, agora)).toBe(3)
    expect(sequenciaJunta(hist({ 1: [5, 4], 2: [1, 1] }), HIST_VAZIO, agora)).toBe(2)
    expect(sequenciaJunta(hist({ 0: [3, 2], 2: [1, 1] }), HIST_VAZIO, agora)).toBe(1) // furou ontem
    expect(sequenciaJunta(HIST_VAZIO, HIST_VAZIO, agora)).toBe(0)
  })
  it('um dia só com cartões também vale', () => {
    expect(sequenciaJunta(hist({ 0: [3, 2], 2: [1, 1] }), hist({ 1: [10, 8] }), agora)).toBe(3)
  })
})

describe('painel do dia', () => {
  it('sem nada: sugere questões novas e oferece o simulado da semana; sequência zero', () => {
    const p = montarPainel(entrada())
    expect(p).toMatchObject({ respondidasHoje: 0, sequencia: 0, cartoesParaEstudar: 0, erros: 0, fraca: null, novas: 60, semQuestoes: false })
    expect(p.sugestao).toMatchObject({ id: 'novas', n: 10 }); expect(p.alternativas.map((a) => a.id)).toEqual(['semana'])
  })
  it('a ordem de prioridade: cartões vencidos > caderno de erros > matéria fraca > questões novas', () => {
    const base = entrada({ prog: progFraca(), caderno: erros(7), cartoes: [vencido('c1'), vencido('c2')] })
    expect(montarPainel(base).sugestao).toMatchObject({ id: 'cartoes', n: 2 })
    expect(montarPainel(base).alternativas.map((a) => a.id)).toEqual(['erros', 'fraca'])
    expect(montarPainel({ ...base, cartoes: [] }).sugestao).toMatchObject({ id: 'erros', n: 7 })
    expect(montarPainel({ ...base, cartoes: [], caderno: {} }).sugestao).toMatchObject({ id: 'fraca', materia: 'Matemática' })
  })
  it('cartões novos contam só até o limite diário; o caderno grande sugere no máximo 20', () => {
    const novos = Array.from({ length: 30 }, (_, i) => criarCartao({ b: 'b', f: 'f' + i, v: 'v' }, agora - 1000 - i, 'n' + i))
    expect(montarPainel(entrada({ cartoes: novos })).cartoesParaEstudar).toBe(10) // limite padrão de 10 novos por dia
    expect(montarPainel(entrada({ caderno: erros(30) })).sugestao.n).toBe(20)
  })
  it('hoje: respondidas, acertos, cartões e meta', () => {
    const p = montarPainel(entrada({ histQuestoes: hist({ 0: [12, 9], 1: [4, 3] }), histCartoes: hist({ 0: [8, 6] }) }))
    expect(p).toMatchObject({ respondidasHoje: 12, acertosHoje: 9, cartoesHoje: 8, sequencia: 2, metaDia: META_DIA })
  })
  it('espaço sem questões e sem cartões sugere importar', () => {
    const p = montarPainel(entrada({ bank: [] }))
    expect(p.sugestao.id).toBe('importar'); expect(p.semQuestoes).toBe(true); expect(p.alternativas).toEqual([])
  })
  it('matéria fraca só com respostas suficientes; tudo novo não tem matéria fraca', () => {
    expect(montarPainel(entrada()).fraca).toBeNull()
    expect(montarPainel(entrada({ prog: progFraca() })).fraca).toMatchObject({ materia: 'Matemática' })
  })
})

describe('o texto do painel', () => {
  it('saudação pela hora', () => {
    expect(saudacao(new Date(2026, 10, 16, 3).getTime())).toBe('Boa madrugada'); expect(saudacao(new Date(2026, 10, 16, 9).getTime())).toBe('Bom dia')
    expect(saudacao(new Date(2026, 10, 16, 15).getTime())).toBe('Boa tarde'); expect(saudacao(new Date(2026, 10, 16, 21).getTime())).toBe('Boa noite')
  })
  it('dia ainda sem estudo, com sequência para manter', () => {
    const t = textoDoPainel(montarPainel(entrada({ histQuestoes: hist({ 1: [5, 4], 2: [3, 3] }) })), agora)
    expect(t).toMatch(/^Bom dia! Aqui está o seu dia:/); expect(t).toMatch(/Hoje ainda não estudou \(sua sequência é de 2 dias: estude hoje para mantê-la\)/); expect(t).toMatch(/Sugiro começar por: questões novas \(10\) — ainda não apareceram/)
  })
  it('dia com estudo: números, acerto, esperando e matéria fraca; meta batida muda o convite', () => {
    const p = montarPainel(entrada({ prog: progFraca(), caderno: erros(7), cartoes: [vencido('c1')], histQuestoes: hist({ 0: [12, 9] }), histCartoes: hist({ 0: [3, 2] }) }))
    const t = textoDoPainel(p, agora)
    expect(t).toMatch(/Hoje: 12 de 20 questões \(75 % de acerto\) e 3 cartões/); expect(t).toMatch(/Esperando por você: 1 cartão para estudar e 7 questões no caderno de erros/)
    expect(t).toMatch(/Onde mais precisa de treino: Matemática \(30 % de acerto\)/); expect(t).toMatch(/Sugiro começar por: estudar cartões \(1\)/)
    expect(textoDoPainel(montarPainel(entrada({ histQuestoes: hist({ 0: [25, 20] }) })), agora)).toMatch(/Meta do dia batida!/)
  })
})

describe('plano de estudo por tempo', () => {
  const tf = {}
  const rng = () => rngDe('plano')
  it('divide o tempo: até 40 % em cartões (30 s cada) e o resto em questões (2 min cada) na mistura erros/fracas/novas', () => {
    const cartoes = Array.from({ length: 60 }, (_, i) => vencido('c' + i))
    const pl = montarPlano(entrada({ prog: progFraca(), caderno: erros(8), cartoes }), 30, tf, rng())
    expect(pl.cartoes).toBe(24) // 40 % de 30 min = 12 min = 24 cartões
    expect(pl.minutosCartoes).toBe(24 * MIN_POR_CARTAO)
    expect(pl.questoes.ids).toHaveLength(9) // (30 - 12) / 2
    expect(pl.minutosQuestoes).toBe(9 * MIN_POR_QUESTAO)
    expect(pl.questoes.partes.erros).toBe(4) // 40 % de 9, arredondado
    expect(pl.folga).toBeLessThanOrEqual(1)
  })
  it('poucos cartões: o tempo que sobra vai para as questões', () => {
    const pl = montarPlano(entrada({ cartoes: [vencido('a'), vencido('b')] }), 20, tf, rng())
    expect(pl.cartoes).toBe(2); expect(pl.questoes.ids).toHaveLength(Math.floor((20 - 1) / 2))
  })
  it('sem cartões e sem erros: só questões novas; pelo menos uma questão; limites de 5 a 240 min', () => {
    expect(montarPlano(entrada(), 5, tf, rng()).questoes.ids.length).toBeGreaterThanOrEqual(1)
    expect(montarPlano(entrada(), 1, tf, rng()).minutos).toBe(5)
    expect(montarPlano(entrada(), 9999, tf, rng()).minutos).toBe(240)
    expect(montarPlano(entrada(), 30, tf, rng()).questoes.partes).toMatchObject({ erros: 0, novas: 15 })
  })
  it('é repetível (mesma semente, mesmo plano)', () => {
    const a = montarPlano(entrada({ caderno: erros(5) }), 30, tf, rngDe('x')), b = montarPlano(entrada({ caderno: erros(5) }), 30, tf, rngDe('x'))
    expect(a.questoes.ids).toEqual(b.questoes.ids)
  })
  it('o texto do plano diz a ordem, o que entra e quanto leva', () => {
    const t = textoDoPlano(montarPlano(entrada({ prog: progFraca(), caderno: erros(8), cartoes: Array.from({ length: 60 }, (_, i) => vencido('c' + i)) }), 30, tf, rng()))
    expect(t).toMatch(/^Plano de 30 minutos:\n1\. 24 cartões \(cerca de 12 min\)\n2\. 9 questões \(cerca de 18 min\): 4 do caderno de erros, \d de matérias fracas \(Matemática\)/)
  })
  it('espaço vazio: explica em vez de montar um plano vazio', () => {
    expect(textoDoPlano(montarPlano(entrada({ bank: [] }), 30, tf, rng()))).toMatch(/Não há cartões nem questões/)
  })
})

describe('quanto tempo a pessoa tem', () => {
  const casos: [string, number | undefined][] = [
    ['tenho 30 minutos', 30], ['só 20 min hoje', 20], ['meia hora', 30], ['uma hora', 60], ['1 hora e meia', 90], ['2h', 120], ['duas horas', 120], ['45 min', 45],
    ['15 minutos', 15], ['tenho 3 minutos', undefined], ['500 minutos', undefined], ['simulado de 30 questões', undefined], ['treinar 20', undefined],
  ]
  it.each(casos)('"%s" → %s', (t, esperado) => expect(acharMinutos(t)).toBe(esperado))
})
