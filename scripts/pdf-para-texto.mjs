// Lê um PDF com texto EXATAMENTE como o app lê um material (leitor de PDF → linhas → parágrafos) e grava os parágrafos num .txt (separados por linha em branco).
// Serve para medir os geradores com um PDF seu: scripts/medir-cartoes.mjs e scripts/medir-questoes.mjs só leem .md/.txt.
// Uso: node scripts/pdf-para-texto.mjs <arquivo.pdf> <saida.txt>
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const [, , arq, saida] = process.argv
if (!arq || !saida) { console.log('Uso: node scripts/pdf-para-texto.mjs <arquivo.pdf> <saida.txt>'); process.exit(1) }
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { paginasParaLinhas, removerCitacoes } = await vite.ssrLoadModule('/src/core/importar/layout.ts')
const { linhasParaParagrafos } = await vite.ssrLoadModule('/src/core/importar/cartoes.ts')
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(arq)), useSystemFonts: true }).promise
const paginas = []
for (let n = 1; n <= doc.numPages; n++) {
  const p = await doc.getPage(n), vp = p.getViewport({ scale: 1 }), tc = await p.getTextContent()
  paginas.push({ numero: n, largura: vp.width, altura: vp.height, itens: tc.items.filter((i) => typeof i.str === 'string').map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, texto: i.str, h: i.height })) })
}
const limpas = removerCitacoes(paginas)
const linhas = paginasParaLinhas(limpas.paginas, { margens: 'repetidas' })
const paragrafos = linhasParaParagrafos(linhas)
writeFileSync(saida, paragrafos.join('\n\n'), 'utf8')
console.log(`páginas ${doc.numPages} · linhas ${linhas.length} · citações tiradas ${limpas.removidas} · parágrafos ${paragrafos.length} → ${saida}`)
await vite.close()
