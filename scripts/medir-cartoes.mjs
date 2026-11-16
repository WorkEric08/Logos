// MEDE o gerador de cartões (F3) com os SEUS resumos: lê arquivos .md/.txt de uma pasta (ou um arquivo só), gera os cartões e mostra, por arquivo, quantos saíram de
// cada tipo, quantos foram barrados pela qualidade (com o motivo) e quantos parágrafos ficaram de fora, mais uma amostra para você marcar "bom/ruim" à mão.
// Meta do plano: pelo menos 80 % de cartões bons numa amostra de ~100. Uso: node scripts/medir-cartoes.mjs <pasta-ou-arquivo> [--amostra=30] [--tudo]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { createServer } from 'vite'

const alvo = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!alvo) { console.log('Uso: node scripts/medir-cartoes.mjs <pasta-ou-arquivo> [--amostra=30] [--tudo]'); process.exit(1) }
const amostra = Number((process.argv.find((a) => a.startsWith('--amostra=')) ?? '--amostra=30').split('=')[1])
const tudo = process.argv.includes('--tudo')

const arquivos = statSync(alvo).isDirectory()
  ? readdirSync(alvo, { recursive: true }).map(String).filter((f) => ['.md', '.txt', '.markdown'].includes(extname(f).toLowerCase())).map((f) => join(alvo, f))
  : [alvo]
if (!arquivos.length) { console.log('Nenhum .md/.txt em', alvo); process.exit(1) }

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { sugerirCartoes, textoParaParagrafos } = await vite.ssrLoadModule('/src/core/importar/cartoes.ts')

const todos = []
const porTipo = {}
let paragrafos = 0, sobraram = 0, barrados = 0
const motivos = {}
for (const arq of arquivos) {
  const r = sugerirCartoes(textoParaParagrafos(readFileSync(arq, 'utf8')))
  paragrafos += r.paragrafos; sobraram += r.sobraram; barrados += r.descartados.length
  for (const c of r.cartoes) { porTipo[c.tipo] = (porTipo[c.tipo] ?? 0) + 1; todos.push({ arq, c }) }
  for (const d of r.descartados) motivos[d.motivo] = (motivos[d.motivo] ?? 0) + 1
  console.log(`${r.cartoes.length.toString().padStart(4)} cartões · ${r.descartados.length} barrados · ${r.sobraram}/${r.paragrafos} parágrafos de fora — ${arq}`)
}
console.log(`\nTOTAL: ${todos.length} cartões em ${arquivos.length} arquivo(s); ${barrados} barrados; ${sobraram} de ${paragrafos} parágrafos sem cartão (${paragrafos ? Math.round((sobraram / paragrafos) * 100) : 0} %)`)
console.log('Por tipo:', Object.entries(porTipo).map(([t, n]) => `${t} ${n}`).join(' · ') || '—')
if (barrados) console.log('Motivos dos barrados:', Object.entries(motivos).map(([m, n]) => `${m} (${n})`).join(' · '))

// amostra espalhada (sempre a mesma: passo fixo), para você julgar: "bom" = ajuda a estudar, tem uma ideia só, não entrega a resposta na frente
const passo = Math.max(1, Math.floor(todos.length / Math.max(1, amostra)))
const mostra = tudo ? todos : todos.filter((_, i) => i % passo === 0).slice(0, amostra)
console.log(`\n${tudo ? 'TODOS' : `AMOSTRA de ${mostra.length}`} (marque b/r ao lado de cada um e conte):`)
mostra.forEach(({ c }, i) => console.log(`\n#${i + 1} [${c.tipo}]${c.aviso ? ' ⚠ ' + c.aviso : ''}\n  F: ${c.f.replace(/\n/g, '\n     ')}\n  V: ${c.v}`))
await vite.close()
