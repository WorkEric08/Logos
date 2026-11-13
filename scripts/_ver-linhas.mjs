// Ferramenta de desenvolvimento: mostra as linhas que o núcleo extrai de um PDF (depois do corte de colunas e margens).
// Uso: node scripts/_ver-linhas.mjs <arquivo.pdf> <página inicial> [página final] [máx. linhas]
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
const [, , arq, p0 = '1', p1 = p0, max = '200'] = process.argv
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { paginasParaLinhas } = await vite.ssrLoadModule('/src/core/importar/layout.ts')
const { lerPaginas } = await vite.ssrLoadModule('/src/services/importar/pdf.ts')
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const pags = Array.from({ length: Number(p1) - Number(p0) + 1 }, (_, i) => Number(p0) + i)
const { paginas } = await lerPaginas(pdfjs, new Uint8Array(readFileSync(arq)), undefined, pags)
for (const l of paginasParaLinhas(paginas).slice(0, Number(max))) console.log(`p${l.pagina} c${l.coluna} y${Math.round(l.y)} x${Math.round(l.x0)}  ${l.texto}`)
await vite.close()
