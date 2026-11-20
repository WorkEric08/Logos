import { describe, expect, it } from 'vitest'
import { HIST_VAZIO, MAX_SIMS, diaDe, registrarResposta, registrarSimulado, type Hist, type Sim } from '../historico'
import { recordAnswer } from '../filters'
import type { Letter, ProgressMap, Question } from '../types'
import { baseDe, derivar, desfeito, mesclarEventos, resposta, simulado, zerar, type Evento } from './eventos'

// gerador pseudoaleatório com semente: o teste repete igual sempre
const sementeada = (s: number) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
const LETRAS: Letter[] = ['A', 'B', 'C', 'D', 'E']
const dia = (d: number, h = 10) => new Date(2026, 10, d, h).getTime() // novembro de 2026
const sim = (t: number, p = 60): Sim => ({ t, p, b: 20, e: 40, c: 42, n: 70, ok: true })
const Q = (id: string, g: Letter): Question => ({ id, g } as unknown as Question)

/** Aplica uma lista de respostas pelas contas ATUAIS do app e devolve o progresso e o histórico (a referência). */
function comoOAppFaz(respostas: { q: string; g: Letter; l: Letter; t: number }[], sims: Sim[] = []) {
  let prog: ProgressMap = {}, hist: Hist = HIST_VAZIO
  for (const r of respostas) { prog = recordAnswer(prog, Q(r.q, r.g), r.l, r.t); hist = registrarResposta(hist, r.l === r.g, r.t) }
  for (const s of sims) hist = registrarSimulado(hist, s)
  return { prog, hist }
}

function respostasAleatorias(rnd: () => number, n: number, t0: number) {
  const out: { q: string; g: Letter; l: Letter; t: number }[] = []
  let t = t0
  for (let i = 0; i < n; i++) {
    t += 1 + Math.floor(rnd() * 3_600_000) // de 1 ms a 1 h entre respostas
    const q = `q${Math.floor(rnd() * 12)}`, g = LETRAS[q.length % 5]
    out.push({ q, g, l: rnd() < 0.55 ? g : LETRAS[Math.floor(rnd() * 5)], t })
  }
  return out
}

describe('derivar: o mesmo que as contas atuais do app', () => {
  it('respostas viram progresso e histórico idênticos aos de recordAnswer/registrarResposta (várias sementes)', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const rs = respostasAleatorias(sementeada(seed), 150, dia(1))
      const ref = comoOAppFaz(rs)
      const ev: Evento[] = rs.map((r) => resposta('pc', r.q, r.l, r.l === r.g, r.t))
      expect(derivar(ev), `semente ${seed}`).toEqual(ref)
    }
  })
  it('simulados entregues entram no histórico, ordenados e limitados aos mais recentes', () => {
    const sims = Array.from({ length: MAX_SIMS + 5 }, (_, i) => sim(dia(1) + i * 1000, 40 + (i % 50)))
    const ref = comoOAppFaz([], sims)
    expect(derivar(sims.map((s) => simulado('pc', s))).hist).toEqual(ref.hist)
    expect(derivar(sims.map((s) => simulado('pc', s))).hist.sims).toHaveLength(MAX_SIMS)
  })
  it('migração: o que o aparelho já tinha (evento-base) deriva EXATAMENTE o mesmo progresso e histórico de antes', () => {
    for (const seed of [11, 12, 13, 14]) {
      const ref = comoOAppFaz(respostasAleatorias(sementeada(seed), 120, dia(1)), [sim(dia(3)), sim(dia(5), 80)])
      expect(derivar([baseDe('pc', dia(9), ref.prog, ref.hist)]), `semente ${seed}`).toEqual(ref)
    }
  })
  it('a linha de progresso antiga sem data (t) ou sem letra (last) continua igual depois da migração', () => {
    const prog: ProgressMap = { a: { n: 3, c: 2, ok: false }, b: { n: 1, c: 1, ok: true, last: 'C' } }
    expect(derivar([baseDe('pc', dia(9), prog, HIST_VAZIO)]).prog).toEqual(prog)
  })
  it('base + respostas novas: soma, e o "último" é a resposta mais recente', () => {
    const antes = comoOAppFaz([{ q: 'q1', g: 'A', l: 'B', t: dia(1) }]) // errou
    const ev = [baseDe('pc', dia(2), antes.prog, antes.hist), resposta('pc', 'q1', 'A', true, dia(3))]
    const d = derivar(ev)
    expect(d.prog.q1).toEqual({ n: 2, c: 1, ok: true, last: 'A', t: dia(3) })
    expect(d.hist.dias[diaDe(dia(1))]).toEqual({ n: 1, c: 0 }); expect(d.hist.dias[diaDe(dia(3))]).toEqual({ n: 1, c: 1 })
  })
})

describe('juntar dois (ou três) aparelhos sem perder nada', () => {
  const rnd = sementeada(99)
  const pc = respostasAleatorias(rnd, 80, dia(1)).map((r) => resposta('pc', r.q, r.l, r.l === r.g, r.t))
  const cel = respostasAleatorias(rnd, 80, dia(2)).map((r) => resposta('cel', r.q, r.l, r.l === r.g, r.t))
  const tab = respostasAleatorias(rnd, 30, dia(3)).map((r) => resposta('tab', r.q, r.l, r.l === r.g, r.t))
  const todos = [...pc, ...cel, ...tab]

  it('nenhuma resposta se perde: o total de respostas é a soma dos aparelhos', () => {
    const d = derivar(mesclarEventos(pc, cel, tab))
    const n = Object.values(d.prog).reduce((a, p) => a + p.n, 0)
    expect(n).toBe(todos.length)
    expect(Object.values(d.hist.dias).reduce((a, x) => a + x.n, 0)).toBe(todos.length)
  })
  it('a ordem em que os aparelhos sincronizam não muda o resultado (comutativa e associativa)', () => {
    const ref = derivar(mesclarEventos(pc, cel, tab))
    for (const ordem of [[cel, pc, tab], [tab, cel, pc], [pc, tab, cel], [cel, tab, pc]]) expect(derivar(mesclarEventos(...ordem))).toEqual(ref)
    expect(derivar(mesclarEventos(mesclarEventos(pc, cel), tab))).toEqual(ref)
    expect(derivar(mesclarEventos(pc, mesclarEventos(cel, tab)))).toEqual(ref)
  })
  it('sincronizar duas vezes (ou receber o mesmo evento de novo) não duplica nada (idempotente)', () => {
    const ref = derivar(mesclarEventos(pc, cel))
    expect(derivar(mesclarEventos(pc, cel, pc, cel))).toEqual(ref)
    expect(mesclarEventos(mesclarEventos(pc, cel), cel)).toEqual(mesclarEventos(pc, cel))
  })
  it('o resultado é igual ao de UM aparelho que tivesse recebido todas as respostas em ordem de tempo', () => {
    const rsTodas = [...pc, ...cel, ...tab].sort((a, b) => (a as { t: number }).t - (b as { t: number }).t)
    const ref = comoOAppFaz(rsTodas.map((e) => { const r = e as ReturnType<typeof resposta>; return { q: r.q, g: r.ok ? r.l : (LETRAS.find((x) => x !== r.l) as Letter), l: r.l, t: r.t } }))
    expect(derivar(mesclarEventos(pc, cel, tab)).prog).toEqual(ref.prog)
  })
  it('dois aparelhos com histórico anterior (cada um com o seu evento-base) somam as duas histórias', () => {
    const a = comoOAppFaz([{ q: 'q1', g: 'A', l: 'A', t: dia(1) }, { q: 'q2', g: 'B', l: 'C', t: dia(1, 11) }])
    const b = comoOAppFaz([{ q: 'q1', g: 'A', l: 'B', t: dia(2) }], [sim(dia(2))])
    const d = derivar(mesclarEventos([baseDe('pc', dia(5), a.prog, a.hist)], [baseDe('cel', dia(6), b.prog, b.hist)]))
    expect(d.prog.q1).toMatchObject({ n: 2, c: 1, ok: false, last: 'B', t: dia(2) }) // a resposta mais recente (do celular) é a "última"
    expect(d.prog.q2).toMatchObject({ n: 1, c: 0, ok: false })
    expect(d.hist.sims).toHaveLength(1)
    expect(d.hist.dias[diaDe(dia(1))]).toEqual({ n: 2, c: 1 })
  })
  it('o mesmo evento-base chegando duas vezes (reenvio) não dobra a história; o refeito mais novo substitui', () => {
    const a = comoOAppFaz([{ q: 'q1', g: 'A', l: 'A', t: dia(1) }])
    const b1 = baseDe('pc', dia(5), a.prog, a.hist)
    expect(derivar(mesclarEventos([b1], [b1])).prog.q1.n).toBe(1)
    const a2 = comoOAppFaz([{ q: 'q1', g: 'A', l: 'A', t: dia(1) }, { q: 'q1', g: 'A', l: 'B', t: dia(4) }])
    expect(derivar(mesclarEventos([b1], [baseDe('pc', dia(6), a2.prog, a2.hist)])).prog.q1.n).toBe(2)
  })
})

describe('zerar progresso entre aparelhos (e o desfazer)', () => {
  const r = (dev: string, q: string, t: number, ok = true) => resposta(dev, q, ok ? 'A' : 'B', ok, t)
  it('o zerar vale para as respostas de TODOS os aparelhos anteriores a ele; as posteriores contam', () => {
    const ev = [r('pc', 'q1', dia(1)), r('cel', 'q2', dia(2)), zerar('pc', dia(3)), r('cel', 'q3', dia(4)), r('pc', 'q1', dia(5), false)]
    const d = derivar(ev)
    expect(Object.keys(d.prog).sort()).toEqual(['q1', 'q3'])
    expect(d.prog.q1).toMatchObject({ n: 1, c: 0, ok: false })
    expect(Object.keys(d.hist.dias)).toEqual([diaDe(dia(4)), diaDe(dia(5))])
  })
  it('um aparelho offline que só sincroniza depois do zerar não "ressuscita" o que era anterior a ele', () => {
    const celAntigo = [r('cel', 'q9', dia(1)), r('cel', 'q9', dia(2))] // respondido antes, sincronizado só depois do zerar
    const d = derivar(mesclarEventos(celAntigo, [zerar('pc', dia(3)), r('pc', 'q1', dia(4))]))
    expect(Object.keys(d.prog)).toEqual(['q1'])
  })
  it('desfazer o zerar = remover o evento: tudo volta, nada tinha sido apagado', () => {
    const base = [r('pc', 'q1', dia(1)), r('pc', 'q2', dia(2))]
    const z = zerar('pc', dia(3))
    expect(derivar([...base, z]).prog).toEqual({})
    expect(derivar(base).prog).toEqual(derivar(mesclarEventos(base)).prog)
    expect(Object.keys(derivar(base).prog)).toEqual(['q1', 'q2'])
  })
  it('o evento-base também respeita o zerar, item por item (o que foi respondido antes não volta, o posterior fica)', () => {
    const antes = comoOAppFaz([{ q: 'qa', g: 'A', l: 'A', t: dia(1) }, { q: 'qb', g: 'A', l: 'A', t: dia(8) }], [sim(dia(1)), sim(dia(9))])
    const d = derivar([baseDe('cel', dia(10), antes.prog, antes.hist), zerar('pc', dia(5))])
    expect(Object.keys(d.prog)).toEqual(['qb'])
    expect(d.hist.sims.map((s) => s.t)).toEqual([dia(9)])
    expect(Object.keys(d.hist.dias)).toEqual([diaDe(dia(8))])
  })
  it('vários zerar: vale o mais recente', () => {
    const d = derivar([r('pc', 'q1', dia(1)), zerar('pc', dia(2)), r('pc', 'q2', dia(3)), zerar('cel', dia(4)), r('cel', 'q3', dia(5))])
    expect(Object.keys(d.prog)).toEqual(['q3'])
  })
})

describe('desfazer o zerar por evento "desfeito" (F6.3a)', () => {
  const r = (q: string, t: number) => resposta('pc', q, 'A', true, t)
  it('o zerar desfeito deixa de valer; as respostas de antes voltam e as de depois continuam', () => {
    const z = zerar('pc', 1000)
    const ev = [r('q1', 500), r('q2', 800), z, r('q3', 1500)]
    expect(Object.keys(derivar(ev).prog)).toEqual(['q3'])
    const d = desfeito('pc', 2000, z.id)
    expect(Object.keys(derivar([...ev, d]).prog).sort()).toEqual(['q1', 'q2', 'q3'])
  })
  it('em qualquer ordem e repetido dá o mesmo; desfazer um zerar não anula um zerar MAIS NOVO', () => {
    const z1 = zerar('pc', 1000), z2 = zerar('cel', 3000), d1 = desfeito('pc', 2000, z1.id)
    const ev = [r('q1', 500), z1, r('q2', 1500), d1, z2, r('q3', 3500)]
    const esperado = derivar(ev)
    expect(derivar(mesclarEventos([...ev].reverse()))).toEqual(esperado); expect(derivar(mesclarEventos(ev, ev))).toEqual(esperado)
    expect(Object.keys(esperado.prog)).toEqual(['q3']) // o 2º zerar continua valendo
  })
})
