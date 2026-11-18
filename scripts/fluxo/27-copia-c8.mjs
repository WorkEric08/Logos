// C-8: cópia de segurança leva progresso, histórico, cartões e marcações. Exportar (A) → "apagar dados" (contexto novo, B) → restaurar; restaurar de novo; restaurar sobre dados diferentes (C);
// restaurar cópia ANTIGA (v1, sem estudo) em aparelho vazio (D) e com dados (E).
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { abrirApp, irPara, onde, voltar, texto, toast, foto, esperarMovimento } from './_base.mjs'
const out = (...a) => console.log(...a)
const R = []; const ok = (n, c, x = '') => { const l = `${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`; R.push(l); console.log(l) }
const DADOS = join(process.cwd(), 'scripts', 'fluxo', 'dados'); mkdirSync(DADOS, { recursive: true })
const NOVA = join(DADOS, 'copia-nova.json'), ANTIGA = join(DADOS, 'copia-antiga.json')
const novo = async () => { const a = await abrirApp({ ctxExtra: { reducedMotion: 'reduce', acceptDownloads: true } }); a.p.setDefaultTimeout(12000); return a }
const stats = (p) => p.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent).join('|'))
const estado = async (p) => {
  await irPara(p, 'Início'); const st = await stats(p)
  await irPara(p, 'Cards'); await p.waitForTimeout(400); const cards = (await texto(p)).split('\n').slice(0, 2).join(' ')
  const baralhos = await p.locator('.deck').allInnerTexts().then((a) => a.map((t) => t.split('\n')[0]))
  await irPara(p, 'Treinar'); const marc = await p.locator('.chip', { hasText: 'Marcadas' }).innerText().then((t) => t.replace(/\D/g, ''))
  await irPara(p, 'Desempenho'); await p.waitForTimeout(300); const mes = (await p.locator('.evo .note').first().innerText()).trim()
  return { st, cards, baralhos, marc, mes }
}
const treino = async (p, n) => { await irPara(p, 'Início'); await p.locator('.tile', { hasText: 'Treino rápido' }).click(); await p.waitForSelector('.sheet'); for (let i = 0; i < n; i++) { await p.locator('.alt:not([disabled])').first().click(); await p.waitForTimeout(60); await p.locator('.foot .btn.pri').click() } await voltar(p); await p.waitForTimeout(300) }
const restaurar = async (p, arq) => {
  await irPara(p, 'Mais'); await p.waitForTimeout(500)
  await p.setInputFiles('#copia-arquivo', arq); await p.waitForTimeout(1500)
  return (await p.locator('.card.copia [role=status],.card.copia [role=alert]').allInnerTexts()).join(' / ')
}

// ---- A: aparelho com dados
const A = await novo()
await A.p.locator('.tile', { hasText: 'Treino rápido' }).click(); await A.p.waitForSelector('.sheet')
await A.p.locator('.marcar').click(); await A.p.locator('.nota summary').click(); await A.p.fill('textarea', 'nota do A'); await A.p.locator('.alt:not([disabled])').first().click(); await A.p.waitForTimeout(300)
await A.p.locator('.criarcard').click(); await A.p.waitForTimeout(1200)
for (let i = 0; i < 5; i++) { await A.p.locator('.foot .btn.pri').click(); await A.p.waitForTimeout(60); await A.p.locator('.alt:not([disabled])').first().click(); await A.p.waitForTimeout(60) }
await voltar(A.p); await A.p.waitForTimeout(300)
await irPara(A.p, 'Cards'); await A.p.locator('text=Novo baralho').first().click(); await A.p.fill('#nb', 'Meu baralho'); await A.p.click('text=Criar baralho'); await A.p.waitForTimeout(700)
await A.p.click('.btn >> text=Novo cartão'); await A.p.fill('#cf', 'P-A'); await A.p.fill('#cv', 'R-A'); await A.p.click('.foot >> text=Salvar >> nth=-1'); await A.p.waitForTimeout(800)
const eA = await estado(A.p); out('A estado:', JSON.stringify(eA))
await irPara(A.p, 'Mais'); await A.p.waitForTimeout(600)
out('A texto da cópia:', (await A.p.locator('.card.copia').innerText()).replace(/\n/g, ' | ').slice(0, 520))
const dl = A.p.waitForEvent('download'); await A.p.getByRole('button', { name: 'Salvar cópia' }).click(); const d = await dl; await d.saveAs(NOVA)
out('A status após salvar:', (await A.p.locator('.card.copia [role=status]').allInnerTexts()).join(' / '))
const j = JSON.parse(readFileSync(NOVA, 'utf8')); out('chaves da cópia nova:', Object.keys(j).join(','), '| versao', j.versao)
ok('cópia nova guarda progresso, histórico, cartões e marcações', !!j.estudo && JSON.stringify(j.estudo).length > 200, Object.keys(j.estudo ?? {}).join(','))
await A.fechar()

// ---- B: aparelho "sem dados" (contexto novo = IndexedDB vazio)
const B = await novo()
out('B antes:', (await estado(B.p)).st)
const msgB = await restaurar(B.p, NOVA); out('B restaurar →', msgB)
const eB = await estado(B.p); out('B depois:', JSON.stringify(eB))
ok('B progresso/vistas igual ao A', eB.st === eA.st, `${eB.st} vs ${eA.st}`)
ok('B baralhos iguais (Das questões + Meu baralho)', JSON.stringify(eB.baralhos) === JSON.stringify(eA.baralhos), JSON.stringify(eB.baralhos))
ok('B marcações (flag "Marcar") e anotações voltam com a cópia (F-17 se falhar)', eB.marc === eA.marc, `A=${eA.marc} B=${eB.marc}`)
ok('B gráfico do mês igual', eB.mes === eA.mes, eB.mes)
// anotação voltou?
const msgB2 = await restaurar(B.p, NOVA); out('B restaurar de novo →', msgB2)
const eB2 = await estado(B.p); ok('B restaurar 2x não duplica nada', JSON.stringify(eB2) === JSON.stringify(eB), JSON.stringify(eB2))
await B.p.reload(); await B.p.waitForSelector('h1'); await esperarMovimento(B.p); ok('B depois de recarregar continua igual', (await estado(B.p)).st === eA.st)
await B.fechar()

// ---- C: aparelho com dados DIFERENTES recebe a cópia (nada some)
const C = await novo()
await treino(C.p, 3)
await irPara(C.p, 'Cards'); await C.p.locator('text=Criar o primeiro baralho').click(); await C.p.fill('#nb', 'Do C'); await C.p.click('text=Criar baralho'); await C.p.waitForTimeout(600)
const eC0 = await estado(C.p); out('C antes:', JSON.stringify(eC0))
out('C restaurar →', await restaurar(C.p, NOVA))
const eC = await estado(C.p); out('C depois:', JSON.stringify(eC))
ok('C baralho do C continua e o do A chegou', eC.baralhos.includes('Do C') && eC.baralhos.includes('Meu baralho'), JSON.stringify(eC.baralhos))
ok('C progresso não diminuiu', parseInt(eC.st.split('|')[0]) >= Math.max(parseInt(eC0.st.split('|')[0]), parseInt(eA.st.split('|')[0])), `${eC0.st} + ${eA.st} → ${eC.st}`)
await C.fechar()

// ---- D / E: cópia antiga (v1)
const D = await novo()
const msgD = await restaurar(D.p, ANTIGA); out('D (antiga em aparelho vazio) →', msgD)
ok('D cópia antiga é aceita (espaço Antigo)', /Restaurei|1 espaço/.test(msgD) && !/não é uma cópia|mais nova/.test(msgD), msgD)
ok('D progresso segue zerado', (await estado(D.p)).st === '0|–|0')
await D.fechar()
const E = await novo()
await treino(E.p, 4); const eE0 = await estado(E.p)
out('E (antiga em aparelho com dados) →', await restaurar(E.p, ANTIGA)); const eE = await estado(E.p)
ok('E dados do aparelho intactos depois de restaurar cópia antiga', eE.st === eE0.st && JSON.stringify(eE.baralhos) === JSON.stringify(eE0.baralhos), `${eE0.st} → ${eE.st}`)
await E.fechar()
console.log('\n' + R.filter((l) => l.startsWith('FALHOU')).length + ' falhas de ' + R.length)
