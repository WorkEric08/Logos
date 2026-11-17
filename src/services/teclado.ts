// O teclado digital só COBRE a tela (README, "Teclado"): a janela não encolhe e nada se mexe. Mas o que ficou atrás dele precisa poder
// ser alcançado rolando. Por isso a altura do teclado vira a variável CSS `--teclado`, que só aumenta o espaço de rolagem no fim da
// página (espaçador no fim do .scroll-y): nada muda de lugar ao abrir; a pessoa rola e o campo de baixo sobe acima do teclado.
// ÚNICA exceção (2026-11-16): a caixa de mensagem do chat do assistente fica presa no pé e sobe com o teclado (`aoMudarTeclado` serve à "câmera" dela).
//  - APK: quem mede é o MainActivity.java (insets do Android) e injeta `--teclado`.
//  - Navegador/PWA no Android: VirtualKeyboard API (`geometrychange`), com `overlaysContent`.
import { ehNativo } from './native'

interface TecladoVirtual extends EventTarget { overlaysContent: boolean; boundingRect: { height: number } }

/** A altura do teclado agora, em px (a variável --teclado: o Android a injeta no APK, a VirtualKeyboard API no navegador). */
export const alturaDoTeclado = (): number => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--teclado')) || 0

/**
 * Avisa quando a altura do teclado muda (nos dois jeitos de ela chegar: ambos escrevem a variável no estilo da raiz). `antes` é a altura
 * anterior. Só a caixa de mensagem do assistente usa isto, para a "câmera" do chat; o resto do app continua sem reagir ao teclado.
 */
export function aoMudarTeclado(cb: (kb: number, antes: number) => void): () => void {
  let antes = alturaDoTeclado()
  const mo = new MutationObserver(() => {
    const kb = alturaDoTeclado()
    if (kb === antes) return
    const a = antes
    antes = kb
    cb(kb, a)
  })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
  return () => mo.disconnect()
}

export function ligarTeclado(): () => void {
  const vk = (navigator as Navigator & { virtualKeyboard?: TecladoVirtual }).virtualKeyboard
  if (ehNativo() || !vk) return () => {}
  const raiz = document.documentElement
  vk.overlaysContent = true
  const aplicar = () => raiz.style.setProperty('--teclado', `${Math.round(vk.boundingRect.height)}px`)
  vk.addEventListener('geometrychange', aplicar)
  return () => { vk.removeEventListener('geometrychange', aplicar); raiz.style.removeProperty('--teclado') }
}
