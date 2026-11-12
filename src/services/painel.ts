// Largura do painel da questão (tela larga): vira a variável CSS --painel-w e fica guardada neste aparelho (localStorage).
import { larguraGuardada, limitarLargura } from '../core/painel'

const CHAVE = 'treino_painel_w'

/** Aplica a largura (já presa aos limites) e devolve o valor usado. Não guarda: guardar é só quando o arrasto termina. */
export function aplicarLargura(px: number): number {
  const v = limitarLargura(px, window.innerWidth)
  document.documentElement.style.setProperty('--painel-w', `${v}px`)
  return v
}

export function guardarLargura(px: number) { try { localStorage.setItem(CHAVE, String(limitarLargura(px, window.innerWidth))) } catch { /* sem armazenamento: vale só nesta sessão */ } }

/** Volta ao tamanho padrão (o do CSS) e esquece o valor guardado. */
export function restaurarLargura() {
  document.documentElement.style.removeProperty('--painel-w')
  try { localStorage.removeItem(CHAVE) } catch { /* sem armazenamento */ }
}

/** Na abertura do app: reaplica a largura que a pessoa deixou. */
export function ligarPainel() {
  let g: number | null = null
  try { g = larguraGuardada(localStorage.getItem(CHAVE)) } catch { /* sem armazenamento */ }
  if (g != null) document.documentElement.style.setProperty('--painel-w', `${g}px`) // o CSS prende ao que cabe na janela
}
