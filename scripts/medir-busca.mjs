// MEDE a busca ("perguntar ao meu material") com um conjunto que NÃO foi escrito por quem fez a busca: as 1.168 questões reais do banco viram o material, e para cada
// questão sorteada a "pergunta" é feita só com 3 palavras do enunciado, em quatro versões: como está, sem acento, com uma letra trocada e pelo avesso (sem acento + erro).
// Acerto = a questão (ou uma idêntica, o banco repete provas) aparece entre os 3 primeiros. Uso: node scripts/medir-busca.mjs [quantas] [--detalhe]
import { createServer } from 'vite'

const quantas = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 300)
const detalhe = process.argv.includes('--detalhe')
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { default: bank } = await import('../src/data/bank.json', { with: { type: 'json' } })
const { docsDeQuestoes } = await vite.ssrLoadModule('/src/core/busca/documentos.ts')
const { criarIndice } = await vite.ssrLoadModule('/src/services/busca/indice.ts')
const { PALAVRAS_VAZIAS, palavras, semAcento } = await vite.ssrLoadModule('/src/core/busca/texto.ts')

const qs = bank.q
const t0 = performance.now()
const indice = await criarIndice(docsDeQuestoes(qs, bank.sources))
const construcao = performance.now() - t0

// repetição: mesmo enunciado = mesma questão para efeito de acerto
const norm = (s) => semAcento(s).replace(/[^a-z0-9]+/g, ' ').trim()
const iguais = new Map(); for (const q of qs) { const k = norm(q.e); (iguais.get(k) ?? iguais.set(k, []).get(k)).push(q.id) }

let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
const amostra = [...qs].sort(() => rnd() - 0.5).slice(0, quantas)
const tres = (q) => { // 3 palavras de conteúdo do enunciado (as mais longas, na ordem em que aparecem), sem números soltos
  const uteis = palavras(q.e, true).filter((p) => !PALAVRAS_VAZIAS.has(semAcento(p)) && p.length >= 5 && !/^\d+$/.test(p))
  const unicas = [...new Set(uteis)]
  const escolhidas = new Set([...unicas].sort((a, b) => b.length - a.length).slice(0, 3))
  return unicas.filter((p) => escolhidas.has(p))
}
const troca = (p) => (p.length < 6 ? p : p.slice(0, 2) + p[3] + p[2] + p.slice(4)) // duas letras do meio trocadas

const versoes = { 'como está': (w) => w.join(' '), 'sem acento': (w) => w.map(semAcento).join(' '), 'uma troca de letras': (w) => w.map((p, i) => (i === 0 ? troca(p) : p)).join(' '), 'sem acento + troca': (w) => w.map((p, i) => semAcento(i === 0 ? troca(p) : p)).join(' ') }
const tabela = {}; const erros = []
let tempoBusca = 0, nBuscas = 0
for (const [nome, fazer] of Object.entries(versoes)) {
  let top1 = 0, top3 = 0, n = 0
  for (const q of amostra) {
    const w = tres(q); if (w.length < 2) continue
    const consulta = fazer(w); const aceitos = new Set(iguais.get(norm(q.e)))
    const t1 = performance.now(); const r = indice.buscar(consulta, 3); tempoBusca += performance.now() - t1; nBuscas++
    n++; const ids = r.map((x) => x.doc.ref)
    if (aceitos.has(ids[0])) top1++
    if (ids.some((i) => aceitos.has(i))) top3++; else if (detalhe) erros.push(`[${nome}] "${consulta}" → ${r.map((x) => x.doc.titulo).join(' | ')}`)
  }
  tabela[nome] = { perguntas: n, 'em 1º': `${((100 * top1) / n).toFixed(1)} %`, 'nos 3 primeiros': `${((100 * top3) / n).toFixed(1)} %` }
}
console.log(`Índice de ${qs.length} questões construído em ${construcao.toFixed(0)} ms; busca média ${(tempoBusca / nBuscas).toFixed(1)} ms.`)
console.table(tabela)
if (detalhe) console.log(erros.slice(0, 40).join('\n'))
await vite.close()
