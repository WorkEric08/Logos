// Gera os ícones do app a partir do ícone OFICIAL (docs/icone/icone-oficial-1024.png) e confere que public/icon.svg (vetor)
// desenha a mesma coisa. Rode quando o ícone oficial mudar: node scripts/gerar-icones.mjs   (precisa de playwright)
// Também gera os ícones do Android (android/app/src/main/res/mipmap-*): ic_launcher_foreground (adaptativo, só a arte, centralizada),
// ic_launcher (quadrado arredondado) e ic_launcher_round (círculo). FOREGROUND_LARGURA = largura da arte (100 unidades) em % do quadro
// de 108 dp do ícone adaptativo; a janela visível do launcher é 72/108 = 66,7 % (arte a 54 % = ~81 % da janela). Ajuste olhando o aparelho.
// Saídas em public/: icon-512.png, icon-192.png ("any", cantos arredondados transparentes), icon-maskable-512.png (quadrado cheio,
// arte a 80 % para caber na zona segura), apple-touch-icon.png (180, quadrado cheio: o iOS arredonda sozinho).
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const oficial = 'data:image/png;base64,' + readFileSync('docs/icone/icone-oficial-1024.png').toString('base64')
const svg = readFileSync('public/icon.svg', 'utf8')
const FOREGROUND_LARGURA = 0.54
const svgArte = svg.replace(/<rect width="150"[^>]*\/>/, '') // o mesmo desenho, sem o fundo preto
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()

const r = await p.evaluate(async ({ oficial, svg, svgArte, FOREGROUND_LARGURA }) => {
  const carrega = async (src) => { const im = new Image(); im.src = src; await im.decode(); return im }
  const tela = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; return [c, x] }
  const reduz = (img, n) => { // reduz pela metade enquanto der, para não serrilhar
    let atual = img, t = img.width
    while (t / 2 >= n) { t = Math.round(t / 2); const [c, x] = tela(t); x.drawImage(atual, 0, 0, t, t); atual = c }
    const [c, x] = tela(n); x.drawImage(atual, 0, 0, n, n); return c
  }
  const png = (c) => c.toDataURL('image/png').split(',')[1]
  const im = await carrega(oficial)
  const saidas = {}
  saidas['icon-512.png'] = png(reduz(im, 512)); saidas['icon-192.png'] = png(reduz(im, 192))
  { const [c, x] = tela(512); x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); const m = reduz(im, 512); x.drawImage(m, 51.2, 51.2, 409.6, 409.6); saidas['icon-maskable-512.png'] = png(c) }
  { const [c, x] = tela(180); x.fillStyle = '#000'; x.fillRect(0, 0, 180, 180); x.drawImage(reduz(im, 180), 0, 0); saidas['apple-touch-icon.png'] = png(c) }
  // ---- Android: arte centralizada no primeiro plano; ícones antigos (quadrado e círculo) ----
  const arte = await carrega('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgArte))
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
  const android = {}
  for (const [d, k] of Object.entries(dens)) {
    const S = Math.round(108 * k), u = (FOREGROUND_LARGURA * S) / 100 // px por unidade
    const [c, x] = tela(S); x.drawImage(arte, S / 2 - 75.75 * u, S / 2 - 81.75 * u, 150 * u, 150 * u)
    android['mipmap-' + d + '/ic_launcher_foreground.png'] = png(c)
    const L = Math.round(48 * k)
    android['mipmap-' + d + '/ic_launcher.png'] = png(reduz(im, L))
    const [cr, xr] = tela(L); xr.beginPath(); xr.arc(L / 2, L / 2, L / 2, 0, Math.PI * 2); xr.closePath(); xr.fillStyle = '#000'; xr.fill(); xr.save(); xr.clip()
    xr.drawImage(reduz(im, L), L * 0.09, L * 0.09, L * 0.82, L * 0.82); xr.restore()
    android['mipmap-' + d + '/ic_launcher_round.png'] = png(cr)
  }
  // o vetor desenha o mesmo que o oficial? (diferença média por pixel, 0–255)
  const sv = await carrega('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg))
  const [c1, x1] = tela(1024); x1.drawImage(sv, 0, 0, 1024, 1024)
  const [c2, x2] = tela(1024); x2.drawImage(im, 0, 0)
  const a = x1.getImageData(0, 0, 1024, 1024).data, o = x2.getImageData(0, 0, 1024, 1024).data
  let soma = 0, grandes = 0
  for (let i = 0; i < a.length; i += 4) {
    const alfa = Math.max(a[i + 3], o[i + 3]) / 255 // compara sobre fundo branco, para o canto transparente contar
    const d = (k) => Math.abs((a[i + k] * a[i + 3] + 255 * (255 - a[i + 3])) / 255 - (o[i + k] * o[i + 3] + 255 * (255 - o[i + 3])) / 255)
    const m = (d(0) + d(1) + d(2)) / 3; soma += m; if (m > 60 && alfa > 0) grandes++
  }
  return { saidas, android, difMedia: soma / (a.length / 4), pixelsMuitoDiferentes: grandes }
}, { oficial, svg, svgArte, FOREGROUND_LARGURA })

for (const [nome, b64] of Object.entries(r.saidas)) writeFileSync(join('public', nome), Buffer.from(b64, 'base64'))
import { existsSync, mkdirSync } from 'node:fs'
const RES = 'android/app/src/main/res'
if (existsSync(RES)) {
  for (const [nome, b64] of Object.entries(r.android)) { mkdirSync(join(RES, nome, '..'), { recursive: true }); writeFileSync(join(RES, nome), Buffer.from(b64, 'base64')) }
  writeFileSync(join(RES, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n')
  console.log('ícones do Android gerados em', RES)
}
console.log('gerados:', Object.keys(r.saidas).join(', '))
console.log(`vetor (icon.svg) × oficial: diferença média ${r.difMedia.toFixed(3)} de 255; pixels muito diferentes: ${r.pixelsMuitoDiferentes} de ${1024 * 1024}`)
await b.close()
process.exit(r.difMedia < 1 && r.pixelsMuitoDiferentes < 5000 ? 0 : 1)
