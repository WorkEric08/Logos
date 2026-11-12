// Varre as 400 imagens de public/q no navegador: recorte cortado embaixo (pixel escuro nas 2 últimas linhas, fora da borda
// lateral) e imagem em branco. Só lê. Defeitos já conhecidos (decisão do dono) saem como CONHECIDO.
// Uso: node scripts/verificar-imagens.mjs [--estrito]      (precisa do Chrome instalado e de `playwright`)
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const ESTRITO = process.argv.includes('--estrito')
const CONHECIDOS = { 'BB-2018-AC-INF-55.png': 'sobra cortada da coluna seguinte embaixo; as cinco alternativas estão completas na parte de cima' }
const q = JSON.parse(readFileSync('src/data/bank.json', 'utf8')).q.filter((x) => x.img)
const srv = createServer((req, res) => {
  try { const b = readFileSync(join('public/q', decodeURIComponent(req.url.slice(1)))); res.writeHead(200, { 'content-type': 'image/png' }); res.end(b) } catch { res.writeHead(404); res.end() }
}).listen(0)
const porta = srv.address().port
const nav = await chromium.launch({ channel: 'chrome' })
const p = await nav.newPage(); await p.goto(`http://127.0.0.1:${porta}/BB-2010-AC-ATD-41.png`)
const res = await p.evaluate(async (lista) => {
  const out = []
  for (const f of lista) {
    const im = new Image(); im.src = '/' + f; await im.decode()
    const W = im.naturalWidth, H = im.naturalHeight, c = new OffscreenCanvas(W, H), g = c.getContext('2d')
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(im, 0, 0)
    const escuros = (x0, y0, w, h) => { const d = g.getImageData(x0, y0, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 150 && d[i + 1] < 150 && d[i + 2] < 150) n++; return n }
    out.push({ f, W, H, cortada: escuros(14, H - 2, W - 28, 2), conteudo: escuros(0, 0, W, H) / (W * H) })
  }
  return out
}, q.map((x) => x.img))
await nav.close(); srv.close()
let falhas = 0, conhecidos = 0
const cortadas = res.filter((r) => r.cortada > 0), brancas = res.filter((r) => r.conteudo < 0.002)
console.log(`${res.length} imagens analisadas; larguras ${Math.min(...res.map((r) => r.W))}–${Math.max(...res.map((r) => r.W))} px`)
for (const r of cortadas) { if (CONHECIDOS[r.f]) { conhecidos++; console.log(`CONHECIDO ${r.f} — ${CONHECIDOS[r.f]} (${r.cortada}px escuros na última linha)`) } else { falhas++; console.log(`FALHOU    ${r.f} — possível corte embaixo (${r.cortada}px escuros na última linha, ${r.W}x${r.H})`) } }
console.log(cortadas.length ? '' : 'OK        nenhuma imagem cortada embaixo')
if (brancas.length) { falhas += brancas.length; console.log(`FALHOU    em branco: ${brancas.map((r) => r.f).join(', ')}`) } else console.log('OK        nenhuma imagem em branco')
const fantasmas = Object.keys(CONHECIDOS).filter((f) => !cortadas.some((r) => r.f === f))
if (fantasmas.length) console.log(`AVISO     defeito conhecido que não aparece mais (corrigido?): ${fantasmas.join(', ')}`)
console.log(`\nResumo: ${falhas} falha(s), ${conhecidos} conhecido(s).`)
process.exit(falhas || (ESTRITO && conhecidos) ? 1 : 0)
