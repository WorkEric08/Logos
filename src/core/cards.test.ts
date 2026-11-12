import { describe, expect, it } from 'vitest'
import { AJUSTES_PADRAO, DIA, MAX_IVL, MIN, agendar, contar, contarNovo, criarBaralho, criarCartao, devido, diaDe, limparCards, limparCartao, meiaNoite, montarFila, novoId, novosRestantes, rotuloDias, rotulosDasNotas, type Ajustes, type Cartao, type Nota } from './cards'
import { limparHist } from './historico'

const agora = new Date(2026, 10, 8, 15, 30).getTime() // 08/11/2026 15:30
const novo = (id = 'a', extra: Partial<Cartao> = {}): Cartao => ({ ...criarCartao({ b: 'b1', f: `frente ${id}`, v: `verso ${id}` }, agora - DIA, id), ...extra })
const emRev = (ivl: number, fac = 2.5, extra: Partial<Cartao> = {}): Cartao => novo('r', { estado: 'revisao', ivl, fac, reps: 3, due: meiaNoite(agora, 0), ...extra })

describe('agendamento (repetição espaçada)', () => {
  it('cartão novo: Errei 10 min (aprendendo) · Difícil 1 d · Bom 2 d · Fácil 5 d, sempre à meia-noite do dia', () => {
    const c = novo()
    const e = agendar(c, 0, agora); expect(e.estado).toBe('aprendendo'); expect(e.due).toBe(agora + 10 * MIN); expect(e.lapsos).toBe(0); expect(e.ivl).toBe(0)
    for (const [n, d] of [[1, 1], [2, 2], [3, 5]] as [Nota, number][]) {
      const r = agendar(c, n, agora); expect(r.estado).toBe('revisao'); expect(r.ivl).toBe(d); expect(r.due).toBe(meiaNoite(agora, d)); expect(r.ult).toBe(agora)
    }
  })
  it('cartão em revisão: Bom = ×facilidade; Difícil = ×1,2 e facilidade −0,15; Fácil = ×facilidade×1,3 e +0,15', () => {
    const c = emRev(10, 2.5)
    expect(agendar(c, 2, agora)).toMatchObject({ ivl: 25, fac: 2.5, reps: 4 })
    expect(agendar(c, 1, agora)).toMatchObject({ ivl: 12, fac: 2.35 })
    expect(agendar(c, 3, agora)).toMatchObject({ ivl: 33, fac: 2.65 })
  })
  it('Errei em revisão: volta a aprendendo, conta um lapso, facilidade −0,20 (mínimo 1,3) e zera a sequência', () => {
    const e = agendar(emRev(30, 2.5, { reps: 5 }), 0, agora)
    expect(e).toMatchObject({ estado: 'aprendendo', lapsos: 1, fac: 2.3, reps: 0, ivl: 0, due: agora + 10 * MIN })
    expect(agendar(emRev(30, 1.35), 0, agora).fac).toBe(1.3)
    expect(agendar(emRev(30, 1.3), 0, agora).fac).toBe(1.3)
  })
  it('o intervalo sempre cresce ao menos 1 dia, nunca passa de 365 e a facilidade nunca cai de 1,3', () => {
    expect(agendar(emRev(1, 1.3), 2, agora).ivl).toBe(2) // 1×1,3 arredonda para 1; sobe para 2
    expect(agendar(emRev(1, 1.3), 1, agora).ivl).toBe(2)
    expect(agendar(emRev(300, 2.5), 3, agora).ivl).toBe(MAX_IVL)
    let c = emRev(10, 1.35)
    for (let i = 0; i < 6; i++) c = agendar({ ...c, estado: 'revisao' }, 1, agora)
    expect(c.fac).toBe(1.3)
  })
  it('não muda o cartão original', () => {
    const c = novo(); const copia = { ...c }; agendar(c, 3, agora); expect(c).toEqual(copia)
  })
  it('rótulos dos botões: 10 min / 1 d / 2 d / 5 d no cartão novo; em dias, meses e anos depois', () => {
    expect(rotulosDasNotas(novo(), agora)).toEqual(['10 min', '1 d', '2 d', '5 d'])
    expect(rotulosDasNotas(emRev(10), agora)).toEqual(['10 min', '12 d', '25 d', '1 m'])
    expect(rotuloDias(29)).toBe('29 d'); expect(rotuloDias(45)).toBe('2 m'); expect(rotuloDias(365)).toBe('1 a'); expect(rotuloDias(547)).toBe('1,5 a')
  })
})

describe('o que está devido hoje', () => {
  it('em revisão: venceu até o fim de hoje (inclusive hoje à noite); amanhã não. Aprendendo: sempre', () => {
    expect(devido(emRev(3, 2.5, { due: meiaNoite(agora, -2) }), agora)).toBe(true)
    expect(devido(emRev(3, 2.5, { due: meiaNoite(agora, 0) }), agora)).toBe(true)
    expect(devido(emRev(3, 2.5, { due: meiaNoite(agora, 1) }), agora)).toBe(false)
    expect(devido(novo('x', { estado: 'aprendendo', due: agora + 5 * MIN }), agora)).toBe(true)
    expect(devido(novo(), agora)).toBe(false) // novo não é "devido": entra pelo limite de novos
  })
  it('limite de novos por dia: conta só os de hoje; 0 = sem limite', () => {
    const a: Ajustes = { limite: 10, dia: diaDe(agora), novos: 7 }
    expect(novosRestantes(a, agora)).toBe(3)
    expect(novosRestantes({ ...a, dia: '2000-01-01' }, agora)).toBe(10) // outro dia: zera
    expect(novosRestantes({ ...a, limite: 0 }, agora)).toBe(Infinity)
    expect(novosRestantes({ ...a, novos: 50 }, agora)).toBe(0)
    expect(contarNovo(a, agora)).toEqual({ limite: 10, dia: diaDe(agora), novos: 8 })
    expect(contarNovo({ ...a, dia: '2000-01-01' }, agora).novos).toBe(1)
  })
  it('fila: aprendendo, depois revisões (as mais atrasadas primeiro), depois os novos até o limite, na ordem de criação', () => {
    const cs = [
      novo('n1', { criado: 1 }), novo('n2', { criado: 2 }), novo('n3', { criado: 3 }),
      emRev(5, 2.5, { id: 'rA', due: meiaNoite(agora, -1) }), emRev(5, 2.5, { id: 'rB', due: meiaNoite(agora, -5) }), emRev(5, 2.5, { id: 'rFut', due: meiaNoite(agora, 3) }),
      novo('ap', { estado: 'aprendendo', due: agora }),
    ]
    expect(montarFila(cs, { limite: 2, dia: '', novos: 0 }, agora)).toEqual(['ap', 'rB', 'rA', 'n1', 'n2'])
    expect(montarFila(cs, { limite: 0, dia: '', novos: 0 }, agora)).toEqual(['ap', 'rB', 'rA', 'n1', 'n2', 'n3'])
    expect(montarFila(cs, { limite: 10, dia: diaDe(agora), novos: 10 }, agora)).toEqual(['ap', 'rB', 'rA']) // já viu os 10 de hoje
  })
  it('contagens do painel', () => {
    const cs = [novo('n1'), novo('n2'), emRev(30, 2.5, { id: 'm', due: meiaNoite(agora, 10) }), emRev(3, 2.5, { id: 'v', due: meiaNoite(agora, -1) }), novo('ap', { estado: 'aprendendo' })]
    expect(contar(cs, { limite: 1, dia: '', novos: 0 }, agora)).toEqual({ novos: 1, aprender: 1, revisar: 1, total: 5, aprendidos: 2, maduros: 1, hoje: 3 })
    expect(contar([], AJUSTES_PADRAO, agora).hoje).toBe(0)
  })
})

describe('tamanho dos cartões', () => {
  it('corta faces muito longas', () => {
    const longo = 'x'.repeat(5000)
    expect(criarCartao({ b: 'b', f: longo, v: 'v' }, agora, 'i').f).toHaveLength(2000)
  })
})

describe('dados vindos do banco ou de backup', () => {
  it('cartão: exige id, baralho e as duas faces; corrige números absurdos', () => {
    expect(limparCartao(null)).toBeNull(); expect(limparCartao({ id: 'a', b: 'b', f: 'x', v: '  ' })).toBeNull(); expect(limparCartao({ id: 'a', f: 'x', v: 'y' })).toBeNull()
    const c = limparCartao({ id: 'a', b: 'b', f: 'x', v: 'y', estado: 'qualquer', ivl: 9999, fac: 99, reps: -3, due: 'x' })!
    expect(c).toMatchObject({ estado: 'novo', ivl: MAX_IVL, fac: 2.5, reps: 0, due: 0 })
  })
  it('backup: descarta cartão de baralho inexistente e id repetido; ajustes e histórico voltam limpos', () => {
    const d = limparCards({
      baralhos: [{ id: 'b1', nome: ' Siglas ' }, { id: '', nome: 'x' }, { nome: 'sem id' }],
      cartoes: [{ id: 'a', b: 'b1', f: 'f', v: 'v' }, { id: 'a', b: 'b1', f: 'dup', v: 'dup' }, { id: 'c', b: 'fantasma', f: 'f', v: 'v' }],
      ajustes: { limite: 7, dia: 5, novos: -1 }, hist: { dias: { '2026-11-08': { n: 2, c: 1 } } },
    }, limparHist)
    expect(d.baralhos).toEqual([{ id: 'b1', nome: 'Siglas', criado: 0 }]); expect(d.cartoes.map((c) => c.id)).toEqual(['a']); expect(d.cartoes[0].f).toBe('f')
    expect(d.ajustes).toEqual({ limite: 10, dia: '', novos: 0 }); expect(d.hist.dias['2026-11-08']).toEqual({ n: 2, c: 1 })
    expect(limparCards(undefined, limparHist)).toMatchObject({ baralhos: [], cartoes: [] })
  })
  it('ids novos não se repetem e baralho tem nome limpo', () => {
    const ids = new Set(Array.from({ length: 500 }, (_, i) => novoId(agora + i))) // como o app faz (import: agora + i); 500 sorteios no mesmo milissegundo colidiam em ~7 % das execuções
    expect(ids.size).toBe(500)
    expect(criarBaralho('  Bancários   siglas  ', agora, 'x').nome).toBe('Bancários siglas')
  })
})
