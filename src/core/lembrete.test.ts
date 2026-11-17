import { describe, expect, it } from 'vitest'
import {
  DIAS_A_FRENTE, LEMBRETE_PADRAO, TITULO, avisoDeTeste, corpoDeHoje, corpoGeral, estadoDoDiaDe, horaTexto, idDoDia, jaEstudouHoje, lerConfig,
  planejarLembretes, proximoAviso, somarMinutos, type ConfigLembrete, type EstadoDoDia,
} from './lembrete'

const em = (a: number, m: number, d: number, h = 0, min = 0) => new Date(a, m - 1, d, h, min, 0, 0).getTime()
const ligado = (hora = 19, minuto = 0): ConfigLembrete => ({ ativo: true, hora, minuto })
const vazio: EstadoDoDia = { respondidasHoje: 0, cartoesHoje: 0, cartoesParaEstudar: 0, erros: 0, sequencia: 0 }

describe('configuração do lembrete', () => {
  it('de fábrica está desligado, às 19:00', () => {
    expect(LEMBRETE_PADRAO).toEqual({ ativo: false, hora: 19, minuto: 0 })
    expect(horaTexto(LEMBRETE_PADRAO)).toBe('19:00')
    expect(horaTexto({ hora: 7, minuto: 5 })).toBe('07:05')
  })
  it('lê qualquer coisa guardada e devolve sempre uma configuração válida', () => {
    expect(lerConfig(null)).toEqual(LEMBRETE_PADRAO)
    expect(lerConfig('lixo')).toEqual(LEMBRETE_PADRAO)
    expect(lerConfig({ ativo: true, hora: 7, minuto: 30 })).toEqual({ ativo: true, hora: 7, minuto: 30 })
    expect(lerConfig({ ativo: 'sim', hora: 25, minuto: -1 })).toEqual(LEMBRETE_PADRAO) // só `true` liga; fora da faixa volta ao padrão
    expect(lerConfig({ ativo: true, hora: 7.5, minuto: '30' })).toEqual({ ativo: true, hora: 19, minuto: 0 })
  })
  it('somar minutos dá a volta no relógio de 24 h', () => {
    expect(somarMinutos(ligado(19, 0), 15)).toEqual(ligado(19, 15))
    expect(somarMinutos(ligado(19, 50), 15)).toEqual(ligado(20, 5))
    expect(somarMinutos(ligado(23, 50), 15)).toEqual(ligado(0, 5))
    expect(somarMinutos(ligado(0, 5), -15)).toEqual(ligado(23, 50))
    expect(somarMinutos(ligado(0, 0), -15)).toEqual(ligado(23, 45))
    expect(somarMinutos({ ativo: false, hora: 8, minuto: 0 }, 30).ativo).toBe(false) // não mexe em ligado/desligado
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
