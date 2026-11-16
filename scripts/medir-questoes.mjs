// MEDE o gerador de questões (F4) com os SEUS materiais: lê .md/.txt de uma pasta (ou um arquivo), gera as questões e mostra, por arquivo, quantas saíram de cada tipo,
// quantos fatos não renderam questão (e por quê) e uma AMOSTRA completa (enunciado, 5 alternativas, gabarito e trecho de origem) para você marcar "aproveitável" ou
// "não" e, nas ruins, se foi enunciado confuso, alternativa absurda ou duas certas. Metas do plano: ≥ 70 % aproveitáveis sem edição e < 10 % com alternativa absurda.
// Uso: node scripts/medir-questoes.mjs <pasta-ou-arquivo> [--amostra=30] [--tudo]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { createServer } from 'vite'

const alvo = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!alvo) { console.log('Uso: node scripts/medir-questoes.mjs <pasta-ou-arquivo> [--amostra=30] [--tudo]'); process.exit(1) }
const amostra = Number((process.argv.find((a) => a.startsWith('--amostra=')) ?? '--amostra=30').split('=')[1])
const tudo = process.argv.includes('--tudo')

const arquivos = statSync(alvo).isDirectory()
  ? readdirSync(alvo, { recursive: true }).map(String).filter((f) => ['.md', '.txt', '.markdown'].includes(extname(f).toLowerCase())).map((f) => join(alvo, f))
  : [alvo]
if (!arquivos.length) { console.log('Nenhum .md/.txt em', alvo); process.exit(1) }

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { gerarQuestoes } = await vite.ssrLoadModule('/src/core/questoes/gerar.ts')
const { textoParaParagrafos } = await vite.ssrLoadModule('/src/core/importar/cartoes.ts')

const todas = []
const porTipo = {}, motivos = {}
let fatos = 0
for (const arq of arquivos) {
  const nome = basename(arq).replace(/\.[^.]+$/, '')
  const g = gerarQuestoes(textoParaParagrafos(readFileSync(arq, 'utf8')), { id: 'M' + nome, nome })
  fatos += g.fatos
  for (const { q, tipo } of g.questoes) { porTipo[tipo] = (porTipo[tipo] ?? 0) + 1; todas.push({ arq, q, tipo }) }
  for (const d of g.descartadas) motivos[d.motivo] = (motivos[d.motivo] ?? 0) + 1
  console.log(`${String(g.questoes.length).padStart(4)} questões · ${g.fatos} fatos · ${g.descartadas.length} sem questão — ${arq}`)
}
console.log(`\nTOTAL: ${todas.length} questões de ${fatos} fatos em ${arquivos.length} arquivo(s)`)
console.log('Por tipo:', Object.entries(porTipo).map(([t, n]) => `${t} ${n}`).join(' · ') || '—')
if (Object.keys(motivos).length) console.log('Fatos que não viraram questão:', Object.entries(motivos).map(([m, n]) => `${m} (${n})`).join(' · '))
// proxies automáticos (NÃO substituem o seu julgamento): a certa mais longa que todas as outras, e distribuição das letras certas
const maisLonga = todas.filter(({ q }) => Object.entries(q.o).every(([l, t]) => l === q.g || t.length < q.o[q.g].length)).length
const letras = {}; for (const { q } of todas) letras[q.g] = (letras[q.g] ?? 0) + 1
console.log(`Certa é a alternativa mais longa em ${todas.length ? Math.round((maisLonga / todas.length) * 100) : 0} % (esperado ~20 %); letras certas:`, Object.entries(letras).sort().map(([l, n]) => `${l} ${n}`).join(' · '))

const passo = Math.max(1, Math.floor(todas.length / Math.max(1, amostra)))
const mostra = tudo ? todas : todas.filter((_, i) => i % passo === 0).slice(0, amostra)
console.log(`\n${tudo ? 'TODAS' : `AMOSTRA de ${mostra.length}`} (marque ✓ aproveitável / ✗ ruim, e o motivo):`)
mostra.forEach(({ q, tipo }, i) => {
  console.log(`\n#${i + 1} [${tipo}] ${q.e}`)
  for (const l of ['A', 'B', 'C', 'D', 'E']) console.log(`   ${l === q.g ? '✓' : ' '} ${l}) ${q.o[l]}`)
  console.log(`   fonte: ${q.fonte}`)
})
await vite.close()
