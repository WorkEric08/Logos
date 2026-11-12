// Pilha de camadas do botão voltar: voltar fecha só a de cima.
type Layer = { close: () => void; leve: boolean }
const stack: Layer[] = []

/** `leve`: níveis de navegação dentro de uma tela (ex.: Banco › Cargo › Provas). O voltar a fecha como qualquer camada, mas ela não cobre nada. */
export function openLayer(close: () => void, leve = false): () => void {
  const layer = { close, leve }
  stack.push(layer)
  syncSentinel()
  return () => {
    const i = stack.indexOf(layer)
    if (i >= 0) stack.splice(i, 1)
  }
}
export function closeTopLayer(): boolean {
  const top = stack.pop()
  if (!top) return false
  top.close()
  return true
}
/** Camadas que COBREM a tela (as leves não contam). */
export const layerCount = () => stack.filter((l) => !l.leve).length

// ---- navegador / PWA: uma única entrada "sentinela" no histórico ----
export const EXIT_WINDOW_MS = 2500
let sentinelOn = false
let hooks: { goHome: () => boolean; askExit: () => void } | null = null
let lastBack = -Infinity
let nativo = false // no APK o botão voltar chega por evento do Capacitor: sem entrada "sentinela" no histórico

function syncSentinel() {
  if (!hooks || sentinelOn || nativo) return
  history.pushState({ treino: 1 }, '')
  sentinelOn = true
}

/** Decide o que o "voltar" faz. Função pura-ish para teste: devolve a ação tomada. */
export function handleBack(now: number): 'layer' | 'home' | 'warn' | 'exit' {
  if (closeTopLayer()) return 'layer'
  if (hooks?.goHome()) return 'home'
  if (now - lastBack <= EXIT_WINDOW_MS) { lastBack = -Infinity; return 'exit' }
  lastBack = now
  hooks?.askExit()
  return 'warn'
}

/** Liga/desliga a decisão do "voltar" sem mexer no histórico (usado pelo botão voltar do Android, services/native/voltar.ts). */
export function attachBackHooks(h: { goHome: () => boolean; askExit: () => void }) { hooks = h; nativo = true }
export function detachBackHooks() { hooks = null; nativo = false }

export function bindBack(h: { goHome: () => boolean; askExit: () => void }) {
  hooks = h
  syncSentinel()
  const onPop = () => {
    sentinelOn = false
    const act = handleBack(Date.now())
    if (act === 'exit') { history.back(); return }
    syncSentinel()
  }
  window.addEventListener('popstate', onPop)
  return () => { window.removeEventListener('popstate', onPop); hooks = null }
}
export function _resetForTest() { stack.length = 0; hooks = null; sentinelOn = false; lastBack = -Infinity; nativo = false }
