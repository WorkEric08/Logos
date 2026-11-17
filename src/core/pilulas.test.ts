import { describe, expect, it } from 'vitest'
import { disposicaoPilulas, LIMITE_CURTA } from './pilulas'

describe('disposição das pílulas no celular', () => {
  it('curtas seguidas formam duplas; longas ocupam a linha toda', () => {
    expect(disposicaoPilulas(['Matemática', 'Português', 'Todas as matérias do edital do concurso'])).toEqual(['meia', 'meia', 'inteira'])
    expect(disposicaoPilulas(['Importar uma prova em PDF para o espaço', 'Ajuda'])).toEqual(['inteira', 'inteira']) // a curta que ficaria só vira linha inteira
  })
  it('a curta que sobra num grupo ímpar ocupa a linha (nunca fica um buraco ao lado)', () => {
    expect(disposicaoPilulas(['A', 'B', 'C'])).toEqual(['meia', 'meia', 'inteira'])
    expect(disposicaoPilulas(['A', 'B', 'C', 'D', 'E'])).toEqual(['meia', 'meia', 'meia', 'meia', 'inteira'])
  })
  it('uma longa no meio separa os grupos: cada grupo faz as suas duplas', () => {
    expect(disposicaoPilulas(['A', 'B', 'uma sugestão bem comprida aqui', 'C', 'D'])).toEqual(['meia', 'meia', 'inteira', 'meia', 'meia'])
    expect(disposicaoPilulas(['A', 'uma sugestão bem comprida aqui', 'B', 'C'])).toEqual(['inteira', 'inteira', 'meia', 'meia'])
  })
  it('não reordena nada e devolve um item por rótulo', () => {
    const r = ['x', 'y', 'z', 'uma sugestão bem comprida aqui', 'w']
    expect(disposicaoPilulas(r)).toHaveLength(r.length)
    expect(disposicaoPilulas([])).toEqual([])
  })
  it('o limite conta letras (sem os espaços das pontas) e pode ser mudado', () => {
    expect('a'.repeat(LIMITE_CURTA)).toHaveLength(LIMITE_CURTA)
    expect(disposicaoPilulas(['a'.repeat(LIMITE_CURTA), 'b'.repeat(LIMITE_CURTA)])).toEqual(['meia', 'meia'])
    expect(disposicaoPilulas(['a'.repeat(LIMITE_CURTA + 1), 'b'])).toEqual(['inteira', 'inteira'])
    expect(disposicaoPilulas(['  curta  ', 'curta'])).toEqual(['meia', 'meia'])
    expect(disposicaoPilulas(['abcdef', 'ghi'], 4)).toEqual(['inteira', 'inteira'])
  })
})
