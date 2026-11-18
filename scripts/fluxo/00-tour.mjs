// Tour pelas abas em 390x844 escuro e claro: texto de cada tela + capturas
import { abrirApp, irPara, foto, texto, onde } from './_base.mjs'
for (const tema of ['dark', 'light']) {
  const { p, erros, fechar } = await abrirApp({ tema })
  for (const aba of ['Início', 'Treinar', 'Cards', 'Assistente', 'Desempenho', 'Mais']) {
    await irPara(p, aba); await p.waitForTimeout(500)
    console.log(`\n=== ${tema} / ${aba} (${await onde(p)}) ===`)
    if (tema === 'dark') console.log((await texto(p)).slice(0, 700))
    await foto(p, `tour-${tema}-${aba.toLowerCase().replace('í', 'i')}`)
  }
  console.log('erros', erros)
  await fechar()
}
