// Ferramenta de desenvolvimento: mostra os itens de texto de uma página de PDF (x, y, texto), para ver como é o layout.
// Uso: node scripts/_pdf-dump.mjs <arquivo.pdf> [página] [máx. itens]
import { readFileSync } from 'node:fs'
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const [, , arq, pag = '1', max = '80'] = process.argv
const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(arq)), useSystemFonts: true }).promise
console.log('páginas', doc.numPages)
const p = await doc.getPage(Number(pag))
const vp = p.getViewport({ scale: 1 })
console.log('tamanho', vp.width, vp.height)
const tc = await p.getTextContent()
for (const it of tc.items.slice(0, Number(max))) console.log(Math.round(it.transform[4]), Math.round(it.transform[5]), Math.round(it.width), JSON.stringify(it.str))
