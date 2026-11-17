// Ferramenta de desenvolvimento: importa UM PDF seu pelo assistente ("Criar cartões de um resumo") no navegador de verdade e mostra o que o assistente diz e os cartões da prévia.
// Confere o caminho inteiro (leitor de PDF do navegador → limpeza → cartões → mensagens), que os scripts de medição (só texto) não percorrem.
// Precisa do app em http://localhost:4173/ (npm run build && npx vite preview --port 4173). Uso: node scripts/_importar-pdf-real.mjs <arquivo.pdf> [url]
import { createRequire } from 'node:module'
import { basename, join } from 'node:path'
import { esperarMovimento, irPara, novoContexto } from './_ctx.mjs'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const arq = process.argv[2]
if (!arq) { console.log('Uso: node scripts/_importar-pdf-real.mjs <arquivo.pdf> [url]'); process.exit(1) }
const base = process.argv[3] ?? 'http://localhost:4173/'
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await novoContexto(b, { viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, colorScheme: 'dark' })
const p = await ctx.newPage()
p.on('pageerror', (e) => console.log('ERRO DE SCRIPT:', e.message))
await p.goto(base); await p.waitForSelector('.folders')
await irPara(p, 'Assistente'); await p.waitForSelector('.as-pilula'); await esperarMovimento(p)
// as questões geradas só entram em espaços do usuário (o do Banco do Brasil é fixo): cria um espaço vazio antes
await p.locator('.as-pilula[data-acao="espaco"]').click()
await p.locator('.btn', { hasText: 'Novo espaço' }).click()
await p.fill('#as-espaco', 'Estudo'); await p.locator('.btn', { hasText: 'Criar vazio' }).click()
await p.waitForSelector('.as-pilula'); await esperarMovimento(p)
await p.locator('.as-pilula[data-acao="cartoes"]').click()
await p.setInputFiles('#as-f-resumo', arq)
await p.waitForSelector('.as-qs, #as-baralho', { timeout: 120000 })
await esperarMovimento(p)
const falas = await p.locator('.as-msg.a:not(.as-digitando)').allInnerTexts()
console.log(`=== ${basename(arq)} ===`)
console.log(falas.slice(-4).join('\n---\n'))
const itens = await p.locator('.as-q').count()
console.log(`\nPrévia: ${itens} cartões`)
// depois, as QUESTÕES do mesmo material (o resumo ficou guardado no aparelho)
await p.reload(); await p.waitForSelector('.nav', { state: 'attached' })
await irPara(p, 'Assistente'); await p.waitForSelector('.as-pilula'); await esperarMovimento(p)
await p.locator('.as-pilula[data-acao="questoes"]').click()
await p.waitForSelector('.as-qs, .as-sug-lista', { timeout: 120000 }); await p.waitForTimeout(3000); await esperarMovimento(p)
if (!(await p.locator('.as-qs').count())) {
  // mais de um material guardado: escolhe o primeiro
  console.log('pílulas:', (await p.locator('.as-pilula').allInnerTexts()).join(' | '))
  await p.locator('.as-pilula[data-sug^="mat-"]').first().click().catch(() => {})
  await p.waitForSelector('.as-qs', { timeout: 120000 }); await esperarMovimento(p)
}
const falasQ = await p.locator('.as-msg.a:not(.as-digitando)').allInnerTexts()
console.log('\n=== questões ===\n' + falasQ.slice(-3).join('\n---\n'))
const nq = await p.locator('.as-q').count()
console.log(`Prévia: ${nq} questões`)
await b.close()
