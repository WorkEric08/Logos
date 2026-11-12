// Contexto de navegador para os testes: cria o contexto e liga a única chave de teste do app (localStorage.treino_skip_splash = '1'),
// que pula a abertura animada de 2 s. Só scripts/e2e-splash.mjs testa a abertura de verdade, sem esta chave.
export async function novoContexto(navegador, opcoes = {}) {
  const c = await navegador.newContext(opcoes)
  await c.addInitScript(() => { try { localStorage.setItem('treino_skip_splash', '1') } catch { /* sem armazenamento */ } })
  return c
}

/**
 * Vai para uma aba pela barra de navegação. No celular a barra começa recolhida (sobreposta ao conteúdo): abre pela aba, toca no
 * destino e ela volta sozinha ao repouso. No computador o trilho já está à vista.
 */
export async function irPara(pagina, rotulo) {
  const item = pagina.locator('.nav .rail-item', { hasText: rotulo }).first()
  if (!(await item.isVisible())) await pagina.locator('.rail-alca').click()
  await item.click()
}

/**
 * Espera todas as animações do app terminarem (o app anima a entrada das telas e dos grupos: medir no meio dá posição, opacidade, altura ou
 * largura intermediárias). Termina também se algo não parar em 5 s; o e2e-movimento.mjs é quem confere que nada fica animando.
 */
export async function esperarMovimento(pagina) {
  await pagina.waitForFunction(() => document.getAnimations().length === 0, null, { timeout: 5000 }).catch(() => {})
}
