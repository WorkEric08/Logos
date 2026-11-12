import { create } from 'zustand'
import { AJUSTES_PADRAO, NOME_MAX, TAM_MAX, agendar, contarNovo, criarBaralho, criarCartao, lembrou, novoId, type Ajustes, type Baralho, type Cartao, type DadosCards, type Nota } from '../core/cards'
import { AVISOS } from '../core/avisos'
import { HIST_VAZIO, registrarResposta, type Hist } from '../core/historico'
import type { Question } from '../core/types'
import { deleteBaralho, deleteCartao, loadCards, replaceCards, saveAjustes, saveBaralho, saveCartao, saveCartoes, saveFcHist } from '../services/db'
import { useApp } from './app'

export const BARALHO_QUESTOES = 'Das questões'

/** O que se precisa para desfazer uma avaliação. */
export interface Foto { cartao: Cartao; hist: Hist; ajustes: Ajustes }

interface State {
  pronto: boolean; baralhos: Baralho[]; cartoes: Cartao[]; ajustes: Ajustes; hist: Hist
  load: () => Promise<void>
  novoBaralho: (nome: string) => string | null
  renomear: (id: string, nome: string) => boolean
  excluirBaralho: (id: string) => void
  adicionar: (b: string, f: string, v: string, inverso?: boolean) => Cartao[]
  editar: (id: string, d: { b: string; f: string; v: string }) => boolean
  excluirCartao: (id: string) => void
  avaliar: (id: string, nota: Nota) => Foto | null
  desfazerAvaliacao: (foto: Foto) => void
  setLimite: (n: number) => void
  daQuestao: (q: Question, texto: { f: string; v: string }) => 'criado' | 'existe'
  snapshot: () => DadosCards
  restaurar: (d: DadosCards) => Promise<void>
}

const aviso = (t: string, acao?: { label: string; run: () => void }) => useApp.getState().showToast(t, acao)
const semPar = (nome: string) => nome.trim().replace(/\s+/g, ' ').slice(0, NOME_MAX).toLocaleLowerCase('pt-BR')

export const useCards = create<State>((set, get) => ({
  pronto: false, baralhos: [], cartoes: [], ajustes: AJUSTES_PADRAO, hist: HIST_VAZIO,
  load: async () => {
    try { const d = await loadCards(); set({ ...d, pronto: true }) } catch { set({ pronto: true }); aviso(AVISOS.cardsNaoAbriu) }
  },
  novoBaralho: (nome) => {
    const limpo = nome.trim().replace(/\s+/g, ' ')
    if (!limpo) { aviso(AVISOS.baralhoSemNome); return null }
    if (get().baralhos.some((b) => semPar(b.nome) === semPar(limpo))) { aviso(AVISOS.baralhoRepetido); return null }
    const b = criarBaralho(limpo, Date.now(), novoId(Date.now()))
    set({ baralhos: [...get().baralhos, b] }); void saveBaralho(b)
    return b.id
  },
  renomear: (id, nome) => {
    const limpo = nome.trim().replace(/\s+/g, ' ')
    if (!limpo) { aviso(AVISOS.baralhoSemNome); return false }
    if (get().baralhos.some((b) => b.id !== id && semPar(b.nome) === semPar(limpo))) { aviso(AVISOS.baralhoRepetido); return false }
    const baralhos = get().baralhos.map((b) => (b.id === id ? { ...b, nome: limpo.slice(0, NOME_MAX) } : b))
    set({ baralhos }); void saveBaralho(baralhos.find((b) => b.id === id)!)
    return true
  },
  excluirBaralho: (id) => {
    const { baralhos, cartoes } = get(), b = baralhos.find((x) => x.id === id)
    if (!b) return
    const seus = cartoes.filter((c) => c.b === id)
    set({ baralhos: baralhos.filter((x) => x.id !== id), cartoes: cartoes.filter((c) => c.b !== id) }); void deleteBaralho(id)
    aviso(AVISOS.baralhoExcluido, {
      label: 'Desfazer', run: () => { set({ baralhos: [...get().baralhos, b], cartoes: [...get().cartoes, ...seus] }); void saveBaralho(b); void saveCartoes(seus) },
    })
  },
  adicionar: (b, f, v, inverso = false) => {
    const fl = f.trim(), vl = v.trim(), agora = Date.now()
    if (!fl || !vl || !get().baralhos.some((x) => x.id === b)) { aviso(AVISOS.cartaoIncompleto); return [] }
    const novos = [criarCartao({ b, f: fl, v: vl }, agora, novoId(agora))]
    if (inverso) novos.push(criarCartao({ b, f: vl, v: fl }, agora + 1, novoId(agora + 1)))
    set({ cartoes: [...get().cartoes, ...novos] }); void saveCartoes(novos)
    return novos
  },
  editar: (id, d) => {
    const fl = d.f.trim().slice(0, TAM_MAX), vl = d.v.trim().slice(0, TAM_MAX)
    if (!fl || !vl) { aviso(AVISOS.cartaoIncompleto); return false }
    const atual = get().cartoes.find((c) => c.id === id)
    if (!atual || !get().baralhos.some((x) => x.id === d.b)) return false
    const novo = { ...atual, f: fl, v: vl, b: d.b }
    set({ cartoes: get().cartoes.map((c) => (c.id === id ? novo : c)) }); void saveCartao(novo)
    return true
  },
  excluirCartao: (id) => {
    const c = get().cartoes.find((x) => x.id === id)
    if (!c) return
    set({ cartoes: get().cartoes.filter((x) => x.id !== id) }); void deleteCartao(id)
    aviso(AVISOS.cartaoExcluido, { label: 'Desfazer', run: () => { if (get().baralhos.some((b) => b.id === c.b)) { set({ cartoes: [...get().cartoes, c] }); void saveCartao(c) } } })
  },
  avaliar: (id, nota) => {
    const { cartoes, hist, ajustes } = get(), c = cartoes.find((x) => x.id === id)
    if (!c) return null
    const agora = Date.now()
    const novo = agendar(c, nota, agora)
    const histNovo = registrarResposta(hist, lembrou(nota), agora)
    const ajustesNovo = c.estado === 'novo' ? contarNovo(ajustes, agora) : ajustes
    set({ cartoes: cartoes.map((x) => (x.id === id ? novo : x)), hist: histNovo, ajustes: ajustesNovo })
    void saveCartao(novo); void saveFcHist(histNovo); if (ajustesNovo !== ajustes) void saveAjustes(ajustesNovo)
    return { cartao: c, hist, ajustes }
  },
  desfazerAvaliacao: (foto) => {
    set({ cartoes: get().cartoes.map((x) => (x.id === foto.cartao.id ? foto.cartao : x)), hist: foto.hist, ajustes: foto.ajustes })
    void saveCartao(foto.cartao); void saveFcHist(foto.hist); void saveAjustes(foto.ajustes)
  },
  setLimite: (n) => { const ajustes = { ...get().ajustes, limite: n }; set({ ajustes }); void saveAjustes(ajustes) },
  daQuestao: (q, texto) => {
    if (get().cartoes.some((c) => c.q === q.id)) return 'existe'
    let b = get().baralhos.find((x) => semPar(x.nome) === semPar(BARALHO_QUESTOES))?.id
    if (!b) b = get().novoBaralho(BARALHO_QUESTOES) ?? undefined
    if (!b) return 'existe'
    const agora = Date.now()
    const c = criarCartao({ b, f: texto.f, v: texto.v, q: q.id }, agora, novoId(agora))
    set({ cartoes: [...get().cartoes, c] }); void saveCartao(c)
    return 'criado'
  },
  snapshot: () => { const { baralhos, cartoes, ajustes, hist } = get(); return { baralhos, cartoes, ajustes, hist } },
  restaurar: async (d) => { set({ ...d }); await replaceCards(d) },
}))
