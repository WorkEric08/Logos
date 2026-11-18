// A "câmera" das telas (2026-11-17): quando um elemento se abre ou cresce por um toque (confirmar exclusão, anotação, aviso que aparece embaixo), a tela rola o
// mínimo para ele aparecer INTEIRO, em vez de ficar como estava com o conteúdo cortado. As contas estão em core/rolagem.ts (`quantoRevelar`).
// Regras: só roda depois de um toque (nunca ao abrir a tela nem ao abrir o teclado: a REGRA DO TECLADO continua valendo); não vale para campos de texto que
// recebem foco ao abrir (o teclado vai cobrir o que for, e a regra diz que nada rola sozinho nessa hora); respeita "reduzir movimento".
import { quantoRevelar } from '../core/rolagem'
import { alturaDoTeclado } from '../services/teclado'

/** O ancestral que rola (o `.scroll-y` de cada tela, ou qualquer outro com rolagem própria). */
const quemRola = (el: HTMLElement): HTMLElement | null => {
  for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p }
  return null
}

/** Até onde a tela é visível: a base da área rolável, menos o teclado e menos os botões fixos do pé (`.foot.sticky`, `.side.go`) que cobrem o fim do conteúdo. */
const baseVisivelDe = (area: HTMLElement): number => {
  let base = area.getBoundingClientRect().bottom - alturaDoTeclado()
  for (const f of area.querySelectorAll<HTMLElement>('.foot.sticky, .side.go')) {
    const r = f.getBoundingClientRect()
    if (r.height > 0 && r.top < base && r.bottom > area.getBoundingClientRect().top) base = Math.min(base, r.top)
  }
  return base
}

/** Rola agora, o mínimo, para `el` caber à vista. Devolve quanto rolou (0 se já cabia ou se nada rola). */
export function revelarAgora(el: HTMLElement | null | undefined): number {
  if (!el || !el.isConnected) return 0
  const area = quemRola(el)
  if (!area) return 0
  const r = el.getBoundingClientRect()
  if (r.height === 0) return 0
  const dy = quantoRevelar({ topo: r.top, base: r.bottom, topoVisivel: area.getBoundingClientRect().top, baseVisivel: baseVisivelDe(area) })
  if (!dy) return 0
  const suave = !matchMedia('(prefers-reduced-motion: reduce)').matches
  area.scrollBy({ top: dy, behavior: suave ? 'smooth' : 'auto' })
  return dy
}

/** Espera a entrada animada do elemento terminar (a altura final só vale depois) e então mostra tudo. */
export function revelar(el: HTMLElement | null | undefined): void {
  if (!el) return
  const animacoes = el.getAnimations?.({ subtree: true }) ?? []
  const fim = Promise.race([Promise.allSettled(animacoes.map((a) => a.finished)), new Promise((ok) => setTimeout(ok, 450))])
  void fim.then(() => requestAnimationFrame(() => revelarAgora(el)))
}

/**
 * Ref para elementos que SÓ aparecem depois de um toque (a pergunta "Sim, excluir", um aviso embaixo de um botão): ao entrar na tela, ela rola o mínimo para
 * mostrá-los inteiros. É uma função estável (o React só a chama ao entrar e ao sair), então não repete a cada atualização. NÃO use em algo que já existe quando a
 * tela abre (aí a tela rolaria sozinha ao abrir): para isso, `revelar` direto depois do toque.
 * Ex.: `<div ref={aoAparecer}>…</div>`; para um aviso que muda de texto, `key={texto}` faz cada texto novo ser mostrado.
 */
export const aoAparecer = (el: HTMLElement | null): void => { if (el) revelar(el) }

/** Para `<details>`: ao tocar no título, mostra o bloco inteiro quando ele abriu (se ele fechou, não faz nada). Use em `<summary onClick={aoTocarNoResumo}>`. */
export const aoTocarNoResumo = (e: { currentTarget: HTMLElement }): void => {
  const d = e.currentTarget.parentElement
  if (!(d instanceof HTMLDetailsElement)) return
  requestAnimationFrame(() => { if (d.open) revelar(d) })
}
