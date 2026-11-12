import { describe, expect, it } from 'vitest'
import { SOURCES } from './subjects'
import { BANCOS, bancosPresentes, descreverProvas, lerChave, ordenarProvas, type ProvaComDados } from './provas'

const com = (s: string, n: number, vistas: number): ProvaComDados => ({ ...lerChave(s), n, vistas })

describe('lerChave', () => {
  it('banco, ano e cargo', () => {
    expect(lerChave('bb-2021')).toMatchObject({ banco: 'bb', ano: 2021, mes: null, cargo: 'ac' })
    expect(lerChave('bb-2021-ti')).toMatchObject({ banco: 'bb', ano: 2021, cargo: 'ti' })
    expect(lerChave('bancodaamazonia-2024-ti')).toMatchObject({ banco: 'bancodaamazonia', ano: 2024, cargo: 'ti' })
  })
  it('mês quando a chave traz (03/2015, RS 09/2024)', () => {
    expect(lerChave('bb-032015')).toMatchObject({ banco: 'bb', ano: 2015, mes: 3 })
    expect(lerChave('bb-102015')).toMatchObject({ ano: 2015, mes: 10 })
    expect(lerChave('caixa-rs092024')).toMatchObject({ banco: 'caixa', ano: 2024, mes: 9, cargo: 'ac' })
  })
  it('todas as provas do banco real têm banco conhecido, ano e cargo', () => {
    const l = descreverProvas(SOURCES)
    expect(l.length).toBe(Object.keys(SOURCES).length)
    for (const p of l) { expect(BANCOS.some((b) => b.id === p.banco)).toBe(true); expect(p.ano).toBeGreaterThan(2000) }
    expect(l.filter((p) => p.cargo === 'ti').every((p) => p.s.endsWith('-ti'))).toBe(true)
  })
})

describe('bancosPresentes', () => {
  it('na ordem do app, sem repetir', () => {
    expect(bancosPresentes(descreverProvas(SOURCES))).toEqual(['bb', 'caixa', 'bnb', 'bancodaamazonia', 'banese'])
  })
  it('banco desconhecido vai para o fim', () => {
    expect(bancosPresentes([lerChave('xyz-2020'), lerChave('bb-2020')])).toEqual(['bb', 'xyz'])
  })
})

describe('ordenarProvas', () => {
  const l = [com('bb-2014', 64, 10), com('bb-102015', 65, 0), com('bb-032015', 65, 65), com('bb-2023', 70, 7)]
  it('mais novas primeiro (desempata pelo mês)', () => { expect(ordenarProvas(l, 'novas').map((p) => p.s)).toEqual(['bb-2023', 'bb-102015', 'bb-032015', 'bb-2014']) })
  it('mais antigas primeiro é o inverso', () => { expect(ordenarProvas(l, 'antigas').map((p) => p.s)).toEqual(['bb-2014', 'bb-032015', 'bb-102015', 'bb-2023']) })
  it('menos vistas primeiro (empate: a mais nova)', () => { expect(ordenarProvas(l, 'menos-vistas').map((p) => p.s)).toEqual(['bb-102015', 'bb-2023', 'bb-2014', 'bb-032015']) })
  it('não altera a lista original', () => { const c = [...l]; ordenarProvas(l, 'antigas'); expect(l).toEqual(c) })
})
