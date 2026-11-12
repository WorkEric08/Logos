// EXPERIMENTO HISTÓRICO (superado: a regra aplicada hoje é a de duas etapas, testada de verdade em src/core/sorteio.test.ts; para ver a tabela: VITE_TABELA=1 npx vitest run src/core/sorteio.test.ts --reporter=verbose).
// Compara o sorteio "por peso" atual com uma proposta que faz cada matéria pesar o que o edital diz.
// A fórmula atual é reescrita aqui em JS só para comparar; o teste de verdade do código está em src/core/sorteio.test.ts.
// Uso: node scripts/simular-sorteio.mjs
import { readFileSync } from 'node:fs'
const SUBJ = { 'Vendas e Negociação': 15, 'Conhecimentos de Informática': 15, 'Língua Portuguesa': 10, 'Conhecimentos Bancários': 10, 'Matemática Financeira': 5, 'Matemática': 5, 'Língua Inglesa': 5, 'Atualidades do Mercado Financeiro': 5, 'Estatística': 3, 'Ética': 2, 'Legislação': 2, 'Conhecimentos Digitais': 2 }
const Q = JSON.parse(readFileSync('src/data/bank.json', 'utf8')).q
const idade = (q) => (q.ol ? 0.25 : q.y === 2018 ? 0.5 : 1)
const T = {}, S = {}, N = {}
for (const q of Q) { const k = q.m + '|' + q.t; T[k] = (T[k] ?? 0) + idade(q); S[q.m] = (S[q.m] ?? 0) + idade(q); N[q.m] = (N[q.m] ?? 0) + 1 }
const old = (q) => q.m === 'Vendas e Negociação' || q.m === 'Conhecimentos de Informática'
const fator = (q) => (q.ol ? (old(q) ? 0.3 : 0.6) : 1)
const W = {
  atual: (q) => SUBJ[q.m] * (1 + T[q.m + '|' + q.t]) * 1.5 * fator(q),
  // proposta: a matéria pesa o que o edital diz (peso ÷ nº de questões dela); o tema só reordena dentro da matéria (parte da frequência do tema na matéria)
  proposta: (q) => (SUBJ[q.m] / N[q.m]) * (1 + 4 * (T[q.m + '|' + q.t] / S[q.m])) * 1.5 * fator(q),
}
let s = 11; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647
function pick(pool, n, w) { const a = pool.map((q) => ({ q, w: w(q) })), o = []; while (o.length < n && a.length) { const tot = a.reduce((x, y) => x + y.w, 0); let r = rng() * tot, i = 0; for (; i < a.length - 1; i++) { r -= a[i].w; if (r <= 0) break } o.push(a.splice(i, 1)[0].q) } return o }
const soma = Object.values(SUBJ).reduce((a, b) => a + b, 0)
const res = {}
for (const nome of Object.keys(W)) { const c = {}; for (let i = 0; i < 3000; i++) for (const q of pick(Q, 10, W[nome])) c[q.m] = (c[q.m] ?? 0) + 1; res[nome] = c }
console.log('matéria'.padEnd(36), 'peso%'.padStart(6), 'atual%'.padStart(7), 'proposta%'.padStart(10))
for (const m of Object.keys(SUBJ)) console.log(m.padEnd(36), (100 * SUBJ[m] / soma).toFixed(1).padStart(6), (100 * (res.atual[m] ?? 0) / 30000).toFixed(1).padStart(7), (100 * (res.proposta[m] ?? 0) / 30000).toFixed(1).padStart(10))
