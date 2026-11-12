import { create } from 'zustand'
import { ABA_PADRAO, ICONES_PADRAO, limparAba, limparIcones, type Icones, type Lado, type PosicaoAba } from '../core/aba'

const CHAVE = 'treino_rail_aba' // preferência de quem usa (onde fica a aba); por isso fica no localStorage, não no banco
const CHAVE_ICONES = 'treino_rail_icones' // onde ficam os ícones dentro da barra (cima, meio, baixo)

const ler = (): PosicaoAba => { try { const t = localStorage.getItem(CHAVE); return t ? limparAba(JSON.parse(t)) : ABA_PADRAO } catch { return ABA_PADRAO } }
const gravar = (p: PosicaoAba) => { try { localStorage.setItem(CHAVE, JSON.stringify(p)) } catch { /* sem armazenamento: vale só nesta sessão */ } }
const lerIcones = (): Icones => { try { return limparIcones(localStorage.getItem(CHAVE_ICONES)) } catch { return ICONES_PADRAO } }
const gravarIcones = (i: Icones) => { try { localStorage.setItem(CHAVE_ICONES, i) } catch { /* sem armazenamento: vale só nesta sessão */ } }

interface State extends PosicaoAba {
  icones: Icones
  mover: (lado: Lado, pos: number) => void
  definirIcones: (i: Icones) => void
  /** Volta a aba (lado e altura) e o alinhamento dos ícones ao padrão. */
  reiniciar: () => void
}

/** Como a barra de navegação está arrumada: onde fica a aba (lado e altura) e onde ficam os ícones. Lembrado entre as sessões. */
export const useAba = create<State>((set) => ({
  ...ler(),
  icones: lerIcones(),
  mover: (lado, pos) => { const p = limparAba({ lado, pos }); gravar(p); set(p) },
  definirIcones: (i) => { const v = limparIcones(i); gravarIcones(v); set({ icones: v }) },
  reiniciar: () => { gravar(ABA_PADRAO); gravarIcones(ICONES_PADRAO); set({ ...ABA_PADRAO, icones: ICONES_PADRAO }) },
}))
