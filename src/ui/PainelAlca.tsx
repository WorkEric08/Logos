import { useContext, useEffect, useState } from 'react'
import { PAINEL_MIN, painelMax } from '../core/painel'
import { aplicarLargura, guardarLargura, restaurarLargura } from '../services/painel'
import { SlotCtx } from './bits'

const PASSO = 24

/**
 * Alça na borda esquerda do painel da direita da tela da questão (só em tela larga; o CSS a esconde quando não há esse painel).
 * Arrastar para a ESQUERDA alarga o painel: a questão e as alternativas ganham o espaço que sobra e a página da prova cresce junto.
 * Teclado: setas ←/→ alargam/estreitam, Home/End vão ao mínimo/máximo. Duplo clique volta ao tamanho padrão.
 */
export function PainelAlca() {
  const slot = useContext(SlotCtx)
  const [largura, setLargura] = useState(0)
  const [arrastando, setArrastando] = useState(false)
  useEffect(() => { // acompanha a largura de verdade do painel (também quando a janela muda e o CSS a prende)
    if (!slot) return
    const ro = new ResizeObserver(() => setLargura(Math.round(slot.getBoundingClientRect().width)))
    ro.observe(slot)
    return () => ro.disconnect()
  }, [slot])
  const atual = () => slot?.getBoundingClientRect().width ?? 0
  const pegar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!slot || e.button !== 0) return
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setArrastando(true)
    document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize'
  }
  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando || !slot) return
    aplicarLargura(slot.getBoundingClientRect().right - e.clientX) // o painel termina na borda direita da janela: largura = borda − dedo
  }
  const soltar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando) return
    setArrastando(false); document.body.style.userSelect = ''; document.body.style.cursor = ''
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    guardarLargura(atual())
  }
  const tecla = (e: React.KeyboardEvent) => {
    const w = atual(), max = painelMax(window.innerWidth)
    const novo = e.key === 'ArrowLeft' ? w + PASSO : e.key === 'ArrowRight' ? w - PASSO : e.key === 'Home' ? PAINEL_MIN : e.key === 'End' ? max : null
    if (novo == null) return
    e.preventDefault(); guardarLargura(aplicarLargura(novo))
  }
  return (
    <div className="painel-alca">
      <div
        className="painel-pega" role="separator" aria-orientation="vertical" tabIndex={0} data-arrastando={arrastando ? '1' : undefined}
        aria-label="Largura do painel da questão. Setas para a esquerda e para a direita alargam e estreitam; duplo clique volta ao padrão."
        aria-valuemin={PAINEL_MIN} aria-valuemax={Math.max(PAINEL_MIN, painelMax(typeof window === 'undefined' ? 1440 : window.innerWidth))} aria-valuenow={largura || undefined}
        onPointerDown={pegar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} onKeyDown={tecla} onDoubleClick={restaurarLargura}
      />
    </div>
  )
}
