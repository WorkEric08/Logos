// Questões A–E geradas do material da pessoa, por regras (F4). Puro e determinístico: o mesmo material gera sempre as mesmas questões (mesmos ids), então gerar de novo
// não duplica. Os FATOS vêm do gerador de cartões (core/importar/cartoes.ts: definições, siglas, lacunas, números, perguntas e a marcação da pessoa), que já passou
// pelas regras de qualidade; aqui cada fato vira uma questão no estilo das provas (enunciado + 5 alternativas), SEM inventar nada: a alternativa certa é o que o material
// diz e as erradas vêm do próprio material (outras definições, termos, siglas) ou de números parecidos. Se não houver 4 alternativas erradas boas, a questão NÃO é gerada.
import { idPorConteudo } from '../espaco'
import { sugerirCartoes, type CartaoSugerido } from '../importar/cartoes'
import { slug } from '../importar/montar'
import type { Letter, Question } from '../types'
import type { Rng } from '../weights'
import { destacaPeloTamanho, escolherDistratores, formaDe, norm, rngDe } from './distratores'
import { perturbar } from './numeros'

export type TipoQuestao = 'definicao' | 'termo' | 'sigla' | 'numero' | 'lacuna' | 'pergunta' | 'incorreta'
export const ROTULO_TIPO_QUESTAO: Record<TipoQuestao, string> = {
  definicao: 'Qual é a definição', termo: 'Qual é o termo', sigla: 'Sigla', numero: 'Número', lacuna: 'Complete a frase', pergunta: 'Pergunta e resposta', incorreta: 'Assinale a INCORRETA',
}
export interface QuestaoGerada { q: Question; tipo: TipoQuestao }
export interface Descartada { motivo: string; resumo: string }
export interface Geracao {
  questoes: QuestaoGerada[]
  /** Quantos fatos do material serviram de ponto de partida. */
  fatos: number
  descartadas: Descartada[]
  /** A "prova" que agrupa as geradas deste material (chave e rótulo no formato do Início e do Treinar). */
  meta: { chave: string; rotulo: string; ano: number; bancoId: string; bancoNome: string }
}

export const MATERIA_GERADAS = 'Do meu material'
export const MAX_QUESTOES = 120
const MAX_ALT = 280, MAX_ENUNCIADO = 600, MAX_FONTE = 300
const LETRAS: Letter[] = ['A', 'B', 'C', 'D', 'E']

const corta = (t: string, n: number) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…')
const semPonto = (t: string) => t.trim().replace(/[.;]+$/, '')

interface ParTermo { termo: string; def: string; origem: string }
interface ParSigla { sigla: string; expansao: string; origem: string }
interface ParQA { pergunta: string; resposta: string; origem: string }
interface Lacuna { frase: string; resposta: string; origem: string }

/** Os cartões viram fatos tipados. */
function fatosDosCartoes(cartoes: readonly CartaoSugerido[]) {
  const termos: ParTermo[] = [], siglas: ParSigla[] = [], qas: ParQA[] = [], numeros: Lacuna[] = [], lacunas: Lacuna[] = []
  for (const c of cartoes) {
    if (c.tipo === 'definicao' || c.tipo === 'titulo') { termos.push({ termo: c.f, def: semPonto(c.v), origem: c.origem }); continue }
    if (c.tipo === 'verbo') {
      const termo = /^O que (?:é|são) (.+)\?$/.exec(c.f)?.[1]
      if (!termo) continue
      const def = c.v.slice(termo.length).replace(/^\s*(?:é|são|significa|consiste em|refere-se a|define-se como|chama-se|denomina-se)\s+/i, '')
      if (def && def !== c.v.slice(termo.length)) termos.push({ termo, def: semPonto(def), origem: c.origem })
      continue
    }
    if (c.tipo === 'sigla') {
      const s = /^O que significa a sigla (.+)\?$/.exec(c.f)
      if (s) siglas.push({ sigla: s[1], expansao: c.v, origem: c.origem })
      continue
    }
    if (c.tipo === 'numero') { numeros.push({ frase: c.f, resposta: c.v, origem: c.origem }); continue }
    if (c.tipo === 'lacuna') { lacunas.push({ frase: c.f, resposta: c.v, origem: c.origem }); continue }
    if (c.tipo === 'pergunta' || (c.tipo === 'sintaxe' && /\?$/.test(c.f))) { qas.push({ pergunta: c.f, resposta: semPonto(c.v), origem: c.origem }); continue }
    if (c.tipo === 'sintaxe' && c.f.length <= 80 && !c.f.includes('_____')) termos.push({ termo: c.f, def: semPonto(c.v), origem: c.origem })
  }
  return { termos, siglas, qas, numeros, lacunas }
}

interface Rascunho { tipo: TipoQuestao; enunciado: string; correta: string; erradas: string[]; assunto: string; origem: string }
type Resultado = { ok: true; q: Rascunho & { o: Record<Letter, string>; g: Letter } } | { ok: false; motivo: string; resumo: string }

/** Confere o rascunho, embaralha a certa entre as 5 posições (de forma repetível) e devolve as alternativas. */
function fechar(r: Rascunho, rng: Rng): Resultado {
  const resumo = corta(r.enunciado, 90)
  if (r.enunciado.length > MAX_ENUNCIADO) return { ok: false, motivo: 'enunciado longo demais', resumo }
  if ([r.correta, ...r.erradas].some((a) => a.length > MAX_ALT)) return { ok: false, motivo: 'alternativa longa demais', resumo }
  if (new Set([r.correta, ...r.erradas].map(norm)).size !== 5) return { ok: false, motivo: 'alternativas repetidas', resumo }
  if (destacaPeloTamanho(r.correta, r.erradas)) return { ok: false, motivo: 'a certa se destaca pelo tamanho', resumo }
  const pos = Math.floor(rng() * 5)
  const alts = [...r.erradas]
  alts.splice(pos, 0, r.correta)
  return { ok: true, q: { ...r, o: Object.fromEntries(LETRAS.map((l, i) => [l, alts[i]])) as Record<Letter, string>, g: LETRAS[pos] } }
}

/** A frase da definição repete o termo? ("Inflação: a inflação é…"): então pedir o termo entregaria a resposta. */
const repeteTermo = (termo: string, def: string) => { const t = norm(termo); return t.length >= 4 && norm(def).includes(t) }

export function gerarQuestoes(paragrafos: readonly string[], material: { id: string; nome: string }, opcoes: { ano?: number; max?: number } = {}): Geracao {
  const ano = opcoes.ano ?? new Date().getFullYear()
  const max = opcoes.max ?? MAX_QUESTOES
  const bancoId = 'ger-' + (slug(material.nome).slice(0, 24) || 'material')
  const meta = { chave: `${bancoId}-${ano}`, rotulo: `Geradas: ${material.nome} ${ano} · do meu material`, ano, bancoId, bancoNome: `Geradas: ${material.nome}` }
  const { termos, siglas, qas, numeros, lacunas } = fatosDosCartoes(sugerirCartoes(paragrafos).cartoes)
  const descartadas: Descartada[] = []
  const rascunhos: { r: Rascunho; rng: Rng }[] = []
  const semente = (tipo: string, chave: string) => rngDe(`${material.id}|${tipo}|${chave}`)
  const tenta = (tipo: TipoQuestao, chave: string, f: (rng: Rng) => Rascunho | { motivo: string; resumo: string }) => {
    const rng = semente(tipo, chave)
    const r = f(rng)
    if ('motivo' in r) descartadas.push(r); else rascunhos.push({ r, rng })
  }
  const ehTermo = (t: string) => termos.some((x) => norm(x.termo) === norm(t))
  const faltaPool = (resumo: string) => ({ motivo: 'poucas alternativas parecidas no material', resumo })

  for (const t of termos) {
    const direcao = repeteTermo(t.termo, t.def) ? 'definicao' : semente('dir', t.termo)() < 0.5 ? 'definicao' : 'termo'
    if (direcao === 'definicao') {
      tenta('definicao', t.termo, (rng) => {
        const erradas = escolherDistratores(t.def, termos.filter((x) => x !== t).map((x) => x.def), 4, rng)
        return erradas ? { tipo: 'definicao', enunciado: `Segundo o seu material, qual é a definição de "${t.termo}"?`, correta: t.def, erradas, assunto: t.termo, origem: t.origem } : faltaPool(`definição de ${t.termo}`)
      })
    } else {
      tenta('termo', t.termo, (rng) => {
        const erradas = escolherDistratores(t.termo, termos.filter((x) => x !== t).map((x) => x.termo), 4, rng)
        return erradas ? { tipo: 'termo', enunciado: `Segundo o seu material, qual termo corresponde à definição: ${t.def}?`, correta: t.termo, erradas, assunto: t.termo, origem: t.origem } : faltaPool(`termo de "${corta(t.def, 50)}"`)
      })
    }
  }
  for (const s of siglas) {
    if (semente('dir-sigla', s.sigla)() < 0.5) {
      tenta('sigla', s.sigla, (rng) => {
        const erradas = escolherDistratores(s.expansao, siglas.filter((x) => x !== s).map((x) => x.expansao), 4, rng)
        return erradas ? { tipo: 'sigla', enunciado: `No seu material, a sigla ${s.sigla} significa:`, correta: s.expansao, erradas, assunto: s.sigla, origem: s.origem } : faltaPool(`sigla ${s.sigla}`)
      })
    } else {
      tenta('sigla', s.sigla, (rng) => {
        const erradas = escolherDistratores(s.sigla, siglas.filter((x) => x !== s).map((x) => x.sigla), 4, rng)
        return erradas ? { tipo: 'sigla', enunciado: `No seu material, qual é a sigla de "${s.expansao}"?`, correta: s.sigla, erradas, assunto: s.sigla, origem: s.origem } : faltaPool(`sigla de ${s.expansao}`)
      })
    }
  }
  for (const n of numeros) {
    tenta('numero', n.frase, (rng) => {
      const erradas = perturbar(n.resposta, rng)
      return erradas ? { tipo: 'numero', enunciado: `Segundo o seu material, complete: ${n.frase}`, correta: n.resposta, erradas, assunto: n.resposta, origem: n.origem } : { motivo: 'valor que não sei variar', resumo: corta(n.frase, 90) }
    })
  }
  for (const l of lacunas) {
    tenta('lacuna', l.frase, (rng) => {
      const forma = formaDe(l.resposta)
      // a resposta é um NOME (Copom, CVM): as erradas são outros nomes e siglas; se for um termo de definição (Liquidez), as erradas são outros termos
      const pool = [...lacunas.filter((x) => x !== l).map((x) => x.resposta), ...(ehTermo(l.resposta) ? termos.map((x) => x.termo) : siglas.map((x) => x.sigla))].filter((x) => formaDe(x) === forma)
      const erradas = escolherDistratores(l.resposta, pool, 4, rng)
      return erradas ? { tipo: 'lacuna', enunciado: `Segundo o seu material, complete a frase: ${l.frase}`, correta: l.resposta, erradas, assunto: l.resposta, origem: l.origem } : faltaPool(corta(l.frase, 60))
    })
  }
  for (const qa of qas) {
    tenta('pergunta', qa.pergunta, (rng) => {
      const forma = formaDe(qa.resposta) // número pede números parecidos; nome curto pede outros nomes (siglas, termos); frase pede outras frases
      const pool = [...qas.filter((x) => x !== qa).map((x) => x.resposta), ...(forma === 'curta' ? (ehTermo(qa.resposta) ? termos.map((x) => x.termo) : siglas.map((x) => x.sigla)) : [])].filter((x) => formaDe(x) === forma)
      const erradas = forma === 'numero' ? perturbar(qa.resposta, rng) : escolherDistratores(qa.resposta, pool, 4, rng)
      return erradas ? { tipo: 'pergunta', enunciado: qa.pergunta, correta: qa.resposta, erradas, assunto: corta(qa.pergunta, 50), origem: qa.origem } : faltaPool(corta(qa.pergunta, 60))
    })
  }
  // "Assinale a INCORRETA": 4 afirmações do material e uma trocada (o termo de uma com a definição de outra). Precisa de pelo menos 6 definições.
  const comprimento = (t: ParTermo) => t.termo.length + t.def.length
  const aptos = termos.filter((t) => comprimento(t) <= MAX_ALT - 4 && !repeteTermo(t.termo, t.def))
  const quantasIncorretas = Math.min(3, Math.floor(aptos.length / 6))
  for (let k = 0; k < quantasIncorretas; k++) {
    tenta('incorreta', `${k}|${aptos.map((a) => a.termo).join('|')}`, (rng) => {
      const sorteio = [...aptos].map((t) => ({ t, r: rng() })).sort((a, b) => a.r - b.r).slice(0, 5).map((x) => x.t)
      if (sorteio.length < 5) return faltaPool('questão de afirmação incorreta')
      const [a, b, ...verdadeiras] = sorteio
      const falsa = `${a.termo}: ${b.def}`
      const certas = [`${b.termo}: ${b.def}`, ...verdadeiras.map((t) => `${t.termo}: ${t.def}`)]
      return { tipo: 'incorreta', enunciado: 'Segundo o seu material, assinale a alternativa INCORRETA:', correta: falsa, erradas: certas, assunto: 'Afirmações do material', origem: `${a.origem}\n${b.origem}` }
    })
  }

  // fecha cada rascunho (embaralha a certa, confere o tamanho) e numera
  const prontas: { r: Rascunho & { o: Record<Letter, string>; g: Letter } }[] = []
  for (const { r, rng } of rascunhos) {
    const f = fechar(r, rng)
    if (f.ok) prontas.push({ r: f.q }); else descartadas.push({ motivo: f.motivo, resumo: corta(r.enunciado, 90) })
  }
  // se passar do limite, intercala os tipos (para não ficar só com um)
  const porTipo = new Map<TipoQuestao, typeof prontas>()
  for (const p of prontas) porTipo.set(p.r.tipo, [...(porTipo.get(p.r.tipo) ?? []), p])
  const ordenadas: typeof prontas = []
  for (let i = 0; ordenadas.length < prontas.length; i++) for (const l of porTipo.values()) if (l[i]) ordenadas.push(l[i])
  const escolhidas = ordenadas.slice(0, max)
  const questoes: QuestaoGerada[] = escolhidas.map(({ r }, i) => ({
    tipo: r.tipo,
    q: {
      id: idPorConteudo({ enunciado: r.enunciado, alternativas: r.o }), y: ano, s: meta.chave, n: i + 1, m: MATERIA_GERADAS, t: material.nome.slice(0, 60), a: corta(r.assunto, 60),
      e: r.enunciado, b: '', o: r.o, g: r.g, p: null, bp: null, f: 0, ol: 0, ger: 1, fonte: corta(r.origem.replace(/\s+/g, ' ').trim(), MAX_FONTE),
    },
  }))
  return { questoes, fatos: termos.length + siglas.length + numeros.length + lacunas.length + qas.length, descartadas: [...descartadas, ...ordenadas.slice(max).map(({ r }) => ({ motivo: `passou do limite de ${max} questões`, resumo: corta(r.enunciado, 90) }))], meta }
}
