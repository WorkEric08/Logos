// A porta com o Android para o lembrete diário: o ÚNICO arquivo que fala com o plugin de notificações locais do Capacitor.
// Quem decide quais avisos existem é core/lembrete.ts (puro); aqui só se agenda, se cancela e se pede a permissão.
// No navegador/PWA não há porta (`portaDeNotificacoes()` devolve null): o navegador não avisa com o app fechado.
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Aviso } from '../../core/lembrete'
import { ehNativo } from './index'

export type Permissao = 'granted' | 'denied' | 'prompt'

export interface PortaNotificacoes {
  permissao(): Promise<Permissao>
  /** Pede a permissão (o Android 13+ mostra o diálogo do sistema; se a pessoa já negou duas vezes, ele não aparece e continua "denied"). */
  pedirPermissao(): Promise<Permissao>
  /** Troca TUDO o que estava agendado pela lista nova (idempotente: refazer a lista nunca duplica um aviso). Lista vazia = só cancela. */
  substituir(avisos: readonly Aviso[]): Promise<void>
  /** Um aviso avulso (o teste), sem mexer no que já estava agendado. */
  agendarUm(aviso: Aviso): Promise<void>
}

/** Canal das notificações: imutável depois de criado (o Android não deixa o app mudar importância nem som; só a pessoa, nas configurações). Id novo = canal novo. */
export const CANAL_LEMBRETE = 'lembrete-diario'

const comoPermissao = (v: string): Permissao => (v === 'granted' ? 'granted' : v === 'denied' ? 'denied' : 'prompt')

/** O aviso no formato do plugin. `isExactNotification: false`: um lembrete diário não precisa ser ao segundo, e o alarme exato faria o Android abrir a
 *  tela "Alarmes e lembretes" para a pessoa liberar uma permissão extra. Sem ele o aviso chega na hora marcada, com variação de poucos minutos. */
export const paraOPlugin = (a: Aviso) => ({
  id: a.id, title: a.titulo, body: a.corpo, channelId: CANAL_LEMBRETE, autoCancel: true,
  schedule: { at: new Date(a.em), allowWhileIdle: true }, isExactNotification: false,
  extra: { destino: a.tipo === 'cartoes' ? 'cartoes' : 'assistente' }, // para onde o toque leva: o aviso de cartões abre os Cartões; o de começo, o Assistente
})

let canalCriado = false
async function garantirCanal() {
  if (canalCriado) return
  // importância 4 = alta (aparece e toca), 1 = conteúdo visível na tela bloqueada (o texto só tem contagens de estudo, nada sensível), vibração ligada
  await LocalNotifications.createChannel({ id: CANAL_LEMBRETE, name: 'Lembrete diário de estudo', description: 'Um aviso por dia, na hora que você escolher', importance: 4, visibility: 1, vibration: true })
  canalCriado = true
}

export const portaCapacitor: PortaNotificacoes = {
  permissao: async () => comoPermissao((await LocalNotifications.checkPermissions()).display),
  pedirPermissao: async () => comoPermissao((await LocalNotifications.requestPermissions()).display),
  substituir: async (avisos) => {
    const { notifications } = await LocalNotifications.getPending()
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) })
    if (!avisos.length) return
    await garantirCanal()
    await LocalNotifications.schedule({ notifications: avisos.map(paraOPlugin) })
  },
  agendarUm: async (aviso) => { await garantirCanal(); await LocalNotifications.schedule({ notifications: [paraOPlugin(aviso)] }) },
}

export const portaDeNotificacoes = (): PortaNotificacoes | null => (ehNativo() ? portaCapacitor : null)

/** Chama `f` quando a pessoa toca numa notificação (com o app aberto, em segundo plano ou fechado: o plugin guarda o toque até alguém ouvir). `destino` é o que o aviso levava no `extra`. */
export async function aoTocarNaNotificacao(f: (destino: 'assistente' | 'cartoes') => void): Promise<() => void> {
  const h = await LocalNotifications.addListener('localNotificationActionPerformed', (e) => f((e?.notification?.extra as { destino?: string } | undefined)?.destino === 'cartoes' ? 'cartoes' : 'assistente'))
  return () => { void h.remove() }
}
