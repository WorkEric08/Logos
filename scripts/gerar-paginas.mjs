// Gera a imagem da PÁGINA INTEIRA da prova (public/pages/p<chave>-NN.jpg) de cada questão do banco que ainda não tem uma, a partir dos
// PDFs originais (campo `pagina` e `arquivoProva` de banco/*.json). Usa o visualizador de PDF do Chrome (não precisa de pdftoppm).
// Largura de 744 px, como as páginas que já existiam (a altura segue a folha). Repetível: pula o que já existe. Depois rode: node scripts/importar-banco.mjs
// Uso (da raiz): node scripts/gerar-paginas.mjs [pasta dos PDFs] [--so-listar]
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const requ = createRequire(join(process.cwd(), 'package.json'))
const sharp = requ('sharp')
const argumentos = process.argv.slice(2)
const soListar = argumentos.includes('--so-listar')
const soChave = argumentos.find((a) => a.startsWith('--so='))?.slice(5) // teste: só uma prova (ex.: --so=caixa-2024), e só a 1ª página dela
const limite = argumentos.find((a) => a.startsWith('--max='))?.slice(6)
const RAIZ_PDF = argumentos.find((a) => !a.startsWith('--')) ?? 'C:/Users/Pichau/Documents/Banco de questões Bancos Cesgranrio'
const SAIDA = 'public/pages'
const LARGURA = 744
// As provas do BB que já tinham páginas guardam os arquivos pela chave antiga (p2010-NN.jpg); as outras, pela chave da prova (pcaixa-2024-NN.jpg).
const FAMILIA = { 'bb-2010': '2010', 'bb-2012': '2012', 'bb-2014': '2014', 'bb-032015': '2015a', 'bb-102015': '2015b', 'bb-2018': '2018', 'bb-2021': '2021', 'bb-2023': '2023' }
const pad = (n) => String(n).padStart(2, '0')

const bank = JSON.parse(readFileSync('src/data/bank.json', 'utf8')).q
const registros = {}
for (const f of readdirSync('banco').filter((x) => x.endsWith('.json'))) for (const r of JSON.parse(readFileSync(join('banco', f), 'utf8'))) registros[r.id] = r

// (chave da prova no app, arquivo PDF) -> páginas que faltam
const faltam = new Map()
for (const q of bank) {
  if (q.p) continue
  const r = registros[q.id]
  if (!r?.pagina || !r.arquivoProva) continue
  const chave = q.ps ?? FAMILIA[q.s] ?? q.s, arq = join(SAIDA, `p${chave}-${pad(r.pagina)}.jpg`)
  if (existsSync(arq)) continue
  const k = `${chave}|${r.arquivoProva}`
  if (!faltam.has(k)) faltam.set(k, new Set())
  faltam.get(k).add(r.pagina)
}
const total = [...faltam.values()].reduce((a, s) => a + s.size, 0)
console.log(`${total} páginas a gerar em ${faltam.size} provas`)
if (soListar) { for (const [k, s] of faltam) console.log(k, [...s].sort((a, b) => a - b).join(',')); process.exit(0) }

// acha o PDF pelo nome em qualquer subpasta
const indice = new Map()
const varre = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) varre(f); else if (/\.pdf$/i.test(n) && !indice.has(n)) indice.set(n, f) } }
varre(RAIZ_PDF)

const { chromium } = requ('playwright')
// O visualizador de PDF do Chrome só existe com janela: o headless "novo" vem pelo argumento.
const navegador = await chromium.launch({ channel: 'chrome', headless: false, args: ['--headless=new'] })
mkdirSync(SAIDA, { recursive: true })
let feitas = 0
for (const [k, paginas] of faltam) {
  const [chave, nomePdf] = k.split('|')
  if (soChave && chave !== soChave) continue
  const pdf = indice.get(nomePdf)
  if (!pdf) { console.error(`FALTA o PDF ${nomePdf}`); process.exitCode = 1; continue }
  for (const n of [...paginas].sort((a, b) => a - b).slice(0, limite ? Number(limite) : undefined)) {
    const pagina = await navegador.newPage({ viewport: { width: 1240, height: 2200 }, deviceScaleFactor: 1 })
    await pagina.goto(`${pathToFileURL(resolve(pdf)).href}#page=${n}&zoom=page-fit&navpanes=0&toolbar=0`)
    await pagina.waitForTimeout(2200)
    const png = await pagina.screenshot()
    await pagina.close()
    // O visualizador pinta um fundo escuro em volta da folha e mostra a folha seguinte logo abaixo: acha a 1ª folha pelas linhas de fundo.
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const W = info.width, H = info.height, c = info.channels
    const claro = (x, y) => { const o = (y * W + x) * c; return data[o] > 200 && data[o + 1] > 200 && data[o + 2] > 200 } // a folha é branca; o fundo, a sombra e o vão são escuros
    const meio = Math.floor(W / 2)
    let y0 = 0; while (y0 < H && !claro(meio, y0)) y0++ // topo da folha
    const ym = Math.min(y0 + 6, H - 1) // faixa branca da margem de cima
    let x0 = 0; while (x0 < W && !claro(x0, ym)) x0++
    let x1 = W - 20; while (x1 > x0 && !claro(x1, ym)) x1-- // (os últimos pixels são a barra de rolagem do visualizador)
    const linhaFolha = (y) => { for (let x = x0 + 10; x < x1 - 10; x += 3) if (claro(x, y)) return true; return false }
    let y1 = y0 + 200; while (y1 < H && linhaFolha(y1)) y1++ // 1ª linha sem nada claro depois da folha = o vão entre folhas
    const saida = join(SAIDA, `p${chave}-${pad(n)}.jpg`)
    const larguraFolha = x1 - x0 + 1, alturaFolha = y1 - y0
    if (larguraFolha < 600 || alturaFolha < 600) { console.error(`FALHOU ${saida}: folha ${larguraFolha}×${alturaFolha} (esperado ≥ 600)`); process.exitCode = 1; continue }
    await sharp(png).extract({ left: x0, top: y0, width: larguraFolha, height: alturaFolha }).resize({ width: LARGURA }).jpeg({ quality: 78, mozjpeg: true }).toFile(saida)
    const recorte = { info: { width: larguraFolha, height: alturaFolha } }
    feitas++
    console.log(`ok ${saida} (folha ${larguraFolha}×${alturaFolha})`)
  }
}
await navegador.close()
console.log(`${feitas} páginas geradas`)
