import { create } from 'zustand'
import { moverIndice } from '../core/ordemRail'

const CHAVE = 'treino_rail_ordem' // preferência de quem usa (ordem dos ícones da barra); fica no localStorage, não no banco

// guarda o que veio; quem usa a ordem (`ordenarItens`) descarta ids que não existem e completa os que faltam
const ler = (): string[] => { try { const t = localStorage.getItem(CHAVE), v: unknown = t ? JSON.parse(t) : null; return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] } catch { return [] } }
const gravar = (o: string[]) => { try { localStorage.setItem(CHAVE, JSON.stringify(o)) } catch { /* sem armazenamento: vale só nesta sessão */ } }

interface State {
  /** Ids na ordem escolhida; vazio = ordem padrão do app (quem usa passa por `ordenarItens`). */
  ordem: string[]
  /** Move o item `id` para a posição `para` da lista ATUAL `ids` (que é a que está na tela). */
  mover: (ids: string[], id: string, para: number) => void
  reiniciar: () => void
}

export const useOrdemRail = create<State>((set) => ({
  ordem: ler(),
  mover: (ids, id, para) => { const o = moverIndice(ids, ids.indexOf(id), para); gravar(o); set({ ordem: o }) },
  reiniciar: () => { gravar([]); set({ ordem: [] }) },
}))
