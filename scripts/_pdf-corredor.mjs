// Ferramenta de desenvolvimento: por que uma página de PDF foi (ou não) dividida em duas colunas? Mostra o corredor achado e os números da decisão.
// Uso: node scripts/_pdf-corredor.mjs <arquivo.pdf> [página] [quantas linhas mostrar]
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
const [, , arq, pag = '1'] = process.argv
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { acharCorredor, paginaParaLinhas } = await vite.ssrLoadModule('/src/core/importar/layout.ts')
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(arq)), useSystemFonts: true }).promise
const p = await doc.getPage(Number(pag)), vp = p.getViewport({ scale: 1 }), tc = await p.getTextContent()
const pagina = { numero: Number(pag), largura: vp.width, altura: vp.height, itens: tc.items.filter((i) => typeof i.str === 'string').map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, texto: i.str, h: i.height })) }
const uteis = pagina.itens.filter((i) => i.texto.trim())
console.log('largura', Math.round(vp.width), 'altura', Math.round(vp.height), 'itens', uteis.length, 'corredor', acharCorredor(uteis, vp.width))
const linhas = paginaParaLinhas(pagina)
console.log(linhas.slice(0, Number(process.argv[4] ?? 14)).map((l) => `[col ${l.coluna} y${Math.round(l.y)}] ${l.texto.slice(0, 90)}`).join('\n'))
await vite.close()
