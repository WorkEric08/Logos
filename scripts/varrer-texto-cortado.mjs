// Acha texto cortado na tela: reticências (text-overflow: ellipsis), texto cortado na ALTURA (line-clamp, altura fixa) e
// texto que ESTOURA a própria caixa na largura. Regra do padrão: texto do usuário nunca é cortado.
//
// Como função, num teste Playwright:
//   import { textoCortado } from './varrer-texto-cortado.mjs'
//   expect(await textoCortado(pagina)).toEqual([])
// Como comando (da raiz do projeto, com o app servido e COM dados nos limites já restaurados no armazenamento,
// ou simplesmente para ver as telas iniciais):
//   node varrer-texto-cortado.mjs <url> [larguras=320,360,390] [seletorRaiz=main] [chave=valor]
//   node varrer-texto-cortado.mjs http://localhost:4318 320,360 main meuapp_skip_splash=1
// Rode a 320 px, em claro e escuro, com o NOME no tamanho máximo, o VALOR máximo e uma "palavra" de 45 letras sem espaço.
// Se acusar, conserte o CSS (quebrar linha, fonte que encolhe); não silencie a varredura. Ela não vê um número que entrou na
// borda de outro: complemente com uma captura e OLHE.
import { pathToFileURL } from 'node:url'
import { carregarPlaywright } from './_playwright.mjs'

/** Devolve uma lista de strings "tipo: início do texto" (vazia = nada cortado). */
export function textoCortado(pagina, raiz = 'main') {
  return pagina.evaluate((raiz) => {
    const ruins = []
    const base = document.querySelector(raiz) ?? document.body
    for (const el of base.querySelectorAll('p, span, h1, h2, h3, h4, a, button, label, li')) {
      // Sem caixa (display: none) ou só para leitor de tela: ignora.
      if (!el.getClientRects().length || el.closest('.sr-only')) continue
      const estilo = getComputedStyle(el)
      const texto = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
      if (!texto) continue
      if (estilo.textOverflow === 'ellipsis') ruins.push(`reticências: ${texto}`)
      // Elemento "inline" não tem altura/largura própria: o que importa é o bloco que o contém.
      if (estilo.display === 'inline') continue
      if (el.scrollHeight > el.clientHeight + 1) ruins.push(`cortado na altura: ${texto}`)
      if (el.scrollWidth > el.clientWidth + 1) ruins.push(`estoura a largura: ${texto}`)
    }
    // A página inteira também não pode rolar de lado.
    if (document.documentElement.scrollWidth > window.innerWidth) ruins.push('rolagem lateral na página')
    return [...new Set(ruins)]
  }, raiz)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [url, largurasTexto = '320,360,390', raiz = 'main', chave] = process.argv.slice(2)
  if (!url) {
    console.error('Uso: node varrer-texto-cortado.mjs <url> [larguras] [seletorRaiz] [chave=valor]')
    process.exit(1)
  }
  const { chromium } = carregarPlaywright()
  const navegador = await chromium.launch({ channel: 'chrome' })
  let sujo = false
  for (const largura of largurasTexto.split(',').map(Number)) {
    const contexto = await navegador.newContext({
      viewport: { width: largura, height: 740 },
      hasTouch: true,
      isMobile: largura < 768,
      serviceWorkers: 'block',
    })
    if (chave) {
      const [k, v] = chave.split('=')
      await contexto.addInitScript(([a, b]) => localStorage.setItem(a, b), [k, v])
    }
    const pagina = await contexto.newPage()
    await pagina.goto(url)
    await pagina.waitForTimeout(1500)
    const ruins = await textoCortado(pagina, raiz)
    console.log(`${largura} px: ${ruins.length === 0 ? 'nada cortado' : ruins.length + ' problema(s)'}`)
    for (const r of ruins) console.log('  -', r)
    if (ruins.length) sujo = true
    await contexto.close()
  }
  await navegador.close()
  process.exit(sujo ? 2 : 0)
}
