import { describe, expect, it, vi } from 'vitest'

// O contrato com o plugin de notificações locais (o Android de verdade não roda aqui: o que se prova é O QUE o app manda ao plugin).
const chamadas: { m: string; o?: unknown }[] = []
let pendentes: { id: number }[] = []
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: 'prompt-with-rationale' }),
    requestPermissions: async () => ({ display: 'granted' }),
    getPending: async () => ({ notifications: pendentes }),
    cancel: async (o: unknown) => { chamadas.push({ m: 'cancel', o }) },
    createChannel: async (o: unknown) => { chamadas.push({ m: 'createChannel', o }) },
    schedule: async (o: unknown) => { chamadas.push({ m: 'schedule', o }) },
    addListener: async () => ({ remove: async () => {} }),
  },
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))

const { CANAL_LEMBRETE, paraOPlugin, portaCapacitor, portaDeNotificacoes } = await import('./notificacoes')

const aviso = { id: 20_408, em: new Date(2026, 10, 16, 19, 0).getTime(), titulo: 'Hora de estudar', corpo: 'Esperando por você: 3 cartões para revisar.', tipo: 'inicio' as const }

describe('porta das notificações (plugin do Capacitor)', () => {
  it('no navegador não há porta (o navegador não avisa com o app fechado)', () => { expect(portaDeNotificacoes()).toBeNull() })

  it('o aviso vai ao plugin com id, texto, canal, hora e SEM alarme exato (não abre a tela "Alarmes e lembretes")', () => {
    expect(paraOPlugin(aviso)).toEqual({
      id: 20_408, title: 'Hora de estudar', body: 'Esperando por você: 3 cartões para revisar.', channelId: CANAL_LEMBRETE, autoCancel: true,
      schedule: { at: new Date(aviso.em), allowWhileIdle: true }, isExactNotification: false, extra: { destino: 'assistente' },
    })
  })

  it('o aviso de cartões leva o destino "cartoes" (o toque nele abre os Cartões, o de começo abre o Assistente)', () => {
    expect(paraOPlugin({ ...aviso, tipo: 'cartoes' }).extra).toEqual({ destino: 'cartoes' })
    expect(paraOPlugin(aviso).extra).toEqual({ destino: 'assistente' })
  })

  it('"prompt-with-rationale" do Android conta como "ainda não perguntou"', async () => {
    expect(await portaCapacitor.permissao()).toBe('prompt')
    expect(await portaCapacitor.pedirPermissao()).toBe('granted')
  })

  it('substituir cancela o que estava agendado, cria o canal (uma vez) e agenda a lista inteira de uma vez', async () => {
    chamadas.length = 0; pendentes = [{ id: 1 }, { id: 2 }]
    await portaCapacitor.substituir([aviso, { ...aviso, id: 20_409 }])
    expect(chamadas.map((c) => c.m)).toEqual(['cancel', 'createChannel', 'schedule'])
    expect(chamadas[0].o).toEqual({ notifications: [{ id: 1 }, { id: 2 }] })
    expect(chamadas[1].o).toMatchObject({ id: CANAL_LEMBRETE, importance: 4, vibration: true })
    expect((chamadas[2].o as { notifications: unknown[] }).notifications).toHaveLength(2)
    chamadas.length = 0; pendentes = []
    await portaCapacitor.substituir([aviso]) // o canal já existe: não cria de novo
    expect(chamadas.map((c) => c.m)).toEqual(['schedule'])
  })

  it('lista vazia só cancela (e sem pendentes não chama o plugin à toa)', async () => {
    chamadas.length = 0; pendentes = [{ id: 7 }]
    await portaCapacitor.substituir([])
    expect(chamadas.map((c) => c.m)).toEqual(['cancel'])
    chamadas.length = 0; pendentes = []
    await portaCapacitor.substituir([])
    expect(chamadas).toEqual([])
  })

  it('o aviso avulso (teste) não cancela nada', async () => {
    chamadas.length = 0; pendentes = [{ id: 9 }]
    await portaCapacitor.agendarUm(aviso)
    expect(chamadas.map((c) => c.m)).toEqual(['schedule'])
  })
})
