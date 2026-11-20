import { useEffect, useRef, useState } from 'react'
import { temConteudo, temEstudo, textoDaCopia, type Resumo, type ResumoEstudo } from '../core/copia'
import { lerUltimaCopia } from '../services/db'
import { resumoDoAparelho, resumoDoEstudo, restaurarCopia, salvarCopia } from '../services/copia'
import { AVISOS } from '../core/avisos'
import { useApp } from '../store/app'
import { useCards } from '../store/cards'
import { useEspacos } from '../store/espacos'
import { useConta } from '../services/sync/conta'
import { aoAparecer } from './revelar'

const dataTexto = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Cópia de segurança (em "Mais"): o que só existe neste aparelho (espaços criados, provas e questões importadas ou geradas, materiais) e o estudo (progresso, histórico de dias e
 * simulados, baralhos e cartões) vão para um arquivo que a pessoa guarda onde quiser; restaurar só acrescenta ou junta, nunca apaga nem diminui (C-8, 2026-11-18).
 */
export function Copia() {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [estudo, setEstudo] = useState<ResumoEstudo | null>(null)
  const [ultima, setUltima] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [nota, setNota] = useState<{ texto: string; erro: boolean } | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const logado = useConta().estado === 'dentro'
  const atualizar = async () => { try { setResumo(await resumoDoAparelho()); setEstudo(await resumoDoEstudo()); setUltima(await lerUltimaCopia()) } catch { /* sem banco: a tela só não mostra os números */ } }
  useEffect(() => { void atualizar() }, [])

  const salvar = async () => {
    setOcupado(true); setNota(null)
    const r = await salvarCopia()
    setOcupado(false)
    if (!r.ok) { setNota({ texto: r.erro, erro: true }); return }
    setNota({ texto: r.resultado === 'cancelado' ? 'Cópia cancelada: nada foi guardado.' : `Cópia pronta (${r.megabytes < 0.1 ? 'menos de 0,1' : r.megabytes.toFixed(1).replace('.', ',')} MB): ${textoDaCopia(r.resumo, r.estudo)}. Guarde o arquivo num lugar seguro (Drive, e-mail para você mesmo…).`, erro: false })
    void atualizar()
  }
  const restaurar = async (f: File) => {
    setOcupado(true); setNota(null)
    try {
      const r = await restaurarCopia(await f.text())
      if (!r.ok) { setNota({ texto: r.erro, erro: true }); return }
      const novo = textoDaCopia(r.novos, r.estudo.novos)
      await useEspacos.getState().iniciar() // a lista de espaços e o que o app lê passam a incluir o que voltou
      const e = r.estudo
      if (e.mudouCards) await useCards.getState().load() // baralhos e cartões que voltaram
      if (e.mudouMarcas) await useApp.getState().recarregar({ progresso: false, marcas: true }) // marcações e anotações que voltaram
      // progresso e histórico JUNTADOS (nunca menores); o restaurar da loja refaz os eventos de sincronização. O aviso é nosso, com UM Desfazer para tudo o que o estudo trouxe.
      const desfazProgresso = e.mudouProgresso ? await useApp.getState().restore(e.prog, { hist: e.hist, silencioso: true }) : null
      if (e.mudouProgresso || e.mudouCards || e.mudouMarcas) {
        useApp.getState().showToast(AVISOS.estudoRestaurado, { label: 'Desfazer', run: () => {
          desfazProgresso?.()
          void e.desfazer().then(async () => { await useCards.getState().load(); await useApp.getState().recarregar({ progresso: false, marcas: true }); void atualizar() })
        } })
      }
      setNota({ texto: novo === 'nada' ? 'Nada novo: tudo o que está nessa cópia já existe neste aparelho.' : `Restaurei ${novo}. O que já existia aqui ficou como estava.`, erro: false })
    } catch (e) { setNota({ texto: 'Não consegui ler esse arquivo: ' + (e instanceof Error ? e.message : String(e)), erro: true }) } finally { setOcupado(false); void atualizar() }
  }
  const algo = resumo && estudo ? temConteudo(resumo) || temEstudo(estudo) : false
  return (
    <div className="card copia"><h3>Cópia de segurança</h3>
      <p className="note">O arquivo leva tudo o que é seu: <b>espaços, provas e questões importadas, materiais, progresso, histórico (dias e simulados), marcações e anotações, baralhos e cartões</b>. {logado
        ? 'Progresso, histórico, cartões, espaços, provas e materiais também ficam na conta Google (veja "Conta e sincronização"), menos o que você mantiver "só neste aparelho".'
        : <>Sem entrar na conta Google, tudo isso fica <b>só neste aparelho</b>: salve uma cópia para não perder se o aplicativo for desinstalado ou o celular trocado.</>} Restaurar só junta: nada do que já está aqui é apagado nem diminui.</p>
      {resumo && estudo && <p className="note" role="status">{algo ? `Neste aparelho: ${textoDaCopia(resumo, estudo)}. ${ultima ? `Última cópia: ${dataTexto(ultima)}.` : 'Você ainda não salvou nenhuma cópia.'}` : 'Neste aparelho ainda não há nada seu para guardar.'}</p>}
      <div className="row" style={{ marginTop: 14 }}>
        <button type="button" className="btn pri" disabled={ocupado || !algo} onClick={() => void salvar()}>Salvar cópia</button>
        <button type="button" className="btn" disabled={ocupado} onClick={() => arquivo.current?.click()}>Restaurar de um arquivo</button>
        <input ref={arquivo} id="copia-arquivo" type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void restaurar(f) }} />
      </div>
      {nota && <p key={nota.texto} ref={aoAparecer} className="note" role={nota.erro ? 'alert' : 'status'} style={nota.erro ? { color: 'var(--err)' } : undefined}>{nota.texto}</p>}
    </div>
  )
}
