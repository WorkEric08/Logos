// Início > Provas: descer níveis, abrir prova (vai ao Treinar filtrado), voltar, voltar à aba Início (nível lembrado?), duplicidade Provas x Treinar
import { abrirApp, irPara, onde, voltar, texto, foto } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, erros, fechar } = await abrirApp({})
const crumbs = async () => (await p.locator('.crumbs').innerText().catch(() => '-')).replace(/\s+/g, ' ').trim()
await p.locator('.provas .folder', { hasText: 'Banco do Brasil' }).click(); await p.waitForTimeout(400); out('nível 2:', await crumbs(), '|', (await texto(p)).replace(/\n/g, ' | ').slice(0, 260))
await p.locator('.provas .folder').first().click(); await p.waitForTimeout(400); out('nível 3:', await crumbs(), '|', (await texto(p, '.provas')).replace(/\n/g, ' | ').slice(0, 260))
await foto(p, 'provas-nivel3')
await p.locator('.provas .file').first().click(); await p.waitForTimeout(600)
out('após tocar numa prova →', await onde(p), '| filtros:', (await p.locator('.chip[aria-pressed=true]').allInnerTexts()).join(' / '))
await voltar(p); out('voltar do Treinar (veio da prova) →', await onde(p), '| crumbs:', await crumbs())
await irPara(p, 'Treinar'); await irPara(p, 'Início'); out('Início de novo (nível lembrado?):', await crumbs())
// toque no ícone Início estando nele
await p.locator('.provas .folder', { hasText: 'Banco do Brasil' }).click(); await p.waitForTimeout(300)
await irPara(p, 'Início'); out('tocar ícone Início já no Início →', await crumbs())
out('erros', erros); await fechar()
