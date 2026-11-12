import { beforeEach, describe, expect, it, vi } from 'vitest'

// O banco e a preparação da sincronização são trocados por simulados: aqui se testa o que o ESTADO manda gravar (a gravação de verdade está em services/db.test.ts).
vi.mock('../services/db', () => ({
  loadAll: vi.fn(), replaceAll: vi.fn(), saveOne: vi.fn(), saveTema: vi.fn(), saveHist: vi.fn(), saveMarks: vi.fn(), askPersist: vi.fn(),
  gravarResposta: vi.fn(), gravarSimulado: vi.fn(), gravarZerar: vi.fn(), desfazerZerar: vi.fn(), refazerEventosDoAparelho: vi.fn(),
}))
vi.mock('../services/sync/preparar', () => ({ prepararSincronizacao: vi.fn() }))
import { desfazerZerar, gravarResposta, gravarSimulado, gravarZerar, loadAll, refazerEventosDoAparelho, replaceAll, saveHist, saveOne } from '../services/db'
import { prepararSincronizacao } from '../services/sync/preparar'
import { BANK, BY_ID, ID_MAP, useApp } from './app'
import { derivar, type Evento } from '../core/sync/eventos'
import type { ProgressMap } from '../core/types'

const VAZIO = { dias: {}, sims: [] }
const dados = (prog: ProgressMap = {}) => ({ prog, tema: 'auto', hist: { dias: {}, sims: [] as never[] }, marks: {} })
const certa = (id: string) => BY_ID[id].g
const abrirComSync = async (dev = 'pc', prog: ProgressMap = {}) => {
  vi.mocked(loadAll).mockResolvedValue(dados(prog)); vi.mocked(prepararSincronizacao).mockResolvedValue(dev)
  await useApp.getState().load()
}
const abrirSemSync = async () => {
  vi.mocked(loadAll).mockResolvedValue(dados()); vi.mocked(prepararSincronizacao).mockRejectedValue(new Error('falhou'))
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await useApp.getState().load(); warn.mockRestore()
}

beforeEach(async () => {
  vi.clearAllMocks(); localStorage.clear()
  vi.mocked(replaceAll).mockResolvedValue(undefined); vi.mocked(gravarResposta).mockResolvedValue(undefined); vi.mocked(gravarSimulado).mockResolvedValue(undefined); vi.mocked(gravarZerar).mockResolvedValue(undefined)
  useApp.setState({ ready: false, prog: {}, hist: { dias: {}, sims: [] }, marks: {}, session: null, toast: null, saida: null, tab: 'inicio' })
  await abrirSemSync() // o `aparelho` é uma variável do módulo: cada teste começa "sem sincronização"
  vi.clearAllMocks(); vi.mocked(replaceAll).mockResolvedValue(undefined); vi.mocked(gravarResposta).mockResolvedValue(undefined); vi.mocked(gravarSimulado).mockResolvedValue(undefined); vi.mocked(gravarZerar).mockResolvedValue(undefined)
  useApp.setState({ ready: false, prog: {}, hist: { dias: {}, sims: [] }, marks: {}, session: null, toast: null })
})

describe('abertura: prepara a sincronização', () => {
  it('chama a preparação com o progresso e o histórico ANTES de mostrar a tela', async () => {
    let prontoNaChamada: boolean | undefined
    const prog: ProgressMap = { [BANK[3].id]: { n: 2, c: 1, ok: false, last: 'B', t: 4 } }
    vi.mocked(loadAll).mockResolvedValue(dados(prog))
    vi.mocked(prepararSincronizacao).mockImplementation(async () => { prontoNaChamada = useApp.getState().ready; return 'pc' })
    await useApp.getState().load()
    expect(prepararSincronizacao).toHaveBeenCalledTimes(1)
    expect(vi.mocked(prepararSincronizacao).mock.calls[0][0]).toEqual(prog)
    expect(prontoNaChamada).toBe(false); expect(useApp.getState().ready).toBe(true)
  })
  it('a preparação recebe o progresso JÁ com os ids novos (depois da troca de ids do banco novo)', async () => {
    const antigoId = '2018-1', novoId = ID_MAP.ids[antigoId]
    vi.mocked(loadAll).mockResolvedValue(dados({ [antigoId]: { n: 1, c: 0, ok: false, last: 'A', t: 1 } }))
    vi.mocked(prepararSincronizacao).mockResolvedValue('pc')
    await useApp.getState().load()
    expect(Object.keys(vi.mocked(prepararSincronizacao).mock.calls[0][0])).toEqual([novoId])
  })
  it('se a troca de ids falhar, NÃO prepara a sincronização (a próxima abertura refaz tudo e o evento-base sai certo)', async () => {
    vi.mocked(loadAll).mockResolvedValue(dados({ '2018-1': { n: 1, c: 0, ok: false, last: 'A', t: 1 } }))
    vi.mocked(replaceAll).mockRejectedValue(new Error('disco cheio'))
    await useApp.getState().load()
    expect(prepararSincronizacao).not.toHaveBeenCalled(); expect(useApp.getState().ready).toBe(true)
  })
  it('se a preparação falhar o app abre do mesmo jeito e segue com o caminho de sempre (sem eventos)', async () => {
    await abrirSemSync() // (o app já abriu uma vez no beforeEach; aqui conferimos o caminho de gravação depois da falha)
    expect(useApp.getState().ready).toBe(true)
    useApp.getState().startByWeight()
    const id = useApp.getState().session!.ids[0]
    useApp.getState().answer(certa(id))
    expect(saveOne).toHaveBeenCalledWith(id, expect.objectContaining({ n: 1, c: 1 })); expect(saveHist).toHaveBeenCalled()
    expect(gravarResposta).not.toHaveBeenCalled()
  })
})

describe('com a sincronização ligada, cada mudança grava o seu evento', () => {
  it('responder: um evento junto com o progresso e o histórico (mesma gravação), sem o caminho antigo', async () => {
    await abrirComSync('pc')
    useApp.getState().startByWeight()
    const id = useApp.getState().session!.ids[0]
    useApp.getState().answer(certa(id))
    expect(gravarResposta).toHaveBeenCalledTimes(1)
    const [qid, p, h, ev] = vi.mocked(gravarResposta).mock.calls[0]
    expect(qid).toBe(id); expect(p).toEqual(useApp.getState().prog[id]); expect(h).toEqual(useApp.getState().hist)
    expect(ev).toMatchObject({ k: 'r', dev: 'pc', q: id, l: certa(id), ok: true })
    expect(saveOne).not.toHaveBeenCalled(); expect(saveHist).not.toHaveBeenCalled()
  })
  it('errar grava ok:false e a letra escolhida', async () => {
    await abrirComSync('cel')
    useApp.getState().startByWeight()
    const id = useApp.getState().session!.ids[0], errada = (['A', 'B', 'C', 'D', 'E'] as const).find((l) => l !== certa(id))!
    useApp.getState().answer(errada)
    expect(vi.mocked(gravarResposta).mock.calls[0][3]).toMatchObject({ dev: 'cel', l: errada, ok: false })
  })
  it('simulado entregue: um evento de simulado (uma vez só) e um evento por resposta contada', async () => {
    await abrirComSync('pc')
    useApp.getState().startSimulado()
    const s = useApp.getState().session!
    s.ids.slice(0, 4).forEach((id, i) => { useApp.getState().jump(i); useApp.getState().answer(certa(id)) })
    expect(gravarResposta).not.toHaveBeenCalled() // no simulado as respostas só contam ao entregar
    useApp.getState().finish(); useApp.getState().finish()
    expect(gravarResposta).toHaveBeenCalledTimes(4)
    expect(gravarSimulado).toHaveBeenCalledTimes(1)
    const [hist, ev] = vi.mocked(gravarSimulado).mock.calls[0]
    expect(ev).toMatchObject({ k: 's', dev: 'pc', sim: { n: 70, c: 4 } }); expect(hist.sims).toEqual([ev.sim])
    expect(saveHist).not.toHaveBeenCalled()
  })
  it('zerar: grava o evento de zerar (nada do que existe é apagado), sem trocar o progresso à força; desfazer refaz tudo a partir dos eventos', async () => {
    await abrirComSync('pc')
    const prog: ProgressMap = { [BANK[3].id]: { n: 2, c: 1, ok: false, last: 'B', t: 4 } }
    useApp.setState({ prog })
    await useApp.getState().resetAll()
    expect(useApp.getState().prog).toEqual({})
    expect(gravarZerar).toHaveBeenCalledTimes(1); const z = vi.mocked(gravarZerar).mock.calls[0][0]
    expect(z).toMatchObject({ k: 'z', dev: 'pc' })
    expect(replaceAll).not.toHaveBeenCalled(); expect(saveHist).not.toHaveBeenCalled()
    const t = useApp.getState().toast!
    expect(t.text).toBe('Progresso zerado.'); expect(t.action?.label).toBe('Desfazer')
    vi.mocked(desfazerZerar).mockResolvedValue({ prog: { ...prog, outra: { n: 1, c: 1, ok: true } }, hist: VAZIO })
    t.action!.run(); await vi.waitFor(() => expect(Object.keys(useApp.getState().prog)).toContain('outra'))
    expect(desfazerZerar).toHaveBeenCalledWith(z.id)
    expect(useApp.getState().prog[BANK[3].id]).toEqual(prog[BANK[3].id]) // o que vem dos eventos (inclusive respostas dadas depois do zerar) é o que a tela passa a mostrar
  })
  it('restaurar um backup refaz os eventos deste aparelho como uma base do que foi restaurado; desfazer devolve a base de antes', async () => {
    await abrirComSync('pc')
    const antes: ProgressMap = { [BANK[1].id]: { n: 1, c: 1, ok: true, last: 'A', t: 1 } }
    useApp.setState({ prog: antes })
    const restaurado: ProgressMap = { [BANK[2].id]: { n: 4, c: 3, ok: true, last: 'C', t: 2 } }
    await useApp.getState().restore(restaurado)
    expect(refazerEventosDoAparelho).toHaveBeenCalledTimes(1)
    const [dev, base] = vi.mocked(refazerEventosDoAparelho).mock.calls[0]
    expect(dev).toBe('pc'); expect(derivar([base as Evento]).prog).toEqual(restaurado)
    useApp.getState().toast!.action!.run()
    const base2 = vi.mocked(refazerEventosDoAparelho).mock.calls[1][1]
    expect(derivar([base2 as Evento]).prog).toEqual(antes)
  })
  it('sem sincronização, zerar e desfazer seguem como sempre (substitui o progresso no banco)', async () => {
    const prog: ProgressMap = { [BANK[3].id]: { n: 2, c: 1, ok: false, last: 'B', t: 4 } }
    useApp.setState({ prog })
    await useApp.getState().resetAll()
    expect(gravarZerar).not.toHaveBeenCalled(); expect(replaceAll).toHaveBeenCalledWith({})
    useApp.getState().toast!.action!.run()
    expect(useApp.getState().prog).toEqual(prog); expect(vi.mocked(replaceAll).mock.calls.at(-1)![0]).toEqual(prog)
  })
})
