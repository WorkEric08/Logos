// O lembrete diário (estado da tela e orquestração). A decisão de quais avisos existem é core/lembrete.ts; o Android é a `PortaNotificacoes`
// (services/native/notificacoes.ts), injetada para o teste usar uma de mentira. No navegador não há porta: `disponivel` é falso e nada é agendado.
import { create } from 'zustand'
import { LEMBRETE_PADRAO, avisoDeTeste, lerConfig, planejarLembretes, proximoAviso, somarMinutos, type Aviso, type ConfigLembrete, type EstadoDoDia } from '../core/lembrete'
import { gravarLembreteGuardado, lerLembreteGuardado } from '../services/db'
import { portaDeNotificacoes, type Permissao, type PortaNotificacoes } from '../services/native/notificacoes'
import { useAssistente } from './assistente'

export type SituacaoPermissao = Permissao | 'indisponivel'

interface State {
  config: ConfigLembrete
  carregada: boolean
  /** Há como avisar? (só no app do Android) */
  disponivel: boolean
  permissao: SituacaoPermissao
  /** Quando é o próximo aviso, em palavras ("hoje às 19:00"); null se não há (desligado, ou já estudou e é o último da janela). */
  proximo: string | null
  /** Uma explicação para a pessoa (permissão negada, teste enviado…). */
  nota: string | null
  ocupado: boolean
  carregar: () => Promise<void>
  ligar: () => Promise<void>
  desligar: () => Promise<void>
  definirHora: (hora: number, minuto: number) => Promise<void>
  somarMinutos: (delta: number) => Promise<void>
  testar: () => Promise<void>
  /** Refaz a lista de avisos (chamado ao abrir, ao voltar ao app e quando a pessoa estuda). Uma por vez. */
  replanejar: () => Promise<void>
  /** A pessoa voltou ao app: relê a permissão (pode ter mudado nas configurações) e refaz a lista. */
  aoVoltar: () => Promise<void>
}

const NOTA_NEGADA = 'O Android bloqueou as notificações do Logos. Abra Configurações do Android › Apps › Logos › Notificações e permita; depois ligue de novo.'
const NOTA_TESTE = 'Teste enviado: o aviso chega em 5 segundos. Pode sair do app para ver como ele aparece.'

/** `porta` e `agora` entram de fora para o teste; no app valem o Android e o relógio. */
export function criarLoja(porta: PortaNotificacoes | null = portaDeNotificacoes(), agora: () => number = Date.now, estado: () => Promise<EstadoDoDia> = () => useAssistente.getState().estadoDoDia()) {
  // uma troca de lista por vez (a janela é refeita a cada estudo; duas ao mesmo tempo se atropelariam: cancelar uma e agendar outra)
  let fila: Promise<unknown> = Promise.resolve()
  const emFila = <T,>(f: () => Promise<T>): Promise<T> => { const p = fila.then(f, f); fila = p.catch(() => {}); return p }

  return create<State>((set, get) => {
    const gravar = async (c: ConfigLembrete) => { set({ config: c }); try { await gravarLembreteGuardado(c) } catch { /* sem banco: vale nesta abertura */ } }
    const lista = async (): Promise<Aviso[]> => planejarLembretes(get().config, await estado(), agora())
    const aplicar = async () => {
      if (!porta) return
      const c = get().config
      if (!c.ativo) { await porta.substituir([]); set({ proximo: null }); return }
      const p = await porta.permissao()
      set({ permissao: p })
      if (p !== 'granted') { await porta.substituir([]); set({ proximo: null }); return } // sem permissão não há o que agendar (e o que sobrou de antes é tirado)
      const avisos = await lista()
      await porta.substituir(avisos)
      set({ proximo: proximoAviso(avisos, agora()) })
    }
    const replanejar = () => emFila(async () => { try { await aplicar() } catch { set({ nota: 'Não consegui agendar o lembrete agora. Tente de novo mais tarde.' }) } })

    return {
      config: LEMBRETE_PADRAO, carregada: false, disponivel: !!porta, permissao: porta ? 'prompt' : 'indisponivel', proximo: null, nota: null, ocupado: false,
      carregar: async () => {
        let c = LEMBRETE_PADRAO
        try { c = lerConfig(await lerLembreteGuardado()) } catch { /* banco indisponível: padrão */ }
        set({ config: c, carregada: true })
        if (porta) { try { set({ permissao: await porta.permissao() }) } catch { /* sem plugin: segue */ } }
      },
      ligar: async () => {
        if (!porta || get().ocupado) return
        set({ ocupado: true, nota: null })
        try {
          // a permissão só é pedida AQUI, quando a pessoa liga (desligado de fábrica); confere o estado na hora (pode ter mudado nas configurações)
          let p = await porta.permissao()
          if (p === 'prompt') p = await porta.pedirPermissao()
          set({ permissao: p })
          if (p !== 'granted') { set({ nota: NOTA_NEGADA }); return }
          await gravar({ ...get().config, ativo: true })
          await replanejar()
        } catch { set({ nota: 'Não consegui ligar o lembrete agora. Tente de novo.' }) } finally { set({ ocupado: false }) }
      },
      desligar: async () => { await gravar({ ...get().config, ativo: false }); set({ nota: null }); await replanejar() },
      definirHora: async (hora, minuto) => { await gravar({ ...get().config, hora, minuto }); await replanejar() },
      somarMinutos: async (delta) => { await gravar(somarMinutos(get().config, delta)); await replanejar() },
      testar: async () => {
        if (!porta || get().ocupado) return
        set({ ocupado: true, nota: null })
        try {
          let p = await porta.permissao()
          if (p === 'prompt') p = await porta.pedirPermissao()
          set({ permissao: p })
          if (p !== 'granted') { set({ nota: NOTA_NEGADA }); return }
          await porta.agendarUm(avisoDeTeste(await estado(), agora()))
          set({ nota: NOTA_TESTE })
        } catch { set({ nota: 'Não consegui enviar o teste agora.' }) } finally { set({ ocupado: false }) }
      },
      replanejar,
      aoVoltar: async () => { if (!porta) return; try { set({ permissao: await porta.permissao() }) } catch { /* segue */ } await replanejar() },
    }
  })
}

export const useLembrete = criarLoja()
