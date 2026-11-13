// Adaptador do leitor de PDF (pdf.js) para o formato do núcleo (core/importar/layout.ts). Recebe o módulo do pdf.js como parâmetro, então serve no
// navegador (build normal, com worker) e no Node (testes e scripts, build "legacy"). Nada aqui sai do aparelho: o PDF é lido onde está.
import type { PaginaPdf } from '../../core/importar/layout'

/** O pedaço do pdf.js de que precisamos (tipado à mão para não puxar os tipos gigantes da biblioteca). */
export interface PdfJs {
  getDocument(src: { data: Uint8Array; useSystemFonts?: boolean }): { promise: Promise<PdfDoc> }
}
export interface PdfDoc { numPages: number; getPage(n: number): Promise<PdfPagina>; destroy?(): Promise<void> }
export interface PdfVista { getViewport(o: { scale: number }): { width: number; height: number }; render(o: { canvasContext: unknown; viewport: unknown; canvas?: unknown }): { promise: Promise<void> } }
export interface PdfPagina extends PdfVista {
  getViewport(o: { scale: number }): { width: number; height: number }
  getTextContent(): Promise<{ items: { str?: string; transform: number[]; width: number }[] }>
}

export interface Progresso { pagina: number; de: number }

/** Lê o texto de todas as páginas (ou só de `paginas`, 1-based). PDF só com imagem (escaneado) volta com páginas sem itens. */
export async function lerPaginas(pdfjs: PdfJs, dados: Uint8Array, aoProgredir?: (p: Progresso) => void, paginas?: number[]): Promise<{ paginas: PaginaPdf[]; total: number; doc: PdfDoc }> {
  const doc = await pdfjs.getDocument({ data: dados, useSystemFonts: true }).promise
  const alvo = paginas ?? Array.from({ length: doc.numPages }, (_, i) => i + 1)
  const saida: PaginaPdf[] = []
  for (const n of alvo) {
    const p = await doc.getPage(n)
    const vp = p.getViewport({ scale: 1 })
    const tc = await p.getTextContent()
    saida.push({
      numero: n, largura: vp.width, altura: vp.height,
      itens: tc.items.filter((i) => typeof i.str === 'string').map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, texto: i.str as string })),
    })
    aoProgredir?.({ pagina: n, de: alvo.length })
  }
  return { paginas: saida, total: doc.numPages, doc }
}
