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
    expect(r1).toMatchObject({ adicionadas: 3, repetidas: 0, ids: ['u1', 'u2', 'u3'] })
    expect(app.BANK).toHaveLength(3); expect(subj.ALL_SUBJECTS.map((m) => m.n).sort()).toEqual(['Civil', 'Direito Penal']); expect(subj.SOURCES['dir-2024']).toBe('Direito 2024')
    expect(sc.SIMULADO_PLAN.reduce((a, [, n]) => a + n, 0)).toBe(3)
    expect(await esp.useEspacos.getState().adicionar(novas)).toMatchObject({ adicionadas: 0, repetidas: 3, ids: [] })
    expect(app.BANK).toHaveLength(3)
  })
  it('C-9 retirar: tira SÓ as questões da importação e devolve o espaço ao que era; as que já existiam ficam', async () => {
    await esp.useEspacos.getState().criar('Direito', false)
    await esp.useEspacos.getState().adicionar([q('u1', 'Direito Penal')], { fontes: { 'dir-2023': 'Direito 2023' }, bancos: [{ id: 'dir', nome: 'Direito' }] })
    const r = await esp.useEspacos.getState().adicionar([q('u1', 'Direito Penal'), q('u2', 'Civil', 'dir-2025', 2)], { fontes: { 'dir-2025': 'Direito 2025' } })
    expect(r.ids).toEqual(['u2']); expect(app.BANK.map((x) => x.id).sort()).toEqual(['u1', 'u2'])
    await esp.useEspacos.getState().retirar(esp.useEspacos.getState().ativo, r.ids, r.antes)
    expect(app.BANK.map((x) => x.id)).toEqual(['u1']); expect(subj.SOURCES['dir-2025']).toBeUndefined(); expect(subj.SOURCES['dir-2023']).toBe('Direito 2023')
    expect(esp.useEspacos.getState().lista.find((x) => x.id === esp.useEspacos.getState().ativo)?.n).toBe(1)
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

// C-11: o contador de "questões sem enunciado" por espaço (defeito antigo) aparece na lista e some sozinho quando o espaço é consertado
describe('questões sem enunciado por espaço (C-11)', () => {
  const vazia = (id: string, ger = false): Question => ({ ...q(id, 'Civil'), e: '', ...(ger ? { ger: 1 as const, fonte: 'trecho' } : {}) })
  it('a lista traz o número por espaço (e quantas são geradas); só os afetados; o total soma; importar de novo conserta e o contador some; apagar o espaço também', async () => {
    await esp.useEspacos.getState().iniciar()
    const idA = await esp.useEspacos.getState().criar('Espaço A', false)
    await esp.useEspacos.getState().adicionar([vazia('u1'), vazia('u2'), vazia('u3', true), q('u4', 'Civil')], { fontes: { 'dir-2024': 'Direito 2024' } })
    const idB = await esp.useEspacos.getState().criar('Espaço B', false)
    await esp.useEspacos.getState().adicionar([q('u9', 'Civil')])
    let st = esp.useEspacos.getState()
    const a = st.lista.find((e) => e.id === idA), b = st.lista.find((e) => e.id === idB)
    expect(a).toMatchObject({ semEnunciado: 3, semEnunciadoGeradas: 1 }); expect(b?.semEnunciado).toBeUndefined(); expect(st.lista[0].semEnunciado).toBeUndefined() // o BB nunca é afetado
    expect(st.semEnunciado).toBe(3)
    // importar a prova de novo (mesmos ids, agora com enunciado) conserta
    await esp.useEspacos.getState().ativar(idA)
    await esp.useEspacos.getState().adicionar([q('u1', 'Civil'), q('u2', 'Civil')])
    st = esp.useEspacos.getState()
    expect(st.lista.find((e) => e.id === idA)).toMatchObject({ semEnunciado: 1, semEnunciadoGeradas: 1 }); expect(st.semEnunciado).toBe(1) // sobrou a gerada
    // desfazer a importação (retirar) e apagar o espaço também recontam
    await esp.useEspacos.getState().apagar(idA)
    expect(esp.useEspacos.getState().semEnunciado).toBe(0); expect(esp.useEspacos.getState().lista.some((e) => (e.semEnunciado ?? 0) > 0)).toBe(false)
  })
})
