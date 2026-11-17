import { describe, expect, it } from 'vitest'
import { entender } from '../conversa'
import { acharHorario } from '../lembrete'
import { ajustarPelasEntidades, descrever, entenderResposta, pedidoDe, preencher, proximoPasso, type Passo } from './dialogo'
import { extrairEntidades, type Contexto } from './entidades'

// O lembrete diário pelo chat: "me lembre às 20h", "lembrete 8 da noite", "desligar o lembrete".
const ctx = (lembrete?: Contexto['lembrete']): Contexto => ({ materias: [{ nome: 'Matemática', curto: 'Matemática' }], provas: [], espacos: [], espacoAtivo: 'bb', temRegras: true, lembrete })
const entenda = (fala: string, c = ctx()) => {
  const e = extrairEntidades(fala, c)
  return { e, i: ajustarPelasEntidades(entender(fala), e, fala) }
}
const perguntar = (p: Passo) => { if (p.tipo !== 'perguntar') throw new Error('esperava uma pergunta'); return p }

describe('horário escrito', () => {
  it('lê as formas comuns', () => {
    const casos: [string, [number, number]][] = [
      ['20h', [20, 0]], ['20h30', [20, 30]], ['às 20:30', [20, 30]], ['as 8:05', [8, 5]], ['19 horas', [19, 0]], ['8 da noite', [20, 0]], ['6 da tarde', [18, 0]],
      ['7 da manhã', [7, 0]], ['7 e meia da manhã', [7, 30]], ['às 7 e meia', [7, 30]], ['meio-dia', [12, 0]], ['meia noite', [0, 0]], ['às 19', [19, 0]], ['lembrete às 7h30', [7, 30]],
    ]
    for (const [t, [hora, minuto]] of casos) expect(acharHorario(t), t).toEqual({ hora, minuto })
  })
  it('o que não é horário não vira horário: "30 minutos", hora fora da faixa, nada', () => {
    for (const t of ['tenho 30 minutos', 'às 25h', '12:75', 'quero treinar matemática', '']) expect(acharHorario(t), t).toBeUndefined()
  })
})

describe('entender o pedido de lembrete', () => {
  it('"me lembre às 20h", "lembrete 8 da noite", "avise às 7h30": ação lembrete com o horário', () => {
    for (const [fala, hora, minuto] of [['me lembre às 20h', 20, 0], ['lembrete 8 da noite', 20, 0], ['avise às 7h30', 7, 30], ['me lembre de estudar às 19h', 19, 0], ['quero um lembrete às 7 e meia da manhã', 7, 30], ['coloca um lembrete às 21:15', 21, 15]] as const) {
      const { e, i } = entenda(fala)
      expect(i, fala).toEqual({ tipo: 'acao', id: 'lembrete' })
      expect(pedidoDe('lembrete', e), fala).toEqual({ acao: 'lembrete', hora, minuto })
      expect(proximoPasso(pedidoDe('lembrete', e), ctx()).tipo, fala).toBe('executar')
    }
  })
  it('o horário não vira a quantidade de questões', () => {
    expect(extrairEntidades('me lembre às 20h', ctx()).quantidade).toBeUndefined()
    expect(extrairEntidades('lembrete às 8:30', ctx()).quantidade).toBeUndefined()
  })
  it('"desligar o lembrete" e "parar de lembrar" desligam', () => {
    for (const fala of ['desligar o lembrete', 'desligue o lembrete', 'parar de lembrar', 'cancelar o lembrete', 'quero tirar o lembrete', 'sem lembrete']) {
      const { e, i } = entenda(fala)
      expect(i, fala).toEqual({ tipo: 'acao', id: 'lembrete' })
      expect(pedidoDe('lembrete', e), fala).toEqual({ acao: 'lembrete', desligar: true })
    }
  })
  it('sem horário pergunta, com os atalhos; se já está ligado, diz a hora de hoje e oferece desligar', () => {
    const p = pedidoDe('lembrete', entenda('lembrete').e)
    const q = perguntar(proximoPasso(p, ctx()))
    expect(q.slot).toBe('horario'); expect(q.texto).toBe('Em que horário quer o lembrete diário?')
    expect(q.opcoes.map((o) => o.valor)).toEqual(['07:30', '12:30', '18:00', '21:00'])
    const l = perguntar(proximoPasso(p, ctx({ ativo: true, hora: 19, minuto: 0 })))
    expect(l.texto).toMatch(/ligado às 19:00/); expect(l.opcoes.at(-1)).toEqual({ rotulo: 'Desligar o lembrete', valor: 'desligar' })
    expect(perguntar(proximoPasso(p, ctx({ ativo: false, hora: 19, minuto: 0 }))).opcoes.some((o) => o.valor === 'desligar')).toBe(false) // desligado: nada a desligar
  })
  it('as outras falas com tempo continuam sendo o plano de estudo: "tenho 30 minutos", "tenho 2 horas", "tenho 1h"', () => {
    for (const fala of ['tenho 30 minutos', 'tenho 2 horas', 'só tenho 1h hoje', 'meia hora']) expect(entenda(fala).i, fala).toEqual({ tipo: 'acao', id: 'plano' })
  })
})

describe('responder à pergunta do horário', () => {
  it('entende o que se escreve: "20h30", "8 da noite", "21", "7 e meia"; e não entende bobagem', () => {
    expect(entenderResposta('horario', '20h30', ctx())).toBe('20:30')
    expect(entenderResposta('horario', '8 da noite', ctx())).toBe('20:00')
    expect(entenderResposta('horario', '21', ctx())).toBe('21:00')
    expect(entenderResposta('horario', 'às 7 e meia', ctx())).toBe('07:30')
    expect(entenderResposta('horario', 'qualquer coisa', ctx())).toBeUndefined()
    expect(entenderResposta('horario', '99', ctx())).toBeUndefined()
  })
  it('"desligar" só vale como resposta se o lembrete está ligado', () => {
    expect(entenderResposta('horario', 'desligar', ctx({ ativo: true, hora: 19, minuto: 0 }))).toBe('desligar')
    expect(entenderResposta('horario', 'desligar', ctx())).toBeUndefined()
  })
  it('a resposta entra no pedido e ele descreve o que vai fazer', () => {
    const p = pedidoDe('lembrete', {})
    expect(preencher(p, 'horario', '07:30')).toEqual({ acao: 'lembrete', hora: 7, minuto: 30 })
    expect(preencher(p, 'horario', 'desligar')).toEqual({ acao: 'lembrete', desligar: true })
    expect(descrever({ acao: 'lembrete', hora: 7, minuto: 30 })).toBe('lembrete diário às 07:30')
    expect(descrever({ acao: 'lembrete', desligar: true })).toBe('desligar o lembrete diário')
  })
})
