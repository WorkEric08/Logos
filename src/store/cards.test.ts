import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/db', () => ({
  loadCards: vi.fn(), saveBaralho: vi.fn(), saveCartao: vi.fn(), saveCartoes: vi.fn(), deleteCartao: vi.fn(), deleteBaralho: vi.fn(), saveAjustes: vi.fn(), saveFcHist: vi.fn(), replaceCards: vi.fn(),
  loadAll: vi.fn(), replaceAll: vi.fn(), saveOne: vi.fn(), saveTema: vi.fn(), saveHist: vi.fn(), saveMarks: vi.fn(), askPersist: vi.fn(),
}))
import { deleteBaralho, loadCards, replaceCards, saveAjustes, saveCartao, saveCartoes, saveFcHist } from '../services/db'
import { AJUSTES_PADRAO, diaDe } from '../core/cards'
import { HIST_VAZIO } from '../core/historico'
import { BANK, useApp } from './app'
import { BARALHO_QUESTOES, useCards } from './cards'

const limpo = () => useCards.setState({ pronto: true, baralhos: [], cartoes: [], ajustes: AJUSTES_PADRAO, hist: HIST_VAZIO })
const novoB = (nome = 'Siglas') => useCards.getState().novoBaralho(nome)!
beforeEach(() => { vi.clearAllMocks(); limpo(); useApp.setState({ toast: null }) })

describe('abertura', () => {
  it('carrega baralhos, cartões, ajustes e histórico do banco', async () => {
    vi.mocked(loadCards).mockResolvedValue({ baralhos: [{ id: 'b', nome: 'X', criado: 1 }], cartoes: [], ajustes: { limite: 20, dia: '', novos: 0 }, hist: HIST_VAZIO })
    useCards.setState({ pronto: false }); await useCards.getState().load()
    expect(useCards.getState().pronto).toBe(true); expect(useCards.getState().baralhos).toHaveLength(1); expect(useCards.getState().ajustes.limite).toBe(20)
  })
  it('se o banco falhar, abre vazio e avisa (os dados não são apagados)', async () => {
    vi.mocked(loadCards).mockRejectedValue(new Error('x')); useCards.setState({ pronto: false }); await useCards.getState().load()
    expect(useCards.getState().pronto).toBe(true); expect(useApp.getState().toast?.text).toMatch(/Não consegui abrir os flashcards/)
  })
})

describe('baralhos', () => {
  it('cria, recusa nome vazio e nome repetido (sem diferenciar maiúsculas e espaços extras)', () => {
    const id = novoB('Bancários  siglas')
    expect(id).toBeTruthy(); expect(useCards.getState().baralhos[0].nome).toBe('Bancários siglas')
    expect(useCards.getState().novoBaralho('   ')).toBeNull(); expect(useApp.getState().toast?.text).toBe('Dê um nome ao baralho.')
    expect(useCards.getState().novoBaralho('bancários SIGLAS')).toBeNull(); expect(useApp.getState().toast?.text).toBe('Já existe baralho com esse nome.')
    expect(useCards.getState().baralhos).toHaveLength(1)
  })
  it('renomear: aceita, recusa vazio e nome de outro baralho (o próprio nome com outra caixa vale)', () => {
    const a = novoB('A'), b = novoB('B')
    expect(useCards.getState().renomear(a, 'B')).toBe(false); expect(useCards.getState().renomear(a, '')).toBe(false)
    expect(useCards.getState().renomear(b, 'b')).toBe(true); expect(useCards.getState().baralhos.find((x) => x.id === b)!.nome).toBe('b')
  })
  it('excluir apaga o baralho e os cartões dele; "Desfazer" devolve tudo e regrava', () => {
    const a = novoB('A'), b = novoB('B')
    useCards.getState().adicionar(a, 'f1', 'v1'); useCards.getState().adicionar(a, 'f2', 'v2'); useCards.getState().adicionar(b, 'f3', 'v3')
    useCards.getState().excluirBaralho(a)
    expect(useCards.getState().baralhos.map((x) => x.id)).toEqual([b]); expect(useCards.getState().cartoes).toHaveLength(1)
    expect(deleteBaralho).toHaveBeenCalledWith(a); expect(useApp.getState().toast?.text).toBe('Baralho excluído.')
    useApp.getState().toast!.action!.run()
    expect(useCards.getState().baralhos).toHaveLength(2); expect(useCards.getState().cartoes).toHaveLength(3)
    expect(vi.mocked(saveCartoes).mock.calls.at(-1)![0]).toHaveLength(2)
  })
})

describe('cartões', () => {
  it('adicionar exige frente, verso e baralho existente; com "inverso" cria também verso→frente', () => {
    const b = novoB()
    expect(useCards.getState().adicionar(b, '', 'v')).toEqual([]); expect(useCards.getState().adicionar(b, 'f', '  ')).toEqual([]); expect(useCards.getState().adicionar('nao-existe', 'f', 'v')).toEqual([])
    const dois = useCards.getState().adicionar(b, ' SELIC ', ' taxa básica ', true)
    expect(dois.map((c) => [c.f, c.v])).toEqual([['SELIC', 'taxa básica'], ['taxa básica', 'SELIC']]); expect(new Set(dois.map((c) => c.id)).size).toBe(2)
    expect(useCards.getState().cartoes).toHaveLength(2); expect(dois.every((c) => c.estado === 'novo')).toBe(true)
  })
  it('editar troca texto e baralho sem mexer no agendamento; recusa vazio', () => {
    const a = novoB('A'), b = novoB('B')
    const [c] = useCards.getState().adicionar(a, 'f', 'v')
    useCards.getState().avaliar(c.id, 2)
    const antes = useCards.getState().cartoes[0]
    expect(useCards.getState().editar(c.id, { b, f: 'novo f', v: 'novo v' })).toBe(true)
    expect(useCards.getState().cartoes[0]).toMatchObject({ f: 'novo f', v: 'novo v', b, due: antes.due, ivl: antes.ivl, estado: 'revisao' })
    expect(useCards.getState().editar(c.id, { b, f: '', v: 'x' })).toBe(false); expect(useCards.getState().editar(c.id, { b: 'fantasma', f: 'a', v: 'b' })).toBe(false)
  })
  it('excluir cartão tem "Desfazer"', () => {
    const [c] = useCards.getState().adicionar(novoB(), 'f', 'v')
    useCards.getState().excluirCartao(c.id); expect(useCards.getState().cartoes).toHaveLength(0)
    useApp.getState().toast!.action!.run(); expect(useCards.getState().cartoes).toEqual([c])
  })
})

describe('estudo', () => {
  it('avaliar um cartão novo: agenda, conta no histórico do dia, gasta 1 dos novos de hoje e grava tudo', () => {
    const [c] = useCards.getState().adicionar(novoB(), 'f', 'v')
    const foto = useCards.getState().avaliar(c.id, 2)!
    const s = useCards.getState()
    expect(s.cartoes[0]).toMatchObject({ estado: 'revisao', ivl: 2 }); expect(s.ajustes).toMatchObject({ novos: 1, dia: diaDe(Date.now()) })
    expect(Object.values(s.hist.dias)).toEqual([{ n: 1, c: 1 }]); expect(foto.cartao.estado).toBe('novo')
    expect(saveCartao).toHaveBeenCalled(); expect(saveFcHist).toHaveBeenCalled(); expect(saveAjustes).toHaveBeenCalled()
  })
  it('"Errei" conta como resposta errada; rever um cartão que já não é novo não gasta o limite de novos', () => {
    const [c] = useCards.getState().adicionar(novoB(), 'f', 'v')
    useCards.getState().avaliar(c.id, 0); useCards.getState().avaliar(c.id, 2)
    const s = useCards.getState()
    expect(Object.values(s.hist.dias)).toEqual([{ n: 2, c: 1 }]); expect(s.ajustes.novos).toBe(1) // só a 1ª vez era "novo"
  })
  it('desfazer a avaliação devolve cartão, histórico e contador de novos exatamente como estavam', () => {
    const [c] = useCards.getState().adicionar(novoB(), 'f', 'v')
    const antes = useCards.getState()
    const foto = useCards.getState().avaliar(c.id, 3)!
    useCards.getState().desfazerAvaliacao(foto)
    const s = useCards.getState()
    expect(s.cartoes).toEqual(antes.cartoes); expect(s.hist).toEqual(antes.hist); expect(s.ajustes).toEqual(antes.ajustes)
  })
  it('avaliar cartão inexistente não faz nada', () => { expect(useCards.getState().avaliar('x', 2)).toBeNull() })
  it('limite de novos por dia fica guardado', () => { useCards.getState().setLimite(20); expect(useCards.getState().ajustes.limite).toBe(20); expect(saveAjustes).toHaveBeenCalled() })
})

describe('de uma questão', () => {
  it('cria o baralho "Das questões" na primeira vez, guarda o id da questão e não duplica', () => {
    const q = BANK[3]
    expect(useCards.getState().daQuestao(q, { f: 'pergunta', v: 'resposta' })).toBe('criado')
    expect(useCards.getState().baralhos.map((b) => b.nome)).toEqual([BARALHO_QUESTOES]); expect(useCards.getState().cartoes[0].q).toBe(q.id)
    expect(useCards.getState().daQuestao(q, { f: 'pergunta', v: 'resposta' })).toBe('existe'); expect(useCards.getState().cartoes).toHaveLength(1)
    expect(useCards.getState().daQuestao(BANK[4], { f: 'outra', v: 'resp' })).toBe('criado'); expect(useCards.getState().baralhos).toHaveLength(1)
  })
})

describe('backup', () => {
  it('snapshot e restaurar fazem ida e volta e regravam o banco', async () => {
    vi.mocked(replaceCards).mockResolvedValue(undefined)
    const b = novoB(); useCards.getState().adicionar(b, 'f', 'v')
    const foto = useCards.getState().snapshot(); limpo()
    await useCards.getState().restaurar(foto)
    expect(useCards.getState().cartoes).toEqual(foto.cartoes); expect(replaceCards).toHaveBeenCalledWith(foto)
  })
})
