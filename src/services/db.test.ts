// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HIST_VAZIO, registrarResposta, type Hist } from '../core/historico'
import { baseDe, derivar, resposta, zerar, type Evento } from '../core/sync/eventos'
import type { Progress, ProgressMap } from '../core/types'

// Banco de verdade (Dexie sobre um IndexedDB simulado): aqui se prova a GRAVAÇÃO (transações, migração v2 → v3), não a lógica do estado.
type Db = typeof import('./db')
type Prep = typeof import('./sync/preparar')
let db: Db, prep: Prep
const abrir = async () => { vi.resetModules(); db = await import('./db'); prep = await import('./sync/preparar') }
beforeEach(async () => { await Dexie.delete('treino-bb'); await abrir() }) // cada teste começa com o banco apagado

const t0 = new Date(2026, 10, 10, 10).getTime()
const prog1 = (ok: boolean): Progress => ({ n: 1, c: ok ? 1 : 0, ok, last: ok ? 'A' : 'B', t: t0 })
const histCom = (n: number): Hist => { let h = HIST_VAZIO; for (let i = 0; i < n; i++) h = registrarResposta(h, true, t0 + i); return h }

describe('banco: eventos de sincronização', () => {
  it('o id do aparelho é criado uma vez e continua o mesmo depois de reabrir o app', async () => {
    const a = await db.idDoAparelho()
    expect(a).toMatch(/^d[0-9a-f]{12}$/)
    expect(await db.idDoAparelho()).toBe(a)
    await abrir() // "fechou e abriu o app": o mesmo IndexedDB, módulo novo
    expect(await db.idDoAparelho()).toBe(a)
  })

  it('uma resposta grava progresso, histórico e evento juntos; o evento leva o `t` na linha', async () => {
    const ev = resposta('pc', 'q1', 'A', true, t0)
    await db.gravarResposta('q1', prog1(true), histCom(1), ev)
    const { prog, hist } = await db.loadAll()
    expect(prog.q1).toEqual(prog1(true)); expect(hist.dias['2026-11-10']).toEqual({ n: 1, c: 1 })
    expect(await db.lerEventos()).toEqual([expect.objectContaining({ id: ev.id, k: 'r', q: 'q1', t: t0 })])
  })

  it('se o evento não puder ser gravado, NADA é gravado (nem o progresso, nem o histórico)', async () => {
    const quebrado = { ...resposta('pc', 'q1', 'A', true, t0), id: undefined as unknown as string }
    await expect(db.gravarResposta('q1', prog1(true), histCom(1), quebrado)).rejects.toBeTruthy()
    const { prog, hist } = await db.loadAll()
    expect(prog).toEqual({}); expect(hist).toEqual(HIST_VAZIO); expect(await db.lerEventos()).toEqual([])
  })

  it('zerar limpa o que a tela mostra, guarda o evento e desfazer devolve tudo (e mantém respostas dadas depois do zerar)', async () => {
    const dev = 'pc'
    let h = HIST_VAZIO; const prog: ProgressMap = {}
    for (const [i, q] of ['q1', 'q2', 'q3'].entries()) { h = registrarResposta(h, true, t0 + i * 1000); prog[q] = { ...prog1(true), t: t0 + i * 1000 }; await db.gravarResposta(q, prog[q], h, resposta(dev, q, 'A', true, t0 + i * 1000)) }
    const z = zerar(dev, t0 + 10_000)
    await db.gravarZerar(z)
    expect((await db.loadAll()).prog).toEqual({}); expect((await db.loadAll()).hist).toEqual(HIST_VAZIO)
    expect((await db.lerEventos()).filter((e) => e.k === 'z')).toHaveLength(1)
    // uma resposta DEPOIS do zerar
    await db.gravarResposta('q9', { ...prog1(false), t: t0 + 20_000 }, registrarResposta(HIST_VAZIO, false, t0 + 20_000), resposta(dev, 'q9', 'B', false, t0 + 20_000))
    const d = await db.desfazerZerar(z.id)
    expect(Object.keys(d.prog).sort()).toEqual(['q1', 'q2', 'q3', 'q9'])
    expect(d.prog.q1).toEqual({ n: 1, c: 1, ok: true, last: 'A', t: t0 })
    expect(d.hist.dias['2026-11-10']).toEqual({ n: 4, c: 3 })
    const salvo = await db.loadAll()
    expect(salvo.prog).toEqual(d.prog); expect(salvo.hist).toEqual(d.hist) // o que ficou gravado é o mesmo que o app recebe
    expect((await db.lerEventos()).some((e) => e.k === 'z')).toBe(false)
  })

  it('na abertura: evento-base uma vez só (com progresso de antes), nada com o app vazio, e a conferência fica "ok"', async () => {
    const vazio = await prep.prepararSincronizacao({}, HIST_VAZIO)
    expect(await db.lerEventos()).toEqual([]) // aparelho novo: nada a registrar
    expect(await db.lerConferencia()).toMatchObject({ ok: true, eventos: 0 })
    const prog: ProgressMap = { q1: prog1(true), q2: prog1(false) }, hist = histCom(2)
    const dev = await prep.prepararSincronizacao(prog, hist)
    expect(dev).toBe(vazio)
    const eventos = await db.lerEventos()
    expect(eventos).toHaveLength(1); expect(eventos[0]).toMatchObject({ k: 'b', id: `b:${dev}` })
    expect(derivar(eventos)).toEqual({ prog, hist })
    expect(await db.lerConferencia()).toMatchObject({ ok: true, eventos: 1, diferencas: [] })
    await prep.prepararSincronizacao(prog, hist) // abrir de novo não cria outra base
    expect(await db.lerEventos()).toHaveLength(1)
  })

  it('se os eventos deste aparelho ficaram para trás do progresso, a abertura os refaz como uma base (e avisa)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const prog: ProgressMap = { q1: prog1(true) }
    const dev = await prep.prepararSincronizacao(prog, histCom(1))
    const depois: ProgressMap = { ...prog, q2: prog1(true) } // a tela passou a mostrar mais uma questão sem que o evento fosse gravado
    await prep.prepararSincronizacao(depois, histCom(2))
    const c = await db.lerConferencia() as { ok: boolean; curou?: number; eventos: number }
    expect(c).toMatchObject({ ok: true, curou: 2, eventos: 1 })
    const ev = await db.lerEventos()
    expect(ev).toHaveLength(1); expect(ev[0]).toMatchObject({ k: 'b', id: `b:${dev}` })
    expect(derivar(ev)).toEqual({ prog: depois, hist: histCom(2) })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('NÃO refaz nada quando há eventos de outro aparelho: só acusa (refazer afastaria o que já saiu daqui)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const prog: ProgressMap = { q1: prog1(true) }
    await prep.prepararSincronizacao(prog, histCom(1))
    const dev = await db.idDoAparelho()
    const doOutro = resposta('cel', 'q7', 'A', true, t0 + 5)
    await db.gravarResposta('q7', prog1(true), histCom(1), doOutro) // (simula um evento de outro aparelho que chegou)
    const antes = await db.lerEventos()
    await prep.prepararSincronizacao(prog, histCom(1)) // o progresso local não tem a q7: diverge
    const c = await db.lerConferencia() as { ok: boolean; curou?: number }
    expect(c.ok).toBe(false); expect(c.curou).toBeUndefined()
    expect(await db.lerEventos()).toEqual(antes); expect(dev).toBeTruthy()
    warn.mockRestore()
  })

  it('app zerado (sem progresso) com eventos antigos sem zerar: a cura apaga os eventos deste aparelho, sem base', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await prep.prepararSincronizacao({ q1: prog1(true) }, histCom(1))
    await prep.prepararSincronizacao({}, HIST_VAZIO) // a tela ficou vazia por fora dos eventos
    expect(await db.lerEventos()).toEqual([]); expect(await db.lerConferencia()).toMatchObject({ ok: true, eventos: 0 })
    warn.mockRestore()
  })

  it('refazer os eventos deste aparelho (restaurar backup) mantém os dos outros aparelhos', async () => {
    const outro = resposta('cel', 'q7', 'A', true, t0)
    await db.gravarResposta('q1', prog1(true), histCom(1), resposta('pc', 'q1', 'A', true, t0))
    await db.gravarResposta('q7', prog1(true), histCom(1), outro)
    const base = baseDe('pc', t0 + 1, { q5: prog1(true) }, histCom(1))
    await db.refazerEventosDoAparelho('pc', base)
    const ev = (await db.lerEventos()) as Evento[]
    expect(ev.map((e) => e.id).sort()).toEqual([base.id, outro.id].sort())
  })
})

describe('banco: migração v2 → v3 só acrescenta', () => {
  it('um banco no esquema antigo (progresso, histórico, baralhos e cartões) abre na v3 sem perder nada e ganha a tabela de eventos', async () => {
    const velho = new Dexie('treino-bb')
    velho.version(1).stores({ prog: 'id', meta: 'key' })
    velho.version(2).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b' })
    await velho.open()
    await velho.table('prog').put({ id: 'q1', n: 3, c: 2, ok: true, last: 'C', t: t0 })
    await velho.table('meta').bulkPut([{ key: 'tema', value: 'dark' }, { key: 'hist', value: JSON.stringify(histCom(2)) }])
    await velho.table('decks').put({ id: 'b1', nome: 'Siglas', criado: t0 })
    await velho.table('cards').put({ id: 'c1', b: 'b1', f: 'SELIC', v: 'juros', criado: t0, estado: 'novo', due: t0, ivl: 0, fac: 2.5, reps: 0, lapsos: 0 })
    velho.close()
    await abrir() // abre com o esquema novo
    const { prog, tema, hist } = await db.loadAll()
    expect(prog.q1).toEqual({ n: 3, c: 2, ok: true, last: 'C', t: t0 }); expect(tema).toBe('dark'); expect(hist.dias['2026-11-10']).toEqual({ n: 2, c: 2 })
    expect((await db.loadCards()).cartoes.map((c) => c.id)).toEqual(['c1'])
    expect(await db.lerEventos()).toEqual([])
  })
})
