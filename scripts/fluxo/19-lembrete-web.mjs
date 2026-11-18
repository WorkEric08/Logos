// Lembrete diário no navegador (sem notificações nativas): o assistente diz JÁ na 1ª resposta que só funciona no app Android (F-14), sem perguntar horário.
import { abrirApp, irPara, texto } from './_base.mjs'
const out = []; const ok = (n, c, x = '') => out.push(`${c ? 'OK     ' : 'FALHOU '} ${n}${x ? ' — ' + x : ''}`)
const { p, erros, fechar } = await abrirApp({})
p.setDefaultTimeout(10000)
await irPara(p, 'Assistente'); await p.waitForTimeout(5200)
await p.getByRole('button', { name: 'Lembrete diário', exact: true }).click(); await p.waitForTimeout(2500)
const t = await texto(p)
ok('1ª resposta explica que só funciona no Android', /só funciona no aplicativo do Android/.test(t))
ok('não pergunta horário (sem opções de período)', (await p.getByRole('button', { name: /Manhã|Tarde|Noite|Madrugada/ }).count()) === 0 && !/Em que horário/.test(t))
await irPara(p, 'Mais'); ok('Mais menciona Lembrete', /Lembrete/.test(await texto(p)))
ok('sem erros de script', erros.length === 0, erros.join('|'))
console.log(out.join('\n')); await fechar()
