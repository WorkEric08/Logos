import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACOES, acaoPorId } from './assistente'

// A documentação (docs/assistente.md) tem de falar de TODA ação do catálogo: ação nova sem texto lá faz este teste falhar.
const doc = readFileSync(join(process.cwd(), 'docs', 'assistente.md'), 'utf8')

describe('catálogo de ações do assistente', () => {
  it('cada ação está documentada pelo id e tem tudo preenchido', () => {
    for (const a of ACOES) {
      expect(doc, `docs/assistente.md precisa citar a ação "${a.id}"`).toContain(`(\`${a.id}\`)`)
      for (const k of ['rotulo', 'resumo', 'precisa', 'gera', 'limites'] as const) expect(a[k].trim().length, `${a.id}.${k}`).toBeGreaterThan(5)
    }
  })
  it('ids não se repetem e a busca por id funciona', () => {
    expect(new Set(ACOES.map((a) => a.id)).size).toBe(ACOES.length); expect(acaoPorId('prova').rotulo).toContain('prova')
  })
})
