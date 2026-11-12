import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// O banco de dados do navegador (Dexie) é trocado por um simulado: aqui se testa a lógica do estado, não o IndexedDB.
vi.mock('../services/db', () => ({ loadAll: vi.fn(), replaceAll: vi.fn(), saveOne: vi.fn(), saveTema: vi.fn(), saveHist: vi.fn(), saveMarks: vi.fn(), askPersist: vi.fn(),
  gravarResposta: vi.fn(), gravarSimulado: vi.fn(), gravarZerar: vi.fn(), desfazerZerar: vi.fn(), refazerEventosDoAparelho: vi.fn() }))
vi.mock('../services/sync/preparar', () => ({ prepararSincronizacao: vi.fn() }))
import { loadAll, replaceAll, saveHist, saveMarks } from '../services/db'
import { BANK, BY_ID, ID_MAP, useApp } from './app'
import { parseBackup } from '../core/filters'
import { iniciarCron } from '../core/cronometro'
import { SIMULADO_PLAN } from '../core/scoring'
import { EXTRA_SUBJECTS } from '../core/subjects'
import type { ProgressMap } from '../core/types'

const antigoId = '2018-1' // BB 2018 Q1: o gabarito antigo (D) estava errado; o certo é C
const novoId = ID_MAP.ids[antigoId]
const semTroca = Object.keys(ID_MAP.ids).find((i) => !ID_MAP.trocas[i])! // um id antigo cujo gabarito NÃO mudou
const progAntigo = (): ProgressMap => ({
  [antigoId]: { n: 3, c: 2, ok: true, last: 'D', t: 7 },
  [semTroca]: { n: 1, c: 1, ok: true, last: 'A', t: 8 },
  '2010-26': { n: 2, c: 0, ok: false, last: 'B', t: 9 }, // sem par: mantém o id
})
const COPIA = 'treino_progresso_antes_do_banco_novo'

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  useApp.setState({ ready: false, prog: {}, hist: { dias: {}, sims: [] }, marks: {}, session: null, toast: null, saida: null, tab: 'inicio' })
})

describe('abertura com progresso salvo nos ids antigos', () => {
  it('migra, grava, abre a tela e avisa uma vez', async () => {
    vi.mocked(loadAll).mockResolvedValue({ prog: progAntigo(), tema: 'dark', hist: { dias: {}, sims: [] }, marks: {} })
    vi.mocked(replaceAll).mockResolvedValue(undefined)
    await useApp.getState().load()
    const s = useApp.getState()
    expect(s.ready).toBe(true); expect(s.tema).toBe('dark')
    expect(Object.keys(s.prog).sort()).toEqual([novoId, ID_MAP.ids[semTroca], '2010-26'].sort())
    expect(s.prog[novoId]).toMatchObject({ n: 3, c: 1, ok: false, last: 'D' }) // a última resposta (D) deixou de ser "certa"
    expect(replaceAll).toHaveBeenCalledTimes(1)
    expect(vi.mocked(replaceAll).mock.calls[0][0]).toEqual(s.prog)
    expect(s.toast?.text).toBe('Gabarito corrigido em 1 resposta.')
    // a cópia de segurança é o progresso antigo, intacto e restaurável
    expect(JSON.parse(localStorage.getItem(COPIA)!)).toEqual({ v: 1, prog: progAntigo() })
  })
  it('sem ids antigos (já migrado ou instalação nova): não grava nada e não avisa', async () => {
    vi.mocked(loadAll).mockResolvedValue({ prog: { [novoId]: { n: 1, c: 1, ok: true, last: 'C', t: 1 } }, tema: 'auto', hist: { dias: {}, sims: [] }, marks: {} })
    await useApp.getState().load()
    expect(replaceAll).not.toHaveBeenCalled()
    expect(useApp.getState().toast).toBeNull(); expect(localStorage.getItem(COPIA)).toBeNull()
  })
  it('FALHA ao gravar: o app abre, o progresso antigo segue intacto no banco, e a cópia em localStorage existe e é restaurável', async () => {
    const original = progAntigo()
    vi.mocked(loadAll).mockResolvedValue({ prog: original, tema: 'auto', hist: { dias: {}, sims: [] }, marks: {} })
    vi.mocked(replaceAll).mockRejectedValue(new Error('disco cheio'))
    await useApp.getState().load()
    const s = useApp.getState()
    expect(s.ready).toBe(true) // não fica preso na tela de abertura
    expect(s.prog).toEqual(progAntigo()) // memória = banco (ids antigos), para a próxima migração não contar em dobro
    expect(s.toast?.text).toBe('Não consegui atualizar o banco.')
    expect(JSON.parse(localStorage.getItem(COPIA)!)).toEqual({ v: 1, prog: progAntigo() })
    // a cópia restaura o progresso pelo caminho normal de "restaurar backup" (e passa pelo mapa de ids)
    vi.mocked(replaceAll).mockResolvedValue(undefined)
    await useApp.getState().restore(parseBackup(localStorage.getItem(COPIA)!)!)
    expect(useApp.getState().prog[novoId]).toBeTruthy()
  })
  it('depois da falha, na abertura seguinte, o que foi respondido nesse meio-tempo soma sem contar o antigo em dobro', async () => {
    const respondidoDepois: ProgressMap = { ...progAntigo(), [ID_MAP.ids[semTroca]]: { n: 1, c: 0, ok: false, last: 'E', t: 99 } }
    vi.mocked(loadAll).mockResolvedValue({ prog: respondidoDepois, tema: 'auto', hist: { dias: {}, sims: [] }, marks: {} })
    vi.mocked(replaceAll).mockResolvedValue(undefined)
    await useApp.getState().load()
    expect(useApp.getState().prog[ID_MAP.ids[semTroca]]).toEqual({ n: 2, c: 1, ok: false, last: 'E', t: 99 })
  })
})

describe('backup e restauração', () => {
  it('ida e volta: salvar o backup e restaurar devolve exatamente o mesmo progresso', async () => {
    vi.mocked(replaceAll).mockResolvedValue(undefined)
    const prog: ProgressMap = { [novoId]: { n: 3, c: 1, ok: false, last: 'D', t: 7 }, [BANK[5].id]: { n: 1, c: 1, ok: true, last: BANK[5].g, t: 2 } }
    useApp.setState({ prog })
    const texto = JSON.stringify({ v: 1, prog: useApp.getState().prog })
    useApp.setState({ prog: {} })
    await useApp.getState().restore(parseBackup(texto)!)
    expect(useApp.getState().prog).toEqual(prog)
    expect(useApp.getState().toast?.text).toBe('Progresso restaurado.')
  })
  it('backup da versão ANTIGA (ids antigos), em arquivo ou colado como texto, passa pelo mapa de ids', async () => {
    vi.mocked(replaceAll).mockResolvedValue(undefined)
    const texto = JSON.stringify({ v: 1, prog: progAntigo() })
    await useApp.getState().restore(parseBackup(texto)!)
    const s = useApp.getState()
    expect(Object.keys(s.prog)).not.toContain(antigoId)
    expect(s.prog[novoId]).toMatchObject({ ok: false, c: 1 })
    expect(vi.mocked(replaceAll).mock.calls[0][0]).toEqual(s.prog)
    for (const id of Object.keys(s.prog)) expect(BY_ID[id]).toBeTruthy()
  })
  it('"Desfazer" depois de restaurar volta ao progresso de antes', async () => {
    vi.mocked(replaceAll).mockResolvedValue(undefined)
    const antes: ProgressMap = { [BANK[1].id]: { n: 1, c: 1, ok: true, last: BANK[1].g, t: 1 } }
    useApp.setState({ prog: antes })
    await useApp.getState().restore({ [BANK[2].id]: { n: 1, c: 0, ok: false, last: 'A', t: 2 } })
    useApp.getState().toast!.action!.run()
    expect(useApp.getState().prog).toEqual(antes)
  })
})

describe('zerar progresso + desfazer', () => {
  it('zera, avisa com o botão Desfazer e o Desfazer devolve tudo (e regrava no banco)', async () => {
    vi.mocked(replaceAll).mockResolvedValue(undefined)
    const prog: ProgressMap = { [BANK[3].id]: { n: 2, c: 1, ok: false, last: 'B', t: 4 } }
    useApp.setState({ prog })
    await useApp.getState().resetAll()
    expect(useApp.getState().prog).toEqual({})
    const t = useApp.getState().toast!
    expect(t.text).toBe('Progresso zerado.'); expect(t.action?.label).toBe('Desfazer')
    t.action!.run()
    expect(useApp.getState().prog).toEqual(prog)
    expect(vi.mocked(replaceAll).mock.calls.at(-1)![0]).toEqual(prog)
  })
})

describe('sorteios com o banco novo', () => {
  it('simulado: 70 questões, a composição do edital, sem matéria fora do edital, sem repetida, sem anulada (nenhuma está no banco)', () => {
    const fora = new Set(EXTRA_SUBJECTS.map((m) => m.n))
    for (let k = 0; k < 120; k++) {
      useApp.getState().startSimulado()
      const s = useApp.getState().session!
      expect(s.ids).toHaveLength(70); expect(new Set(s.ids).size).toBe(70)
      const porMateria: Record<string, number> = {}
      for (const id of s.ids) { const q = BY_ID[id]; porMateria[q.m] = (porMateria[q.m] ?? 0) + 1; expect(fora.has(q.m)).toBe(false); expect(q.g).toMatch(/^[A-E]$/) }
      for (const [m, n] of SIMULADO_PLAN) expect(porMateria[m]).toBe(n)
      expect(s.sim).toBe(true)
    }
  })
  it('"Rever erros" usa os ids novos: só entram questões marcadas como erradas', () => {
    const erradas = [BANK[10], BANK[300], BANK[900]].map((q) => q.id)
    useApp.setState({ prog: { ...Object.fromEntries(erradas.map((id) => [id, { n: 1, c: 0, ok: false as const, last: 'A' as const, t: 1 }])), [BANK[11].id]: { n: 1, c: 1, ok: true, last: BANK[11].g, t: 1 } } })
    useApp.getState().startErrors()
    const ids = useApp.getState().session!.ids
    expect(ids.sort()).toEqual([...erradas].sort())
  })
  it('treino por filtro de matéria e de prova só traz o que foi pedido', () => {
    useApp.getState().setMatFilter('Estatística'); useApp.getState().setFilter('qtd', 0); useApp.getState().startFromFilters()
    const a = useApp.getState().session!.ids.map((id) => BY_ID[id])
    expect(a.length).toBe(BANK.filter((q) => q.m === 'Estatística').length); expect(a.every((q) => q.m === 'Estatística')).toBe(true)
    useApp.getState().leave(); useApp.getState().setMatFilter(''); useApp.getState().setFilter('qtd', 10); useApp.getState().setFilter('ano', 'bb-2023'); useApp.getState().startFromFilters()
    const b = useApp.getState().session!.ids.map((id) => BY_ID[id])
    expect(b.length).toBe(Math.min(10, BANK.filter((q) => q.s === 'bb-2023').length)); expect(b.every((q) => q.s === 'bb-2023')).toBe(true)
  })
})

describe('histórico e marcações no estado', () => {
  const certa = (id: string) => BY_ID[id].g
  const errada = (id: string) => (['A', 'B', 'C', 'D', 'E'] as const).find((l) => l !== BY_ID[id].g)!
  const hoje = () => new Date().toISOString().slice(0, 10) // só para conferir o formato; o dia exato vem do fuso local
  it('cada resposta soma no dia de hoje (certas e erradas) e é gravada', () => {
    const [x, y] = [BANK[20].id, BANK[21].id]
    useApp.setState({ session: { ids: [x, y], i: 0, ans: {}, sim: false, done: false, review: false, counted: false, cron: iniciarCron(0) } })
    useApp.getState().answer(certa(x)); useApp.getState().go(1); useApp.getState().answer(errada(y))
    const dias = Object.values(useApp.getState().hist.dias)
    expect(dias).toEqual([{ n: 2, c: 1 }]); expect(hoje()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(vi.mocked(saveHist)).toHaveBeenCalledTimes(2)
  })
  it('simulado só entra no histórico ao entregar (uma vez) e as respostas também contam no dia', () => {
    useApp.getState().startSimulado()
    const s = useApp.getState().session!
    s.ids.slice(0, 10).forEach((id, i) => { useApp.getState().jump(i); useApp.getState().answer(certa(id)) })
    expect(useApp.getState().hist.sims).toHaveLength(0)
    useApp.getState().finish(); useApp.getState().finish()
    const h = useApp.getState().hist
    expect(h.sims).toHaveLength(1); expect(h.sims[0]).toMatchObject({ n: 70, c: 10, ok: false })
    expect(Object.values(h.dias)).toEqual([{ n: 10, c: 10 }])
  })
  it('marcar, anotar (gravação só depois de uma pausa) e filtrar por marcadas', () => {
    vi.useFakeTimers()
    const id = BANK[30].id
    useApp.getState().toggleMark(id)
    expect(useApp.getState().marks[id]).toMatchObject({ r: true }); expect(vi.mocked(saveMarks)).toHaveBeenCalledTimes(1)
    useApp.getState().setNote(id, 'a'); useApp.getState().setNote(id, 'ab'); useApp.getState().setNote(id, 'abc')
    expect(vi.mocked(saveMarks)).toHaveBeenCalledTimes(1) // ainda não gravou: está digitando
    vi.advanceTimersByTime(600)
    expect(vi.mocked(saveMarks)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(saveMarks).mock.calls[1][0][id]).toMatchObject({ a: 'abc', r: true })
    useApp.getState().setNote(id, 'abcd'); useApp.getState().flushMarks() // sair do campo grava na hora
    expect(vi.mocked(saveMarks)).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
    useApp.getState().setMatFilter(''); useApp.getState().setFilter('ano', '') // os filtros ficam guardados entre os testes
    useApp.getState().setFilter('status', 'marcadas'); useApp.getState().setFilter('qtd', 0); useApp.getState().startFromFilters()
    expect(useApp.getState().session!.ids).toEqual([id])
  })
  it('zerar apaga progresso e evolução mas mantém marcações; Desfazer devolve o progresso e a evolução', async () => {
    vi.mocked(replaceAll).mockResolvedValue(undefined)
    const id = BANK[40].id
    const prog: ProgressMap = { [id]: { n: 1, c: 1, ok: true, last: BANK[40].g, t: 1 } }
    const hist = { dias: { '2026-11-08': { n: 5, c: 4 } }, sims: [] }
    useApp.setState({ prog, hist, marks: { [id]: { r: true, t: 1 } } })
    await useApp.getState().resetAll()
    expect(useApp.getState().hist).toEqual({ dias: {}, sims: [] }); expect(useApp.getState().marks[id]).toBeTruthy()
    useApp.getState().toast!.action!.run()
    expect(useApp.getState().prog).toEqual(prog); expect(useApp.getState().hist).toEqual(hist)
    expect(vi.mocked(saveHist).mock.calls.at(-1)![0]).toEqual(hist)
  })
  it('restaurar backup novo traz histórico e marcações; backup antigo mantém os de agora; Desfazer volta tudo', async () => {
    vi.mocked(replaceAll).mockResolvedValue(undefined)
    const id = BANK[50].id
    const atual = { dias: { '2026-11-01': { n: 1, c: 1 } }, sims: [] }
    useApp.setState({ hist: atual, marks: { [id]: { r: true, t: 1 } } })
    await useApp.getState().restore({}, { hist: { dias: { '2026-10-01': { n: 9, c: 9 } }, sims: [] }, marks: {} })
    expect(Object.keys(useApp.getState().hist.dias)).toEqual(['2026-10-01']); expect(useApp.getState().marks).toEqual({})
    useApp.getState().toast!.action!.run()
    expect(useApp.getState().hist).toEqual(atual); expect(useApp.getState().marks[id]).toBeTruthy()
    // backup antigo: sem hist/marks → não apaga o que existe
    await useApp.getState().restore({})
    expect(useApp.getState().hist).toEqual(atual); expect(useApp.getState().marks[id]).toBeTruthy()
  })
})

describe('simulado: cronômetro escondido e saída com confirmação', () => {
  afterEach(() => { vi.useRealTimers() })
  it('o tempo gasto vai para o resultado e para o histórico; pausas (app em segundo plano) não contam', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T10:00:00'))
    useApp.getState().startSimulado()
    vi.advanceTimersByTime(60_000) // 1 min com o app à vista
    useApp.getState().pausarCron(); vi.advanceTimersByTime(3_600_000) // 1 h com a tela bloqueada: não conta
    useApp.getState().pausarCron() // pausar de novo não muda nada
    useApp.getState().retomarCron(); vi.advanceTimersByTime(30_000)
    useApp.getState().finish()
    expect(useApp.getState().session!.dur).toBe(90)
    expect(useApp.getState().hist.sims[0].d).toBe(90)
    vi.advanceTimersByTime(600_000); useApp.getState().finish() // entregar de novo não conta outra vez nem muda o tempo
    expect(useApp.getState().session!.dur).toBe(90); expect(useApp.getState().hist.sims).toHaveLength(1)
  })
  it('treino comum não tem aviso: sair vai direto; e sem sessão a troca de aba também', () => {
    useApp.getState().startByWeight(); useApp.getState().sair()
    expect(useApp.getState().saida).toBeNull(); expect(useApp.getState().session).toBeNull()
    useApp.getState().irPara('mais'); expect(useApp.getState().tab).toBe('mais'); expect(useApp.getState().saida).toBeNull()
  })
  it('simulado em andamento: Sair e trocar de aba perguntam antes; cancelar continua exatamente onde estava', () => {
    useApp.getState().startSimulado()
    const id = useApp.getState().session!.ids[0]
    useApp.getState().answer('A')
    useApp.getState().sair()
    expect(useApp.getState().saida).toEqual({ destino: 'inicio' }); expect(useApp.getState().session).not.toBeNull()
    useApp.getState().cancelarSaida()
    expect(useApp.getState().saida).toBeNull(); expect(useApp.getState().session!.ans[id]).toBe('A')
    useApp.getState().irPara('desempenho')
    expect(useApp.getState().saida).toEqual({ destino: 'desempenho' }); expect(useApp.getState().session).not.toBeNull()
  })
  it('confirmar encerra: some a sessão, vai para o destino e NADA entra no histórico nem no progresso', () => {
    useApp.getState().startSimulado()
    useApp.getState().answer('A'); useApp.getState().go(1); useApp.getState().answer('B')
    useApp.getState().irPara('desempenho'); useApp.getState().confirmarSaida()
    const s = useApp.getState()
    expect(s.session).toBeNull(); expect(s.saida).toBeNull(); expect(s.tab).toBe('desempenho')
    expect(s.hist.sims).toHaveLength(0); expect(s.prog).toEqual({}); expect(Object.keys(s.hist.dias)).toHaveLength(0)
  })
  it('simulado já entregue (resultado ou revisão): sair não pergunta', () => {
    useApp.getState().startSimulado(); useApp.getState().finish()
    useApp.getState().jump(3) // revendo uma questão
    useApp.getState().sair()
    expect(useApp.getState().saida).toBeNull(); expect(useApp.getState().session).toBeNull(); expect(useApp.getState().tab).toBe('inicio')
  })
})
