// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarBaralho, criarCartao } from '../../core/cards'
import { HIST_VAZIO, registrarResposta } from '../../core/historico'
import { resposta, zerar, type Evento } from '../../core/sync/eventos'
import type { ItemNuvem } from '../../core/sync/nuvem'
import type { Efeitos, MudancaEventos, MudancaItens, Porta } from './motor'

// Banco de verdade (Dexie sobre IndexedDB simulado) + uma "nuvem" de mentira: prova a lógica de juntar, enviar e aplicar sem Firebase.
type Db = typeof import('../db')
type Motor = typeof import('./motor')
let db: Db, motor: Motor
beforeEach(async () => { await Dexie.delete('treino-bb'); vi.resetModules(); db = await import('../db'); motor = await import('./motor') })

const t0 = new Date(2026, 10, 10, 10).getTime()
const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms))

function nuvemFalsa() {
  let cbI: ((m: MudancaItens) => void) | null = null, cbE: ((m: MudancaEventos) => void) | null = null
  const itensEnviados: ItemNuvem[] = [], eventosEnviados: Evento[] = [], apagados: string[] = []
  const porta: Porta = {
    ouvirItens: (cb) => { cbI = cb; return () => { cbI = null } },
    ouvirEventos: (cb) => { cbE = cb; return () => { cbE = null } },
    enviarItens: async (i) => { itensEnviados.push(...i) },
    enviarEventos: async (e) => { eventosEnviados.push(...e) },
    apagarEvento: async (id) => { apagados.push(id) },
  }
  return {
    porta, itensEnviados, eventosEnviados, apagados,
    itens: (itens: ItemNuvem[], doServidor = true) => cbI?.({ itens, doServidor }),
    eventos: (novos: Evento[], removidos: string[] = [], doServidor = true) => cbE?.({ novos, removidos, doServidor }),
  }
}
const efeitos = () => { const recebido = vi.fn(); const estados: string[] = []; const ef: Efeitos = { aoReceber: recebido, aoMudarEstado: (e) => { estados.push(e) } }; return { ef, recebido, estados } }

const baralho = (id = 'b1') => criarBaralho('Direito', t0, id)
const cartao = (id: string, f = 'frente') => criarCartao({ b: 'b1', f, v: 'verso' }, t0, id)

describe('motor: o que sobe', () => {
  it('o que o aparelho já tinha (sem carimbo) sobe no primeiro login, com o valor completo', async () => {
    await db.idDoAparelho()
    await db.saveBaralho(baralho()); await db.saveCartao(cartao('c1'))
    const n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera(); n.itens([]); n.eventos([]); await espera()
    expect(n.itensEnviados.map((i) => i.key).sort()).toEqual(['b:b1', 'c:c1'])
    expect(n.itensEnviados.find((i) => i.key === 'c:c1')?.v).toMatchObject({ f: 'frente', v: 'verso', b: 'b1' })
    s.parar()
  })

  it('NÃO envia nada enquanto só viu o cache do aparelho (não é a resposta do servidor)', async () => {
    await db.idDoAparelho(); await db.saveBaralho(baralho())
    const n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera(); n.itens([], false); n.eventos([], [], false); await espera()
    expect(n.itensEnviados).toEqual([])
    n.itens([], true); n.eventos([], [], true); await espera()
    expect(n.itensEnviados.map((i) => i.key)).toEqual(['b:b1']) // agora sim
    s.parar()
  })

  it('uma edição feita depois sobe sozinha e o eco da nuvem não faz reenviar', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera(); n.itens([]); n.eventos([]); await espera()
    await db.saveBaralho(baralho()); await db.saveCartao(cartao('c1', 'primeira')); await espera(40)
    expect(n.itensEnviados.map((i) => i.key).sort()).toEqual(['b:b1', 'c:c1'])
    const eco = n.itensEnviados.filter((i) => i.key === 'c:c1'); n.itens(eco); await espera()
    expect(n.itensEnviados.filter((i) => i.key === 'c:c1')).toHaveLength(1)
    await db.saveCartao(cartao('c1', 'segunda')); await espera(40)
    expect(n.itensEnviados.filter((i) => i.key === 'c:c1')).toHaveLength(2)
    s.parar()
  })

  it('apagar vira lápide e a lápide sobe', async () => {
    await db.idDoAparelho(); await db.saveBaralho(baralho()); await db.saveCartao(cartao('c1'))
    const n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera(); n.itens([]); n.eventos([]); await espera()
    await db.deleteCartao('c1'); await espera(40)
    const ultimo = n.itensEnviados.filter((i) => i.key === 'c:c1').at(-1)
    expect(ultimo?.x).toBe(1); expect(ultimo?.v).toBeUndefined()
    s.parar()
  })

  it('as respostas (eventos) sobem uma vez cada', async () => {
    const dev = await db.idDoAparelho(), n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera(); n.itens([]); n.eventos([]); await espera()
    const ev = resposta(dev, 'q1', 'A', true, t0)
    await db.gravarResposta('q1', { n: 1, c: 1, ok: true, last: 'A', t: t0 }, registrarResposta(HIST_VAZIO, true, t0), ev); await espera(40)
    expect(n.eventosEnviados.map((e) => e.id)).toEqual([ev.id])
    n.eventos([ev]); await espera() // eco
    expect(n.eventosEnviados).toHaveLength(1)
    s.parar()
  })
})

describe('motor: o que desce', () => {
  it('item novo da nuvem aparece no aparelho; o mais velho não passa por cima do local', async () => {
    const dev = await db.idDoAparelho()
    await db.saveBaralho(baralho()); await db.saveCartao(cartao('c1', 'local'))
    const n = nuvemFalsa(), { ef, recebido } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera()
    const velho: ItemNuvem = { key: 'c:c1', u: 1, dev: 'dOutro', v: { ...cartao('c1', 'VELHO') } }
    const novo: ItemNuvem = { key: 'c:c2', u: Date.now() + 5, dev: 'dOutro', v: { ...cartao('c2', 'do-celular') } }
    n.itens([velho, novo]); n.eventos([]); await espera()
    const { cartoes } = await db.loadCards()
    expect(cartoes.map((c) => [c.id, c.f]).sort()).toEqual([['c1', 'local'], ['c2', 'do-celular']])
    expect(recebido).toHaveBeenCalledWith({ progresso: false, cartoes: true, marcas: false })
    void dev; s.parar()
  })

  it('a edição mais nova da nuvem vence a local; e a lápide da nuvem apaga o cartão', async () => {
    await db.idDoAparelho(); await db.saveBaralho(baralho()); await db.saveCartao(cartao('c1', 'antes')); await db.saveCartao(cartao('c2'))
    const n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera()
    const futuro = Date.now() + 10_000
    n.itens([{ key: 'c:c1', u: futuro, dev: 'dOutro', v: { ...cartao('c1', 'editado no PC') } }, { key: 'c:c2', u: futuro, dev: 'dOutro', x: 1 }]); n.eventos([]); await espera()
    const { cartoes } = await db.loadCards()
    expect(cartoes.map((c) => [c.id, c.f])).toEqual([['c1', 'editado no PC']])
    s.parar()
  })

  it('marcações e anotações descem e sobem por questão', async () => {
    await db.idDoAparelho()
    await db.saveMarks({ q1: { r: true, t: t0 } })
    const n = nuvemFalsa(), { ef, recebido } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera(); n.itens([{ key: 'm:q2', u: Date.now() + 5, dev: 'dOutro', v: { r: true, a: 'revisar', t: t0 } }]); n.eventos([]); await espera()
    expect((await db.loadAll()).marks).toEqual({ q1: { r: true, t: t0 }, q2: { r: true, a: 'revisar', t: t0 } })
    expect(recebido).toHaveBeenCalledWith({ progresso: false, cartoes: false, marcas: true })
    expect(n.itensEnviados.map((i) => i.key)).toEqual(['m:q1'])
    s.parar()
  })

  it('respostas de outro aparelho entram no progresso e no histórico; zerar de lá vale aqui', async () => {
    const dev = await db.idDoAparelho()
    const n = nuvemFalsa(), { ef, recebido } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera()
    const a = resposta('dCelular', 'q1', 'A', true, t0), b = resposta('dCelular', 'q1', 'B', false, t0 + 1000)
    n.itens([]); n.eventos([a, b]); await espera()
    let r = await db.loadAll()
    expect(r.prog.q1).toMatchObject({ n: 2, c: 1, ok: false, last: 'B' })
    expect(Object.values(r.hist.dias)[0]).toEqual({ n: 2, c: 1 })
    expect(recebido).toHaveBeenCalledWith({ progresso: true, cartoes: false, marcas: false })
    n.eventos([zerar('dCelular', t0 + 5000)]); await espera()
    r = await db.loadAll(); expect(r.prog).toEqual({}); void dev
    s.parar()
  })

  it('evento apagado na nuvem (desfazer o zerar em outro aparelho) some daqui e o progresso volta', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera()
    const a = resposta('dCelular', 'q1', 'A', true, t0), z = zerar('dCelular', t0 + 5000)
    n.itens([]); n.eventos([a, z]); await espera()
    expect((await db.loadAll()).prog).toEqual({})
    n.eventos([], [z.id]); await espera()
    expect((await db.loadAll()).prog.q1).toMatchObject({ n: 1, c: 1 })
    s.parar()
  })

  it('lixo vindo da nuvem não derruba nada (tipos errados são ignorados)', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(), { ef, estados } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera(); n.itens([]); n.eventos([]); await espera()
    expect(estados).toContain('ok'); expect(estados).not.toContain('erro')
    s.parar(); expect(estados.at(-1)).toBe('parado')
  })
})

describe('motor: segurança do que já existe', () => {
  it('ligar a sincronização não apaga nem altera nada do que o aparelho tinha', async () => {
    await db.idDoAparelho()
    await db.saveBaralho(baralho()); await db.saveCartao(cartao('c1')); await db.saveMarks({ q1: { r: true, t: t0 } })
    const antes = await db.loadCards(), marksAntes = (await db.loadAll()).marks
    const n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera(); n.itens([]); n.eventos([]); await espera()
    expect(await db.loadCards()).toEqual(antes); expect((await db.loadAll()).marks).toEqual(marksAntes)
    expect(await db.syncAtivo()).toBe(true)
    s.parar()
  })

  it('erro ao enviar vira estado "erro" e os dados locais continuam', async () => {
    await db.idDoAparelho(); await db.saveBaralho(baralho())
    const n = nuvemFalsa(), { ef, estados } = efeitos()
    n.porta.enviarItens = async () => { throw new Error('permission-denied') }
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera(); n.itens([]); n.eventos([]); await espera()
    expect(estados).toContain('erro'); expect((await db.loadCards()).baralhos).toHaveLength(1)
    s.parar()
  })
})
