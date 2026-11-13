import { useMemo, useState } from 'react'
import { SOURCES } from '../core/subjects'
import { sentidoDoNivel } from '../core/movimento'
import { totals } from '../core/filters'
import {
  CARGOS, ORDENS, bancosPresentes, descreverProvas, nomeDoBanco, ordenarProvas,
  type Cargo, type OrdemProvas, type ProvaComDados,
} from '../core/provas'
import { BANK, useApp } from '../store/app'
import type { Question } from '../core/types'
import { Icon } from './bits'
import { useBackLayer } from './useBackLayer'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0)


interface Nav { banco: string | null; cargo: Cargo | null }
const INICIO: Nav = { banco: null, cargo: null }
let ultimo: Nav = INICIO // ao voltar do treino, o Início reabre onde o usuário estava
/** Tocar no ícone do Início na barra lateral volta as provas para a lista de bancos. */
export const reiniciarProvas = () => { ultimo = INICIO }

function resumo(l: ProvaComDados[]) {
  const n = l.reduce((a, p) => a + p.n, 0), vistas = l.reduce((a, p) => a + p.vistas, 0)
  return { provas: l.length, n, p: pct(vistas, n) }
}

/** Provas no Início, em três níveis: Banco → Cargo (Agente Comercial / TI) → provas, mostradas já nas três ordens (Mais novas, Mais antigas, Menos vistas), cada uma sob o seu título. */
export function Provas({ aoAbrir }: { aoAbrir: (s: string) => void }) {
  const prog = useApp((s) => s.prog)
  const [nav, setNav] = useState<Nav>(ultimo)
  const ir = (n: Partial<Nav>) => { ultimo = { ...ultimo, ...n }; setNav(ultimo) }
  // o voltar sobe um nível por vez (cada nível é uma camada leve; o voltar remove a de cima da pilha, por isso uma por nível)
  useBackLayer(nav.banco !== null && nav.cargo === null, () => ir({ banco: null }), true)
  useBackLayer(nav.cargo !== null, () => ir({ cargo: null }), true)
  const versao = useApp((s) => s.versao) // troca de espaço de estudo: as provas e as questões são outras
  const PROVAS = useMemo(() => descreverProvas(SOURCES), [versao])
  const POR_PROVA = useMemo(() => { const m: Record<string, Question[]> = {}; for (const q of BANK) (m[q.s] ??= []).push(q); return m }, [versao])
  const todas = useMemo<ProvaComDados[]>(
    () => PROVAS.map((p) => { const l = POR_PROVA[p.s] ?? []; return { ...p, n: l.length, vistas: totals(l, prog).seen } }),
    [prog, PROVAS, POR_PROVA],
  )
  // descer de nível (banco → cargo → provas) entra pela direita, subir pela esquerda; a 1ª pintura e voltar à tela não animam
  const nivel = nav.banco ? (nav.cargo ? 2 : 1) : 0
  const [mn, setMn] = useState<{ nivel: number; dir: 'avanca' | 'recua' | null }>({ nivel, dir: null })
  if (mn.nivel !== nivel) setMn({ nivel, dir: sentidoDoNivel(mn.nivel, nivel) })
  const doBanco = nav.banco ? todas.filter((p) => p.banco === nav.banco) : []
  const cargos = (['ac', 'ti'] as Cargo[]).filter((c) => doBanco.some((p) => p.cargo === c))
  const doCargo = nav.banco && nav.cargo ? doBanco.filter((p) => p.cargo === nav.cargo) : []

  const Cartao = ({ nome, sub, p, run }: { nome: string; sub: string; p: number; run: () => void }) => (
    <button className="folder" onClick={run}>
      <span className="ftop"><span className="badge" aria-hidden="true"><Icon n="doc" size={20} /></span><span className="fpc">{p}%<small>vistas</small></span></span>
      <span className="fnm">{nome}</span>
      <span className="fsub">{sub}</span>
      <span className="bar" aria-hidden="true"><i style={{ width: `${p}%` }} /></span>
    </button>
  )

  return (
    <div className="late provas">
      <div className="sec">Provas · {!nav.banco ? 'escolha o banco' : !nav.cargo ? 'escolha o cargo' : plural(doCargo.length, 'prova', 'provas')}</div>
      <nav className="crumbs" aria-label="Caminho das provas">
        <button type="button" aria-current={!nav.banco ? 'page' : undefined} onClick={() => ir({ banco: null, cargo: null })}>Bancos</button>
        {nav.banco && <span className="crumb"><span aria-hidden="true">›</span><button type="button" aria-current={!nav.cargo ? 'page' : undefined} onClick={() => ir({ cargo: null })}>{nomeDoBanco(nav.banco)}</button></span>}
        {nav.cargo && <span className="crumb"><span aria-hidden="true">›</span><button type="button" aria-current="page">{CARGOS[nav.cargo]}</button></span>}
      </nav>

      <div key={nivel} className={`provas-corpo${mn.dir ? ` fc-tela ${mn.dir}` : ''}`}>
      {!nav.banco && (
        <div className="folders">
          {bancosPresentes(PROVAS).map((id) => {
            const r = resumo(todas.filter((p) => p.banco === id))
            return <Cartao key={id} nome={nomeDoBanco(id)} sub={`${plural(r.provas, 'prova', 'provas')} · ${plural(r.n, 'questão', 'questões')}`} p={r.p} run={() => ir({ banco: id, cargo: null })} />
          })}
        </div>
      )}

      {nav.banco && !nav.cargo && (
        <div className="folders">
          {cargos.map((c) => {
            const r = resumo(doBanco.filter((p) => p.cargo === c))
            return <Cartao key={c} nome={CARGOS[c]} sub={`${plural(r.provas, 'prova', 'provas')} · ${plural(r.n, 'questão', 'questões')}`} p={r.p} run={() => ir({ cargo: c })} />
          })}
        </div>
      )}

      {nav.banco && nav.cargo && (
        <>
          {(Object.keys(ORDENS) as OrdemProvas[]).map((o) => (
            <section key={o} className="provas-grupo" aria-labelledby={`prov-${o}`}>
              <h3 id={`prov-${o}`} className="sec provas-titulo">{ORDENS[o]}</h3>
              <div className="files">
                {ordenarProvas(doCargo, o).map((p) => (
                  <button key={p.s} className="file" onClick={() => aoAbrir(p.s)}>
                    <span className="badge" aria-hidden="true"><Icon n="doc" size={20} /></span>
                    <span className="ftx"><span className="fname">{p.rotulo}</span><span className="fmeta">{plural(p.n, 'questão', 'questões')} · {p.vistas} vistas</span></span>
                    <span className="badge pct" aria-label={`${pct(p.vistas, p.n)}% vistas`}>{pct(p.vistas, p.n)}%</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
      </div>
    </div>
  )
}
