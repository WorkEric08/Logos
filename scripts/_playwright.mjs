// Resolve o Playwright a partir do projeto onde o script roda (cwd), e não da pasta do script.
import { createRequire } from 'node:module'
import { join } from 'node:path'

const requerer = createRequire(join(process.cwd(), 'package.json'))

export function carregarPlaywright() {
  for (const nome of ['@playwright/test', 'playwright']) {
    try {
      return requerer(nome)
    } catch {
      // tenta o próximo
    }
  }
  throw new Error('Instale @playwright/test no projeto (devDependency) e rode o script da raiz dele.')
}
