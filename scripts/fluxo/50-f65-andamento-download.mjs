// F6.5: andamento em Mais e no selo do espaço DURANTE um download grande no B (muitos pacotes); amostra o texto a cada 120 ms logo depois do login do B
import { irPara } from '../_ctx.mjs'
import { foto } from './_base.mjs'
import { aparelho, entrar, fim, lancar, ok, out, emailUnico, linhasEspacos } from './_dois.mjs'
import { guardarMaterial, novoEspaco } from './_espacos.mjs'
const b = await lancar(); const e = emailUnico('dl')
const A = await aparelho(b, e); await entrar(A.p)
await novoEspaco(A.p, 'Enorme')
const grande = (k) => '# Mat ' + k + '\n\n' + Array.from({ length: 1700 }, (_, i) => `Item${k}-${i}: definição do item ${i} do material ${k}, texto de enchimento para ocupar espaço e criar vários pacotes na nuvem: ${'abc def ghi jkl mno '.repeat(6)}fim.`).join('\n\n')
const N = 8
for (let k = 1; k <= N; k++) await guardarMaterial(A.p, `Enorme${k}.md`, grande(k))
await A.p.waitForTimeout(8000); out('A pronto:', (await (async () => { await irPara(A.p, 'Mais'); return (await A.p.locator('.conta').innerText()).split('\n').filter((l) => /pacote/.test(l)).join(' ') })()))
const B = await aparelho(b, e)
await irPara(B.p, 'Mais'); await B.p.waitForSelector('.conta')
await B.p.getByRole('button', { name: 'Entrar com Google' }).click()
const mais = new Set(), selos = new Set(); const ini = Date.now(); let fotoTirada = false
while (Date.now() - ini < 90000) {
  const l = (await B.p.locator('.conta').innerText().catch(() => '')).split('\n').filter((x) => /pacote|Baixando|Enviando|erro|Espaços e materiais/i.test(x)).join(' / ')
  if (l) { mais.add(l); if (/Baixando/.test(l) && !fotoTirada) { await foto(B.p, 'f65-mais-baixando'); fotoTirada = true } }
  if (/pacotes? na sua conta/.test(l) && !/Baixando/.test(l) && Date.now() - ini > 4000 && mais.size > 0 && [...mais].some((t) => /na sua conta/.test(t))) break
  await B.p.waitForTimeout(120)
}
out('textos em Mais (B), em ordem de aparição:'); for (const t of mais) out('  -', t)
ok('Mais mostrou "Baixando espaços e materiais: N de M pacotes" durante o download', [...mais].some((t) => /Baixando espaços e materiais: \d+ de \d+ pacotes/.test(t)), [...mais].join(' || ').slice(0, 300))
ok('Mais termina em "N pacotes na sua conta"', [...mais].some((t) => /\d+ pacotes na sua conta/.test(t)))
out('conta do B no fim:', (await B.p.locator('.conta').innerText()).split(String.fromCharCode(10)).join(' / ')); await foto(B.p, 'f65-b-fim')
const sel = (await linhasEspacos(B.p)).find((t) => /Enorme/.test(t)); out('selo final do espaço no B:', sel)
ok('selo final "Na conta · N pacotes"', /Na conta · \d+ pacotes/.test(sel ?? ''))
ok('sem erros de script', A.erros.length + B.erros.length === 0, [...A.erros, ...B.erros].join(' | ').slice(0, 300))
fim(); await b.close()
