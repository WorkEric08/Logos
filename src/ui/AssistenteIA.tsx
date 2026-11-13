import { useState } from 'react'
import { MODELOS_IA, gravarChave, gravarModelo, iaLigada, lerChave, lerModelo, mensagemErroIA, testarChave } from '../services/importar/ia'
import { useAssistente } from '../store/assistente'

/** Ajuda de IA opcional: a chave da própria pessoa, guardada só neste aparelho. Desligada por padrão. */
export function IaPainel() {
  const { voltarAoInicio } = useAssistente.getState()
  const [chave, setChave] = useState(lerChave())
  const [modelo, setModelo] = useState(lerModelo())
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null)
  const [testando, setTestando] = useState(false)
  const [, forca] = useState(0)
  const ligada = iaLigada()
  return (
    <div className="card as-painel">
      <p className="note"><b>Como funciona:</b> quando você toca em "Reler com IA" numa questão da prévia, o recorte da página e o texto lido dela são enviados à API da Anthropic usando a <b>sua</b> chave, e a IA devolve uma transcrição para você conferir. Nada é enviado sem esse toque. O uso é cobrado na sua conta da Anthropic (console.anthropic.com), que é separada da assinatura do Claude.</p>
      <label className="lb" htmlFor="as-chave">Chave da API (sk-ant-…)</label>
      <input id="as-chave" className="campo" type="password" value={chave} onChange={(e) => setChave(e.target.value)} autoComplete="off" spellCheck={false} placeholder="sk-ant-api03-…" />
      <p className="note">A chave fica só neste aparelho (nunca vai para a nuvem do Logos nem para o backup). Qualquer pessoa que use este navegador consegue vê-la: use uma chave só para isto e coloque um limite de gasto no console.</p>
      <label className="lb" htmlFor="as-modelo">Modelo</label>
      <select id="as-modelo" className="campo" value={modelo} onChange={(e) => { setModelo(e.target.value); gravarModelo(e.target.value) }}>
        {MODELOS_IA.map((m) => <option key={m.id} value={m.id}>{m.rotulo}</option>)}
      </select>
      {estado && <p className="note" role="status" style={estado.ok ? undefined : { color: 'var(--err)' }}>{estado.texto}</p>}
      <div className="foot sticky">
        <button className="btn" onClick={voltarAoInicio}>Voltar</button>
        {ligada && <button className="btn warn" onClick={() => { gravarChave(''); setChave(''); setEstado({ ok: true, texto: 'Chave removida deste aparelho.' }); forca((n) => n + 1) }}>Remover a chave</button>}
        <button className="btn" disabled={testando || chave.trim().length < 20} onClick={() => {
          setTestando(true); setEstado(null)
          void testarChave(chave.trim(), modelo).then(() => { gravarChave(chave); setEstado({ ok: true, texto: 'Chave válida e salva. "Reler com IA" aparece nas questões com aviso.' }) }).catch((e) => setEstado({ ok: false, texto: mensagemErroIA(e) })).finally(() => { setTestando(false); forca((n) => n + 1) })
        }}>{testando ? 'Testando…' : 'Testar e salvar'}</button>
      </div>
    </div>
  )
}
