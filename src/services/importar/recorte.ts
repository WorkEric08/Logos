// Recorta da página do PDF a região de uma questão (que o leitor já mediu) e devolve um PNG. É o mesmo que fizemos à mão para o banco do BB
// (imagens/<id>.png): tabela, figura e fórmula que o texto perde ficam na imagem. Só roda no navegador (precisa de canvas).
import type { Regiao } from '../../core/importar/prova'
import type { PdfDoc } from './pdf'

const ESCALA = 2.2 // 2,2× o tamanho do PDF: nítido no celular sem pesar
const FOLGA = 6

const canvasPNG = (c: HTMLCanvasElement): Promise<Blob> => new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('não consegui gerar a imagem'))), 'image/png'))

/** Junta, de cima para baixo, o recorte de cada página/coluna em que a questão aparece. */
export async function recortarQuestao(doc: PdfDoc, regioes: readonly Regiao[]): Promise<Blob | null> {
  if (!regioes.length) return null
  const partes: HTMLCanvasElement[] = []
  for (const r of [...regioes].sort((a, b) => a.pagina - b.pagina || a.coluna - b.coluna)) {
    const pagina = await doc.getPage(r.pagina)
    const vp = pagina.getViewport({ scale: ESCALA })
    const cheio = document.createElement('canvas')
    cheio.width = Math.ceil(vp.width); cheio.height = Math.ceil(vp.height)
    const ctx = cheio.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cheio.width, cheio.height)
    await pagina.render({ canvasContext: ctx, viewport: vp, canvas: cheio }).promise
    const altura = vp.height / ESCALA
    const x = Math.max(0, (r.x0 - FOLGA) * ESCALA), w = Math.min(cheio.width - x, (r.x1 - r.x0 + FOLGA * 2) * ESCALA)
    const y = Math.max(0, (altura - (r.yTopo + 11)) * ESCALA), h = Math.min(cheio.height - y, (r.yTopo - r.yBase + 11 + FOLGA) * ESCALA)
    if (w < 8 || h < 8) continue
    const parte = document.createElement('canvas')
    parte.width = Math.ceil(w); parte.height = Math.ceil(h)
    parte.getContext('2d')!.drawImage(cheio, x, y, w, h, 0, 0, w, h)
    partes.push(parte)
  }
  if (!partes.length) return null
  if (partes.length === 1) return canvasPNG(partes[0])
  const largura = Math.max(...partes.map((p) => p.width)), altura = partes.reduce((a, p) => a + p.height, 0)
  const junto = document.createElement('canvas')
  junto.width = largura; junto.height = altura
  const ctx = junto.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, largura, altura)
  let topo = 0
  for (const p of partes) { ctx.drawImage(p, 0, topo); topo += p.height }
  return canvasPNG(junto)
}
