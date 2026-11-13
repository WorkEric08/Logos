// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Question } from '../core/types'

// Os espaços de estudo com um banco de verdade (Dexie sobre IndexedDB simulado): criar, importar, trocar, apagar e abrir de novo sem perder o Banco do Brasil.
type Esp = typeof import('./espacos')
type App = typeof import('./app')
type Subj = typeof import('../core/subjects')
type Sc = typeof import('../core/scoring')
let esp: Esp, app: App, subj: Subj, sc: Sc
const abrir = async () => { vi.resetModules(); app = await import('./app'); esp = await import('./espacos'); subj = await import('../core/subjects'); sc = await import('../core/scoring') }
beforeEach(async () => { await Dexie.delete('treino-bb'); await abrir() })

const q = (id: string, m: string, s = 'dir-2024', n = 1): Question => ({ id, y: 2024, s, n, m, t: 'Geral', a: '', e: `Enunciado ${id}`, b: '', o: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, g: 'A', p: null, bp: null, f: 0, ol: 0 })

describe('espaços de estudo', () => {
  it('começa no Banco do Brasil, com as regras do edital', () => {
    expect(esp.useEspacos.getState().ativo).toBe('bb'); expect(app.BANK.length).toBe(1168); expect(sc.REGRAS).not.toBeNull(); expect(sc.SIMULADO_PLAN.reduce((a, [, n]) => a + n, 0)).toBe(70)
  })

  it('criar um espaço vazio o ativa e as telas passam a ler o espaço novo (sem questões, sem regras)', async () => {
    const versao = app.useApp.getState().versao
    await esp.useEspacos.getState().criar('Direito', false)
    expect(esp.useEspacos.getState().ativo).not.toBe('bb'); expect(app.BANK).toEqual([]); expect(subj.ALL_SUBJECTS).toEqual([]); expect(sc.REGRAS).toBeNull()
    expect(app.useApp.getState().versao).toBe(versao + 1)
    expect(esp.useEspacos.getState().lista.map((e) => e.nome)).toEqual(['Banco do Brasil e outros bancos', 'Direito'])
  })

  it('importar para o Banco do Brasil é recusado com uma explicação', async () => {
    await expect(esp.useEspacos.getState().adicionar([q('u1', 'Direito')])).rejects.toThrow(/espaço seu/)
  })

  it('importar questões cria as matérias e as provas, ativa um plano de simulado e não duplica na segunda vez', async () => {
    await esp.useEspacos.getState().criar('Direito', false)
    const novas = [q('u1', 'Direito Penal'), q('u2', 'Direito Penal', 'dir-2024', 2), q('u3', 'Civil', 'dir-2024', 3)]
    const r1 = await esp.useEspacos.getState().adicionar(novas, { fontes: { 'dir-2024': 'Direito 2024' }, bancos: [{ id: 'dir', nome: 'Direito' }] })
    expect(r1).toEqual({ adicionadas: 3, repetidas: 0 })
    expect(app.BANK).toHaveLength(3); expect(subj.ALL_SUBJECTS.map((m) => m.n).sort()).toEqual(['Civil', 'Direito Penal']); expect(subj.SOURCES['dir-2024']).toBe('Direito 2024')
    expect(sc.SIMULADO_PLAN.reduce((a, [, n]) => a + n, 0)).toBe(3)
    expect(await esp.useEspacos.getState().adicionar(novas)).toEqual({ adicionadas: 0, repetidas: 3 })
    expect(app.BANK).toHaveLength(3)
  })

  it('trocar de espaço restaura o outro por inteiro; o progresso das questões não é tocado', async () => {
    await esp.useEspacos.getState().criar('Direito', false)
    await esp.useEspacos.getState().adicionar([q('u1', 'Direito Penal')])
    await esp.useEspacos.getState().ativar('bb')
    expect(app.BANK.length).toBe(1168); expect(sc.REGRAS).not.toBeNull(); expect(subj.ALL_SUBJECTS.length).toBe(12)
    const id = esp.useEspacos.getState().lista.find((e) => e.nome === 'Direito')!.id
    await esp.useEspacos.getState().ativar(id)
    expect(app.BANK.map((x) => x.id)).toEqual(['u1'])
  })

  it('o espaço ativo continua depois de fechar e abrir o app', async () => {
    await esp.useEspacos.getState().criar('Direito', false)
    await esp.useEspacos.getState().adicionar([q('u1', 'Direito Penal'), q('u2', 'Civil')])
    await abrir() // "fechou e abriu": mesmo IndexedDB, módulos novos
    expect(app.BANK.length).toBe(1168)
    await esp.useEspacos.getState().iniciar()
    expect(esp.useEspacos.getState().ativo).not.toBe('bb'); expect(app.BANK).toHaveLength(2); expect(esp.useEspacos.getState().lista).toHaveLength(2)
  })

  it('"com as questões do BB" soma as suas às embutidas e mantém as regras do edital', async () => {
    await esp.useEspacos.getState().criar('BB + meus', true)
    await esp.useEspacos.getState().adicionar([q('u1', 'Língua Portuguesa', 'bb-2030')], { fontes: { 'bb-2030': 'BB 2030' } })
    expect(app.BANK.length).toBe(1169); expect(sc.REGRAS).not.toBeNull(); expect(subj.SOURCES['bb-2030']).toBe('BB 2030'); expect(subj.ALL_SUBJECTS.length).toBe(12)
  })

  it('apagar o espaço ativo volta ao Banco do Brasil e some da lista; o do BB não se apaga', async () => {
    await esp.useEspacos.getState().criar('Direito', false)
    const id = esp.useEspacos.getState().ativo
    await esp.useEspacos.getState().apagar(id)
    expect(esp.useEspacos.getState().ativo).toBe('bb'); expect(app.BANK.length).toBe(1168); expect(esp.useEspacos.getState().lista.map((e) => e.id)).toEqual(['bb'])
    await esp.useEspacos.getState().apagar('bb'); expect(esp.useEspacos.getState().lista).toHaveLength(1)
  })

  it('espaço sem regras faz simulado simples: nota é a contagem de acertos', async () => {
    await esp.useEspacos.getState().criar('Direito', false)
    const qs = [q('u1', 'Civil'), q('u2', 'Civil', 'dir-2024', 2), q('u3', 'Civil', 'dir-2024', 3), q('u4', 'Civil', 'dir-2024', 4)]
    await esp.useEspacos.getState().adicionar(qs)
    const r = sc.scoreSimulado(qs, { u1: 'A', u2: 'A', u3: 'B', u4: 'B' })
    expect(r).toMatchObject({ points: 2, approved: true }); expect(sc.scoreSimulado(qs, { u1: 'A' }).approved).toBe(false)
  })
})
