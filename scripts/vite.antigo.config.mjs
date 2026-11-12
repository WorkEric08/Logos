// Gera uma versão do app com o banco ANTIGO e sem migração (progresso gravado com os ids antigos), em dist-antigo/.
// Usada só por scripts/e2e-migracao.mjs. O código do app é o atual; só os dados são os antigos (o código antigo não foi guardado: não há git).
// Uso: node scripts/e2e-migracao.mjs (ele gera os arquivos temporários e chama este config).
import { loadConfigFromFile, mergeConfig } from 'vite'
import { resolve } from 'node:path'

const base = (await loadConfigFromFile({ command: 'build', mode: 'production' }, resolve('vite.config.ts'))).config
export default mergeConfig(base, {
  build: { outDir: 'dist-antigo', emptyOutDir: true },
  resolve: {
    alias: [
      { find: /^\.\.\/data\/bank\.json$/, replacement: resolve('.tmp-antigo/bank.json') },
      { find: /^\.\.\/data\/id-map\.json$/, replacement: resolve('.tmp-antigo/id-map.json') },
    ],
  },
})
