// A conta Google e o estado da sincronização, para a tela "Mais" mostrar. O app funciona sem conta: entrar é opcional.
// O Firebase só é carregado se a pessoa já entrou antes neste aparelho (flag no localStorage) ou se tocar em "Entrar".
import { create } from 'zustand'
import { useApp } from '../../store/app'
import { useCards } from '../../store/cards'
import { gravarUidSync, lerUidSync } from '../db'
import { entrarComGoogle, mensagemDeErro, observarUsuario, sairDaConta } from './firebase'
import { portaFirestore } from './firestore'
import { iniciarSincronizacao, type EstadoSync, type Sincronizacao } from './motor'
import { registrarApagarEvento } from './ponte'

const FLAG = 'logos_conta'
const lerFlag = () => { try { return localStorage.getItem(FLAG) === '1' } catch { return false } }
const poeFlag = (v: boolean) => { try { if (v) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG) } catch { /* sem armazenamento: só não lembra */ } }

export interface Usuario { uid: string; email: string; nome: string }
interface State {
  /** 'iniciando' só enquanto o Firebase verifica se já havia alguém logado. */
  estado: 'iniciando' | 'fora' | 'dentro'
  usuario: Usuario | null
  sync: EstadoSync
  detalhe: string
  ocupado: boolean
  erro: string
  entrar: () => Promise<void>
  sair: () => Promise<void>
}

let sincronizacao: Sincronizacao | null = null
let parouOuvir: (() => void) | null = null
let iniciou = false

const pararSync = () => { sincronizacao?.parar(); sincronizacao = null; registrarApagarEvento(null) }

export const useConta = create<State>((set, get) => ({
  estado: 'fora', usuario: null, sync: 'parado', detalhe: '', ocupado: false, erro: '',
  entrar: async () => {
    if (get().ocupado) return
    set({ ocupado: true, erro: '' })
    try {
      await ouvirConta() // garante que o Firebase está carregado e escutando
      await entrarComGoogle()
    } catch (e) { set({ erro: mensagemDeErro(e) }) }
    finally { set({ ocupado: false }) }
  },
  sair: async () => {
    set({ ocupado: true, erro: '' })
    pararSync()
    try { await sairDaConta() } catch (e) { set({ erro: mensagemDeErro(e) }) }
    poeFlag(false); set({ usuario: null, estado: 'fora', sync: 'parado', detalhe: '', ocupado: false }) // os dados do aparelho ficam: sair da conta não apaga nada
  },
}))

/** Recarrega do banco local o que a nuvem trouxe (as telas leem dos estados em memória). */
async function aoReceber(o: { progresso: boolean; cartoes: boolean; marcas: boolean }) {
  if (o.progresso || o.marcas) await useApp.getState().recarregar(o)
  if (o.cartoes) await useCards.getState().load()
}

async function usuarioMudou(u: { uid: string; email: string | null; displayName: string | null } | null) {
  pararSync()
  if (!u) { set({ usuario: null, estado: 'fora', sync: 'parado' }); return }
  // O aparelho só junta dados com UMA conta: outra conta no mesmo aparelho misturaria o que é de pessoas diferentes.
  const dono = await lerUidSync()
  if (dono && dono !== u.uid) {
    try { await sairDaConta() } catch { /* segue */ }
    poeFlag(false)
    set({ usuario: null, estado: 'fora', sync: 'parado', erro: 'Este aparelho já foi ligado a outra conta Google. Entre com a mesma conta de antes (os dados daqui não são misturados com os de outra pessoa).' })
    return
  }
  if (!dono) await gravarUidSync(u.uid)
  poeFlag(true)
  set({ usuario: { uid: u.uid, email: u.email ?? '', nome: u.displayName ?? '' }, estado: 'dentro', erro: '' })
  sincronizacao = iniciarSincronizacao(portaFirestore(u.uid), {
    aoReceber: (o) => void aoReceber(o).catch((e) => console.warn('[sync] não recarregou a tela', e)),
    aoMudarEstado: (e, d) => set({ sync: e, detalhe: d ?? '' }),
  })
  registrarApagarEvento((id) => sincronizacao?.apagarEventoNaNuvem(id))
}
const set = (p: Partial<State>) => useConta.setState(p)

/** Começa a escutar o login. Só carrega o Firebase se já houve login neste aparelho (ou quando a pessoa tocar em "Entrar"). */
export async function ouvirConta(): Promise<void> {
  if (iniciou) return
  iniciou = true
  set({ estado: 'iniciando' })
  try {
    parouOuvir = await observarUsuario((u) => { void usuarioMudou(u).catch((e) => set({ erro: mensagemDeErro(e), sync: 'erro' })) }, (e) => set({ erro: mensagemDeErro(e), estado: 'fora' }))
  } catch (e) { iniciou = false; set({ estado: 'fora', erro: mensagemDeErro(e) }) }
}
export const iniciarContaSeJaEntrou = () => { if (lerFlag()) void ouvirConta() }
export const pararDeOuvirConta = () => { pararSync(); parouOuvir?.(); parouOuvir = null; iniciou = false }
