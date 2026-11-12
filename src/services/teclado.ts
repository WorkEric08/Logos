// O teclado digital só COBRE a tela (README, "Teclado"): a janela não encolhe e nada se mexe. Mas o que ficou atrás dele precisa poder
// ser alcançado rolando. Por isso a altura do teclado vira a variável CSS `--teclado`, que só aumenta o espaço de rolagem no fim da
// página (padding-bottom do .scroll-y): nada muda de lugar ao abrir; a pessoa rola e o campo de baixo sobe acima do teclado.
//  - APK: quem mede é o MainActivity.java (insets do Android) e injeta `--teclado`.
//  - Navegador/PWA no Android: VirtualKeyboard API (`geometrychange`), com `overlaysContent`.
import { ehNativo } from './native'

interface TecladoVirtual extends EventTarget { overlaysContent: boolean; boundingRect: { height: number } }

export function ligarTeclado(): () => void {
  const vk = (navigator as Navigator & { virtualKeyboard?: TecladoVirtual }).virtualKeyboard
  if (ehNativo() || !vk) return () => {}
  const raiz = document.documentElement
  vk.overlaysContent = true
  const aplicar = () => raiz.style.setProperty('--teclado', `${Math.round(vk.boundingRect.height)}px`)
  vk.addEventListener('geometrychange', aplicar)
  return () => { vk.removeEventListener('geometrychange', aplicar); raiz.style.removeProperty('--teclado') }
}
