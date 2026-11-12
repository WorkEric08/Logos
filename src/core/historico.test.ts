import { describe, expect, it } from 'vitest'
import { HIST_VAZIO, MAX_SIMS, alternarMarca, diaDe, diasDoMes, limparHist, limparMarks, marcadas, parseBackupCompleto, registrarResposta, registrarSimulado, salvarNota, sequencia, ultimosDias, type Hist, type Sim } from './historico'
import { DEFAULT_FILTERS, filterPool } from './filters'
import bank from '../data/bank.json'
import type { Question } from './types'
const BANK = bank.q as unknown as Question[]

const dia = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime()
const sim = (t: number, p = 60): Sim => ({ t, p, b: 20, e: 40, c: 42, n: 70, ok: true })

describe('histórico por dia', () => {
  it('conta as respostas e as certas no dia (fuso do aparelho) sem alterar o histórico anterior', () => {
    const h0 = HIST_VAZIO
    const h1 = registrarResposta(h0, true, dia(2026, 11, 8, 23))
    const h2 = registrarResposta(h1, false, dia(2026, 11, 8, 23))
    expect(h2.dias['2026-11-08']).toEqual({ n: 2, c: 1 })
    expect(h0.dias).toEqual({}); expect(h1.dias['2026-11-08']).toEqual({ n: 1, c: 1 })
    expect(diaDe(dia(2026, 1, 5, 0))).toBe('2026-01-05')
  })
  it('últimos dias: do mais antigo ao de hoje, dias parados com zero, atravessa virada de mês e de ano', () => {
    const h: Hist = { dias: { '2025-12-31': { n: 4, c: 3 }, '2026-01-02': { n: 1, c: 1 } }, sims: [] }
    const u = ultimosDias(h, 4, dia(2026, 1, 2))
    expect(u.map((x) => x.dia)).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'])
    expect(u.map((x) => x.n)).toEqual([0, 4, 0, 1])
  })
  it('dias do mês: do dia 1 ao último (28, 29, 30 ou 31), com os dias futuros e parados em zero, sem misturar com o mês vizinho', () => {
    const h: Hist = { dias: { '2026-10-31': { n: 9, c: 9 }, '2026-11-01': { n: 2, c: 1 }, '2026-11-10': { n: 5, c: 4 }, '2026-12-01': { n: 7, c: 7 } }, sims: [] }
    const nov = diasDoMes(h, dia(2026, 11, 10))
    expect(nov).toHaveLength(30)
    expect(nov[0]).toEqual({ dia: '2026-11-01', n: 2, c: 1 })
    expect(nov[29].dia).toBe('2026-11-30')
    expect(nov.reduce((a, x) => a + x.n, 0)).toBe(7) // só novembro: 31/10 e 01/12 ficam de fora
    expect(nov[9]).toEqual({ dia: '2026-11-10', n: 5, c: 4 }); expect(nov[29].n).toBe(0) // futuro
    expect(diasDoMes(HIST_VAZIO, dia(2026, 12, 31, 23))).toHaveLength(31) // último dia do ano
    expect(diasDoMes(HIST_VAZIO, dia(2028, 2, 1))).toHaveLength(29) // bissexto
    expect(diasDoMes(HIST_VAZIO, dia(2027, 2, 28))).toHaveLength(28)
  })
  it('sequência: conta dias seguidos; hoje vazio não quebra a de ontem; um dia sem estudo zera', () => {
    const d = (n: number) => ({ n, c: 0 })
    const h: Hist = { dias: { '2026-11-06': d(2), '2026-11-07': d(1), '2026-11-08': d(3) }, sims: [] }
    expect(sequencia(h, dia(2026, 11, 8))).toBe(3)
    expect(sequencia(h, dia(2026, 11, 9))).toBe(3) // hoje (9) ainda sem resposta: vale a de ontem
    expect(sequencia(h, dia(2026, 11, 10))).toBe(0) // ficou um dia inteiro sem estudar
    expect(sequencia(HIST_VAZIO, dia(2026, 11, 8))).toBe(0)
    const h2: Hist = { dias: { '2026-11-05': d(1), '2026-11-07': d(1), '2026-11-08': d(1) }, sims: [] }
    expect(sequencia(h2, dia(2026, 11, 8))).toBe(2) // o buraco no dia 6 corta a sequência
  })
})

describe('histórico de simulados', () => {
  it('guarda em ordem e limita a quantidade (os mais antigos saem)', () => {
    let h = HIST_VAZIO
    for (let i = 0; i < MAX_SIMS + 5; i++) h = registrarSimulado(h, sim(i))
    expect(h.sims).toHaveLength(MAX_SIMS)
    expect(h.sims[0].t).toBe(5); expect(h.sims.at(-1)!.t).toBe(MAX_SIMS + 4)
  })
})

describe('leitura de dados guardados / backup', () => {
  it('descarta lixo e mantém o que tem cara de histórico', () => {
    const h = limparHist({
      dias: { '2026-11-08': { n: 3, c: 2 }, 'ontem': { n: 1, c: 1 }, '2026-11-07': { n: 1, c: 5 }, '2026-11-06': 'x' },
      sims: [sim(5), { t: 'a' }, null, sim(2)],
    })
    expect(Object.keys(h.dias)).toEqual(['2026-11-08'])
    expect(h.sims.map((s) => s.t)).toEqual([2, 5]) // reordenou por data
    expect(limparHist(null)).toEqual(HIST_VAZIO); expect(limparHist('abc')).toEqual(HIST_VAZIO)
  })
  it('o tempo do simulado (d, em segundos) é mantido; simulado antigo sem tempo continua válido; tempo inválido é ignorado', () => {
    const h = limparHist({ sims: [{ ...sim(1), d: 3909.4 }, sim(2), { ...sim(3), d: -5 }, { ...sim(4), d: 'x' }] })
    expect(h.sims.map((s) => s.d)).toEqual([3909, undefined, undefined, undefined])
    expect('d' in h.sims[1]).toBe(false) // sem o campo, e não "d: undefined"
  })
  it('backup novo traz progresso, histórico e marcações; backup antigo (só progresso) devolve null nos dois (nada é apagado)', () => {
    const novo = parseBackupCompleto(JSON.stringify({ v: 2, prog: { a: { n: 1, c: 1, ok: true } }, hist: { dias: { '2026-11-08': { n: 1, c: 1 } }, sims: [] }, marks: { a: { r: true, t: 1 } } }))!
    expect(novo.hist!.dias['2026-11-08']).toEqual({ n: 1, c: 1 }); expect(novo.marks).toEqual({ a: { r: true, t: 1 } })
    const antigo = parseBackupCompleto(JSON.stringify({ v: 1, prog: { a: { n: 1, c: 1, ok: true } } }))!
    expect(antigo.hist).toBeNull(); expect(antigo.marks).toBeNull(); expect(Object.keys(antigo.prog)).toEqual(['a'])
    expect(parseBackupCompleto('não é json')).toBeNull(); expect(parseBackupCompleto('{"x":1}')).toBeNull()
  })
})

describe('marcar para revisar e anotar', () => {
  it('marca e desmarca; sem marca e sem nota, a entrada some', () => {
    let m = alternarMarca({}, 'q1', 5)
    expect(m).toEqual({ q1: { r: true, t: 5 } }); expect(marcadas(m)).toEqual(['q1'])
    m = alternarMarca(m, 'q1', 6)
    expect(m).toEqual({})
  })
  it('anotar também marca; desmarcar mantém o texto; apagar o texto de uma questão desmarcada remove tudo', () => {
    let m = salvarNota({}, 'q1', 'cuidado com a crase', 1)
    expect(m.q1).toEqual({ r: true, a: 'cuidado com a crase', t: 1 })
    m = alternarMarca(m, 'q1', 2) // desmarca, o texto fica
    expect(m.q1).toEqual({ a: 'cuidado com a crase', t: 2 }); expect(marcadas(m)).toEqual([])
    m = salvarNota(m, 'q1', '   ', 3) // texto vazio e sem marca
    expect(m).toEqual({})
  })
  it('apagar o texto de uma questão ainda marcada mantém a marca', () => {
    let m = alternarMarca({}, 'q1', 1); m = salvarNota(m, 'q1', 'x', 2); m = salvarNota(m, 'q1', '', 3)
    expect(m.q1).toEqual({ r: true, t: 3 })
  })
  it('não muda o objeto original e corta anotação gigante', () => {
    const m0 = {}
    salvarNota(m0, 'q', 'a', 1); expect(m0).toEqual({})
    expect(salvarNota({}, 'q', 'x'.repeat(5000), 1).q.a).toHaveLength(2000)
    expect(limparMarks({ a: { r: true, t: 1 }, b: { t: 2 }, c: 7, d: { a: '  ', t: 3 } })).toEqual({ a: { r: true, t: 1 } })
  })
  it('filtro "Marcadas" traz só as marcadas (as só-anotadas e depois desmarcadas ficam de fora)', () => {
    const [a, b, c] = [BANK[1].id, BANK[2].id, BANK[3].id]
    let m = alternarMarca({}, a, 1)
    m = alternarMarca(m, b, 1)
    m = alternarMarca(salvarNota(m, c, 'nota', 1), c, 2) // c: anotada e depois desmarcada
    const f = { ...DEFAULT_FILTERS, status: 'marcadas' as const, qtd: 0 }
    expect(filterPool(BANK, f, {}, m).map((q) => q.id).sort()).toEqual([a, b].sort())
    expect(filterPool(BANK, f, {}).length).toBe(0) // sem marcações: nada
  })
})
