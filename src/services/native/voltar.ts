import { App } from '@capacitor/app'
import { attachBackHooks, detachBackHooks, handleBack } from '../backStack'

/** Botão voltar do Android: fecha a camada de cima → vai ao início → no início avisa e só sai no 2º toque (2,5 s). Mesma regra do navegador. */
export function bindNativeBack(h: { goHome: () => boolean; askExit: () => void }) {
  attachBackHooks(h)
  const sub = App.addListener('backButton', () => { if (handleBack(Date.now()) === 'exit') void App.exitApp() })
  return () => { void sub.then((s) => s.remove()); detachBackHooks() }
}
