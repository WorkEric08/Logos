import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// O movimento do app (styles.css) tem regras que, se quebradas, só se notam no aparelho: este teste as trava.
const css = readFileSync(join(process.cwd(), 'src', 'ui', 'styles.css'), 'utf8')

describe('movimento do app (CSS)', () => {
  it('"reduzir movimento": duração e atraso zerados em tudo, inclusive ::before/::after (senão a cascata deixa itens invisíveis até o atraso acabar)', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation-duration:\.01ms!important;transition-duration:\.01ms!important\}\}/)
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation-delay:0s!important\}\}/)
  })
  it('a área de rolagem corta o eixo x: a tela que desliza (translateX) não gera rolagem lateral no meio da animação', () => {
    expect(css).toMatch(/\.scroll-y\{[^}]*overflow-x:hidden/)
  })
  it('nada anima para sempre (só entradas e saídas); as únicas que repetem são indicadores de "algo está acontecendo" (digitando… e lendo), e somem com "reduzir movimento"', () => {
    const infinitas = [...css.matchAll(/animation:([^;}]*infinite[^;}]*)/g)].map((m) => m[1])
    for (const a of infinitas) expect(a, a).toMatch(/as-ponto|as-brilho/)
    expect(css).toContain('@media (prefers-reduced-motion:reduce){.as-brilho i::after,.as-esqueleto i::after,.as-digitando i{animation:none}}')
  })
  it('as telas deslizam com os mesmos nomes dos Cards (avanca/recua/troca) e a cascata cobre os grupos principais', () => {
    for (const k of ['fc-avanca', 'fc-recua', 'fc-troca', 'fc-entra', 'fc-pop', 'fc-barra-y', 'fc-anel']) expect(css, k).toContain(`@keyframes ${k}`)
    expect(css).toContain(':is(.tiles,.folders,.files,.stats,.mgrid,.evo,.simlist,.tbls,.rules)>*')
  })
})
