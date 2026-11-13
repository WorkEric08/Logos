// Carrega o leitor de PDF (pdf.js, versão "legacy" que roda também na WebView do Android) só quando alguém importa um arquivo: o resto do app não paga por ele.
import type { PdfJs } from './pdf'

let promessa: Promise<PdfJs> | null = null
export function carregarPdfJs(): Promise<PdfJs> {
  return (promessa ??= (async () => {
    const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')])
    ;(pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = (worker as { default: string }).default
    return pdfjs as unknown as PdfJs
  })().catch((e) => { promessa = null; throw e }))
}
