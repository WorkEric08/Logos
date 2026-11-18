import { useEffect, type ReactNode } from 'react'
import { PASSO_MINUTOS, PERIODOS, faixaDoPeriodo, horaTexto } from '../core/lembrete'
import { useLembrete } from '../store/lembrete'
import { BotaoRepete } from './BotaoRepete'
import { aoAparecer } from './revelar'

/** "−" / "+" do horário: um toque anda um passo (15 min); apertar e SEGURAR repete até soltar. Durante o aperto só a tela muda; ao soltar o horário é guardado e a lista de avisos refeita UMA vez. */
function BotaoHora({ delta, rotulo, children }: { delta: number; rotulo: string; children: ReactNode }) {
  const { ajustarHora, confirmarHora, somarMinutos } = useLembrete.getState()
  return <BotaoRepete rotulo={rotulo} aoPasso={() => ajustarHora(delta)} aoSoltar={() => void confirmarHora()} aoTeclado={() => void somarMinutos(delta)}>{children}</BotaoRepete>
}

/** O lembrete diário (em "Mais"): liga/desliga, escolhe a hora, marca os períodos de aviso de cartões e manda um aviso de teste. Só funciona no app do Android: o navegador não avisa com o app fechado. */
export function Lembrete() {
  const { config, disponivel, permissao, proximo, nota, ocupado } = useLembrete()
  const { carregar, ligar, desligar, alternarPeriodo, testar } = useLembrete.getState()
  useEffect(() => { void carregar() }, [carregar])
  if (!disponivel) {
    return (
      <div className="card lembrete"><h3>Lembrete diário</h3>
        <p className="note">Disponível só no aplicativo do Android: o navegador não consegue avisar com o app fechado.</p>
      </div>
    )
  }
  const hora = horaTexto(config)
  const marcados = PERIODOS.filter((p) => config.periodos.includes(p.id))
  return (
    <div className="card lembrete"><h3>Lembrete diário</h3>
      <p className="note">O <b>horário</b> abaixo é o aviso de <b>começo do estudo</b>: um por dia, com o que está esperando (cartões e erros). Se você já estudou no dia, ele não toca.</p>
      <div className="field">
        <button type="button" className="fcswitch" role="switch" aria-checked={config.ativo} disabled={ocupado} onClick={() => void (config.ativo ? desligar() : ligar())}>
          <span className="fctrilho" aria-hidden="true"><i /></span>
          <span className="fcswitch-tx">Lembrar de estudar<small>{!config.ativo ? 'Desligado' : permissao !== 'granted' ? 'Bloqueado pelo Android' : proximo ? `Próximo aviso: ${proximo}` : 'Sem aviso nos próximos dias'}</small></span>
        </button>
      </div>
      {config.ativo && (
        <>
          <div className="field"><span className="lb">Horário de começo do estudo</span>
            <div className="lemb-hora" role="group" aria-label="Horário do lembrete">
              <BotaoHora delta={-PASSO_MINUTOS} rotulo={`${PASSO_MINUTOS} minutos mais cedo`}>−</BotaoHora>
              <output className="lemb-rel num" aria-label={`Horário: ${hora}`}>{hora}</output>
              <BotaoHora delta={PASSO_MINUTOS} rotulo={`${PASSO_MINUTOS} minutos mais tarde`}>+</BotaoHora>
            </div>
            <p className="note">Toque para andar {PASSO_MINUTOS} minutos; segure para andar direto.</p>
          </div>
          <div className="field"><span className="lb">Avisos de cartões para revisar</span>
            <p className="note">Cada período que você marcar avisa uma vez, dentro da faixa dele, se você <b>ainda tiver flashcards para revisar</b> naquele dia. Marque quantos quiser ou nenhum.</p>
            <div className="chips lemb-rapidos" role="group" aria-label="Períodos para avisar de cartões para revisar">
              {PERIODOS.map((p) => (
                <button type="button" key={p.id} className="chip" aria-label={`${p.rotulo}, das ${horaTexto(p.de)} às ${horaTexto(p.ate)}`} aria-pressed={config.periodos.includes(p.id)} onClick={() => void alternarPeriodo(p.id)}>{p.rotulo}<small>{faixaDoPeriodo(p)}</small></button>
              ))}
            </div>
            <p className="note" aria-live="polite" data-resumo-periodos="">{marcados.length ? `Se sobrar cartão para revisar, aviso às ${marcados.map((p) => horaTexto(p)).join(', ')} (dentro ${marcados.length === 1 ? 'do período marcado' : 'dos períodos marcados'}).` : 'Nenhum período marcado: só o aviso de começo do estudo.'}</p>
          </div>
        </>
      )}
      <div className="row" style={{ marginTop: 14 }}><button type="button" className="btn" disabled={ocupado} onClick={() => void testar()}>Enviar um teste</button></div>
      {nota && <p key={nota} ref={aoAparecer} className="note" role="status">{nota}</p>}
      <p className="note">O aviso chega na hora marcada, com variação de poucos minutos. Se o celular tem economia de bateria própria do fabricante (Samsung, Xiaomi…), deixe o Logos sem restrição de bateria; o app não consegue ver isso. Se você parar de abrir o app por 14 dias, os avisos acabam.</p>
    </div>
  )
}
