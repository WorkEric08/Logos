import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../store/app'
import { useBackLayer } from './useBackLayer'

/** “Tem certeza?” ao sair do simulado em andamento (pelo Sair, pelo voltar do celular ou por outra aba da barra).
 *  Não é o confirm() do navegador: é uma camada do app, com foco, Esc e voltar (que fecha só o aviso e continua o simulado). */
export function ConfirmarSaida() {
  const { confirmarSaida, cancelarSaida } = useApp.getState()
  const continuar = useRef<HTMLButtonElement>(null)
  useBackLayer(true, cancelarSaida)
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    continuar.current?.focus() // o botão seguro recebe o foco: um toque no Enter/espaço sem querer não apaga o simulado
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); useApp.getState().cancelarSaida() } }
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('keydown', esc); antes?.focus?.() }
  }, [])
  return createPortal(
    <div className="dialogo-veu" onClick={(e) => { if (e.target === e.currentTarget) cancelarSaida() }}>
      <div className="dialogo card" role="dialog" aria-modal="true" aria-labelledby="ds-t" aria-describedby="ds-d">
        <h2 id="ds-t">Encerrar o simulado?</h2>
        <p id="ds-d">Você tem certeza de que deseja encerrar esta sessão de simulado? As respostas dadas até aqui serão perdidas e o simulado não será entregue nem entrará no seu desempenho.</p>
        <div className="row">
          <button ref={continuar} className="btn pri" onClick={cancelarSaida}>Continuar o simulado</button>
          <button className="btn warn" onClick={confirmarSaida}>Encerrar</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
