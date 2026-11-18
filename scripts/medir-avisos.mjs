// Todo aviso rápido (o retângulo escuro de baixo) cabe numa LINHA SÓ (a única exceção é o recado de descanso do plano, até 4 linhas), inclusive a 320 px e com o botão "Desfazer". Mede cada mensagem
// do app (src/core/avisos.ts, no pior caso de números) dentro do aviso de verdade (mesmo CSS), em 320/360/390/412 e no computador.
// Precisa do app em http://localhost:4173/. Uso: node scripts/medir-avisos.mjs [url]. Sai com 1 se alguma quebrar linha ou passar da tela.
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { novoContexto } from './_ctx.mjs'

const { todosOsAvisos } = await import(pathToFileURL(join(process.cwd(), 'src/core/avisos.ts')).href)
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')
const base = process.argv[2] ?? 'http://localhost:4173/'
const b = await chromium.launch({ channel: 'chrome' })
const falhas = []
let n = 0
for (const [w, h] of [[320, 568], [360, 640], [390, 844], [412, 892], [1440, 900]]) for (const tema of ['dark', 'light']) {
  const ctx = await novoContexto(b, { viewport: { width: w, height: h }, colorScheme: tema, hasTouch: w < 900, isMobile: w < 900 })
  const p = await ctx.newPage()
  await p.goto(base); await p.waitForSelector('.folders')
  const r = await p.evaluate((lista) => {
    const out = []
    const um = (texto, acao, longo) => {
      const el = document.createElement('div'); el.className = longo ? 'toast longo' : 'toast'; el.setAttribute('role', 'status'); el.style.animation = 'none'
      el.innerHTML = `<span></span>${acao ? `<button>${acao}</button>` : ''}`; el.querySelector('span').textContent = texto
      document.body.appendChild(el)
      const sp = el.querySelector('span'), linha = parseFloat(getComputedStyle(sp).lineHeight) || parseFloat(getComputedStyle(sp).fontSize) * 1.4
      const rs = sp.getBoundingClientRect(), re = el.getBoundingClientRect()
      out.push({ texto, longo: !!longo, linhas: Math.round(rs.height / linha), dentro: re.left >= 0 && re.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1 && [...el.children].every((c) => c.getBoundingClientRect().right <= re.right + 0.5), largura: Math.round(re.width), tela: innerWidth })
      el.remove()
    }
    for (const a of lista) um(a.texto, a.acao, a.longo)
    return out
  }, todosOsAvisos())
  for (const x of r) { n++; if (x.linhas > (x.longo ? 4 : 1) || !x.dentro) falhas.push(`${w}×${h} ${tema}: “${x.texto}” ${x.linhas} linhas, ${x.largura}px de ${x.tela}`) }
  await ctx.close()
}
await b.close()
console.log(falhas.length ? falhas.map((f) => 'FALHOU ' + f).join('\n') : `OK: ${n} medidas (mensagem × tamanho × tema), todas numa linha só e dentro da tela`)
process.exit(falhas.length ? 1 : 0)
