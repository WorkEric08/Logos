import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ACOES } from '../core/assistente'
import { cadernoDoEspaco, resumirCaderno } from '../core/caderno'
import { ROTULO_TIPO_QUESTAO } from '../core/questoes/gerar'
import { sugerirDigitando } from '../core/dialogo/digitando'
import { SUBJECT } from '../core/subjects'
import type { Letter } from '../core/types'
import type { TrechoDestacado } from '../core/busca/trecho'
import { ROTULO_TIPO_CARTAO } from '../core/cartoes/tipos'
import type { Achado } from '../services/busca/consultar'
import { BANK, useApp } from '../store/app'
import { iaLigada } from '../services/importar/ia'
import { useAssistente } from '../store/assistente'
import { useEspacos } from '../store/espacos'
import { IaPainel } from './AssistenteIA'
import { Icon, Top } from './bits'
import { Cena, Pilulas, reduzMovimento, useContagem, useFalas, useFechar, type ItemPilula } from './movimentoChat'
import { inicioDaResposta, quantoRolar } from '../core/rolagem'
import { alturaDoTeclado, aoMudarTeclado } from '../services/teclado'

const LETRAS: Letter[] = ['A', 'B', 'C', 'D', 'E']
const resumo = (t: string, n = 110) => (t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…')

/** Um botão que abre o seletor de arquivo (o <input type="file"> fica escondido: só o botão aparece). */
function EscolherArquivo({ rotulo, aceita, nome, onArquivo, id, pri }: { rotulo: string; aceita: string; nome?: string; onArquivo: (f: File) => void; id: string; pri?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="as-arq">
      <input ref={ref} id={id} type="file" accept={aceita} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onArquivo(f); e.target.value = '' }} />
      <button className={`btn${pri ? ' pri' : ''}`} onClick={() => ref.current?.click()}><Icon n="doc" size={18} />{rotulo}</button>
      {nome && <span className="as-nome" title={nome}>{nome}</span>}
    </div>
  )
}

/** O "Desfazer" (só aparece quando há algo a desfazer) e o "Limpar conversa" (quando a conversa já está longa). */
const LIMPAR_A_PARTIR_DE = 12
function pilulasExtras(): ItemPilula[] {
  const st = useAssistente.getState()
  return [
    ...(st.desfazivel ? [{ id: 'desfazer', rotulo: 'Desfazer: ' + st.desfazivel, run: st.desfazer }] : []),
    ...(st.mensagens.length >= LIMPAR_A_PARTIR_DE ? [{ id: 'limpar', rotulo: 'Limpar a conversa', run: st.pedirLimpar }] : []),
  ]
}

/** Sugestões: pílulas no fim da conversa (como as respostas rápidas de um chat). Tocar numa delas é "dizer" aquilo. Enquanto a pessoa digita, a lista se filtra
 *  (como a paleta de comandos): quem escreve "simu" vê "Montar um simulado"; texto que não é comando oferece "Procurar … no meu material". */
function Sugestoes() {
  const { escolher, ajuda, procurar } = useAssistente.getState()
  const desambiguar = useAssistente((s) => s.desambiguar)
  const rascunho = useAssistente((s) => s.rascunho)
  useAssistente((s) => s.desfazivel); useAssistente((s) => s.mensagens.length >= LIMPAR_A_PARTIR_DE)
  // (todos os hooks antes do "return" de baixo: a ordem deles não pode mudar entre uma renderização e outra)
  const painel = useAssistente((s) => s.painel), painelMsgId = useAssistente((s) => s.painelMsgId), ultimoId = useAssistente((s) => s.mensagens.at(-1)?.id)
  const digitando = sugerirDigitando(rascunho, ACOES)
  if (digitando.length) {
    return <Pilulas rotuloGrupo="Sugestões para o que você escreveu" itens={digitando.map((d, i) => d.tipo === 'acao'
      ? { id: 'dg-' + d.id, rotulo: d.rotulo, pri: i === 0, acao: d.id, run: () => escolher(d.id as never) }
      : { id: 'dg-busca', rotulo: d.rotulo, run: () => procurar(rascunho.trim()) })} />
  }
  const { painelAcao } = useAssistente.getState()
  // as sugestões do painel do dia valem enquanto ele for a última fala: fazer qualquer outra coisa as tira
  const doPainel = painel && painelMsgId === ultimoId ? [painel.sugestao, ...painel.alternativas] : []
  const itens: ItemPilula[] = [
    ...doPainel.map((x, i) => ({ id: 'pn-' + x.id, rotulo: x.rotulo, pri: i === 0, run: () => painelAcao(x) })),
    ...desambiguar.map((id) => ({ id: `d-${id}`, rotulo: ACOES.find((a) => a.id === id)!.sugestao, pri: true, acao: id, run: () => escolher(id) })),
    ...ACOES.filter((a) => !desambiguar.includes(a.id)).map((a) => ({ id: a.id, rotulo: a.sugestao, acao: a.id, run: () => escolher(a.id) })),
    { id: 'ajuda', rotulo: 'O que você sabe fazer?', acao: 'ajuda', run: ajuda },
    ...pilulasExtras(),
  ]
  return <Pilulas itens={itens} />
}

/** A pergunta do assistente para completar um pedido ("De qual matéria?"): as opções são sugestões; escrever a resposta também vale. */
function Pergunta() {
  const pendente = useAssistente((s) => s.pendente)
  const { responder, cancelarPergunta } = useAssistente.getState()
  if (!pendente) return null
  const itens: ItemPilula[] = [
    ...pendente.opcoes.map((o, i) => ({ id: 'op-' + String(o.valor), rotulo: o.rotulo, pri: i === 0 && pendente.slot === 'materia' && o.valor === 'edital', run: () => responder(o) })),
    { id: 'cancelar', rotulo: 'Cancelar', run: cancelarPergunta },
  ]
  return <Pilulas itens={itens} rotuloGrupo="Opções" />
}

/** Qual material? (quando há mais de um) */
function QuestoesMaterial() {
  const { materiais } = useAssistente()
  const { gerarQuestoes, voltarAoInicio } = useAssistente.getState()
  const itens: ItemPilula[] = [
    ...materiais.map((m, i) => ({ id: 'mat-' + m.id, rotulo: m.nome, pri: i === 0, run: () => void gerarQuestoes(m.id) })),
    { id: 'mais', rotulo: 'Mais sugestões', run: voltarAoInicio },
  ]
  return <Pilulas itens={itens} rotuloGrupo="Materiais" />
}

/** A prévia das questões geradas: o enunciado, as 5 alternativas (a certa marcada), o tipo e o trecho de onde saiu. Nada entra antes de confirmar. */
function PreviaQuestoes() {
  const fechar = useFechar()
  const s = useAssistente()
  const g = s.geradas!
  const [todas, setTodas] = useState(false)
  const lista = g.geracao.questoes
  const visiveis = todas ? lista : lista.slice(0, 30)
  return (
    <div className="as-painel">
      <div className="card"><p className="note" role="status">{g.escolhidas.length} de {lista.length} questões escolhidas. Cada uma mostra de onde saiu: confira com o seu material antes de adicionar.</p></div>
      <ul className="as-qs">
        {visiveis.map((x, i) => (
          <li key={x.q.id} className={`as-q${g.escolhidas.includes(i) ? '' : ' off'}${i < 12 ? ' casc' : ''}`} style={{ '--i': i } as React.CSSProperties}>
            <label className="as-q-top">
              <input type="checkbox" checked={g.escolhidas.includes(i)} onChange={() => s.alternarGerada(i)} aria-label={`Incluir a questão ${i + 1}`} />
              <b>{x.q.e}</b>
            </label>
            <ol className="as-alts" type="A">
              {LETRAS.map((l) => <li key={l} className={l === x.q.g ? 'certa' : ''}>{x.q.o[l]}{l === x.q.g && <span className="sr-only"> (alternativa certa)</span>}</li>)}
            </ol>
            <small className="as-q-tipo">{ROTULO_TIPO_QUESTAO[x.tipo]} · gabarito {x.q.g} · do trecho: “{resumo(x.q.fonte ?? '', 110)}”</small>
          </li>
        ))}
      </ul>
      {lista.length > 30 && !todas && <button className="btn" onClick={() => setTodas(true)}>Mostrar as {lista.length} questões</button>}
      <div className="foot sticky">
        <button className="btn" onClick={() => fechar(() => useAssistente.getState().voltarAoInicio())}>Cancelar</button>
        <button className="btn pri" disabled={!g.escolhidas.length || s.ocupado} onClick={() => void s.confirmarGeradas()}>Adicionar {g.escolhidas.length}</button>
      </div>
    </div>
  )
}

/** O plano de estudo: o que fazer primeiro (cartões ou questões) e como mudar o tempo. */
function PlanoPainel() {
  const plano = useAssistente((s) => s.plano)
  const { planoAcao, voltarAoInicio } = useAssistente.getState()
  if (!plano) return null
  const itens: ItemPilula[] = [
    ...(plano.cartoes ? [{ id: 'plano-cartoes', rotulo: `Começar pelos cartões (${plano.cartoes})`, pri: true, run: () => planoAcao('cartoes') }] : []),
    ...(plano.questoes.ids.length ? [{ id: 'plano-questoes', rotulo: `Fazer as ${plano.questoes.ids.length} questões`, pri: !plano.cartoes, run: () => planoAcao('questoes') }] : []),
    { id: 'plano-outro', rotulo: 'Outro tempo', run: () => planoAcao('outro') },
    { id: 'mais', rotulo: 'Mais sugestões', run: voltarAoInicio },
  ]
  return <Pilulas itens={itens} rotuloGrupo="Plano de estudo" />
}

/** O caderno de erros: o resumo já está na fala do assistente; aqui as saídas (rever tudo, rever só a matéria em que mais erra, simulado só dos erros). */
function Caderno() {
  const { cadernoAcao, voltarAoInicio } = useAssistente.getState()
  const eventos = useAssistente((s) => s.eventos)
  const prog = useApp((s) => s.prog)
  const r = resumirCaderno(cadernoDoEspaco(eventos, prog, BANK), BANK)
  const itens: ItemPilula[] = [
    { id: 'rever', rotulo: `Rever o caderno (${Math.min(r.total, 20)})`, pri: true, run: () => cadernoAcao('rever') },
    ...r.porMateria.slice(0, 2).map((m) => ({ id: 'rever-' + m.materia, rotulo: `Só ${SUBJECT[m.materia]?.s ?? m.materia} (${m.n})`, run: () => cadernoAcao({ materia: m.materia, rotulo: SUBJECT[m.materia]?.s ?? m.materia }) })),
    { id: 'simulado-erros', rotulo: 'Simulado só dos erros', run: () => cadernoAcao('simulado') },
    { id: 'mais', rotulo: 'Mais sugestões', run: voltarAoInicio },
  ]
  return <Pilulas itens={itens} rotuloGrupo="Caderno de erros" />
}

/** "Limpar a conversa": confirma antes (apaga só o histórico daqui). */
function Limpar() {
  const { limparConversa, voltarAoInicio } = useAssistente.getState()
  const itens: ItemPilula[] = [
    { id: 'apagar-conversa', rotulo: 'Apagar a conversa', pri: true, run: () => void limparConversa() },
    { id: 'manter', rotulo: 'Manter', run: voltarAoInicio },
  ]
  return <Pilulas itens={itens} rotuloGrupo="Confirmar" />
}

/** A caixa de mensagem, como nos apps de mensagem: fica presa no pé da tela (acima do teclado quando ele abre), o campo cresce conforme se escreve
 *  (até 5 linhas, depois rola por dentro) e o botão de enviar é só um ícone, fixo à direita, que acompanha a base do campo. Escrever um pedido
 *  ("importar prova") tem o mesmo efeito de tocar na sugestão. Enter envia (sem quebra de linha: os pedidos são de uma linha só).
 *  EXCEÇÃO CONSCIENTE à regra do teclado (2026-11-16, pedido do dono): só esta caixa sobe com o teclado; o resto do app segue só coberto por ele. */
const ALTURA_MAX_CAMPO = 144 // 5 linhas

/** O fim da conversa (a última coisa antes da caixa) não pode ficar embaixo dela: rola o que falta, mas só se a pessoa estava vendo o fim. */
function manterFimVisivel(caixa: HTMLElement, tecladoAntes: number) {
  const rolo = caixa.closest<HTMLElement>('.scroll-y')
  let anterior = caixa.previousElementSibling
  while (anterior?.classList.contains('sr-only')) anterior = anterior.previousElementSibling // (o aviso só para leitor de tela não conta)
  if (!rolo || !anterior) return
  const px = quantoRolar({
    fimDoConteudo: anterior.getBoundingClientRect().bottom,
    topoDaCaixa: caixa.getBoundingClientRect().top,
    baseVisivelAntes: rolo.getBoundingClientRect().bottom - tecladoAntes,
  })
  if (px > 0) rolo.scrollBy({ top: px, behavior: reduzMovimento() ? 'auto' : 'smooth' })
}
function Composer() {
  const { enviar, digitar } = useAssistente.getState()
  const txt = useAssistente((s) => s.rascunho)
  const pergunta = useAssistente((s) => s.etapa === 'pergunta')
  const campo = useRef<HTMLTextAreaElement>(null)
  // a altura segue o texto (layout, não animação): encolhe para medir e depois cresce até o necessário
  useLayoutEffect(() => {
    const e = campo.current
    if (!e) return
    e.style.height = 'auto'
    e.style.height = `${Math.min(e.scrollHeight + 2, ALTURA_MAX_CAMPO)}px`
  }, [txt])
  const mandar = (t: string) => { if (t.trim()) enviar(t) }
  const caixa = useRef<HTMLFormElement>(null)
  // a "câmera": o teclado abriu ou o campo cresceu e a caixa passou a cobrir o fim da conversa → rola só o necessário (se a pessoa estava no fim dela)
  useEffect(() => {
    const e = caixa.current
    if (!e) return
    const parar = aoMudarTeclado((kb, antes) => { if (kb > antes) manterFimVisivel(e, antes) })
    let altura = e.offsetHeight
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      const h = e.offsetHeight
      if (h > altura && altura > 0) manterFimVisivel(e, alturaDoTeclado())
      altura = h
    })
    ro?.observe(e)
    return () => { parar(); ro?.disconnect() }
  }, [])
  return (
    <form ref={caixa} className="as-composer" onSubmit={(e) => { e.preventDefault(); mandar(txt) }}>
      <textarea
        ref={campo} id="as-msg" className="campo" rows={1} value={txt} maxLength={200} autoComplete="off" enterKeyHint="send"
        aria-label="Mensagem para o assistente" placeholder={pergunta ? 'Escreva a resposta…' : 'Escreva um pedido…'}
        onChange={(e) => {
          const ne = e.nativeEvent as InputEvent
          // teclado do celular que não manda a tecla Enter (só insere a quebra): vale como enviar; texto colado com quebras vira uma linha
          if (ne.inputType === 'insertLineBreak') { mandar(e.target.value.replace(/\s*\n\s*/g, ' ')); return }
          digitar(e.target.value.replace(/\s*\n\s*/g, ' '))
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); mandar(txt) } }}
      />
      {/* onMouseDown: tocar em enviar não tira o foco do campo (o teclado continua aberto, como nos apps de mensagem) */}
      <button type="submit" className="btn pri as-enviar" aria-label="Enviar" disabled={!txt.trim()} onMouseDown={(e) => e.preventDefault()}><Icon n="send" size={22} /></button>
    </form>
  )
}

function NovoEspaco() {
  const fechar = useFechar()
  const { criarEspaco, voltarAoInicio } = useAssistente.getState()
  const ocupado = useAssistente((s) => s.ocupado)
  const [nome, setNome] = useState('')
  return (
    <div className="card as-painel">
      <label className="lb" htmlFor="as-espaco">Nome do espaço</label>
      <input id="as-espaco" className="campo" value={nome} maxLength={40} placeholder="Ex.: Direito, Concurso 2026…" onChange={(e) => setNome(e.target.value)} autoComplete="off" />
      <div className="foot sticky">
        <button className="btn" onClick={() => fechar(voltarAoInicio)}>Cancelar</button>
        <button className="btn" disabled={ocupado} onClick={() => void criarEspaco(nome, false)}>Criar vazio</button>
        <button className="btn pri" disabled={ocupado} onClick={() => void criarEspaco(nome, true)}>Com as questões do BB</button>
      </div>
    </div>
  )
}

function ArquivosProva() {
  const fechar = useFechar()
  const { lerProva, voltarAoInicio } = useAssistente.getState()
  const [prova, setProva] = useState<File | null>(null)
  const [gab, setGab] = useState<File | null>(null)
  return (
    <div className="card as-painel">
      <div className="lb">1. Prova (PDF)</div>
      <EscolherArquivo id="as-f-prova" rotulo="Escolher o PDF da prova" aceita="application/pdf,.pdf" nome={prova?.name} onArquivo={setProva} pri />
      <div className="lb">2. Gabarito (PDF, opcional)</div>
      <EscolherArquivo id="as-f-gab" rotulo="Escolher o PDF do gabarito" aceita="application/pdf,.pdf" nome={gab?.name} onArquivo={setGab} />
      <p className="note">Sem o gabarito, você marca a resposta de cada questão na prévia. Se o PDF tiver mais de um gabarito (cadernos 1, 2…), uso o primeiro.</p>
      <div className="foot sticky">
        <button className="btn" onClick={() => fechar(voltarAoInicio)}>Voltar</button>
        <button className="btn pri" disabled={!prova} onClick={() => prova && void lerProva(prova, gab)}>Ler a prova</button>
      </div>
    </div>
  )
}

function Lendo() {
  const p = useAssistente((s) => s.progresso)
  return (
    <div className="card as-painel as-lendo" role="status" aria-live="polite">
      <p>{p?.texto ?? 'Lendo…'}</p>
      <div className="bar as-brilho" aria-hidden="true"><i style={{ width: `${Math.max(4, p?.pct ?? 0)}%` }} /></div>
      <div className="as-esqueleto" aria-hidden="true"><i /><i /><i /></div>
    </div>
  )
}

function PreviaProva() {
  const fechar = useFechar()
  const s = useAssistente()
  const p = s.previa!
  const [todas, setTodas] = useState(false)
  const lista = p.prep.lida.questoes
  const respostas = { ...(p.prep.gabarito?.respostas ?? {}), ...p.manual }
  const prontas = p.escolhidas.filter((n) => { const q = lista.find((x) => x.numero === n); return q && n in respostas && respostas[n] !== null && q.alternativas[respostas[n] as Letter] })
  const visiveis = todas ? lista : lista.slice(0, 30)
  const semResposta = p.escolhidas.length - prontas.length
  return (
    <div className="as-painel">
      <div className="card">
        <label className="lb" htmlFor="as-prova">Nome da prova</label>
        <input id="as-prova" className="campo" value={p.rotulo} maxLength={80} onChange={(e) => s.setRotulo(e.target.value)} autoComplete="off" />
        <div className="lb">Imagem da questão (recorte da página)</div>
        <div className="chips" role="group" aria-label="Quais questões guardam imagem">
          {([['figuras', 'Só com figura ou tabela'], ['todas', 'Todas'], ['nenhuma', 'Nenhuma']] as const).map(([v, r]) => <button key={v} className="chip" aria-pressed={p.imagens === v} onClick={() => s.setImagens(v)}>{r}</button>)}
        </div>
        <p className="note" role="status">{prontas.length} de {lista.length} prontas para entrar{semResposta ? ` · ${semResposta} sem resposta (marque abaixo)` : ''}.</p>
      </div>
      <ul className="as-qs">
        {visiveis.map((q, idx) => {
          const marcada = p.escolhidas.includes(q.numero)
          const r = respostas[q.numero]
          return (
            <li key={q.numero} className={`as-q${marcada ? '' : ' off'}${idx < 12 ? ' casc' : ''}`} style={{ '--i': idx } as React.CSSProperties}>
              <label className="as-q-top">
                <input type="checkbox" checked={marcada} onChange={() => s.alternarQuestao(q.numero)} aria-label={`Incluir a questão ${q.numero}`} />
                <b>Q{q.numero}</b><span className="muted">{q.materia || 'sem matéria'}</span>
                {q.avisos.length > 0 && <span className="as-aviso" title={q.avisos.join('; ')}>aviso</span>}
              </label>
              <p className="as-q-txt">{resumo(q.enunciado)}</p>
              {q.avisos.length > 0 && <p className="note as-q-av">{q.avisos.join('; ')}</p>}
              {q.avisos.length > 0 && iaLigada() && !s.sugestoes[q.numero] && <button className="btn small-btn" disabled={s.relendo !== null} onClick={() => void s.releer(q.numero)}>{s.relendo === q.numero ? 'Relendo…' : 'Reler com IA'}</button>}
              {s.sugestoes[q.numero] && (
                <div className="as-sug" role="group" aria-label={`Sugestão da IA para a questão ${q.numero}`}>
                  <p className="note"><b>Sugestão da IA</b> (confira com a prova):</p>
                  <p className="as-q-txt">{resumo(s.sugestoes[q.numero].enunciado, 160)}</p>
                  <ul className="as-sug-alts">{LETRAS.filter((l) => s.sugestoes[q.numero].alternativas[l]).map((l) => <li key={l}><b>{l}</b> {resumo(s.sugestoes[q.numero].alternativas[l] ?? '', 80)}</li>)}</ul>
                  <div className="row"><button className="btn small-btn pri" onClick={() => s.aceitarIA(q.numero)}>Usar a sugestão</button><button className="btn small-btn" onClick={() => s.descartarIA(q.numero)}>Descartar</button></div>
                </div>
              )}
              <div className="chips as-letras" role="group" aria-label={`Resposta da questão ${q.numero}`}>
                {LETRAS.map((l) => <button key={l} className="chip" disabled={!q.alternativas[l]} aria-pressed={r === l} onClick={() => s.marcarResposta(q.numero, l)}>{l}</button>)}
                {r === null && <span className="note">anulada</span>}
              </div>
            </li>
          )
        })}
      </ul>
      {lista.length > 30 && !todas && <button className="btn" onClick={() => setTodas(true)}>Mostrar as {lista.length} questões</button>}
      <div className="foot sticky">
        <button className="btn" onClick={() => fechar(() => useAssistente.getState().voltarAoInicio())}>Cancelar</button>
        <button className="btn pri" disabled={s.ocupado || !prontas.length} onClick={() => void s.confirmarProva()}>{s.ocupado ? 'Adicionando…' : `Adicionar ${prontas.length}`}</button>
      </div>
    </div>
  )
}

/** Sucesso: o "visto" se desenha, o número de itens sobe contando e as próximas sugestões entram em cascata. */
function Pronto({ treinar }: { treinar: boolean }) {
  const { voltarAoInicio, escolher } = useAssistente.getState()
  const resultado = useAssistente((s) => s.resultado)
  const n = useContagem(resultado?.n ?? 0)
  const ir = (t: 'treinar' | 'cartoes') => useApp.getState().setTab(t)
  const itens: ItemPilula[] = [
    treinar ? { id: 'treinar', rotulo: 'Treinar agora', pri: true, run: () => ir('treinar') } : { id: 'cartoes', rotulo: 'Ver os cartões', pri: true, run: () => ir('cartoes') },
    ...(treinar ? [{ id: 'outra', rotulo: 'Importar outra prova', run: () => escolher('prova') }] : []),
    { id: 'mais', rotulo: 'Mais sugestões', run: voltarAoInicio },
    ...pilulasExtras().filter((x) => x.id === 'desfazer'),
  ]
  useAssistente((st) => st.desfazivel)
  return (
    <>
      {resultado?.n !== undefined && (
        <div className="as-sucesso" role="status">
          <svg className="as-visto" viewBox="0 0 52 52" width="44" height="44" aria-hidden="true"><circle cx="26" cy="26" r="23" /><path d="M15 27l8 8 15-17" /></svg>
          <div><b className="as-conta" data-testid="conta">{n}</b><span>{treinar ? (resultado.n === 1 ? ' questão adicionada' : ' questões adicionadas') : (resultado.n === 1 ? ' cartão criado' : ' cartões criados')}</span></div>
        </div>
      )}
      <Pilulas itens={itens} />
    </>
  )
}

/** Um trecho com as palavras da pergunta em destaque (<mark>), com reticências quando foi cortado. */
function TextoMarcado({ t }: { t: TrechoDestacado }) {
  const partes: React.ReactNode[] = []
  let pos = 0
  t.destaques.forEach((d, i) => {
    if (d.inicio > pos) partes.push(t.texto.slice(pos, d.inicio))
    partes.push(<mark key={i}>{t.texto.slice(d.inicio, d.fim)}</mark>)
    pos = d.fim
  })
  if (pos < t.texto.length) partes.push(t.texto.slice(pos))
  return <>{t.cortouInicio ? '… ' : ''}{partes}{t.cortouFim ? ' …' : ''}</>
}

const ROTULO_TIPO = { material: 'Material', questao: 'Questão', cartao: 'Cartão' } as const
/** Os achados de uma pergunta: cada um com o tipo, a fonte e o trecho com a palavra em destaque. */
function Achados({ achados }: { achados: Achado[] }) {
  return (
    <ul className="as-achados">
      {achados.map((a, i) => (
        <li key={i} className="as-achado" style={{ '--i': i } as React.CSSProperties}>
          <span className="as-achado-fonte"><b>{ROTULO_TIPO[a.tipo]}</b> · {a.fonte}{a.parcial ? ' · parte da pergunta' : ''}</span>
          <p><TextoMarcado t={a.trecho} /></p>
        </li>
      ))}
    </ul>
  )
}

/** "Meus materiais": o que está guardado neste espaço, com apagar em dois toques e o botão de guardar um novo. */
function Materiais() {
  const fechar = useFechar()
  const { materiais } = useAssistente()
  const [apagando, setApagando] = useState<string | null>(null)
  const { voltarAoInicio, apagarMaterial } = useAssistente.getState()
  const data = (t: number) => new Date(t).toLocaleDateString('pt-BR')
  return (
    <div className="card as-painel">
      {materiais.length > 0 && (
        <ul className="as-esp">
          {materiais.map((m) => (
            <li key={m.id} className="as-esp-i as-mat">
              <span className="as-mat-info"><b>{m.nome}</b><small>{m.trechos} trechos · {Math.round(m.caracteres / 1000)} mil letras · {data(m.criado)}</small></span>
              {apagando === m.id
                ? <span className="as-conf"><button className="btn warn small-btn" onClick={() => { setApagando(null); void apagarMaterial(m.id) }}>Apagar mesmo</button><button className="btn small-btn" onClick={() => setApagando(null)}>Não</button></span>
                : <button className="btn small-btn" aria-label={`Apagar o material ${m.nome}`} onClick={() => setApagando(m.id)}><Icon n="trash" size={16} /></button>}
            </li>
          ))}
        </ul>
      )}
      <p className="note">Aceita PDF com texto, TXT e MD. O que você guardar fica só neste aparelho e a busca funciona sem internet. Apagar um material não apaga suas questões nem cartões.</p>
      <div className="foot sticky"><button className="btn" onClick={() => fechar(voltarAoInicio)}>Voltar</button><button className="btn pri" onClick={() => useAssistente.setState({ etapa: 'material-arquivo' })}>Guardar um material</button></div>
    </div>
  )
}

function ArquivoMaterial() {
  const fechar = useFechar()
  const { guardarMaterial, voltarAoInicio } = useAssistente.getState()
  return (
    <div className="card as-painel">
      <EscolherArquivo id="as-f-material" rotulo="Escolher o arquivo do material" aceita="application/pdf,.pdf,.txt,.md,.markdown,text/plain,text/markdown" onArquivo={(f) => void guardarMaterial(f)} pri />
      <p className="note">Resumos, apostilas, anotações. Depois é só perguntar, por exemplo: "o que é Copom?".</p>
      <div className="foot sticky"><button className="btn" onClick={() => fechar(voltarAoInicio)}>Voltar</button></div>
    </div>
  )
}

/** Depois de guardar um material: o próximo passo natural é perguntar. */
function ProntoMaterial() {
  const { voltarAoInicio, escolher } = useAssistente.getState()
  const itens: ItemPilula[] = [
    { id: 'perguntar', rotulo: 'Perguntar ao meu material', pri: true, run: () => escolher('perguntar') },
    { id: 'gerar-questoes', rotulo: 'Gerar questões deste material', run: () => escolher('questoes') },
    { id: 'guardar-outro', rotulo: 'Guardar outro material', run: () => useAssistente.setState({ etapa: 'material-arquivo' }) },
    { id: 'mais', rotulo: 'Mais sugestões', run: voltarAoInicio },
  ]
  return <Pilulas itens={itens} />
}

function ArquivoCartoes() {
  const fechar = useFechar()
  const { lerCartoes, voltarAoInicio } = useAssistente.getState()
  return (
    <div className="card as-painel">
      <EscolherArquivo id="as-f-resumo" rotulo="Escolher o arquivo do resumo" aceita="application/pdf,.pdf,.txt,.md,.markdown,text/plain,text/markdown" onArquivo={(f) => void lerCartoes(f)} pri />
      <p className="note">Funciona melhor com "Termo: definição", "Pergunta? Resposta", "X é …", títulos com parágrafo e trechos em **negrito**.</p>
      <div className="foot sticky"><button className="btn" onClick={() => fechar(voltarAoInicio)}>Voltar</button></div>
    </div>
  )
}

function PreviaCartoes() {
  const fechar = useFechar()
  const s = useAssistente()
  const c = s.cartoes!
  const [todos, setTodos] = useState(false)
  const visiveis = todos ? c.sug.cartoes : c.sug.cartoes.slice(0, 40)
  return (
    <div className="as-painel">
      <div className="card">
        <label className="lb" htmlFor="as-baralho">Nome do baralho</label>
        <input id="as-baralho" className="campo" value={c.nome} maxLength={40} onChange={(e) => s.setNomeBaralho(e.target.value)} autoComplete="off" />
        <p className="note" role="status">{c.escolhidos.length} de {c.sug.cartoes.length} cartões escolhidos.</p>
      </div>
      <ul className="as-qs">
        {visiveis.map((x, i) => (
          <li key={i} className={`as-q${c.escolhidos.includes(i) ? '' : ' off'}${i < 12 ? ' casc' : ''}`} style={{ '--i': i } as React.CSSProperties}>
            <label className="as-q-top">
              <input type="checkbox" checked={c.escolhidos.includes(i)} onChange={() => s.alternarCartao(i)} aria-label={`Incluir o cartão ${i + 1}`} />
              <b>{resumo(x.f, 70)}</b>
            </label>
            <p className="as-q-txt">{resumo(x.v, 140)}</p>
            <small className="as-q-tipo">{ROTULO_TIPO_CARTAO[x.tipo]}{x.aviso ? ` · ${x.aviso}` : ''}</small>
          </li>
        ))}
      </ul>
      {c.sug.cartoes.length > 40 && !todos && <button className="btn" onClick={() => setTodos(true)}>Mostrar os {c.sug.cartoes.length} cartões</button>}
      <div className="foot sticky">
        <button className="btn" onClick={() => fechar(() => useAssistente.getState().voltarAoInicio())}>Cancelar</button>
        <button className="btn pri" disabled={!c.escolhidos.length} onClick={s.confirmarCartoes}>Criar o baralho</button>
      </div>
    </div>
  )
}

function Espacos() {
  const fechar = useFechar()
  const { lista, ativo, ativar, apagar } = useEspacos()
  const { voltarAoInicio, novoEspaco } = useAssistente.getState()
  const [apagando, setApagando] = useState<string | null>(null)
  return (
    <div className="card as-painel">
      <ul className="as-esp">
        {lista.map((e) => (
          <li key={e.id} className="as-esp-i">
            <button className="chip" aria-pressed={e.id === ativo} onClick={() => void ativar(e.id)}>{e.nome}<small> · {e.n} questões</small></button>
            {!e.embutido && (apagando === e.id
              ? <span className="as-conf"><button className="btn warn small-btn" onClick={() => { setApagando(null); void apagar(e.id) }}>Apagar mesmo</button><button className="btn small-btn" onClick={() => setApagando(null)}>Não</button></span>
              : <button className="btn small-btn" aria-label={`Apagar o espaço ${e.nome}`} onClick={() => setApagando(e.id)}><Icon n="trash" size={16} /></button>)}
          </li>
        ))}
      </ul>
      <p className="note">Apagar um espaço tira as questões e as imagens dele. O seu progresso fica guardado por questão: importar o mesmo arquivo de novo recupera.</p>
      <div className="foot sticky"><button className="btn" onClick={() => fechar(voltarAoInicio)}>Voltar</button><button className="btn pri" onClick={novoEspaco}>Novo espaço</button></div>
    </div>
  )
}

function Conversa({ iniciais, falas }: { iniciais: number; falas: { visiveis: number; digitando: boolean } }) {
  const msgs = useAssistente((s) => s.mensagens)
  return (
    <div className="as-chat" role="log" aria-live="polite" aria-label="Conversa com o assistente">
      {msgs.slice(0, falas.visiveis).map((x, i) => (
        <div key={x.id} data-id={x.id} className={`as-linha ${x.de}${i >= iniciais ? ' entra' : ''}`}>
          <div className="as-balao">
            <p className={`as-msg ${x.de}${x.tipo ? ' ' + x.tipo : ''}`}>{x.texto}</p>
            {x.achados && x.achados.length > 0 && <Achados achados={x.achados} />}
          </div>
        </div>
      ))}
      {falas.digitando && (
        <div className="as-linha a entra as-digitando-linha" aria-hidden="true">
          <p className="as-msg a as-digitando"><i /><i /><i /></p>
        </div>
      )}
    </div>
  )
}

/** A aba do Assistente: um chat. O assistente fala em balões; o que ele precisa de você aparece dentro da conversa; as ações vêm como sugestões. */
export function Assistente() {
  const pronta = useAssistente((s) => s.carregada)
  const epoca = useAssistente((s) => s.epoca)
  const espaco0 = useEspacos((s) => s.lista.find((e) => e.id === s.ativo)?.nome ?? '')
  useEffect(() => { void useAssistente.getState().abrirAba() }, [])
  // espera o histórico guardado chegar do aparelho: assim o que já foi dito aparece de uma vez, sem refazer a conversa
  if (!pronta) return <Top title="Assistente" sub={`Espaço: ${espaco0}`} />
  return <Chat key={epoca} />
}

function Chat() {
  const etapa = useAssistente((s) => s.etapa)
  const mensagens = useAssistente((s) => s.mensagens)
  const resultado = useAssistente((s) => s.resultado)
  const espaco = useEspacos((s) => s.lista.find((e) => e.id === s.ativo)?.nome ?? '')
  const tela = useRef<HTMLDivElement>(null)
  const iniciais = useRef(useAssistente.getState().vistas).current // as que já estavam mostradas ao entrar na aba não animam de novo
  const falas = useFalas(mensagens, iniciais, (n) => useAssistente.getState().marcarVistas(n))
  // A câmera: quando o assistente responde, a tela vai para o INÍCIO da resposta dele (a primeira fala da última sequência dele), com o que ele pede
  // logo abaixo; assim se lê de cima para baixo, também nas respostas de vários balões e nas listas longas de prévia. Enquanto a resposta não chega,
  // a fala da pessoa fica no alto. Se a pessoa rolou a tela por conta própria, a câmera não a puxa de volta (só volta a agir numa resposta nova).
  // Depois do reposicionamento da aba, para não ser desfeito.
  const ultimoAlvo = useRef<number | null>(null)
  const mexeu = useRef(false)
  useEffect(() => {
    const rolo = tela.current?.closest('.scroll-y')
    if (!rolo) return
    const f = () => { mexeu.current = true }
    rolo.addEventListener('touchstart', f, { passive: true }); rolo.addEventListener('wheel', f, { passive: true })
    return () => { rolo.removeEventListener('touchstart', f); rolo.removeEventListener('wheel', f) }
  }, [])
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const rolo = tela.current?.closest<HTMLElement>('.scroll-y')
      if (!rolo) return
      const linhas = [...(tela.current?.querySelectorAll<HTMLElement>('.as-chat > .as-linha:not(.as-digitando-linha)') ?? [])]
      const ini = inicioDaResposta(linhas.map((l) => (l.classList.contains('a') ? 'a' : 'v')))
      const alvo = ini >= 0 ? linhas[ini] : linhas.at(-1)
      if (!alvo) return
      const idAlvo = Number(alvo.dataset.id)
      if (idAlvo === ultimoAlvo.current && mexeu.current) return // a pessoa já rolou por conta própria nesta resposta
      ultimoAlvo.current = idAlvo; mexeu.current = false
      // posição de layout (offsetTop), não a da tela: a fala que entra ainda está animando (desliza e cresce) e mediria uns pixels fora do lugar
      let y = 0
      for (let e: HTMLElement | null = alvo; e && e !== rolo; e = e.offsetParent as HTMLElement | null) y += e.offsetTop
      rolo.scrollTo({ top: Math.max(0, y - 8) })
    })
    return () => cancelAnimationFrame(id)
  }, [falas.visiveis, falas.digitando, etapa])
  const menu = etapa === 'inicio' || etapa === 'pergunta' || etapa === 'prova-pronta' || etapa === 'cartoes-pronto' || etapa === 'material-pronto'
  return (
    <>
      <Top title="Assistente" sub={`Espaço: ${espaco}`} />
      <div className="chat-tela" ref={tela}>
        <Conversa iniciais={iniciais} falas={falas} />
        {!falas.falando && (
          <Cena chave={etapa}>
            <div className="as-corpo">
              {etapa === 'inicio' && <Sugestoes />}
              {etapa === 'espaco-novo' && <NovoEspaco />}
              {etapa === 'prova-arquivos' && <ArquivosProva />}
              {etapa === 'lendo' && <Lendo />}
              {etapa === 'prova-previa' && <PreviaProva />}
              {etapa === 'prova-pronta' && <Pronto treinar />}
              {etapa === 'cartoes-arquivo' && <ArquivoCartoes />}
              {etapa === 'cartoes-previa' && <PreviaCartoes />}
              {etapa === 'cartoes-pronto' && <Pronto treinar={false} />}
              {etapa === 'pergunta' && <Pergunta />}
              {etapa === 'caderno' && <Caderno />}
              {etapa === 'plano' && <PlanoPainel />}
              {etapa === 'questoes-material' && <QuestoesMaterial />}
              {etapa === 'questoes-previa' && <PreviaQuestoes />}
              {etapa === 'limpar' && <Limpar />}
              {etapa === 'espacos' && <Espacos />}
              {etapa === 'materiais' && <Materiais />}
              {etapa === 'material-arquivo' && <ArquivoMaterial />}
              {etapa === 'material-pronto' && <ProntoMaterial />}
              {etapa === 'ia' && <IaPainel />}
            </div>
          </Cena>
        )}
        {resultado && <p className="sr-only" role="status">{resultado.texto}</p>}
        {menu && <Composer />}{/* por último: presa no pé da tela, acima do teclado */}
      </div>
    </>
  )
}

