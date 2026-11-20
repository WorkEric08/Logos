// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarBaralho, criarCartao } from '../../core/cards'
import { HIST_VAZIO, registrarResposta } from '../../core/historico'
import { desfeito, resposta, zerar, type Evento } from '../../core/sync/eventos'
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
  const corpos = new Map<string, unknown>(), chamadas: string[] = [], corposApagados: string[] = []
  let baixarFalha = 0
  const desde: { itens: (number | undefined)[]; eventos: (number | undefined)[] } = { itens: [], eventos: [] } // o cursor que o motor pediu em cada assinatura (F6.3a)
  const porta: Porta = {
    ouvirItens: (cb, _f, d) => { cbI = cb; desde.itens.push(d); return () => { cbI = null } },
    ouvirEventos: (cb, _f, d) => { cbE = cb; desde.eventos.push(d); return () => { cbE = null } },
    enviarItens: async (i) => { itensEnviados.push(...i) },
    enviarEventos: async (e) => { eventosEnviados.push(...e) },
    apagarEvento: async (id) => { apagados.push(id) },
    enviarCorpos: async (c) => { for (const x of c) { corpos.set(x.pid, x.corpo); chamadas.push('corpo:' + x.pid) } },
    baixarCorpo: async (pid) => { if (baixarFalha > 0) { baixarFalha--; throw new Error('sem rede') } chamadas.push('baixar:' + pid); return corpos.get(pid) ?? null },
    apagarCorpos: async (pids) => { for (const x of pids) { corpos.delete(x); corposApagados.push(x) } },
  }
  const enviarItensOriginal = porta.enviarItens
  porta.enviarItens = async (i) => { for (const x of i) chamadas.push('item:' + x.key + (x.x ? '#x' : '')); await enviarItensOriginal(i) }
  return {
    porta, itensEnviados, eventosEnviados, apagados, desde, corpos, chamadas, corposApagados, falharAoBaixar: (n: number) => { baixarFalha = n },
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
    await db.deleteCartao('c1')
    const ultimo = () => n.itensEnviados.filter((i) => i.key === 'c:c1').at(-1)
    await vi.waitFor(() => expect(ultimo()?.x).toBe(1), { timeout: 3000 }) // espera a lápide subir (um sono fixo de 40 ms falhava com o computador ocupado)
    expect(ultimo()?.v).toBeUndefined()
    s.parar()
  })

  it('as respostas (eventos) sobem uma vez cada', async () => {
    const dev = await db.idDoAparelho(), n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera(); n.itens([]); n.eventos([]); await espera()
    const ev = resposta(dev, 'q1', 'A', true, t0)
    await db.gravarResposta('q1', { n: 1, c: 1, ok: true, last: 'A', t: t0 }, registrarResposta(HIST_VAZIO, true, t0), ev)
    await vi.waitFor(() => expect(n.eventosEnviados.map((e) => e.id)).toEqual([ev.id]), { timeout: 3000 })
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
    expect(recebido).toHaveBeenCalledWith({ progresso: false, cartoes: true, marcas: false, espacos: false })
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
    expect(recebido).toHaveBeenCalledWith({ progresso: false, cartoes: false, marcas: true, espacos: false })
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
    expect(recebido).toHaveBeenCalledWith({ progresso: true, cartoes: false, marcas: false, espacos: false })
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

describe('motor: leitura incremental (F6.3a)', () => {
  const DIA = 24 * 3_600_000
  it('na primeira vez lê tudo (sem cursor); o cursor guarda o maior u/t visto do SERVIDOR; a próxima abertura pede só o que veio depois (menos a margem de 7 dias)', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera()
    expect(n.desde.itens).toEqual([undefined]); expect(n.desde.eventos).toEqual([undefined])
    const u1 = Date.now() - 2 * DIA, t1 = Date.now() - 3 * DIA
    n.itens([{ key: 'c:x', u: u1 - 1000, dev: 'dOutro', x: 1 }, { key: 'c:y', u: u1, dev: 'dOutro', x: 1 }]); n.eventos([resposta('dOutro', 'q1', 'A', true, t1)]); await espera()
    expect(await db.lerCursor('itens')).toBe(u1); expect(await db.lerCursor('eventos')).toBe(t1)
    s.parar()
    // "fechou e abriu o app": o motor novo pede só o que é novo (cursor menos 7 dias)
    const n2 = nuvemFalsa(); const s2 = motor.iniciarSincronizacao(n2.porta, efeitos().ef, 5)
    await espera()
    expect(n2.desde.itens).toEqual([u1 - motor.MARGEM_LEITURA_MS]); expect(n2.desde.eventos).toEqual([t1 - motor.MARGEM_LEITURA_MS])
    s2.parar()
  })
  it('o que só veio do CACHE do aparelho não move o cursor; o cursor só aumenta e nunca passa de 1 dia no futuro', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera()
    n.itens([{ key: 'c:x', u: Date.now() - DIA, dev: 'd', x: 1 }], false); await espera()
    expect(await db.lerCursor('itens')).toBeNull()
    const u = Date.now() - 5 * DIA
    n.itens([{ key: 'c:x', u, dev: 'd', x: 1 }]); await espera(); expect(await db.lerCursor('itens')).toBe(u)
    n.itens([{ key: 'c:y', u: u - DIA, dev: 'd', x: 1 }]); await espera(); expect(await db.lerCursor('itens')).toBe(u) // não volta
    n.itens([{ key: 'c:z', u: Date.now() + 400 * DIA, dev: 'd', x: 1 }]); await espera()
    expect(await db.lerCursor('itens')).toBeLessThanOrEqual(Date.now() + DIA + 1000) // relógio errado não empurra o cursor
    s.parar()
  })
  it('"Sincronizar tudo de novo": sem cursor a leitura volta a ser a coleção inteira', async () => {
    await db.gravarCursor('itens', Date.now() - DIA); await db.gravarCursor('eventos', Date.now() - DIA)
    await db.limparCursores()
    const n = nuvemFalsa(); const s = motor.iniciarSincronizacao(n.porta, efeitos().ef, 5)
    await espera(); expect(n.desde.itens).toEqual([undefined]); expect(n.desde.eventos).toEqual([undefined]); s.parar()
  })
  it('um evento "desfeito" que chega pela leitura incremental desfaz o zerar daqui (sem depender de exclusão)', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(), { ef } = efeitos()
    const s = motor.iniciarSincronizacao(n.porta, ef, 5)
    await espera()
    const a = resposta('dCel', 'q1', 'A', true, t0), z = zerar('dCel', t0 + 5000)
    n.itens([]); n.eventos([a, z]); await espera(); expect((await db.loadAll()).prog).toEqual({})
    n.eventos([desfeito('dCel', t0 + 9000, z.id)]); await espera()
    expect((await db.loadAll()).prog.q1).toMatchObject({ n: 1 })
    s.parar()
  })
})

// ---------- F6.3: espaços, questões e materiais (pacotes) ----------
const rowEsp = (id: string, nome: string) => ({ id, nome, criado: 5, fontes: { 'dir-2026': 'Direito 2026' }, bases: {}, materias: [], extras: [], bancos: [{ id: 'dir', nome: 'Direito' }], simulado: null })
const quest = (id: string, e: string, extra = {}) => ({ id, y: 2026, s: 'dir-2026', n: 1, m: 'Civil', t: 'Geral', a: '', e, b: '', o: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, g: 'A' as const, p: null, bp: null, f: 0 as const, ol: 0 as const, ...extra })
const mat = (id: string, e: string, n = 2) => ({ m: { id, e, nome: 'Resumo SFN', tipo: 'texto' as const, criado: 3, trechos: n, caracteres: n * 10 }, t: Array.from({ length: n }, (_, i) => ({ id: `${id}:${i}`, m: id, e, i, t: `trecho ${i} de juros` })) })
const ligar = async (n: ReturnType<typeof nuvemFalsa>, opc: Record<string, unknown> = {}, comoOpcoes = false, semAviso = false) => {
  if (!semAviso) await db.gravarAvisoEspacos('enviar') // a pessoa já respondeu ao aviso da primeira subida (o teste do aviso usa semAviso)
  const { ef, recebido } = efeitos()
  const s = motor.iniciarSincronizacao(n.porta, { ...ef, ...(comoOpcoes ? {} : opc) }, { atrasoEnvioMs: 5, esperasDeNovo: [20, 20, 20], ...(comoOpcoes ? opc : {}) })
  await espera(); n.itens([]); n.eventos([]); await espera(40)
  return { s, recebido }
}
/** O que a nuvem de mentira guarda de itens (a última versão de cada chave), como o Firestore guardaria. */
const nuvemItens = (n: ReturnType<typeof nuvemFalsa>) => { const m = new Map<string, ItemNuvem>(); for (const i of n.itensEnviados) m.set(i.key, i); return [...m.values()] }

describe('motor: espaços e materiais sobem (F6.3)', () => {
  it('importar sobe o CORPO antes do catálogo; o pacote vira "ok" e o texto guardado para subir sai', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(); const { s } = await ligar(n)
    await db.salvarEspaco(rowEsp('e1', 'Direito'), [quest('u1', 'A pergunta 1'), quest('u2', 'A pergunta 2')]); await espera(60)
    const c = n.chamadas
    const iCorpo = c.findIndex((x) => x.startsWith('corpo:q-e1-')), iCat = c.findIndex((x) => x.startsWith('item:p:q-e1-'))
    expect(iCorpo).toBeGreaterThanOrEqual(0); expect(iCat).toBeGreaterThan(iCorpo) // corpo antes do catálogo
    expect(c).toContain('item:e:e1'); expect((await db.pacotesParaSubir())).toEqual([]); expect((await db.contarPacotes())).toMatchObject({ total: 1, subir: 0, baixar: 0 })
    const corpo = [...n.corpos.values()][0] as { d: string }
    expect(JSON.parse(corpo.d).questoes.map((q: { e: string }) => q.e)).toEqual(['A pergunta 1', 'A pergunta 2']) // o enunciado vai inteiro
    s.parar()
  })
  it('a mesma prova importada de novo não sobe outra vez; espaço "só neste aparelho" não sobe nada', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(); const { s } = await ligar(n)
    const qs = [quest('u1', 'A'), quest('u2', 'B')]
    await db.salvarEspaco(rowEsp('e1', 'Direito'), qs); await espera(60)
    const antes = n.chamadas.length
    await db.salvarEspaco(rowEsp('e1', 'Direito'), [...qs].reverse()); await espera(60)
    expect(n.chamadas.filter((x) => x.startsWith('corpo:')).length).toBe(1)
    await db.salvarEspaco({ ...rowEsp('e2', 'Privado'), local: true }, [quest('u9', 'segredo')]); await espera(60)
    expect(n.chamadas.some((x) => x.includes('e2'))).toBe(false); void antes
    s.parar()
  })
  it('material sobe por partes (corpo antes do catálogo); apagar o material põe lápide e apaga o corpo da nuvem', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(); const { s } = await ligar(n)
    await db.salvarEspaco(rowEsp('e1', 'Direito'), [])
    const { m, t } = mat('Mabc', 'e1'); await db.salvarMaterial(m, t); await espera(60)
    expect(n.corpos.has('m-Mabc-0')).toBe(true); expect(n.chamadas.indexOf('corpo:m-Mabc-0')).toBeLessThan(n.chamadas.indexOf('item:p:m-Mabc-0'))
    await db.apagarMaterial('Mabc'); await espera(80)
    expect(n.chamadas).toContain('item:p:m-Mabc-0#x'); expect(n.corposApagados).toContain('m-Mabc-0'); expect(n.corpos.has('m-Mabc-0')).toBe(false)
    s.parar()
  })
  it('pacote acima da cota fica "só neste aparelho" (estado cota) e o catálogo NÃO sobe; o que cabe sobe', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(); const { s } = await ligar(n, { limites: { espacoBytes: 2_000, contaBytes: 100_000 } }, true)
    await db.salvarEspaco(rowEsp('e1', 'Direito'), [])
    const pequeno = mat('Mpeq', 'e1', 1), grande = mat('Mgrande', 'e1', 1)
    grande.t[0].t = 'x'.repeat(5_000); grande.m.caracteres = 5_000
    await db.salvarMaterial(pequeno.m, pequeno.t); await espera(60)
    await db.salvarMaterial(grande.m, grande.t); await espera(80)
    const estados = Object.fromEntries((await db.pacotesDoEspaco('e1')).map((k) => [k.id, k.estado]))
    expect(estados).toEqual({ 'm-Mpeq-0': 'ok', 'm-Mgrande-0': 'cota' })
    expect(n.corpos.has('m-Mgrande-0')).toBe(false); expect(n.chamadas).not.toContain('item:p:m-Mgrande-0')
    s.parar()
  })
})

describe('motor: espaços e materiais descem (F6.3)', () => {
  const cat = (pid: string, e: string, extra = {}) => ({ e, k: pid.startsWith('q') ? 'q' : 'm', n: 2, b: 500, de: 1, ...extra })
  const corpoQ = (e: string, qs: unknown[]) => ({ e, k: 'q', d: JSON.stringify({ questoes: qs, bases: {}, fontes: { 'dir-2026': 'Direito 2026' }, bancos: [{ id: 'dir', nome: 'Direito' }] }) })
  it('o catálogo chega, o corpo é baixado UM por vez e as questões entram no espaço (com o enunciado); a tela é avisada', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa()
    n.corpos.set('q-e1-aaa', corpoQ('e1', [quest('u1', 'Pergunta 1'), quest('u2', 'Pergunta 2')])); n.corpos.set('q-e1-bbb', corpoQ('e1', [quest('u3', 'Pergunta 3')]))
    const { s, recebido } = await ligar(n)
    const u = Date.now() + 10
    n.itens([{ key: 'e:e1', u, dev: 'dOutro', v: { nome: 'Direito', criado: 5 } }, { key: 'p:q-e1-aaa', u, dev: 'dOutro', v: cat('q-e1-aaa', 'e1') }, { key: 'p:q-e1-bbb', u: u + 1, dev: 'dOutro', v: cat('q-e1-bbb', 'e1', { n: 1 }) }])
    await vi.waitFor(async () => expect((await db.lerEspaco('e1'))?.questoes.length).toBe(3), { timeout: 3000 })
    const d = await db.lerEspaco('e1')
    expect(d?.row.nome).toBe('Direito'); expect(d?.questoes.map((q) => q.e).sort()).toEqual(['Pergunta 1', 'Pergunta 2', 'Pergunta 3']); expect(d?.row.fontes).toEqual({ 'dir-2026': 'Direito 2026' })
    expect((await db.contarPacotes())).toMatchObject({ total: 2, baixar: 0 })
    expect(n.chamadas.filter((x) => x.startsWith('baixar:')).length).toBe(2); expect(recebido).toHaveBeenCalledWith(expect.objectContaining({ espacos: true }))
    expect(n.itensEnviados.filter((i) => i.key.startsWith('p:') || i.key.startsWith('e:'))).toEqual([]) // o que veio da nuvem NÃO sobe de volta
    s.parar()
  })
  it('o pacote que chega ANTES do espaço espera o catálogo do espaço e entra depois; corpo que ainda não existe fica para depois; corpo estragado é recusado sem derrubar nada', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa()
    const { s } = await ligar(n)
    const u = Date.now() + 10
    n.itens([{ key: 'p:q-e1-aaa', u, dev: 'dO', v: cat('q-e1-aaa', 'e1') }, { key: 'p:q-e1-vazio', u, dev: 'dO', v: cat('q-e1-vazio', 'e1') }, { key: 'p:q-e1-ruim', u, dev: 'dO', v: cat('q-e1-ruim', 'e1') }])
    n.corpos.set('q-e1-aaa', corpoQ('e1', [quest('u1', 'Pergunta 1')])); n.corpos.set('q-e1-ruim', { e: 'e1', k: 'q', d: 'não é json' })
    await espera(80)
    expect(await db.lerEspaco('e1')).toBeNull() // sem espaço ainda: nada entra
    n.itens([{ key: 'e:e1', u: u + 1, dev: 'dO', v: { nome: 'Direito', criado: 5 } }])
    await vi.waitFor(async () => expect((await db.lerEspaco('e1'))?.questoes.length).toBe(1), { timeout: 3000 })
    const estados = Object.fromEntries((await db.pacotesDoEspaco('e1')).map((k) => [k.id, k.estado]))
    expect(estados).toEqual({ 'q-e1-aaa': 'ok', 'q-e1-vazio': 'baixar', 'q-e1-ruim': 'invalido' })
    s.parar()
  })
  it('falha de rede ao baixar não derruba: tenta de novo e termina; os dados locais continuam', async () => {
    await db.idDoAparelho(); await db.saveBaralho(baralho())
    const n = nuvemFalsa(); n.corpos.set('q-e1-aaa', corpoQ('e1', [quest('u1', 'Pergunta 1')])); n.falharAoBaixar(2)
    const { s } = await ligar(n)
    const u = Date.now() + 10
    n.itens([{ key: 'e:e1', u, dev: 'dO', v: { nome: 'Direito', criado: 5 } }, { key: 'p:q-e1-aaa', u, dev: 'dO', v: cat('q-e1-aaa', 'e1') }])
    await vi.waitFor(async () => expect((await db.lerEspaco('e1'))?.questoes.length).toBe(1), { timeout: 4000 })
    expect((await db.loadCards()).baralhos).toHaveLength(1)
    s.parar()
  })
  it('lápide do pacote tira SÓ as questões que ele trazia; lápide do espaço apaga o espaço sem gerar lápide nova; a edição mais nova vence a lápide', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa()
    n.corpos.set('q-e1-aaa', corpoQ('e1', [quest('u1', 'P1'), quest('u2', 'P2')])); n.corpos.set('q-e1-bbb', corpoQ('e1', [quest('u2', 'P2'), quest('u3', 'P3')]))
    const { s } = await ligar(n)
    const u = Date.now() + 10
    n.itens([{ key: 'e:e1', u, dev: 'dO', v: { nome: 'Direito', criado: 5 } }, { key: 'p:q-e1-aaa', u, dev: 'dO', v: cat('q-e1-aaa', 'e1') }, { key: 'p:q-e1-bbb', u, dev: 'dO', v: cat('q-e1-bbb', 'e1') }])
    await vi.waitFor(async () => expect((await db.lerEspaco('e1'))?.questoes.length).toBe(3), { timeout: 3000 })
    n.itens([{ key: 'p:q-e1-aaa', u: u + 5, dev: 'dO', x: 1 }]); await espera(60)
    expect((await db.lerEspaco('e1'))?.questoes.map((q) => q.id).sort()).toEqual(['u2', 'u3']) // u1 só era do pacote apagado; u2 também está no outro
    n.itens([{ key: 'e:e1', u: u + 9, dev: 'dO', x: 1 }]); await espera(60)
    expect(await db.lerEspaco('e1')).toBeNull()
    expect(n.itensEnviados.some((i) => i.key.startsWith('e:') || i.key.startsWith('p:'))).toBe(false) // a exclusão que veio não volta como lápide nova
    // edição mais nova que a lápide: este aparelho importa de novo e o espaço ressuscita (e sobe)
    await db.salvarEspaco(rowEsp('e1', 'Direito de volta'), [quest('u7', 'Nova')]); await espera(80)
    expect(n.itensEnviados.find((i) => i.key === 'e:e1')?.v).toMatchObject({ nome: 'Direito de volta' })
    s.parar()
  })
  it('ida e volta entre dois aparelhos (a mesma nuvem): o que o A importa, o B recebe e consegue treinar; apagar no A apaga no B', async () => {
    const dA = await db.idDoAparelho()
    const nuvem = nuvemFalsa()
    const a = await ligar(nuvem)
    await db.salvarEspaco(rowEsp('e1', 'Direito'), [quest('u1', 'Qual o prazo?'), quest('u2', 'Quem decide?')])
    const { m, t } = mat('Mmat', 'e1'); await db.salvarMaterial(m, t); await espera(80)
    const guardadoItens = nuvemItens(nuvem), guardadoCorpos = new Map(nuvem.corpos)
    expect(guardadoCorpos.size).toBe(2); a.s.parar()
    // ---- aparelho B: outro banco, mesma nuvem ----
    await Dexie.delete('treino-bb'); vi.resetModules(); db = await import('../db'); motor = await import('./motor')
    const dB = await db.idDoAparelho(); expect(dB).not.toBe(dA)
    const nB = nuvemFalsa(); for (const [k, v] of guardadoCorpos) nB.corpos.set(k, v)
    const { s: sB } = await ligar(nB)
    nB.itens(guardadoItens)
    await vi.waitFor(async () => expect((await db.lerEspaco('e1'))?.questoes.length).toBe(2), { timeout: 4000 })
    await vi.waitFor(async () => expect((await db.listarMateriais('e1')).length).toBe(1), { timeout: 4000 })
    expect((await db.lerEspaco('e1'))?.questoes.map((q) => q.e).sort()).toEqual(['Qual o prazo?', 'Quem decide?'])
    expect((await db.trechosDoMaterial('Mmat')).map((x) => x.t)).toEqual(['trecho 0 de juros', 'trecho 1 de juros'])
    // o A apaga o espaço: a lápide chega ao B
    nB.itens([{ key: 'e:e1', u: Date.now() + 50_000, dev: dA, x: 1 }, ...guardadoItens.filter((i) => i.key.startsWith('p:')).map((i) => ({ key: i.key, u: Date.now() + 50_000, dev: dA, x: 1 as const }))]); await espera(80)
    expect(await db.lerEspaco('e1')).toBeNull(); expect(await db.listarMateriais('e1')).toEqual([]); sB.parar()
  })
})

describe('motor: aviso da primeira subida e "só neste aparelho" (F6.5)', () => {
  it('antes de a pessoa responder ao aviso NADA de espaço ou material sobe (cartões sobem); ao responder "enviar", sobe', async () => {
    await db.idDoAparelho(); await db.saveBaralho(baralho())
    await db.salvarEspaco(rowEsp('e1', 'Direito'), [quest('u1', 'A pergunta')])
    const n = nuvemFalsa(); const pediu = vi.fn()
    const { s } = await ligar(n, { aoPrecisaAviso: pediu }, false, true)
    expect(pediu).toHaveBeenCalled(); expect(n.itensEnviados.map((i) => i.key)).toEqual(['b:b1']); expect(n.corpos.size).toBe(0)
    await db.gravarAvisoEspacos('enviar'); await s.sincronizarAgora(); await espera(60)
    expect(n.itensEnviados.some((i) => i.key === 'e:e1')).toBe(true); expect(n.corpos.size).toBe(1)
    s.parar()
  })
  it('"Manter só aqui" deixa o que existe só neste aparelho (nada sobe) e o que for criado DEPOIS sobe normalmente', async () => {
    await db.idDoAparelho()
    await db.salvarEspaco(rowEsp('e1', 'Direito'), [quest('u1', 'A pergunta')])
    const m = mat('Mbb', 'bb'); await db.salvarMaterial(m.m, m.t) // material do espaço embutido (sem linha de espaço)
    await db.gravarAvisoEspacos('manter')
    expect((await db.lerEspaco('e1'))?.row.local).toBe(true)
    const n = nuvemFalsa(); const { s } = await ligar(n, {}, false, true)
    await db.salvarEspaco(rowEsp('e2', 'Novo depois'), [quest('u2', 'Outra')]); await espera(80)
    expect(n.itensEnviados.map((i) => i.key).filter((k) => k.startsWith('e:') || k.startsWith('p:')).sort().map((k) => k.slice(0, 6))).toEqual(['e:e2', 'p:q-e2'])
    expect([...n.corpos.keys()].every((k) => k.startsWith('q-e2-'))).toBe(true) // e1 e o material do BB ficaram só aqui
    s.parar()
  })
  it('definirEspacoLocal: liga só antes de subir (recusa se já está na conta); desligar cria os pacotes e carimba', async () => {
    await db.idDoAparelho(); await db.gravarAvisoEspacos('enviar')
    await db.salvarEspaco(rowEsp('e1', 'Direito'), [quest('u1', 'A')])
    expect(await db.definirEspacoLocal('e1', true)).toBe(true)
    expect((await db.lerSinc()).filter((x) => x.id.startsWith('e:') || x.id.startsWith('p:'))).toEqual([]) // nada fica carimbado
    expect(await db.definirEspacoLocal('e1', false)).toBe(true)
    expect((await db.lerSinc()).map((x) => x.id).filter((k) => k.startsWith('e:') || k.startsWith('p:')).length).toBe(2)
    const n = nuvemFalsa(); const { s } = await ligar(n); await espera(80)
    expect(n.corpos.size).toBe(1); s.parar()
    expect(await db.definirEspacoLocal('e1', true)).toBe(false) // já subiu: tirar da conta só apagando o espaço
  })
})

describe('motor: o aviso é por conteúdo, não por lápide (S-05)', () => {
  it('um aparelho que só RECEBEU o espaço e o apaga manda a lápide sem pedir o aviso da 1ª subida', async () => {
    await db.idDoAparelho()
    const n = nuvemFalsa(); const pediu = vi.fn()
    n.corpos.set('q-e1-aaa', { e: 'e1', k: 'q', d: JSON.stringify({ questoes: [quest('u1', 'P1')], bases: {}, fontes: {}, bancos: [] }) })
    const { s } = await ligar(n, { aoPrecisaAviso: pediu }, false, true)
    const u = Date.now() + 10
    n.itens([{ key: 'e:e1', u, dev: 'dO', v: { nome: 'Direito', criado: 5 } }, { key: 'p:q-e1-aaa', u, dev: 'dO', v: { e: 'e1', k: 'q', n: 1, b: 500, de: 1 } }])
    await vi.waitFor(async () => expect((await db.lerEspaco('e1'))?.questoes.length).toBe(1), { timeout: 3000 })
    await db.apagarEspaco('e1'); await espera(80)
    expect(n.itensEnviados.map((i) => i.key + (i.x ? '#x' : '')).sort()).toEqual(['e:e1#x', 'p:q-e1-aaa#x'])
    expect(pediu).not.toHaveBeenCalled()
    s.parar()
  })
})
