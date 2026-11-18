// Liga o lembrete diário ao app (só no APK): carrega a configuração e refaz a lista de avisos quando o app abre, quando volta para a frente e
// quando a pessoa estuda (o aviso de hoje some se ela já estudou; o texto acompanha o que está esperando). Tocar no aviso abre o Assistente (com um simulado em andamento, pergunta antes de sair dele)
// (o painel do dia). Quem decide os avisos é core/lembrete.ts; quem fala com o Android é services/native/notificacoes.ts.
import { App } from '@capacitor/app'
import { useApp } from '../store/app'
import { useCards } from '../store/cards'
import { useLembrete } from '../store/lembrete'
import { ehNativo } from './native'
import { aoTocarNaNotificacao } from './native/notificacoes'

const ESPERA_MS = 800

export function ligarLembretes(): () => void {
  if (!ehNativo()) return () => {}
  let vivo = true
  const limpezas: (() => void)[] = []
  let t: ReturnType<typeof setTimeout> | undefined
  const logo = () => { clearTimeout(t); t = setTimeout(() => void useLembrete.getState().replanejar(), ESPERA_MS) }

  // o que já foi estudado hoje só vale depois de os dados terem sido lidos do aparelho: antes disso "não estudou" seria mentira e o aviso de hoje tocaria à toa
  const prontos = () => useApp.getState().ready && useCards.getState().pronto
  const partir = async () => {
    await new Promise<void>((ok) => {
      if (prontos()) return ok()
      const fim = () => { if (prontos()) { u1(); u2(); ok() } }
      const u1 = useApp.subscribe(fim), u2 = useCards.subscribe(fim)
    })
    if (!vivo) return
    await useLembrete.getState().carregar()
    await useLembrete.getState().replanejar()
    // estudar (questão ou cartão) muda o histórico do dia: refaz a lista (o de hoje sai; o texto acompanha)
    limpezas.push(useApp.subscribe((s, p) => { if (s.hist !== p.hist) logo() }))
    limpezas.push(useCards.subscribe((s, p) => { if (s.hist !== p.hist || s.cartoes !== p.cartoes) logo() }))
  }
  void partir()

  void App.addListener('appStateChange', ({ isActive }) => { if (isActive && prontos()) void useLembrete.getState().aoVoltar() }).then((h) => {
    if (vivo) limpezas.push(() => void h.remove()); else void h.remove()
  }).catch(() => { /* sem o plugin do aplicativo: sem esse ouvinte */ })
  void aoTocarNaNotificacao((destino) => useApp.getState().irPara(destino)).then((parar) => { if (vivo) limpezas.push(parar); else parar() }).catch(() => { /* sem o plugin de notificações: o lembrete simplesmente não existe */ })

  return () => { vivo = false; clearTimeout(t); for (const l of limpezas.splice(0)) l() }
}
