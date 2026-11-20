// A conta Google e o estado da sincronização, para a tela "Mais" mostrar. O app funciona sem conta: entrar é opcional.
// O Firebase só é carregado se a pessoa já entrou antes neste aparelho (flag no localStorage) ou se tocar em "Entrar".
import { create } from 'zustand'
import { useApp } from '../../store/app'
import { useCards } from '../../store/cards'
import { useEspacos } from '../../store/espacos'
import { gravarAvisoEspacos, gravarUidSync, lerUidSync, limparCursores } from '../db'
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
  /** O andamento dos pacotes de espaços e materiais (F6): quantos faltam baixar e quantos bytes. */
  pacotes: { total: number; baixar: number; subir: number; cota: number; bytesBaixar: number; bytesTotal: number }
  detalhe: string
  ocupado: boolean
  erro: string
  entrar: () => Promise<void>
  sair: () => Promise<void>
  /** Há espaço ou material daqui para subir e a pessoa ainda não viu o aviso do que sobe (F6.5). */
  precisaAviso: boolean
  /** Responde ao aviso da primeira subida: 'enviar' ou 'manter' (o que já existe fica só neste aparelho). */
  responderAviso: (modo: 'enviar' | 'manter') => Promise<void>
  /** Lê TUDO da conta de novo (apaga o cursor da leitura incremental): a rede de segurança se algo parecer faltar (relógio muito errado, alteração antiga demais). */
  sincronizarTudo: () => Promise<void>
}

let sincronizacao: Sincronizacao | null = null
let parouOuvir: (() => void) | null = null
let iniciou = false

const pararSync = () => { sincronizacao?.parar(); sincronizacao = null; registrarApagarEvento(null); set({ precisaAviso: false }) }

export const useConta = create<State>((set, get) => ({
  estado: 'fora', usuario: null, sync: 'parado', precisaAviso: false, pacotes: { total: 0, baixar: 0, subir: 0, cota: 0, bytesBaixar: 0, bytesTotal: 0 }, detalhe: '', ocupado: false, erro: '',
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
  responderAviso: async (modo) => {
    await gravarAvisoEspacos(modo); set({ precisaAviso: false })
    await useEspacos.getState().atualizarSelos()
    void sincronizacao?.sincronizarAgora()
  },
  sincronizarTudo: async () => {
    const u = useConta.getState().usuario
    if (!u) return
    pararSync(); await limparCursores(); ligar(u.uid) // nada local é apagado: só a próxima leitura volta a ser a coleção inteira
  },
}))

/** Recarrega do banco local o que a nuvem trouxe (as telas leem dos estados em memória). */
async function aoReceber(o: { progresso: boolean; cartoes: boolean; marcas: boolean; espacos: boolean }) {
  if (o.progresso || o.marcas) await useApp.getState().recarregar(o)
  if (o.cartoes) await useCards.getState().load()
  if (o.espacos) await useEspacos.getState().recarregar() // chegaram espaços, questões ou materiais (F6): a lista e, se for o caso, o espaço ativo
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
  ligar(u.uid)
}
function ligar(uid: string) {
  sincronizacao = iniciarSincronizacao(portaFirestore(uid), {
    aoReceber: (o) => void aoReceber(o).catch((e) => console.warn('[sync] não recarregou a tela', e)),
    aoMudarEstado: (e, d) => set({ sync: e, detalhe: d ?? '' }),
    espacoAtivo: () => useEspacos.getState().ativo,
    aoPacotes: (pacotes) => { set({ pacotes }); void useEspacos.getState().atualizarSelos() },
    aoPrecisaAviso: () => set({ precisaAviso: true }),
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
