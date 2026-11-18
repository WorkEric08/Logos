import { useEffect, useRef, useState } from 'react'
import { temConteudo, textoDoResumo, type Resumo } from '../core/copia'
import { lerUltimaCopia } from '../services/db'
import { resumoDoAparelho, restaurarCopia, salvarCopia } from '../services/copia'
import { useEspacos } from '../store/espacos'
import { aoAparecer } from './revelar'

const dataTexto = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Cópia de segurança (em "Mais"): o que só existe neste aparelho (espaços criados, provas e questões importadas ou geradas, materiais) vai para um arquivo que a pessoa guarda onde
 * quiser; restaurar só acrescenta. O progresso, o histórico e os cartões não entram: esses vão para a conta Google pela sincronização.
 */
export function Copia() {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [ultima, setUltima] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [nota, setNota] = useState<{ texto: string; erro: boolean } | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const atualizar = async () => { try { setResumo(await resumoDoAparelho()); setUltima(await lerUltimaCopia()) } catch { /* sem banco: a tela só não mostra os números */ } }
  useEffect(() => { void atualizar() }, [])

  const salvar = async () => {
    setOcupado(true); setNota(null)
    const r = await salvarCopia()
    setOcupado(false)
    if (!r.ok) { setNota({ texto: r.erro, erro: true }); return }
    setNota({ texto: r.resultado === 'cancelado' ? 'Cópia cancelada: nada foi guardado.' : `Cópia pronta (${r.megabytes < 0.1 ? 'menos de 0,1' : r.megabytes.toFixed(1).replace('.', ',')} MB): ${textoDoResumo(r.resumo)}. Guarde o arquivo num lugar seguro (Drive, e-mail para você mesmo…).`, erro: false })
    void atualizar()
  }
  const restaurar = async (f: File) => {
    setOcupado(true); setNota(null)
    try {
      const r = await restaurarCopia(await f.text())
      if (!r.ok) { setNota({ texto: r.erro, erro: true }); return }
      const novo = textoDoResumo(r.novos)
      await useEspacos.getState().iniciar() // a lista de espaços e o que o app lê passam a incluir o que voltou
      setNota({ texto: novo === 'nada' ? 'Nada novo: tudo o que está nessa cópia já existe neste aparelho.' : `Restaurei ${novo}. O que já existia aqui ficou como estava.`, erro: false })
    } catch (e) { setNota({ texto: 'Não consegui ler esse arquivo: ' + (e instanceof Error ? e.message : String(e)), erro: true }) } finally { setOcupado(false); void atualizar() }
  }
  const algo = resumo ? temConteudo(resumo) : false
  return (
    <div className="card copia"><h3>Cópia de segurança</h3>
      <p className="note">Seu progresso, histórico e cartões ficam na conta Google (veja "Conta e sincronização"). Provas importadas, questões, materiais e espaços que você criou ficam <b>só neste aparelho</b>: salve uma cópia para não perdê-los se o aplicativo for desinstalado ou o celular trocado.</p>
      {resumo && <p className="note" role="status">{algo ? `Neste aparelho: ${textoDoResumo(resumo)}. ${ultima ? `Última cópia: ${dataTexto(ultima)}.` : 'Você ainda não salvou nenhuma cópia.'}` : 'Neste aparelho ainda não há nada seu para guardar.'}</p>}
      <div className="row" style={{ marginTop: 14 }}>
        <button type="button" className="btn pri" disabled={ocupado || !algo} onClick={() => void salvar()}>Salvar cópia</button>
        <button type="button" className="btn" disabled={ocupado} onClick={() => arquivo.current?.click()}>Restaurar de um arquivo</button>
        <input ref={arquivo} id="copia-arquivo" type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void restaurar(f) }} />
      </div>
      {nota && <p key={nota.texto} ref={aoAparecer} className="note" role={nota.erro ? 'alert' : 'status'} style={nota.erro ? { color: 'var(--err)' } : undefined}>{nota.texto}</p>}
    </div>
  )
}
