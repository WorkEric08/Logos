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
    // o zerar FICA (uma exclusão não chegaria a quem lê só o que é novo): quem o anula é o evento "desfeito"
    const evs = await db.lerEventos()
    expect(evs.filter((e) => e.k === 'z')).toHaveLength(1); expect(evs.filter((e) => e.k === 'd').map((e) => (e as { z: string }).z)).toEqual([z.id])
    expect((await db.desfazerZerar(z.id)).prog).toEqual(d.prog); expect((await db.lerEventos()).filter((e) => e.k === 'd')).toHaveLength(1) // desfazer de novo não duplica
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

describe('banco: carimbos da conta Google (tabela sinc, v4)', () => {
  const baralho = (id: string) => ({ id, nome: 'Direito', criado: t0 })
  const cartao = (id: string, b = 'b1') => ({ id, b, f: 'f', v: 'v', criado: t0, estado: 'novo' as const, due: 0, ivl: 0, fac: 2.5, reps: 0, lapsos: 0, ult: 0 })

  it('cada gravação carimba o item; dois carimbos seguidos nunca empatam', async () => {
    await db.idDoAparelho()
    await db.saveBaralho(baralho('b1')); await db.saveCartao(cartao('c1'))
    const antes = (await db.lerSinc()).find((s) => s.id === 'c:c1')!
    await db.saveCartao({ ...cartao('c1'), f: 'editado' })
    const depois = (await db.lerSinc()).find((s) => s.id === 'c:c1')!
    expect(depois.u).toBeGreaterThan(antes.u); expect(depois.dev).toBe(await db.idDoAparelho())
  })

  it('apagar um baralho deixa lápide do baralho e de cada cartão dele (e some do que a tela lê)', async () => {
    await db.idDoAparelho()
    await db.saveBaralho(baralho('b1')); await db.saveBaralho(baralho('b2')); await db.saveCartao(cartao('c1')); await db.saveCartao(cartao('c2', 'b2'))
    await db.deleteBaralho('b1')
    const lapides = (await db.lerSinc()).filter((s) => s.x).map((s) => s.id).sort()
    expect(lapides).toEqual(['b:b1', 'c:c1'])
    const d = await db.loadCards(); expect(d.baralhos.map((b) => b.id)).toEqual(['b2']); expect(d.cartoes.map((c) => c.id)).toEqual(['c2'])
  })

  it('marcações: só o que mudou é carimbado; remover vira lápide', async () => {
    await db.idDoAparelho()
    await db.saveMarks({ q1: { r: true, t: t0 }, q2: { r: true, t: t0 } })
    const u1 = (await db.lerSinc()).find((s) => s.id === 'm:q1')!.u
    await db.saveMarks({ q1: { r: true, t: t0 } }) // q2 saiu; q1 igual
    const s = await db.lerSinc()
    expect(s.find((x) => x.id === 'm:q1')!.u).toBe(u1)
    expect(s.find((x) => x.id === 'm:q2')!.x).toBe(1)
  })

  it('semear: o que existia antes da conta ganha carimbo (com a data do próprio item), uma vez só, sem mexer nos dados', async () => {
    await db.idDoAparelho()
    await db.saveBaralho(baralho('b1')); await db.saveCartao({ ...cartao('c1'), ult: t0 + 5 }); await db.saveMarks({ q1: { r: true, t: t0 + 9 } }); await db.saveAjustes({ limite: 7, dia: '', novos: 0 })
    const cru = new Dexie('treino-bb'); await cru.open(); await cru.table('sinc').clear(); cru.close() // como se os dados fossem de antes da conta: sem carimbo
    const antes = await db.loadCards(), marksAntes = (await db.loadAll()).marks
    expect(await db.semearSinc()).toBe(4)
    const s = Object.fromEntries((await db.lerSinc()).map((x) => [x.id, x.u]))
    expect(s).toEqual({ 'b:b1': t0, 'c:c1': t0 + 5, 'm:q1': t0 + 9, fc: 1 })
    expect(await db.semearSinc()).toBe(0) // segunda vez: nada novo
    expect(await db.loadCards()).toEqual(antes); expect((await db.loadAll()).marks).toEqual(marksAntes)
  })

  it('aplicar da nuvem: item mais velho que o local é ignorado; lápide mais nova apaga; cartão de baralho apagado não fica solto', async () => {
    await db.idDoAparelho(); await db.saveBaralho(baralho('b1')); await db.saveCartao(cartao('c1'))
    const futuro = Date.now() + 60_000
    await db.aplicarItens([{ key: 'c:c1', u: 1, dev: 'dX', v: { ...cartao('c1'), f: 'VELHO' } }])
    expect((await db.loadCards()).cartoes[0].f).toBe('f')
    await db.aplicarItens([{ key: 'b:b1', u: futuro, dev: 'dX', x: 1 }])
    const d = await db.loadCards(); expect(d.baralhos).toEqual([]); expect(d.cartoes).toEqual([]) // o cartão não fica órfão
  })

  it('aplicar eventos refaz progresso e histórico e não duplica o que já existe', async () => {
    const dev = await db.idDoAparelho()
    const ev = resposta(dev, 'q1', 'A', true, t0)
    await db.gravarResposta('q1', prog1(true), histCom(1), ev)
    const outro = resposta('dOutro', 'q1', 'B', false, t0 + 1000)
    expect(await db.aplicarEventos([ev, outro], [])).toBe(true)
    expect((await db.loadAll()).prog.q1).toMatchObject({ n: 2, c: 1, ok: false })
    expect(await db.aplicarEventos([ev, outro], [])).toBe(false) // repetir não muda nada
    expect((await db.lerEventos()).length).toBe(2)
  })
})

describe('banco: materiais de estudo (v6)', () => {
  const prep = async (e: string, nome: string, par: string[]) => { const { prepararMaterial } = await import('../core/material'); const r = prepararMaterial(e, nome, 'texto', par); if (!r.ok) throw new Error(r.erro); return r }

  it('guarda o material e os trechos juntos e lista por espaço (mais novo primeiro)', async () => {
    const a = await prep('e1', 'Resumo A', ['um', 'dois', 'tres']), b = await prep('e1', 'Resumo B', ['quatro']), c = await prep('e2', 'Outro', ['cinco'])
    expect(await db.salvarMaterial({ ...a.material, criado: 1 }, a.trechos)).toBe(true); await db.salvarMaterial({ ...b.material, criado: 2 }, b.trechos); await db.salvarMaterial(c.material, c.trechos)
    expect((await db.listarMateriais('e1')).map((m) => m.nome)).toEqual(['Resumo B', 'Resumo A'])
    expect((await db.lerTrechos('e1')).map((t) => t.t).sort()).toEqual(['dois', 'quatro', 'tres', 'um']); expect(await db.lerTrechos('e2')).toHaveLength(1)
  })
  it('guardar o mesmo material de novo (mesmo conteúdo, mesmo espaço) não duplica e avisa', async () => {
    const a = await prep('e1', 'Resumo', ['um', 'dois'])
    expect(await db.salvarMaterial(a.material, a.trechos)).toBe(true); expect(await db.salvarMaterial(a.material, a.trechos)).toBe(false)
    expect(await db.listarMateriais('e1')).toHaveLength(1); expect(await db.lerTrechos('e1')).toHaveLength(2)
  })
  it('apagar um material leva os trechos dele e só os dele', async () => {
    const a = await prep('e1', 'A', ['um', 'dois']), b = await prep('e1', 'B', ['tres'])
    await db.salvarMaterial(a.material, a.trechos); await db.salvarMaterial(b.material, b.trechos)
    await db.apagarMaterial(a.material.id)
    expect((await db.listarMateriais('e1')).map((m) => m.nome)).toEqual(['B']); expect((await db.lerTrechos('e1')).map((t) => t.t)).toEqual(['tres'])
  })
  it('apagar o espaço leva os materiais e os trechos dele (cascata) e não toca nos de outro espaço', async () => {
    const a = await prep('e1', 'A', ['um']), c = await prep('e2', 'C', ['dois'])
    await db.salvarMaterial(a.material, a.trechos); await db.salvarMaterial(c.material, c.trechos)
    await db.apagarEspaco('e1')
    expect(await db.listarMateriais('e1')).toEqual([]); expect(await db.lerTrechos('e1')).toEqual([]); expect(await db.listarMateriais('e2')).toHaveLength(1)
  })
  it('a versão dos materiais sobe a cada mudança (o índice de busca usa isso para saber que ficou velho)', async () => {
    const v0 = db.versaoMateriais(); const a = await prep('e1', 'A', ['um'])
    await db.salvarMaterial(a.material, a.trechos); const v1 = db.versaoMateriais(); await db.apagarMaterial(a.material.id)
    expect(v1).toBeGreaterThan(v0); expect(db.versaoMateriais()).toBeGreaterThan(v1)
  })
  it('migração: um banco v5 (sem materiais) abre na v6 sem perder o progresso', async () => {
    await Dexie.delete('treino-bb')
    const velho = new Dexie('treino-bb')
    velho.version(5).stores({ prog: 'id', meta: 'key', decks: 'id', cards: 'id, b', eventos: 'id, [dev+t]', sinc: 'id', espacos: 'id', questoes: 'id, e', imagens: 'id, e' })
    await velho.open(); await velho.table('prog').put({ id: 'q1', n: 2, c: 1, ok: true }); velho.close()
    await abrir()
    expect((await db.loadAll()).prog.q1).toMatchObject({ n: 2, c: 1 }); expect(await db.listarMateriais('e1')).toEqual([])
  })
})

// C-10: o enunciado de uma questão importada se perdia ao gravar (a tabela usa `e` para o id do ESPAÇO e `Question.e` é o ENUNCIADO)
describe('banco: questões de espaços guardam o enunciado (C-10)', () => {
  const row = { id: 'e1', nome: 'Direito', criado: 1, fontes: {}, bases: {}, materias: [], extras: [], bancos: [], simulado: null }
  const q = (id: string, e: string) => ({ id, y: 2026, s: 'dir-2026', n: 1, m: 'Civil', t: 'Geral', a: '', e, b: '', o: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, g: 'A' as const, p: null, bp: null, f: 0 as const, ol: 0 as const })
  it('salvar e reler (inclusive depois de "fechar e abrir o app") devolve o enunciado inteiro', async () => {
    await db.salvarEspaco(row, [q('u1', 'Qual é o prazo?'), q('u2', 'Segunda pergunta com acentuação: ação')])
    expect((await db.lerEspaco('e1'))?.questoes.map((x) => x.e).sort()).toEqual(['Qual é o prazo?', 'Segunda pergunta com acentuação: ação'])
    await abrir()
    const r = await db.lerEspaco('e1')
    expect(r?.questoes.find((x) => x.id === 'u1')).toMatchObject({ e: 'Qual é o prazo?', g: 'A', m: 'Civil' }); expect((await db.contarSemEnunciado()).total).toBe(0)
  })
  it('a cópia de segurança leva o enunciado e o devolve', async () => {
    await db.salvarEspaco(row, [q('u1', 'Pergunta que não pode sumir')])
    const c = await db.lerConteudoDoAparelho()
    expect(c.questoes[0]).toMatchObject({ e: 'e1', enun: 'Pergunta que não pode sumir' })
    await Dexie.delete('treino-bb'); await abrir()
    await db.acrescentarConteudoDoAparelho(c)
    expect((await db.lerEspaco('e1'))?.questoes[0].e).toBe('Pergunta que não pode sumir')
  })
})

// ---------- F6.2: Dexie v8 (tabelas novas, migração por cópia) ----------
const V7 = { prog: 'id', meta: 'key', decks: 'id', cards: 'id, b', eventos: 'id, [dev+t]', sinc: 'id', espacos: 'id', questoes: 'id, e', imagens: 'id, e', materiais: 'id, e', trechos: 'id, m, e', conversa: 'id' }
/** Um banco como o app v7 deixava (sem as tabelas novas), com dados dentro. */
async function criarBancoV7(c: { questoes?: unknown[]; espacos?: unknown[]; imagens?: unknown[]; materiais?: unknown[]; trechos?: unknown[]; prog?: unknown[]; cards?: unknown[]; decks?: unknown[] }) {
  await Dexie.delete('treino-bb')
  const v7 = new Dexie('treino-bb'); v7.version(7).stores(V7); await v7.open()
  for (const [tabela, linhas] of Object.entries(c)) if (linhas?.length) await v7.table(tabela).bulkPut(linhas)
  v7.close()
}
const rowE = (id: string, nome: string) => ({ id, nome, criado: 5, fontes: { 'dir-2026': 'Direito 2026' }, bases: {}, materias: [], extras: [], bancos: [{ id: 'dir', nome: 'Direito' }], simulado: null })
const qq = (id: string, e: string, extra = {}) => ({ id, y: 2026, s: 'dir-2026', n: 1, m: 'Civil', t: 'Geral', a: '', e, b: '', o: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, g: 'A' as const, p: null, bp: null, f: 0 as const, ol: 0 as const, ...extra })
const imagem = (bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })

describe('banco v8: migração da v7 por cópia (F6.2)', () => {
  it('linha ANTIGA (sem `enun`, o enunciado já tinha sido sobrescrito) vira questão sem enunciado, é contada; importar de novo conserta', async () => {
    await criarBancoV7({ questoes: [{ ...qq('uvelha', ''), e: 'e1' }], espacos: [rowE('e1', 'Direito')] })
    await abrir()
    expect((await db.lerEspaco('e1'))?.questoes[0]).toMatchObject({ id: 'uvelha', e: '' })
    expect(await db.contarSemEnunciado()).toEqual({ total: 1, porEspaco: { e1: 1 } })
    await db.salvarEspaco(rowE('e1', 'Direito'), [qq('uvelha', 'Enunciado de novo')]) // importar a prova outra vez (mesmo id por conteúdo)
    expect((await db.lerEspaco('e1'))?.questoes[0].e).toBe('Enunciado de novo'); expect((await db.contarSemEnunciado()).total).toBe(0)
  })
  it('copia espaços, questões (com enunciado salvo ou perdido), imagens e materiais para as tabelas novas; as ANTIGAS ficam intactas; progresso e cartões também', async () => {
    await criarBancoV7({
      espacos: [rowE('e1', 'Direito'), rowE('e2', 'Civil')],
      questoes: [{ ...qq('u1', 'e1'), enun: 'Enunciado salvo pelo conserto' }, { ...qq('u2', 'e1'), enun: undefined }, { ...qq('u3', 'e2'), enun: 'Outra' }],
      imagens: [{ id: 'u1', e: 'e1', blob: imagem([1, 2, 3]) }],
      materiais: [{ id: 'Mx', e: 'e1', nome: 'Resumo', tipo: 'texto', criado: 1, trechos: 1, caracteres: 5 }], trechos: [{ id: 'Mx:0', m: 'Mx', e: 'e1', i: 0, t: 'texto' }],
      prog: [{ id: 'u1', n: 2, c: 1, ok: true, last: 'A', t: 9 }],
    })
    await abrir()
    const e1 = await db.lerEspaco('e1'), e2 = await db.lerEspaco('e2')
    expect(e1?.questoes.map((x) => x.id).sort()).toEqual(['u1', 'u2']); expect(e1?.questoes.find((x) => x.id === 'u1')?.e).toBe('Enunciado salvo pelo conserto')
    expect(e1?.questoes.find((x) => x.id === 'u2')?.e).toBe('') // a que já estava sem enunciado continua assim (e é contada)
    expect(e2?.questoes.map((x) => x.id)).toEqual(['u3']); expect((await db.listarEspacos()).map((x) => [x.id, x.n]).sort()).toEqual([['e1', 2], ['e2', 1]])
    expect(await db.contarSemEnunciado()).toEqual({ total: 1, porEspaco: { e1: 1 } })
    expect(await db.lerImagem('u1')).not.toBeNull(); expect((await db.listarMateriais('e1'))[0].nome).toBe('Resumo'); expect((await db.trechosDoMaterial('Mx')).map((t) => t.t)).toEqual(['texto'])
    expect((await db.loadAll()).prog.u1).toMatchObject({ n: 2, c: 1 })
    // as tabelas antigas continuam como estavam (nada foi apagado)
    const raw = new Dexie('treino-bb'); await raw.open()
    expect(await raw.table('questoes').count()).toBe(3); expect(await raw.table('imagens').count()).toBe(1); expect(raw.verno).toBe(8); raw.close()
  })
  it('abrir de novo depois de migrada não copia nem duplica nada', async () => {
    await criarBancoV7({ espacos: [rowE('e1', 'Direito')], questoes: [{ ...qq('u1', 'e1'), enun: 'A' }] })
    await abrir(); await abrir()
    expect((await db.lerEspaco('e1'))?.questoes).toHaveLength(1)
  })
  it('a MESMA questão em dois espaços são duas linhas: apagar um espaço não mexe no outro (chave composta)', async () => {
    await db.salvarEspaco(rowE('e1', 'Direito'), [qq('uigual', 'Pergunta compartilhada'), qq('uso1', 'Só do 1')])
    await db.salvarEspaco(rowE('e2', 'Civil'), [qq('uigual', 'Pergunta compartilhada')])
    await db.gravarImagem('uigual', 'e1', imagem([9])); await db.gravarImagem('uigual', 'e2', imagem([9]))
    expect((await db.lerEspaco('e1'))?.questoes.map((x) => x.id).sort()).toEqual(['uigual', 'uso1']); expect((await db.lerEspaco('e2'))?.questoes.map((x) => x.id)).toEqual(['uigual'])
    await db.apagarEspaco('e1')
    expect(await db.lerEspaco('e1')).toBeNull(); expect((await db.lerEspaco('e2'))?.questoes[0]).toMatchObject({ id: 'uigual', e: 'Pergunta compartilhada' })
    expect(await db.lerImagem('uigual')).not.toBeNull() // a imagem do e2 ficou
  })
})

describe('banco v8: pacotes e carimbos da sincronização (F6.2)', () => {
  const chaves = async () => (await db.lerSinc()).map((x) => x.id + (x.x ? '#x' : '')).sort()
  it('salvar um espaço com questões registra os pacotes (um por prova) e carimba o espaço e os pacotes na mesma transação', async () => {
    await db.salvarEspaco(rowE('e1', 'Direito'), [qq('u1', 'A'), qq('u2', 'B'), qq('u3', 'C', { s: 'outra-2026' })])
    const c = await chaves()
    expect(c.filter((k) => k.startsWith('e:'))).toEqual(['e:e1']); expect(c.filter((k) => k.startsWith('p:q-e1-'))).toHaveLength(2)
    const vs = await db.valoresDe(await db.lerSinc())
    expect(vs.find((i) => i.key === 'e:e1')?.v).toEqual({ nome: 'Direito', criado: 5 })
    expect(vs.filter((i) => i.key.startsWith('p:')).map((i) => (i.v as { n: number }).n).sort()).toEqual([1, 2])
    expect(JSON.stringify(vs)).not.toContain('"d":') // o catálogo nunca leva o corpo
  })
  it('importar a MESMA prova de novo não cria pacote nem carimbo novo (mesmo conjunto = mesmo pacote)', async () => {
    const qs = [qq('u1', 'A'), qq('u2', 'B')]
    await db.salvarEspaco(rowE('e1', 'Direito'), qs); const antes = (await chaves()).filter((k) => k.startsWith('p:'))
    await db.salvarEspaco(rowE('e1', 'Direito'), [...qs].reverse())
    expect((await chaves()).filter((k) => k.startsWith('p:'))).toEqual(antes)
  })
  it('espaço "só neste aparelho" não gera pacote nem carimbo', async () => {
    await db.salvarEspaco({ ...rowE('e1', 'Privado'), local: true }, [qq('u1', 'A')])
    expect(await chaves()).toEqual([])
  })
  it('material: pacote e carimbo; apagar o material vira lápide do pacote', async () => {
    await db.salvarEspaco(rowE('e1', 'Direito'), [])
    await db.salvarMaterial({ id: 'Mx', e: 'e1', nome: 'Resumo', tipo: 'texto', criado: 1, trechos: 2, caracteres: 10 }, [{ id: 'Mx:0', m: 'Mx', e: 'e1', i: 0, t: 'um' }, { id: 'Mx:1', m: 'Mx', e: 'e1', i: 1, t: 'dois' }])
    expect(await chaves()).toContain('p:m-Mx-0')
    await db.apagarMaterial('Mx')
    expect(await chaves()).toContain('p:m-Mx-0#x')
  })
  it('apagar o espaço põe lápide no espaço e nos pacotes; desfazer a importação põe lápide só no pacote que ficou vazio', async () => {
    const r1 = rowE('e1', 'Direito')
    await db.salvarEspaco(r1, [qq('u1', 'A')]); await db.salvarEspaco(r1, [qq('u2', 'B', { s: 'outra-2026' })])
    expect((await chaves()).filter((k) => k.startsWith('p:'))).toHaveLength(2)
    await db.removerQuestoesDoEspaco(['u2'], r1) // desfaz a 2ª importação
    expect((await chaves()).filter((k) => k.endsWith('#x'))).toHaveLength(1); expect((await db.lerEspaco('e1'))?.questoes.map((x) => x.id)).toEqual(['u1'])
    await db.apagarEspaco('e1')
    expect((await db.lerSinc()).every((x) => x.x === 1)).toBe(true); expect(await db.lerEspaco('e1')).toBeNull()
  })
  it('semear o carimbo (1º login) cria pacotes e carimbos para o que o aparelho já tinha, uma vez só', async () => {
    await criarBancoV7({ espacos: [rowE('e1', 'Direito'), { ...rowE('e2', 'Privado'), local: true }], questoes: [{ ...qq('u1', 'e1'), enun: 'A' }, { ...qq('u2', 'e2'), enun: 'B' }],
      materiais: [{ id: 'Mx', e: 'e1', nome: 'Resumo', tipo: 'texto', criado: 1, trechos: 1, caracteres: 5 }], trechos: [{ id: 'Mx:0', m: 'Mx', e: 'e1', i: 0, t: 'texto' }] })
    await abrir()
    expect(await db.semearSinc()).toBeGreaterThan(0)
    const c = await chaves()
    expect(c).toContain('e:e1'); expect(c.some((k) => k.startsWith('p:q-e1-'))).toBe(true); expect(c).toContain('p:m-Mx-0'); expect(c.some((k) => k.includes('e2'))).toBe(false) // o espaço privado não sobe
    expect(await db.semearSinc()).toBe(0)
  })
})
