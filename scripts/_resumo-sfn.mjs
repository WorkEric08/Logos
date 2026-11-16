// O material de teste das questões geradas (F4): lido do mesmo arquivo que os testes de unidade usam (src/core/questoes/fixture.ts), para haver uma fonte só.
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/core/questoes/fixture.ts', import.meta.url), 'utf8')
const m = /RESUMO_TESTE = (\[[\s\S]*?\])\.join\('\\n'\)/.exec(src)
if (!m) throw new Error('Não achei RESUMO_TESTE em src/core/questoes/fixture.ts')
export const RESUMO_SFN = eval(m[1]).join('\n')
