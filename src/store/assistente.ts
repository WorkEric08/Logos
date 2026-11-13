// O chat com ações fixas (core/assistente.ts): estado da conversa e o fluxo de cada ação. Sem IA: quem lê os arquivos são as regras de core/importar.
// A conversa fica só na memória (fechar o assistente a esquece); o que importa de verdade vai para o espaço de estudo e para os baralhos.
import { create } from 'zustand'
import { sugerirCartoes, type Sugestoes } from '../core/importar/cartoes'
import { montarQuestoes, type MetaProva } from '../core/importar/montar'
import type { QuestaoLida } from '../core/importar/prova'
import { acaoPorId, type IdAcao } from '../core/assistente'
import { aplicarSugestao, type Sugestao } from '../core/importar/ia'
import { REGRAS } from '../core/scoring'
import { ALL_SUBJECTS, SOURCE_KEYS } from '../core/subjects'
import { pick } from '../core/weights'
import type { Letter } from '../core/types'
import { anexarImagens, paragrafosDoArquivo, prepararProva, type ProvaPreparada } from '../services/importar/arquivos'
import { lerChave, lerModelo, mensagemErroIA, relerComIA } from '../services/importar/ia'
import { recortarQuestao } from '../services/importar/recorte'
import { BANK, TF, useApp } from './app'
import { useCards } from './cards'
import { useEspacos } from './espacos'

export type Etapa = 'inicio' | 'espaco-novo' | 'prova-arquivos' | 'lendo' | 'prova-previa' | 'prova-pronta' | 'cartoes-arquivo' | 'cartoes-previa' | 'cartoes-pronto' | 'simulado' | 'espacos' | 'ia'
export interface Msg { id: number; de: 'a' | 'v'; texto: string }
export type QuaisImagens = 'figuras' | 'todas' | 'nenhuma'
export interface Previa {
  prep: ProvaPreparada
  rotulo: string
  escolhidas: number[]
  /** Respostas marcadas à mão na prévia (valem mais que as do gabarito lido). */
  manual: Record<number, Letter>
  imagens: QuaisImagens
}
export interface PreviaCartoes { sug: Sugestoes; escolhidos: number[]; nome: string; arquivo: string; avisos: string[] }

interface State {
  aberto: boolean
  etapa: Etapa
  mensagens: Msg[]
  ocupado: boolean
  progresso: { texto: string; pct: number } | null
  /** Ação que pediu para criar um espaço antes de continuar. */
  depois: IdAcao | null
  previa: Previa | null
  cartoes: PreviaCartoes | null
  resultado: { texto: string; treinar?: boolean } | null
  /** Sugestões da IA (opcional) ainda não aceitas, por número de questão; e a questão que está sendo relida. */
  sugestoes: Record<number, Sugestao>
  relendo: number | null
  abrir: () => void
  fechar: () => void
  voltarAoInicio: () => void
  escolher: (id: IdAcao) => void
  criarEspaco: (nome: string, usaBB: boolean) => Promise<void>
  lerProva: (prova: File, gabarito: File | null) => Promise<void>
  alternarQuestao: (n: number) => void
  marcarResposta: (n: number, l: Letter) => void
  setRotulo: (t: string) => void
  setImagens: (q: QuaisImagens) => void
  confirmarProva: () => Promise<void>
  releer: (n: number) => Promise<void>
  aceitarIA: (n: number) => void
  descartarIA: (n: number) => void
  lerCartoes: (f: File) => Promise<void>
  alternarCartao: (i: number) => void
  setNomeBaralho: (t: string) => void
  confirmarCartoes: () => void
  iniciarSimulado: (materia: string | null, n: number) => void
  /** "Novo espaço" a partir da lista de espaços. */
  novoEspaco: () => void
}

let msgId = 0
const m = (de: Msg['de'], texto: string): Msg => ({ id: ++msgId, de, texto })
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const erroTexto = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useAssistente = create<State>((set, get) => {
  const diz = (...textos: string[]) => set((s) => ({ mensagens: [...s.mensagens, ...textos.map((t) => m('a', t))] }))
  const voce = (t: string) => set((s) => ({ mensagens: [...s.mensagens, m('v', t)] }))
  const ir = (etapa: Etapa, extra: Partial<State> = {}) => set({ etapa, ...extra })
  const progresso = (texto: string, pct: number) => set({ progresso: { texto, pct } })
  const ehBB = () => useEspacos.getState().ativo === 'bb'
  const inicio = () => set({ etapa: 'inicio', sugestoes: {}, relendo: null, previa: null, cartoes: null, resultado: null, depois: null, progresso: null, ocupado: false })

  const continuarDepoisDoEspaco = (id: IdAcao | null) => {
    if (id === 'prova') { diz('Escolha o PDF da prova. Se tiver o do gabarito, escolha também (ou marque as respostas na prévia).'); ir('prova-arquivos') }
    else inicio()
  }

  return {
    aberto: false, etapa: 'inicio', mensagens: [], ocupado: false, progresso: null, depois: null, previa: null, cartoes: null, resultado: null, sugestoes: {}, relendo: null,
    abrir: () => {
      if (!get().mensagens.length) set({ mensagens: [m('a', 'Oi! Eu monto o seu espaço de estudo a partir dos seus arquivos. Escolha o que quer fazer; tudo é lido aqui no seu aparelho.')] })
      set({ aberto: true })
    },
    fechar: () => { set({ aberto: false }); inicio() },
    voltarAoInicio: () => inicio(),
    escolher: (id) => {
      const a = acaoPorId(id)
      voce(a.rotulo)
      if (id === 'resumo') {
        const n = BANK.length, mats = ALL_SUBJECTS.filter((x) => BANK.some((q) => q.m === x.n)).length, provas = SOURCE_KEYS.length
        diz(`O espaço "${useEspacos.getState().lista.find((x) => x.id === useEspacos.getState().ativo)?.nome ?? ''}" tem ${plural(n, 'questão', 'questões')}, ${plural(mats, 'matéria', 'matérias')} e ${plural(provas, 'prova', 'provas')}.`)
        return
      }
      if (id === 'prova' && ehBB()) { diz('O espaço do Banco do Brasil não recebe arquivos. Para importar, preciso de um espaço seu: crie um agora (dá para começar com as questões do BB).'); ir('espaco-novo', { depois: 'prova' }); return }
      if (id === 'prova') { continuarDepoisDoEspaco('prova'); return }
      if (id === 'cartoes') { diz('Escolha o arquivo do resumo (PDF com texto, TXT ou MD).'); ir('cartoes-arquivo'); return }
      if (id === 'simulado') { diz(REGRAS ? 'Este espaço tem regras de edital: o simulado é o do edital.' : 'Escolha a matéria e a quantidade de questões.'); ir('simulado'); return }
      if (id === 'espaco') { diz('Estes são os seus espaços. Toque em um para ativar, ou crie um novo.'); ir('espacos'); return }
      if (id === 'ia') { diz('A ajuda de IA é opcional e usa a sua chave da Anthropic. Ela só é usada quando você toca em "Reler com IA" na prévia de uma prova.'); ir('ia'); return }
    },
    novoEspaco: () => { diz('Dê um nome ao espaço e escolha como começar.'); ir('espaco-novo', { depois: null }) },
    criarEspaco: async (nome, usaBB) => {
      if (get().ocupado) return
      set({ ocupado: true })
      try {
        const depois = get().depois
        const id = await useEspacos.getState().criar(nome, usaBB)
        void id
        voce(`Criar o espaço "${nome.trim() || 'Meu espaço'}"${usaBB ? ' com as questões do BB' : ''}`)
        diz('Espaço criado e ativo.')
        set({ ocupado: false }); continuarDepoisDoEspaco(depois)
      } catch (e) { diz('Não consegui criar o espaço: ' + erroTexto(e)); set({ ocupado: false }) }
    },
    lerProva: async (prova, gabarito) => {
      if (get().ocupado) return
      voce(`Prova: ${prova.name}${gabarito ? ` · gabarito: ${gabarito.name}` : ' · sem gabarito'}`)
      ir('lendo', { ocupado: true, progresso: { texto: 'Começando…', pct: 0 } })
      try {
        const prep = await prepararProva(prova, gabarito, progresso)
        const qs = prep.lida.questoes
        const comGab = prep.gabarito ? qs.filter((q) => q.numero in prep.gabarito!.respostas).length : 0
        diz(
          qs.length
            ? `Li ${plural(qs.length, 'questão', 'questões')} em ${plural(prep.paginas, 'página', 'páginas')}${prep.gabarito ? `; o gabarito cobre ${comGab}` : ''}. Confira a prévia antes de adicionar.`
            : 'Não encontrei questões. O PDF pode ser escaneado (só imagem) ou ter um formato que ainda não conheço.',
          ...prep.lida.avisos.map((x) => `Aviso: ${x}.`), ...(prep.gabarito?.avisos ?? []).map((x) => `Gabarito: ${x}.`),
        )
        if (!qs.length) { set({ ocupado: false, progresso: null }); ir('prova-arquivos'); return }
        const ok = (q: QuestaoLida) => Object.keys(q.alternativas).length >= 2
        set({ ocupado: false, progresso: null, previa: { prep, rotulo: prep.meta.rotulo, escolhidas: qs.filter(ok).map((q) => q.numero), manual: {}, imagens: 'figuras' } })
        ir('prova-previa')
      } catch (e) { diz('Não consegui ler o arquivo: ' + erroTexto(e)); set({ ocupado: false, progresso: null }); ir('prova-arquivos') }
    },
    alternarQuestao: (n) => set((s) => (s.previa ? { previa: { ...s.previa, escolhidas: s.previa.escolhidas.includes(n) ? s.previa.escolhidas.filter((x) => x !== n) : [...s.previa.escolhidas, n] } } : {})),
    marcarResposta: (n, l) => set((s) => (s.previa ? { previa: { ...s.previa, manual: { ...s.previa.manual, [n]: l } } } : {})),
    setRotulo: (t) => set((s) => (s.previa ? { previa: { ...s.previa, rotulo: t.slice(0, 80) } } : {})),
    setImagens: (q) => set((s) => (s.previa ? { previa: { ...s.previa, imagens: q } } : {})),
    confirmarProva: async () => {
      const p = get().previa
      if (!p || get().ocupado) return
      set({ ocupado: true })
      try {
        const meta: MetaProva = { ...p.prep.meta, rotulo: p.rotulo.trim() || p.prep.meta.rotulo }
        const respostas = { ...(p.prep.gabarito?.respostas ?? {}), ...p.manual }
        const mont = montarQuestoes(p.prep.lida.questoes, respostas, meta, new Set(p.escolhidas))
        if (!mont.questoes.length) { diz('Nenhuma das questões escolhidas pode entrar (falta gabarito ou alternativas). Marque as respostas na prévia.'); set({ ocupado: false }); return }
        voce(`Adicionar ${plural(mont.questoes.length, 'questão', 'questões')}`)
        const espaco = useEspacos.getState().ativo
        const comImg = await anexarImagens(p.prep, mont.questoes, espaco, p.imagens, progresso)
        const r = await useEspacos.getState().adicionar(comImg.questoes, { fontes: { [meta.chave]: meta.rotulo }, bases: mont.bases, bancos: [{ id: meta.bancoId, nome: meta.bancoNome }] })
        const partes = [`${plural(r.adicionadas, 'questão entrou', 'questões entraram')} em "${meta.rotulo}"`]
        if (r.repetidas) partes.push(`${plural(r.repetidas, 'já estava', 'já estavam')} (não duplicou)`)
        if (mont.ignoradas.length) partes.push(`${plural(mont.ignoradas.length, 'ficou de fora', 'ficaram de fora')}: ${mont.ignoradas.slice(0, 6).map((x) => `Q${x.numero} (${x.motivo})`).join(', ')}${mont.ignoradas.length > 6 ? '…' : ''}`)
        if (comImg.falhas) partes.push(`${plural(comImg.falhas, 'imagem não pôde ser recortada', 'imagens não puderam ser recortadas')}`)
        await p.prep.doc?.destroy?.()
        diz(partes.join('. ') + '.')
        set({ ocupado: false, progresso: null, previa: null, resultado: { texto: partes[0], treinar: true } })
        ir('prova-pronta')
      } catch (e) { diz('Não consegui adicionar: ' + erroTexto(e)); set({ ocupado: false, progresso: null }) }
    },
    releer: async (n) => {
      const p = get().previa
      const q = p?.prep.lida.questoes.find((x) => x.numero === n)
      if (!p || !q || get().relendo !== null) return
      const chave = lerChave()
      if (!chave) { diz('Para reler com IA, cole a sua chave em "Ajuda de IA".'); return }
      set({ relendo: n })
      try {
        const imagem = p.prep.doc ? await recortarQuestao(p.prep.doc, q.regioes).catch(() => null) : null
        const s = await relerComIA({ chave, modelo: lerModelo(), questao: q, imagem })
        set((st) => ({ sugestoes: { ...st.sugestoes, [n]: s }, relendo: null }))
      } catch (e) { diz(`Q${n}: ${mensagemErroIA(e)}`); set({ relendo: null }) }
    },
    aceitarIA: (n) => set((st) => {
      const s = st.sugestoes[n], p = st.previa
      if (!s || !p) return {}
      const questoes = p.prep.lida.questoes.map((q) => (q.numero === n ? aplicarSugestao(q, s) : q))
      const { [n]: _usada, ...resto } = st.sugestoes; void _usada
      return { sugestoes: resto, previa: { ...p, prep: { ...p.prep, lida: { ...p.prep.lida, questoes } } } }
    }),
    descartarIA: (n) => set((st) => { const { [n]: _x, ...resto } = st.sugestoes; void _x; return { sugestoes: resto } }),
    lerCartoes: async (f) => {
      if (get().ocupado) return
      voce(`Resumo: ${f.name}`)
      ir('lendo', { ocupado: true, progresso: { texto: 'Começando…', pct: 0 } })
      try {
        const { paragrafos, avisos } = await paragrafosDoArquivo(f, progresso)
        const sug = sugerirCartoes(paragrafos)
        diz(
          sug.cartoes.length ? `Achei ${plural(sug.cartoes.length, 'cartão', 'cartões')} em ${plural(paragrafos.length, 'parágrafo', 'parágrafos')}. ${sug.sobraram ? `${plural(sug.sobraram, 'parágrafo ficou', 'parágrafos ficaram')} de fora (sem padrão de definição). ` : ''}Escolha os que quer.` : 'Não achei trechos no formato "termo: definição" nem outros padrões que eu reconheça.',
          ...avisos,
        )
        if (!sug.cartoes.length) { set({ ocupado: false, progresso: null }); ir('cartoes-arquivo'); return }
        set({ ocupado: false, progresso: null, cartoes: { sug, escolhidos: sug.cartoes.map((_, i) => i), nome: f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').slice(0, 40), arquivo: f.name, avisos } })
        ir('cartoes-previa')
      } catch (e) { diz('Não consegui ler o arquivo: ' + erroTexto(e)); set({ ocupado: false, progresso: null }); ir('cartoes-arquivo') }
    },
    alternarCartao: (i) => set((s) => (s.cartoes ? { cartoes: { ...s.cartoes, escolhidos: s.cartoes.escolhidos.includes(i) ? s.cartoes.escolhidos.filter((x) => x !== i) : [...s.cartoes.escolhidos, i] } } : {})),
    setNomeBaralho: (t) => set((s) => (s.cartoes ? { cartoes: { ...s.cartoes, nome: t.slice(0, 40) } } : {})),
    confirmarCartoes: () => {
      const c = get().cartoes
      if (!c) return
      const lista = c.escolhidos.slice().sort((a, b) => a - b).map((i) => c.sug.cartoes[i]).filter(Boolean)
      if (!lista.length) { diz('Escolha ao menos um cartão.'); return }
      const nome = c.nome.trim() || 'Resumo importado'
      const cards = useCards.getState()
      let b = cards.baralhos.find((x) => x.nome.trim().toLowerCase() === nome.toLowerCase())?.id ?? null
      if (!b) b = cards.novoBaralho(nome)
      if (!b) { diz('Não consegui criar o baralho (nome vazio ou repetido). Mude o nome.'); return }
      let n = 0
      for (const x of lista) n += useCards.getState().adicionar(b, x.f, x.v).length
      voce(`Criar o baralho "${nome}" com ${plural(lista.length, 'cartão', 'cartões')}`)
      diz(`${plural(n, 'cartão entrou', 'cartões entraram')} no baralho "${nome}". Estude na aba Cards.`)
      set({ cartoes: null, resultado: { texto: `${plural(n, 'cartão entrou', 'cartões entraram')} no baralho "${nome}".` } })
      ir('cartoes-pronto')
    },
    iniciarSimulado: (materia, n) => {
      const { prog, startSimulado, startCustom } = useApp.getState()
      set({ aberto: false }); inicio()
      if (materia === null) { startSimulado(); return }
      const pool = BANK.filter((q) => q.m === materia)
      startCustom(pick(pool, Math.min(n, pool.length), TF, prog).map((q) => q.id), true)
    },
  }
})
