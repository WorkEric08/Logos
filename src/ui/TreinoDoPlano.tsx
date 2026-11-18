import { useEffect, useState } from 'react'
import { rotuloTempo } from '../core/dia'
import { useAssistente } from '../store/assistente'

/**
 * O treino do plano de estudo, guardado na aba Treinar (2026-11-17): quem montou um plano no assistente e saiu no meio das questões o encontra aqui, para continuar só com as que
 * faltam. Fica salvo pelo tempo que a pessoa disse ter; passou disso sem ela voltar, é descartado. Se ela entra nele, leva o tempo que precisar. Some sozinho quando não há mais questão.
 */
export function TreinoDoPlano() {
  useAssistente((s) => s.eventos); useAssistente((s) => s.planoAtivo); useAssistente((s) => s.sessaoDoPlano)
  const [, atualizar] = useState(0)
  const { treinoDoPlano, continuarTreinoDoPlano, descartarPlano, atualizarCaderno } = useAssistente.getState()
  useEffect(() => { void atualizarCaderno() }, [atualizarCaderno]) // lê as respostas mais recentes: o "faltam N" vem do registro
  const t = treinoDoPlano()
  const validoAte = useAssistente((s) => s.planoAtivo?.validoAte)
  // quando o prazo acaba com a tela aberta, o cartão some na hora (e não só na próxima vez que a tela for desenhada)
  useEffect(() => {
    if (!validoAte) return
    const espera = validoAte - Date.now()
    if (espera <= 0 || espera > 2 ** 31 - 1) return
    const h = setTimeout(() => atualizar((n) => n + 1), espera + 50)
    return () => clearTimeout(h)
  }, [validoAte])
  if (!t) return null
  const minutos = Math.max(1, Math.ceil(t.restanteMs / 60_000))
  return (
    <div className="card treino-plano" role="group" aria-label="Treino do seu plano de estudo">
      <h3>Treino do seu plano</h3>
      <p className="note">Faltam <b>{t.faltam}</b> de {t.total} questões do plano de {rotuloTempo(t.minutos)}. Ele fica salvo aqui por mais <b>{rotuloTempo(minutos)}</b>; se você entrar nele, pode levar o tempo que precisar.</p>
      <div className="row">
        <button type="button" className="btn pri" onClick={continuarTreinoDoPlano}>Continuar o treino ({t.faltam})</button>
        <button type="button" className="btn" onClick={descartarPlano}>Descartar</button>
      </div>
    </div>
  )
}
