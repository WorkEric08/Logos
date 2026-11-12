import { useEffect, useRef, useState } from 'react'
import { askPersist } from '../services/db'
import { bindBack } from '../services/backStack'
import { ehNativo } from '../services/native'
import { bindNativeBack } from '../services/native/voltar'
import { useApp, type Tab } from '../store/app'
import { useCards } from '../store/cards'
import { useAba } from '../store/aba'
import { useOrdemRail } from '../store/ordemRail'
import { ordenarItens } from '../core/ordemRail'
import { CAMADA_RESULTADO, camadaDaAba, camadaDaQuestao, sentidoDaTroca, type Camada, type Sentido } from '../core/movimento'
import { useBackLayer } from './useBackLayer'
import { Toast } from './Toast'
import { SlotCtx } from './bits'
import { NavigationRail, useCelular, useRailRecolhida, type ItemRail } from './NavigationRail'
import { Desempenho, Inicio, Mais, Treinar } from './Views'
import { Cartoes } from './Cards'
import { Questao, Resultado } from './Question'
import { AVISOS } from '../core/avisos'
import { Splash } from './Splash'
import { ConfirmarSaida } from './ConfirmarSaida'
import { PainelAlca } from './PainelAlca'
import { reiniciarProvas } from './Provas'

const ITENS: ItemRail<Tab>[] = [
  { id: 'inicio', rotulo: 'Início', icone: 'home' }, { id: 'treinar', rotulo: 'Treinar', icone: 'train' }, { id: 'cartoes', rotulo: 'Cards', icone: 'cards' },
  { id: 'desempenho', rotulo: 'Desempenho', icone: 'chart' }, { id: 'mais', rotulo: 'Mais', icone: 'sliders' },
]
const VIEWS = { inicio: Inicio, treinar: Treinar, cartoes: Cartoes, desempenho: Desempenho, mais: Mais }

export function App() {
  const { ready, tab, session, saida, reinicio, load, irPara, sair } = useApp()
  const main = useRef<HTMLElement>(null)
  const [recolhida, alternarRail] = useRailRecolhida()
  const celular = useCelular()
  const aba = useAba()
  const ordem = useOrdemRail((s) => s.ordem), moverItem = useOrdemRail((s) => s.mover)
  const itens = ordenarItens(ITENS, ordem) // a ordem dos ícones é de quem usa (arrastar um ícone na barra)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  // abertura animada de 2 s; a única chave de teste é localStorage.treino_skip_splash = '1'
  const [abertura, setAbertura] = useState(() => { try { return localStorage.getItem('treino_skip_splash') !== '1' } catch { return true } })
  useEffect(() => { void load(); void useCards.getState().load(); askPersist() }, [load])
  useEffect(() => (ehNativo() ? bindNativeBack : bindBack)({
    goHome: () => { if (useApp.getState().tab === 'inicio') return false; useApp.getState().setTab('inicio'); return true },
    askExit: () => useApp.getState().showToast(AVISOS.voltarParaSair),
  }), [])
  // com o aviso “encerrar o simulado?” aberto, a camada do aviso é a de cima; ao cancelar, esta volta a valer
  useBackLayer(!!session && !saida, sair)
  useEffect(() => { // o relógio escondido do simulado só corre com o app à vista (tela bloqueada ou segundo plano pausam)
    const v = () => (document.hidden ? useApp.getState().pausarCron() : useApp.getState().retomarCron())
    document.addEventListener('visibilitychange', v)
    return () => document.removeEventListener('visibilitychange', v)
  }, [])
  useEffect(() => {
    useApp.getState().tema !== 'auto' && (document.documentElement.dataset.tema = useApp.getState().tema)
  }, [ready])
  const key = session ? `${session.i}-${session.done}-${session.review}` : `${tab}-${reinicio}`
  useEffect(() => { main.current?.scrollTo(0, 0) }, [key])

  // Movimento entre telas (o mesmo dos Cards): entrar mais fundo desliza pela direita, voltar pela esquerda, trocar de aba sobe de leve.
  // O sentido fica em estado (decidido só quando a camada muda) para que um re-render no meio da animação não a corte.
  const camadaAtual: Camada = session ? (session.done && !session.review ? CAMADA_RESULTADO : camadaDaQuestao(!!session.review)) : camadaDaAba(tab, reinicio)
  const [mov, setMov] = useState<{ cam: Camada; sentido: Sentido | null }>({ cam: camadaAtual, sentido: null })
  if (mov.cam.id !== camadaAtual.id) setMov({ cam: camadaAtual, sentido: sentidoDaTroca(mov.cam, camadaAtual) })
  const View = VIEWS[tab]
  // ícone da barra: o do Início também recomeça as provas pela lista de bancos (a menos que um simulado em andamento peça confirmação)
  const aoSelecionar = (t: Tab) => { const s = useApp.getState().session; if (t === 'inicio' && !(s?.sim && !s.done)) reiniciarProvas(); irPara(t) }
  const splash = abertura ? <Splash ready={ready} onFinish={() => setAbertura(false)} /> : null
  // A abertura fica sempre na mesma posição da árvore (2º filho): não remonta quando o app termina de carregar.
  const miolo = !ready ? <div className="boot" aria-busy="true" /> : (
    <SlotCtx value={slot}>
    <div className="shell" data-recolhida={recolhida ? '1' : undefined} data-lado={aba.lado}>
      <NavigationRail itens={itens} ativo={session ? null : tab} nomeAtual={ITENS.find((i) => i.id === tab)?.rotulo ?? ''} recolhida={recolhida} onSelecionar={aoSelecionar} onAlternar={alternarRail} lado={aba.lado} posicao={aba.pos} onMover={aba.mover} onReordenar={(id, para) => moverItem(itens.map((i) => i.id), id, para)} icones={aba.icones} />
      <main className="scroll-y" ref={main} inert={celular && !recolhida}>
        <div key={mov.cam.id} className={`page${!session && tab === 'inicio' ? ' ini' : ''}${!session && tab !== 'inicio' ? ' xl' : ''}${mov.sentido ? ` fc-tela ${mov.sentido}` : ''}`}>{session ? (session.done && !session.review ? <Resultado /> : <Questao />) : <View key={reinicio} />}</div>
      </main>
      {session && !(session.done && !session.review) && <PainelAlca />}{/* só na tela da questão (o painel dela é o único redimensionável) */}
      <div className="slot" ref={setSlot} />
      <Toast />
      {saida && <ConfirmarSaida />}
    </div>
    </SlotCtx>
  )
  return <>{miolo}{splash}</>
}
