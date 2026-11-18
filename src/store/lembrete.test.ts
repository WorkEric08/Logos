// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Aviso, EstadoDoDia } from '../core/lembrete'
import type { Permissao, PortaNotificacoes } from '../services/native/notificacoes'

// O lembrete diário: o que a tela liga e desliga, com um Android de mentira (a porta) para ver o que seria agendado.
type Mod = typeof import('./lembrete')
let mod: Mod
let guardado: typeof import('../services/db')
beforeEach(async () => { await Dexie.delete('treino-bb'); vi.resetModules(); mod = await import('./lembrete'); guardado = await import('../services/db') })

const AGORA = new Date(2026, 10, 16, 10, 0).getTime() // segunda-feira, 10:00
const vazio: EstadoDoDia = { respondidasHoje: 0, cartoesHoje: 0, cartoesParaEstudar: 12, erros: 5, sequencia: 0 }

function fingir(perm: Permissao = 'prompt') {
  const f = { perm, respostaDoPedido: 'granted' as Permissao, pedidos: 0, trocas: [] as Aviso[][], avulsos: [] as Aviso[], falha: false, atraso: 0, emAndamento: 0, maxEmAndamento: 0 }
  const porta: PortaNotificacoes = {
    permissao: async () => f.perm,
    pedirPermissao: async () => { f.pedidos++; f.perm = f.respostaDoPedido; return f.perm },
    substituir: async (a) => {
      f.emAndamento++; f.maxEmAndamento = Math.max(f.maxEmAndamento, f.emAndamento)
      if (f.atraso) await new Promise((r) => setTimeout(r, f.atraso))
      f.emAndamento--
      if (f.falha) throw new Error('plugin caiu')
      f.trocas.push([...a])
    },
    agendarUm: async (a) => { f.avulsos.push(a) },
  }
  return { f, porta }
}
// (de fábrica o horário é 00:00; os testes abaixo, que falam de "hoje às 19:00", começam com 19:00 na memória, como se a pessoa já o tivesse escolhido)
const a19 = (l: ReturnType<Mod['criarLoja']>) => l.setState({ config: { ...l.getState().config, hora: 19, minuto: 0 } })
const nova = (porta: PortaNotificacoes | null, estado: () => Promise<EstadoDoDia> = async () => vazio) => { const l = mod.criarLoja(porta, () => AGORA, estado); a19(l); return l }
const ultima = (f: ReturnType<typeof fingir>['f']) => f.trocas.at(-1)!

describe('lembrete diário: sem Android (navegador)', () => {
  it('não há como avisar: nada liga, nada agenda, e a tela diz que é só do app', async () => {
    const l = nova(null)
    expect(l.getState().disponivel).toBe(false); expect(l.getState().permissao).toBe('indisponivel')
    await l.getState().ligar(); await l.getState().testar(); await l.getState().replanejar()
    expect(l.getState().config.ativo).toBe(false)
  })
})

describe('lembrete diário: ligar', () => {
  it('de fábrica está desligado e NÃO pede permissão ao abrir', async () => {
    const { f, porta } = fingir(); const l = nova(porta)
    await l.getState().carregar(); await l.getState().replanejar()
    expect(l.getState().config).toEqual({ ativo: false, hora: 0, minuto: 0, periodos: [] }); expect(f.pedidos).toBe(0)
    expect(ultima(f)).toEqual([]) // desligado: só garante que não sobrou nada agendado
  })
  it('ao ligar pede a permissão (uma vez), grava e agenda a janela inteira; diz quando é o próximo', async () => {
    const { f, porta } = fingir('prompt'); const l = nova(porta)
    await l.getState().carregar(); a19(l); await l.getState().ligar()
    expect(f.pedidos).toBe(1); expect(l.getState().config.ativo).toBe(true); expect(l.getState().permissao).toBe('granted')
    const a = ultima(f); expect(a).toHaveLength(14); expect(a[0].em).toBe(new Date(2026, 10, 16, 19, 0).getTime())
    expect(a[0].corpo).toMatch(/12 cartões para revisar e 5 questões no caderno de erros/)
    expect(l.getState().proximo).toBe('hoje às 19:00')
    expect(await guardado.lerLembreteGuardado()).toEqual({ ativo: true, hora: 19, minuto: 0, periodos: [] })
  })
  it('permissão já dada: não pergunta de novo', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta)
    await l.getState().ligar(); expect(f.pedidos).toBe(0); expect(l.getState().config.ativo).toBe(true)
  })
  it('permissão negada: não liga, explica o que fazer e não agenda nada', async () => {
    const { f, porta } = fingir('prompt'); f.respostaDoPedido = 'denied'; const l = nova(porta)
    await l.getState().ligar()
    expect(l.getState().config.ativo).toBe(false); expect(l.getState().permissao).toBe('denied'); expect(l.getState().nota).toMatch(/Configurações do Android/)
    expect(f.trocas).toEqual([]); expect(await guardado.lerLembreteGuardado()).toBeNull()
  })
  it('já bloqueada nas configurações ("denied"): nem tenta pedir (o Android não mostraria o diálogo)', async () => {
    const { f, porta } = fingir('denied'); const l = nova(porta)
    await l.getState().ligar(); expect(f.pedidos).toBe(0); expect(l.getState().config.ativo).toBe(false)
  })
})

describe('lembrete diário: o que é agendado', () => {
  it('quem já estudou hoje não recebe o de hoje: o próximo é amanhã', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta, async () => ({ ...vazio, respondidasHoje: 4 }))
    await l.getState().ligar()
    expect(ultima(f)).toHaveLength(13); expect(l.getState().proximo).toBe('amanhã às 19:00')
  })
  it('estudar depois de ligar refaz a lista e tira o de hoje (e o que sobrou não duplica: é sempre a lista inteira)', async () => {
    const { f, porta } = fingir('granted'); let estado = vazio
    const l = nova(porta, async () => estado)
    await l.getState().ligar(); expect(ultima(f)).toHaveLength(14)
    estado = { ...vazio, cartoesHoje: 3 }; await l.getState().replanejar()
    expect(ultima(f)).toHaveLength(13); expect(new Set(ultima(f).map((a) => a.id)).size).toBe(13)
  })
  it('mudar a hora (botões e atalhos) reagenda e fica guardado', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta)
    await l.getState().ligar()
    await l.getState().somarMinutos(15); expect(l.getState().config).toMatchObject({ hora: 19, minuto: 15 }); expect(ultima(f)[0].em).toBe(new Date(2026, 10, 16, 19, 15).getTime())
    await l.getState().definirHora(7, 30)
    expect(ultima(f)[0].em).toBe(new Date(2026, 10, 17, 7, 30).getTime()) // 07:30 de hoje já passou: o primeiro é amanhã
    expect(await guardado.lerLembreteGuardado()).toEqual({ ativo: true, hora: 7, minuto: 30, periodos: [] })
  })
  it('apertar e segurar o "+": a tela anda de 15 em 15 minutos SEM reagendar a cada passo; ao soltar guarda e reagenda uma vez só', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta)
    await l.getState().ligar(); const trocas = f.trocas.length
    for (let i = 0; i < 6; i++) l.getState().ajustarHora(15)
    expect(l.getState().config).toMatchObject({ hora: 20, minuto: 30 }); expect(f.trocas.length).toBe(trocas) // só a tela mudou
    expect(await guardado.lerLembreteGuardado()).toMatchObject({ hora: 19, minuto: 0 })
    await l.getState().confirmarHora()
    expect(f.trocas.length).toBe(trocas + 1); expect(ultima(f)[0].em).toBe(new Date(2026, 10, 16, 20, 30).getTime())
    expect(await guardado.lerLembreteGuardado()).toMatchObject({ hora: 20, minuto: 30 })
    for (let i = 0; i < 4; i++) l.getState().ajustarHora(-15); await l.getState().confirmarHora()
    expect(l.getState().config).toMatchObject({ hora: 19, minuto: 30 })
  })
  it('o horário dá a volta no relógio ao segurar (de 23:45 para 00:00 e de 00:00 para 23:45)', async () => {
    const { porta } = fingir('granted'); const l = nova(porta)
    l.setState({ config: { ...l.getState().config, hora: 23, minuto: 45 } }); l.getState().ajustarHora(15)
    expect(l.getState().config).toMatchObject({ hora: 0, minuto: 0 })
    l.getState().ajustarHora(-15); expect(l.getState().config).toMatchObject({ hora: 23, minuto: 45 })
  })
  it('a configuração guardada volta na próxima abertura do app', async () => {
    await guardado.gravarLembreteGuardado({ ativo: true, hora: 21, minuto: 0, periodos: ['noite'] })
    const { f, porta } = fingir('granted'); const l = nova(porta)
    await l.getState().carregar(); await l.getState().replanejar()
    expect(l.getState().config).toEqual({ ativo: true, hora: 21, minuto: 0, periodos: ['noite'] }); expect(ultima(f)[0].em).toBe(new Date(2026, 10, 16, 21, 0).getTime())
  })
  it('desligar cancela tudo e guarda', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta)
    await l.getState().ligar(); await l.getState().desligar()
    expect(ultima(f)).toEqual([]); expect(l.getState().proximo).toBeNull(); expect((await guardado.lerLembreteGuardado() as { ativo: boolean }).ativo).toBe(false)
  })
  it('a pessoa tirou a permissão nas configurações do Android: ao voltar ao app o app percebe e não deixa nada agendado', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta)
    await l.getState().ligar(); f.perm = 'denied'
    await l.getState().aoVoltar()
    expect(l.getState().permissao).toBe('denied'); expect(ultima(f)).toEqual([]); expect(l.getState().config.ativo).toBe(true) // continua "ligado" para voltar sozinho quando liberar
    f.perm = 'granted'; await l.getState().aoVoltar(); expect(ultima(f)).toHaveLength(14)
  })
})

describe('lembrete diário: teste, fila e falhas', () => {
  it('"Enviar um teste" agenda um aviso avulso em 5 s, sem mexer na lista real', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta)
    await l.getState().testar()
    expect(f.avulsos).toHaveLength(1); expect(f.avulsos[0].em - AGORA).toBe(5000); expect(f.avulsos[0].corpo).toMatch(/^Teste: /); expect(f.trocas).toEqual([])
    expect(l.getState().nota).toMatch(/5 segundos/)
  })
  it('o teste também pede a permissão (e sem ela explica)', async () => {
    const { f, porta } = fingir('prompt'); f.respostaDoPedido = 'denied'; const l = nova(porta)
    await l.getState().testar(); expect(f.avulsos).toEqual([]); expect(l.getState().nota).toMatch(/bloqueou/)
  })
  it('trocas de lista nunca se atropelam: uma por vez, mesmo com várias pedidas juntas', async () => {
    const { f, porta } = fingir('granted'); f.atraso = 15; const l = nova(porta)
    await l.getState().ligar()
    await Promise.all([l.getState().replanejar(), l.getState().replanejar(), l.getState().definirHora(8, 0)])
    expect(f.maxEmAndamento).toBe(1)
  })
  it('o plugin falhar não quebra o app: avisa e a fila segue funcionando', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta)
    await l.getState().ligar(); f.falha = true
    await l.getState().replanejar(); expect(l.getState().nota).toMatch(/Não consegui agendar/)
    f.falha = false; await l.getState().replanejar(); expect(ultima(f)).toHaveLength(14)
  })
})

describe('lembrete diário: períodos de aviso de cartões', () => {
  const comPrevisao = (n: number): EstadoDoDia => ({ ...vazio, cartoesParaEstudar: n, cartoesPorDia: Array.from({ length: 14 }, () => n) })
  it('de fábrica nenhum período está marcado: só o aviso de começo', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta, async () => comPrevisao(9))
    await l.getState().ligar()
    expect(l.getState().config.periodos).toEqual([]); expect(ultima(f).every((a) => a.tipo === 'inicio')).toBe(true)
  })
  it('marcar um período agenda os avisos de cartões, guarda e mostra o de começo como "próximo"', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta, async () => comPrevisao(9))
    await l.getState().ligar(); await l.getState().alternarPeriodo('noite'); await l.getState().alternarPeriodo('tarde')
    expect(l.getState().config.periodos).toEqual(['tarde', 'noite'])
    const c = ultima(f).filter((a) => a.tipo === 'cartoes'); expect(c).toHaveLength(14 * 2); expect(c[0].corpo).toBe('Você ainda tem 9 cartões para revisar hoje.')
    expect(l.getState().proximo).toBe('hoje às 19:00')
    expect(await guardado.lerLembreteGuardado()).toMatchObject({ periodos: ['tarde', 'noite'] })
  })
  it('revisou tudo: a lista é refeita e os avisos de cartões de hoje saem', async () => {
    const { f, porta } = fingir('granted'); let n = 9; const l = nova(porta, async () => ({ ...comPrevisao(n), cartoesPorDia: [n, ...Array.from({ length: 13 }, () => 4)] }))
    await l.getState().ligar(); await l.getState().alternarPeriodo('noite')
    expect(ultima(f).some((a) => a.tipo === 'cartoes' && new Date(a.em).getDate() === 16)).toBe(true)
    n = 0; await l.getState().replanejar()
    expect(ultima(f).some((a) => a.tipo === 'cartoes' && new Date(a.em).getDate() === 16)).toBe(false)
    expect(ultima(f).some((a) => a.tipo === 'cartoes' && new Date(a.em).getDate() === 17)).toBe(true) // amanhã ainda há o que vence
  })
  it('desmarcar todos (a pessoa pode não escolher nenhum) tira todos os avisos de cartões', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta, async () => comPrevisao(9))
    await l.getState().ligar(); await l.getState().alternarPeriodo('manha'); await l.getState().alternarPeriodo('manha')
    expect(l.getState().config.periodos).toEqual([]); expect(ultima(f).some((a) => a.tipo === 'cartoes')).toBe(false)
  })
  it('desligar o lembrete cancela também os avisos de cartões, e os períodos marcados ficam guardados para quando ligar de novo', async () => {
    const { f, porta } = fingir('granted'); const l = nova(porta, async () => comPrevisao(9))
    await l.getState().ligar(); await l.getState().alternarPeriodo('noite'); await l.getState().desligar()
    expect(ultima(f)).toEqual([]); expect(l.getState().config.periodos).toEqual(['noite'])
  })
})
