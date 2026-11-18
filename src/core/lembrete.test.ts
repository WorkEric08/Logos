import { describe, expect, it } from 'vitest'
import {
  DIAS_A_FRENTE, LEMBRETE_PADRAO, PERIODOS, TITULO, TITULO_CARTOES, alternarPeriodo, avisoDeTeste, cartoesPorDia, faixaDoPeriodo, corpoDeHoje, corpoGeral, estadoDoDiaDe, horaTexto, idDoDia, jaEstudouHoje, lerConfig,
  planejarLembretes, proximoAviso, somarMinutos, type ConfigLembrete, type EstadoDoDia, type IdPeriodo,
} from './lembrete'
import type { Ajustes, Cartao } from './cards'

const em = (a: number, m: number, d: number, h = 0, min = 0) => new Date(a, m - 1, d, h, min, 0, 0).getTime()
const ligado = (hora = 19, minuto = 0, periodos: IdPeriodo[] = []): ConfigLembrete => ({ ativo: true, hora, minuto, periodos })
const vazio: EstadoDoDia = { respondidasHoje: 0, cartoesHoje: 0, cartoesParaEstudar: 0, erros: 0, sequencia: 0 }

describe('configuração do lembrete', () => {
  it('de fábrica está desligado, o horário começa em 00:00 e nenhum período está marcado', () => {
    expect(LEMBRETE_PADRAO).toEqual({ ativo: false, hora: 0, minuto: 0, periodos: [] })
    expect(horaTexto(LEMBRETE_PADRAO)).toBe('00:00')
    expect(horaTexto({ hora: 7, minuto: 5 })).toBe('07:05')
  })
  it('lê qualquer coisa guardada e devolve sempre uma configuração válida', () => {
    expect(lerConfig(null)).toEqual(LEMBRETE_PADRAO)
    expect(lerConfig('lixo')).toEqual(LEMBRETE_PADRAO)
    expect(lerConfig({ ativo: true, hora: 7, minuto: 30 })).toEqual({ ativo: true, hora: 7, minuto: 30, periodos: [] }) // (o que foi guardado antes dos períodos existirem continua valendo)
    expect(lerConfig({ ativo: 'sim', hora: 25, minuto: -1 })).toEqual(LEMBRETE_PADRAO) // só `true` liga; fora da faixa volta ao padrão
    expect(lerConfig({ ativo: true, hora: 7.5, minuto: '30' })).toEqual({ ativo: true, hora: 0, minuto: 0, periodos: [] })
  })
  it('somar minutos dá a volta no relógio de 24 h', () => {
    expect(somarMinutos(ligado(19, 0), 15)).toEqual(ligado(19, 15))
    expect(somarMinutos(ligado(19, 50), 15)).toEqual(ligado(20, 5))
    expect(somarMinutos(ligado(23, 50), 15)).toEqual(ligado(0, 5))
    expect(somarMinutos(ligado(0, 5), -15)).toEqual(ligado(23, 50))
    expect(somarMinutos(ligado(0, 0), -15)).toEqual(ligado(23, 45))
    expect(somarMinutos({ ativo: false, hora: 8, minuto: 0, periodos: [] }, 30).ativo).toBe(false) // não mexe em ligado/desligado
  })
})

describe('quais avisos existem', () => {
  it('desligado: nenhum', () => {
    expect(planejarLembretes({ ...ligado(), ativo: false }, vazio, em(2026, 11, 16, 10))).toEqual([])
  })
  it('ligado, antes da hora: o de hoje e os dos próximos dias, todos na hora marcada', () => {
    const a = planejarLembretes(ligado(19, 30), vazio, em(2026, 11, 16, 10))
    expect(a).toHaveLength(DIAS_A_FRENTE)
    expect(a[0].em).toBe(em(2026, 11, 16, 19, 30))
    expect(a.at(-1)!.em).toBe(em(2026, 11, 29, 19, 30))
    for (const x of a) { const d = new Date(x.em); expect([d.getHours(), d.getMinutes()]).toEqual([19, 30]); expect(x.titulo).toBe(TITULO) }
  })
  it('a hora de hoje já passou: começa amanhã (nada é re-sorteado nem mostrado atrasado)', () => {
    const a = planejarLembretes(ligado(8, 0), vazio, em(2026, 11, 16, 10))
    expect(a).toHaveLength(DIAS_A_FRENTE - 1)
    expect(a[0].em).toBe(em(2026, 11, 17, 8, 0))
  })
  it('faltando segundos para a hora: não agenda (o Android o descartaria)', () => {
    expect(planejarLembretes(ligado(19, 0), vazio, em(2026, 11, 16, 19, 0) - 3000)[0].em).toBe(em(2026, 11, 17, 19, 0))
    expect(planejarLembretes(ligado(19, 0), vazio, em(2026, 11, 16, 19, 0) - 60_000)[0].em).toBe(em(2026, 11, 16, 19, 0))
  })
  it('quem já estudou hoje não recebe o de hoje, mas os dos outros dias continuam', () => {
    const estudou: EstadoDoDia = { ...vazio, respondidasHoje: 3 }
    const a = planejarLembretes(ligado(), estudou, em(2026, 11, 16, 10))
    expect(a).toHaveLength(DIAS_A_FRENTE - 1)
    expect(a[0].em).toBe(em(2026, 11, 17, 19, 0))
    expect(planejarLembretes(ligado(), { ...vazio, cartoesHoje: 1 }, em(2026, 11, 16, 10))).toHaveLength(DIAS_A_FRENTE - 1)
    expect(jaEstudouHoje(vazio)).toBe(false)
    expect(jaEstudouHoje({ ...vazio, cartoesHoje: 1 })).toBe(true)
  })
  it('estudar depois de o aviso ter sido planejado o tira (a lista é refeita): mesmo dia, outro resultado', () => {
    const antes = planejarLembretes(ligado(), vazio, em(2026, 11, 16, 10))
    const depois = planejarLembretes(ligado(), { ...vazio, respondidasHoje: 1 }, em(2026, 11, 16, 10, 5))
    expect(antes[0].id).toBe(idDoDia(em(2026, 11, 16)))
    expect(depois.some((x) => x.id === antes[0].id)).toBe(false)
  })
  it('ids: um por dia, estáveis (refazer a lista a qualquer hora do dia não muda nada) e sem repetição', () => {
    const manha = planejarLembretes(ligado(), vazio, em(2026, 11, 16, 8))
    const tarde = planejarLembretes(ligado(), vazio, em(2026, 11, 16, 17, 59))
    expect(tarde.map((x) => [x.id, x.em])).toEqual(manha.map((x) => [x.id, x.em]))
    expect(new Set(manha.map((x) => x.id)).size).toBe(manha.length)
    expect(manha.every((x, i) => i === 0 || x.id === manha[i - 1].id + 1)).toBe(true)
    expect(manha.every((x) => x.id > 0 && x.id < 2 ** 31)).toBe(true)
  })
  it('vira o mês e o ano sem errar o dia nem a hora', () => {
    const a = planejarLembretes(ligado(6, 45), vazio, em(2026, 12, 28, 12))
    expect(a.map((x) => new Date(x.em).getDate())).toEqual([29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) // (o de 28/12 às 06:45 já passou: 13 avisos)
    expect(a[3].em).toBe(em(2027, 1, 1, 6, 45))
    expect(a.every((x) => new Date(x.em).getHours() === 6 && new Date(x.em).getMinutes() === 45)).toBe(true)
  })
  it('a meia-noite e 23:59 também valem', () => {
    expect(planejarLembretes(ligado(0, 0), vazio, em(2026, 11, 16, 10))[0].em).toBe(em(2026, 11, 17, 0, 0))
    expect(planejarLembretes(ligado(23, 59), vazio, em(2026, 11, 16, 10))[0].em).toBe(em(2026, 11, 16, 23, 59))
  })
  it('a janela pode ser menor', () => {
    expect(planejarLembretes(ligado(), vazio, em(2026, 11, 16, 10), 3)).toHaveLength(3)
  })
})

describe('o texto do aviso', () => {
  it('hoje: o que está esperando, no singular e no plural', () => {
    expect(corpoDeHoje({ ...vazio, cartoesParaEstudar: 12, erros: 5 })).toBe('Esperando por você: 12 cartões para revisar e 5 questões no caderno de erros.')
    expect(corpoDeHoje({ ...vazio, cartoesParaEstudar: 1 })).toBe('Esperando por você: 1 cartão para revisar.')
    expect(corpoDeHoje({ ...vazio, erros: 1 })).toBe('Esperando por você: 1 questão no caderno de erros.')
  })
  it('sem nada esperando, convida para questões novas', () => {
    expect(corpoDeHoje(vazio)).toBe('Que tal 10 questões novas para manter o ritmo?')
  })
  it('a sequência de 2 dias ou mais entra como incentivo; a de 1 dia não', () => {
    expect(corpoDeHoje({ ...vazio, cartoesParaEstudar: 3, sequencia: 6 })).toBe('Esperando por você: 3 cartões para revisar. Mantenha a sua sequência de 6 dias.')
    expect(corpoDeHoje({ ...vazio, cartoesParaEstudar: 3, sequencia: 1 })).toBe('Esperando por você: 3 cartões para revisar.')
    expect(corpoDeHoje({ ...vazio, sequencia: 2 })).toBe('Que tal 10 questões novas para manter o ritmo? Mantenha a sua sequência de 2 dias.')
  })
  it('só o aviso de hoje é concreto; os outros dias têm frases gerais (e o mesmo dia tem sempre a mesma frase)', () => {
    const a = planejarLembretes(ligado(), { ...vazio, cartoesParaEstudar: 12 }, em(2026, 11, 16, 10))
    expect(a[0].corpo).toMatch(/12 cartões/)
    expect(a.slice(1).every((x) => !/\d+ cartões/.test(x.corpo))).toBe(true)
    expect(planejarLembretes(ligado(), vazio, em(2026, 11, 16, 11)).slice(1).map((x) => x.corpo)).toEqual(a.slice(1).map((x) => x.corpo))
    expect(new Set(a.slice(1).map((x) => x.corpo)).size).toBeGreaterThan(1) // varia, para não virar ruído
    expect(corpoGeral(-3)).toBeTruthy()
  })
  it('nenhum texto é longo demais para a notificação (uma linha de título e até ~110 letras no corpo)', () => {
    const pior = corpoDeHoje({ respondidasHoje: 0, cartoesHoje: 0, cartoesParaEstudar: 999, erros: 999, sequencia: 999 })
    expect(TITULO.length).toBeLessThan(30)
    expect(pior.length).toBeLessThan(140)
  })
})

describe('teste e próximo aviso', () => {
  it('o teste chega em 5 segundos, tem id próprio (não colide com o de nenhum dia) e diz que é teste', () => {
    const agora = em(2026, 11, 16, 10)
    const t = avisoDeTeste({ ...vazio, cartoesParaEstudar: 2 }, agora)
    expect(t.em - agora).toBe(5000)
    expect(t.id).toBeLessThan(0)
    expect(t.corpo).toMatch(/^Teste: Esperando por você: 2 cartões/)
  })
  it('diz quando é o próximo: hoje, amanhã ou o dia da semana', () => {
    const agora = em(2026, 11, 16, 10) // segunda-feira
    expect(proximoAviso([], agora)).toBeNull()
    const [h, a, ...resto] = planejarLembretes(ligado(19, 5), vazio, agora)
    expect(proximoAviso([h], agora)).toBe('hoje às 19:05')
    expect(proximoAviso([a], agora)).toBe('amanhã às 19:05')
    expect(proximoAviso([resto[0]], agora)).toBe("quarta-feira às 19:05")
  })
  it('o estado do dia vem do painel da F6', () => {
    expect(estadoDoDiaDe({ respondidasHoje: 4, cartoesHoje: 2, cartoesParaEstudar: 9, erros: 3, sequencia: 5 })).toEqual({ respondidasHoje: 4, cartoesHoje: 2, cartoesParaEstudar: 9, erros: 3, sequencia: 5 })
  })
})

describe('períodos que avisam de cartões para revisar', () => {
  const cartao = (id: string, estado: Cartao['estado'], due: number): Cartao => ({ id, b: 'b', f: 'f', v: 'v', criado: 1, estado, due, ivl: estado === 'revisao' ? 5 : 0, fac: 2.5, reps: 1, lapsos: 0, ult: 0 })
  const ajustes: Ajustes = { limite: 10, dia: '', novos: 0 }
  const agora = em(2026, 11, 16, 10)
  const comCartoes = (n: number, resto: Partial<EstadoDoDia> = {}): EstadoDoDia => ({ ...vazio, cartoesParaEstudar: n, cartoesPorDia: Array.from({ length: DIAS_A_FRENTE }, () => n), ...resto })
  const deCartoes = (a: ReturnType<typeof planejarLembretes>) => a.filter((x) => x.tipo === 'cartoes')

  it('os quatro períodos, com a faixa de cada um (manhã, tarde, noite e madrugada) e a hora do aviso DENTRO da faixa', () => {
    expect(PERIODOS.map((p) => [p.id, faixaDoPeriodo(p)])).toEqual([['manha', '06:00 às 11:59'], ['tarde', '12:00 às 17:59'], ['noite', '18:00 às 23:59'], ['madrugada', '00:00 às 05:59']])
    expect(PERIODOS.map((p) => [p.id, horaTexto(p)])).toEqual([['manha', '09:00'], ['tarde', '15:00'], ['noite', '21:00'], ['madrugada', '02:00']])
    for (const p of PERIODOS) { const m = (x: { hora: number; minuto: number }) => x.hora * 60 + x.minuto; expect(m(p)).toBeGreaterThanOrEqual(m(p.de)); expect(m(p)).toBeLessThanOrEqual(m(p.ate)) }
    // as quatro faixas cobrem o dia inteiro, sem buraco nem sobreposição
    const cobertos = new Set<number>(); for (const p of PERIODOS) for (let t = p.de.hora * 60 + p.de.minuto; t <= p.ate.hora * 60 + p.ate.minuto; t++) { expect(cobertos.has(t)).toBe(false); cobertos.add(t) }
    expect(cobertos.size).toBe(1440)
  })
  it('lerConfig só aceita períodos conhecidos, sem repetir, na ordem do dia', () => {
    expect(lerConfig({ ativo: true, hora: 7, minuto: 0, periodos: ['noite', 'lixo', 'manha', 'noite', 3] }).periodos).toEqual(['manha', 'noite'])
    expect(lerConfig({ ativo: true, periodos: 'manha' }).periodos).toEqual([])
    expect(lerConfig({ ativo: true, hora: 7, minuto: 0, periodos: [] }).periodos).toEqual([]) // pode não escolher nenhum
  })
  it('marcar e desmarcar (multisseleção): a ordem é sempre a do dia e dá para ficar sem nenhum', () => {
    let c = ligado(19, 0)
    c = alternarPeriodo(c, 'noite'); c = alternarPeriodo(c, 'manha'); c = alternarPeriodo(c, 'madrugada')
    expect(c.periodos).toEqual(['manha', 'noite', 'madrugada'])
    c = alternarPeriodo(c, 'noite')
    expect(c.periodos).toEqual(['manha', 'madrugada'])
    c = alternarPeriodo(alternarPeriodo(c, 'manha'), 'madrugada')
    expect(c.periodos).toEqual([])
    expect(c.hora).toBe(19) // o horário de começo não muda
  })
  it('nenhum período marcado: só o aviso de começo, mesmo com cartões esperando', () => {
    const a = planejarLembretes(ligado(19, 0), comCartoes(20), agora)
    expect(deCartoes(a)).toHaveLength(0)
    expect(a).toHaveLength(DIAS_A_FRENTE)
    expect(a.every((x) => x.tipo === 'inicio')).toBe(true)
  })
  it('com cartões esperando: um aviso por período marcado e por dia, no horário do período (hoje só os que ainda não passaram)', () => {
    const a = planejarLembretes(ligado(19, 0, ['manha', 'tarde', 'noite']), comCartoes(7), agora) // hoje 10:00: a manhã (09:00) já passou
    const c = deCartoes(a)
    expect(c.filter((x) => new Date(x.em).getDate() === 16).map((x) => horaTexto({ hora: new Date(x.em).getHours(), minuto: new Date(x.em).getMinutes() }))).toEqual(['15:00', '21:00'])
    expect(c).toHaveLength(2 + 3 * (DIAS_A_FRENTE - 1))
    expect(c.every((x) => x.titulo === TITULO_CARTOES)).toBe(true)
    expect(a.every((x, i) => i === 0 || a[i - 1].em <= x.em)).toBe(true) // a lista sai em ordem de hora
  })
  it('sem cartão esperando, nenhum aviso de cartões; revisou tudo hoje: os de hoje saem e os dos outros dias dependem do que vencerá', () => {
    expect(deCartoes(planejarLembretes(ligado(19, 0, ['tarde']), comCartoes(0), agora))).toHaveLength(0)
    const amanhaSo = { ...comCartoes(0), cartoesParaEstudar: 0, cartoesPorDia: [0, 4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
    const c = deCartoes(planejarLembretes(ligado(19, 0, ['tarde']), amanhaSo, agora))
    expect(c.map((x) => new Date(x.em).getDate())).toEqual([17, 20]) // só nos dias em que vence cartão
  })
  it('o texto de hoje diz quantos; os dos outros dias não dizem número (ainda pode mudar)', () => {
    const c = deCartoes(planejarLembretes(ligado(19, 0, ['noite']), comCartoes(7), agora))
    expect(c[0].corpo).toBe('Você ainda tem 7 cartões para revisar hoje.')
    expect(deCartoes(planejarLembretes(ligado(19, 0, ['noite']), comCartoes(1), agora))[0].corpo).toBe('Você ainda tem 1 cartão para revisar hoje.')
    expect(c.slice(1).every((x) => !/\d/.test(x.corpo))).toBe(true)
  })
  it('sem a previsão por dia (cartoesPorDia ausente), só hoje tem aviso de cartões: nada é inventado para os outros dias', () => {
    const c = deCartoes(planejarLembretes(ligado(19, 0, ['noite']), { ...vazio, cartoesParaEstudar: 3 }, agora))
    expect(c).toHaveLength(1)
    expect(new Date(c[0].em).getDate()).toBe(16)
  })
  it('um período na mesma hora do aviso de começo não é repetido', () => {
    const a = planejarLembretes(ligado(21, 0, ['noite', 'tarde']), comCartoes(3), agora)
    expect(deCartoes(a).every((x) => new Date(x.em).getHours() === 15)).toBe(true)
  })
  it('ids: únicos, estáveis, positivos, no inteiro de 32 bits e diferentes dos ids do aviso de começo', () => {
    const a = planejarLembretes(ligado(19, 0, ['manha', 'tarde', 'noite', 'madrugada']), comCartoes(3), agora)
    const b = planejarLembretes(ligado(19, 0, ['manha', 'tarde', 'noite', 'madrugada']), comCartoes(3), agora + 3_600_000)
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length)
    expect(a.every((x) => x.id > 0 && x.id < 2 ** 31)).toBe(true)
    expect(b.filter((x) => x.em > agora + 3_600_000 + 10_000).map((x) => [x.id, x.em])).toEqual(a.filter((x) => x.em > agora + 3_600_000 + 10_000).map((x) => [x.id, x.em]))
  })
  it('a madrugada de amanhã (02:00) e a virada de mês', () => {
    const c = deCartoes(planejarLembretes(ligado(19, 0, ['madrugada']), comCartoes(2), em(2026, 11, 29, 23, 0)))
    expect(c[0].em).toBe(em(2026, 11, 30, 2, 0))
    expect(c[1].em).toBe(em(2026, 12, 1, 2, 0))
  })
  it('"próximo aviso" é sempre o de começo do estudo, nunca um de cartões', () => {
    const a = planejarLembretes(ligado(19, 5, ['tarde']), comCartoes(3), agora)
    expect(a[0].tipo).toBe('cartoes') // 15:00 vem antes das 19:05
    expect(proximoAviso(a, agora)).toBe('hoje às 19:05')
    expect(proximoAviso(a.filter((x) => x.tipo === 'cartoes'), agora)).toBeNull()
  })
  it('os textos de cartões cabem numa notificação', () => {
    for (const x of deCartoes(planejarLembretes(ligado(19, 0, ['manha']), comCartoes(999), agora))) { expect(x.titulo.length).toBeLessThan(30); expect(x.corpo.length).toBeLessThan(110) }
  })

  it('cartoesPorDia: o que vence até cada dia, supondo que nada seja estudado', () => {
    const d = (dia: number, h = 12) => em(2026, 11, dia, h)
    const cs = [cartao('a', 'revisao', d(15)), cartao('b', 'revisao', d(16, 20)), cartao('c', 'revisao', d(18)), cartao('d', 'aprendendo', d(16))]
    const p = cartoesPorDia(cs, ajustes, agora, 5)
    // hoje (16): a atrasada (15), a de hoje à noite (16) e a que está aprendendo; amanhã nada novo vence; no dia 18 entra a terceira
    expect(p).toEqual([3, 3, 4, 4, 4])
  })
  it('cartoesPorDia: cartões novos contam até o limite diário (cada dia tem o seu limite)', () => {
    const novos = Array.from({ length: 25 }, (_, i) => cartao('n' + i, 'novo', 0))
    expect(cartoesPorDia(novos, ajustes, agora, 3)).toEqual([10, 10, 10])
    expect(cartoesPorDia(novos, { limite: 10, dia: String(em(2026, 11, 16)), novos: 0 }, agora, 1)[0]).toBeGreaterThan(0)
    expect(cartoesPorDia([], ajustes, agora, 3)).toEqual([0, 0, 0])
  })
  it('estadoDoDiaDe leva a previsão por dia quando ela existe', () => {
    const p = { respondidasHoje: 0, cartoesHoje: 0, cartoesParaEstudar: 2, erros: 0, sequencia: 0 }
    expect(estadoDoDiaDe(p, [2, 1])).toEqual({ ...p, cartoesPorDia: [2, 1] })
    expect(estadoDoDiaDe(p)).toEqual(p)
  })
})
