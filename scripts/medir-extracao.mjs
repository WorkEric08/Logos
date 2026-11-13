// MEDE o extrator de provas (core/importar) contra o banco já revisado (banco/*.json): lê os PDFs de verdade, extrai as questões e compara
// com o que está no banco (por prova e número). Serve para saber, com número, o quanto o leitor sem IA acerta antes de confiar nele.
// Uso: node scripts/medir-extracao.mjs [pasta dos PDFs] [--detalhe]      (pasta padrão: ~/Documents/Banco de questões Bancos Cesgranrio)
// Precisa dos PDFs (arquivos pessoais, fora do repositório). Sem a pasta, avisa e sai sem erro.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, basename } from 'node:path'
import { createServer } from 'vite'

const args = process.argv.slice(2)
const detalhe = args.includes('--detalhe')
const pasta = args.find((a) => !a.startsWith('--')) ?? join(homedir(), 'Documents', 'Banco de questões Bancos Cesgranrio')
if (!existsSync(pasta)) { console.log('Pasta de PDFs não encontrada:', pasta, '— nada a medir.'); process.exit(0) }

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const carregar = (p) => vite.ssrLoadModule(p)
const { paginasParaLinhas } = await carregar('/src/core/importar/layout.ts')
const { lerProva } = await carregar('/src/core/importar/prova.ts')
const { lerGabarito } = await carregar('/src/core/importar/gabarito.ts')
const { lerPaginas } = await carregar('/src/services/importar/pdf.ts')
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

const achar = (dir, nome, acc = []) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) achar(p, nome, acc); else if (f === nome) acc.push(p) } return acc }
const banco = ['matematica', 'bancarios', 'portugues_ingles', 'informatica', 'atualidades', 'vendas_atendimento', 'estatistica', 'etica', 'digitais_legislacao']
  .flatMap((n) => JSON.parse(readFileSync(`banco/agente_comercial_${n}.json`, 'utf8')))
const porArquivo = {}
for (const q of banco) (porArquivo[q.arquivoProva] ??= []).push(q)

const norm = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')
const bigramas = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1) } return m }
const dice = (a, b) => {
  a = norm(a); b = norm(b)
  if (!a && !b) return 1
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0
  const A = bigramas(a), B = bigramas(b); let inter = 0
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0)
  return (2 * inter) / (a.length + b.length - 2)
}

const linhas = []
const tot = { esperadas: 0, achadas: 0, cinco: 0, altOk: 0, enunOk: 0, gabOk: 0, gabTem: 0 }
const problemas = []
for (const [arq, qs] of Object.entries(porArquivo).sort()) {
  const [pdf] = achar(pasta, arq)
  if (!pdf) { linhas.push([arq, 'PDF não encontrado']); continue }
  const gabNome = arq.replace('_prova.pdf', '_gabarito.pdf')
  const [gpdf] = achar(pasta, gabNome)
  const { paginas } = await lerPaginas(pdfjs, new Uint8Array(readFileSync(pdf)))
  const prova = lerProva(paginasParaLinhas(paginas))
  let gab = null
  if (gpdf) { const g = await lerPaginas(pdfjs, new Uint8Array(readFileSync(gpdf))); gab = lerGabarito(paginasParaLinhas(g.paginas, { colunas: false, margens: false })) }
  const lida = new Map(prova.questoes.map((q) => [q.numero, q]))
  const c = { esperadas: qs.length, achadas: 0, cinco: 0, altOk: 0, enunOk: 0, gabOk: 0, gabTem: 0 }
  for (const q of qs) {
    const r = lida.get(q.numero)
    if (!r) { problemas.push(`${arq} Q${q.numero}: não encontrada`); continue }
    c.achadas++
    const alts = r.alternativas
    if (Object.keys(alts).length === 5) c.cinco++
    const altSim = ['A', 'B', 'C', 'D', 'E'].map((l) => dice(alts[l], q.alternativas?.[l]))
    if (altSim.every((x) => x >= 0.93)) c.altOk++
    else problemas.push(`${arq} Q${q.numero}: alternativas diferentes (${altSim.map((x) => x.toFixed(2)).join(' ')})`)
    const e = Math.max(dice(r.enunciado, q.enunciado), dice(`${r.apoio} ${r.enunciado}`, `${q.textoApoio ?? ''} ${q.enunciado}`))
    if (e >= 0.9) c.enunOk++
    else problemas.push(`${arq} Q${q.numero}: enunciado diferente (${e.toFixed(2)})`)
    if (gab && q.gabarito) { c.gabTem++; if (gab.respostas[q.numero] === q.gabarito) c.gabOk++; else problemas.push(`${arq} Q${q.numero}: gabarito ${gab.respostas[q.numero]} ≠ ${q.gabarito}`) }
  }
  for (const k of Object.keys(tot)) tot[k] += c[k]
  linhas.push([arq.replace('_prova.pdf', ''), c.esperadas, c.achadas, c.cinco, c.altOk, c.enunOk, gab ? `${c.gabOk}/${c.gabTem}` : '(sem gabarito)', prova.avisos.join('; ').slice(0, 60)])
}
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '–')
console.log('prova'.padEnd(52), 'banco', 'achou', '5alt', 'altOK', 'enunOK', 'gabarito')
for (const l of linhas) console.log(String(l[0]).padEnd(52), ...l.slice(1).map((x) => String(x).padEnd(5)))
console.log('\nTOTAL das questões do banco que o leitor tentou:', tot.esperadas)
console.log(`  encontradas ${pct(tot.achadas, tot.esperadas)} · com 5 alternativas ${pct(tot.cinco, tot.esperadas)} · alternativas iguais ${pct(tot.altOk, tot.esperadas)} · enunciado igual ${pct(tot.enunOk, tot.esperadas)} · gabarito certo ${pct(tot.gabOk, tot.gabTem)} (${tot.gabOk}/${tot.gabTem})`)
writeFileSync(join(process.env.TEMP ?? '.', 'medir-extracao-problemas.txt'), problemas.join('\n'))
if (detalhe) console.log('\n' + problemas.slice(0, 60).join('\n'))
else console.log(`  (${problemas.length} diferenças; veja com --detalhe ou em ${join(process.env.TEMP ?? '.', 'medir-extracao-problemas.txt')})`)
await vite.close()
