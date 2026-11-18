// Assistente por escrito: pedidos, lixo, vazio, comandos (desfazer, limpar), reabrir o app e a conversa persistir
import { abrirApp, irPara, onde, voltar, texto, foto, esperarMovimento } from './_base.mjs'
const out = (...a) => console.log(...a)
const { p, ctx, erros, fechar } = await abrirApp({})
await irPara(p, 'Assistente'); await p.waitForTimeout(5200)
const falas = async () => (await p.locator('.as-msg, .as-fala, [class*=balao], [class*=bubble]').allInnerTexts().catch(() => []))
const enviar = async (t, espera = 3500) => { await p.fill('#as-msg', t); await p.keyboard.press('Enter'); await p.waitForTimeout(300); if ((await p.inputValue('#as-msg', { timeout: 500 }).catch(() => '')) === t) await p.locator('.as-composer button').click().catch(() => {}); await p.waitForTimeout(espera) }
const ultimo = async (n = 380) => { const t = (await texto(p)).replace(/\n/g, ' | '); return t.slice(-n) }
await enviar('asdfgh qwerty'); out('lixo →', await ultimo(300))
await enviar('   ', 800); out('só espaços →', 'ok sem erro')
await enviar('quanto é juros compostos?'); out('pergunta sem material →', await ultimo(700).then((x) => x.slice(0, 330)))
await enviar('simulado de matemática com 10 questões', 4000); out('simulado por escrito →', await onde(p), await p.locator('.cnt').innerText().catch(() => ''))
if (await p.locator('.sheet').count()) { await voltar(p); out('voltar do simulado parcial →', await onde(p), '| dialogo', await p.locator('.dialogo').count()); if (await p.locator('.dialogo').count()) { await p.getByRole('button', { name: 'Encerrar', exact: true }).click(); await p.waitForTimeout(600) } }
await irPara(p, 'Assistente'); await p.waitForTimeout(1500)
out('de volta ao assistente:', await ultimo(300))
await enviar('desfazer'); out('desfazer →', await ultimo(260))
await enviar('limpar conversa'); out('limpar →', await ultimo(300)); await foto(p, 'chat-limpar')
const bts = await p.getByRole('button').allInnerTexts(); out('botões no fim:', bts.slice(-6))
// reabrir app: conversa volta?
await p.reload(); await p.waitForSelector('h1'); await esperarMovimento(p); await irPara(p, 'Assistente'); await p.waitForTimeout(3000)
out('após recarregar (conversa):', (await texto(p)).replace(/\n/g, ' | ').slice(0, 400))
out('erros', erros)
await fechar()
