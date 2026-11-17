import { useEffect } from 'react'
import { HORARIOS_RAPIDOS, PASSO_MINUTOS, horaTexto } from '../core/lembrete'
import { useLembrete } from '../store/lembrete'

/** O lembrete diário (em "Mais"): liga/desliga, escolhe a hora e manda um aviso de teste. Só funciona no app do Android: o navegador não avisa com o app fechado. */
export function Lembrete() {
  const { config, disponivel, permissao, proximo, nota, ocupado } = useLembrete()
  const { carregar, ligar, desligar, definirHora, somarMinutos, testar } = useLembrete.getState()
  useEffect(() => { void carregar() }, [carregar])
  if (!disponivel) {
    return (
      <div className="card lembrete"><h3>Lembrete diário</h3>
        <p className="note">Disponível só no aplicativo do Android: o navegador não consegue avisar com o app fechado.</p>
      </div>
    )
  }
  const hora = horaTexto(config)
  return (
    <div className="card lembrete"><h3>Lembrete diário</h3>
      <p className="note">Um aviso por dia, na hora que você escolher, com o que está esperando (cartões e erros). Se você já estudou no dia, ele não toca.</p>
      <div className="field">
        <button type="button" className="fcswitch" role="switch" aria-checked={config.ativo} disabled={ocupado} onClick={() => void (config.ativo ? desligar() : ligar())}>
          <span className="fctrilho" aria-hidden="true"><i /></span>
          <span className="fcswitch-tx">Lembrar de estudar<small>{!config.ativo ? 'Desligado' : permissao !== 'granted' ? 'Bloqueado pelo Android' : proximo ? `Próximo aviso: ${proximo}` : 'Sem aviso nos próximos dias'}</small></span>
        </button>
      </div>
      {config.ativo && (
        <div className="field"><span className="lb">Horário</span>
          <div className="lemb-hora" role="group" aria-label="Horário do lembrete">
            <button type="button" className="btn" aria-label={`${PASSO_MINUTOS} minutos mais cedo`} onClick={() => void somarMinutos(-PASSO_MINUTOS)}>−</button>
            <output className="lemb-rel num" aria-label={`Horário: ${hora}`}>{hora}</output>
            <button type="button" className="btn" aria-label={`${PASSO_MINUTOS} minutos mais tarde`} onClick={() => void somarMinutos(PASSO_MINUTOS)}>+</button>
          </div>
          <div className="chips lemb-rapidos" role="group" aria-label="Horários comuns">
            {HORARIOS_RAPIDOS.map((h) => (
              <button type="button" key={h.rotulo} className="chip" aria-pressed={config.hora === h.hora && config.minuto === h.minuto} onClick={() => void definirHora(h.hora, h.minuto)}>{h.rotulo}<small>{horaTexto(h)}</small></button>
            ))}
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 14 }}><button type="button" className="btn" disabled={ocupado} onClick={() => void testar()}>Enviar um teste</button></div>
      {nota && <p className="note" role="status">{nota}</p>}
      <p className="note">O aviso chega na hora marcada, com variação de poucos minutos. Se o celular tem economia de bateria própria do fabricante (Samsung, Xiaomi…), deixe o Logos sem restrição de bateria; o app não consegue ver isso. Se você parar de abrir o app por 14 dias, os avisos acabam.</p>
    </div>
  )
}
