import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// REGRA DO TECLADO: todo campo de texto do app tem de estar na lista scripts/campos-de-texto.json, e cada um é testado em
// scripts/e2e-teclado.mjs (teclado aberto não pode levar botão nenhum para cima dele). Campo novo sem cenário = este teste falha.
const lista = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'campos-de-texto.json'), 'utf8')) as Record<string, string[] | string>
const registrados = Object.entries(lista).filter(([k]) => !k.startsWith('_')) as [string, string[]][]

function camposDe(arquivo: string): number {
  const t = readFileSync(join(process.cwd(), arquivo), 'utf8')
  const tags = t.match(/<(input|textarea)\b[^>]*>/g) ?? []
  return tags.filter((x) => !/type=["'](checkbox|radio|file|range|button|submit)["']/.test(x)).length
}

describe('campos de texto e a regra do teclado', () => {
  it('cada arquivo de tela tem exatamente os campos registrados (e testados no teclado)', () => {
    const arquivos = readdirSync(join(process.cwd(), 'src', 'ui')).filter((f) => f.endsWith('.tsx')).map((f) => `src/ui/${f}`)
    for (const a of arquivos) {
      const registrado = registrados.find(([k]) => k === a)?.[1].length ?? 0
      expect(camposDe(a), `${a}: campos no código × campos em scripts/campos-de-texto.json (acrescente o campo lá e um cenário em scripts/e2e-teclado.mjs)`).toBe(registrado)
    }
  })
  it('o e2e de teclado cobre todos os campos da lista', () => {
    const e2e = readFileSync(join(process.cwd(), 'scripts', 'e2e-teclado.mjs'), 'utf8')
    for (const [, ids] of registrados) for (const id of ids) expect(e2e, `cenário para ${id}`).toContain(`campo: '${id}'`)
  })
})
