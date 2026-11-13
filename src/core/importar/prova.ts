// Das linhas de uma prova de concurso para as questões. Sem IA: regras para o formato das provas da Cesgranrio (número da questão sozinho na linha,
// alternativas "(A)" a "(E)", matéria em título de letras maiúsculas) e parecidos. Quem não casa com o formato vira AVISO (a tela de prévia mostra e a pessoa corrige),
// nunca uma questão inventada. Puro: sem DOM e sem leitor de PDF.
import type { Letter } from '../types'
import type { Linha } from './layout'

export const LETRAS: Letter[] = ['A', 'B', 'C', 'D', 'E']

/** Pedaço da página que contém (parte de) a questão: serve para recortar a imagem depois. `y` cresce para cima. */
export interface Regiao { pagina: number; coluna: 0 | 1; x0: number; x1: number; yTopo: number; yBase: number }
export interface QuestaoLida {
  numero: number
  materia: string
  bloco: 'B' | 'E' | null
  /** Texto-base (compartilhado por várias questões ou da própria questão), quando foi possível separar. */
  apoio: string
  enunciado: string
  alternativas: Partial<Record<Letter, string>>
  pagina: number
  regioes: Regiao[]
  avisos: string[]
  /** Id da questão calculado sobre o texto como o leitor o entendeu ANTES de uma correção (da IA): corrigir o texto não troca o id, então importar o mesmo arquivo de novo não duplica. */
  idOrigem?: string
}
export interface ProvaLida { questoes: QuestaoLida[]; avisos: string[] }

const TITULOS_IGNORADOS = /^(RASCUNHO|PROVA|GABARITO|CADERNO|INSTRU[ÇC][ÕO]ES|LEIA|ATEN[ÇC][ÃA]O|BOA PROVA|FOLHA|TEXTO\b|QUEST[ÕO]ES?\b|FIM\b)/
const SO_NUMERO = /^(?:QUEST[ÃA]O\s+)?(\d{1,3})\.?$/i
const ALTERNATIVA = /^\(([A-E])\)\s*(.*)$/
const FONTE = /^(Dispon[ií]vel em|Fonte:|Acesso em|Adaptad[oa]\b|Texto adaptado|Elaborad[oa] (pel|por))/i
const SALTO_MAX = 25 // quantas questões podem faltar no meio sem perder o resto (o aviso lista o que faltou)

const soLetrasMaiusculas = (t: string) => t.length >= 5 && t.length <= 70 && /[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ]/.test(t) && t === t.toLocaleUpperCase('pt-BR') && !/\d/.test(t) && !/[.!?]$/.test(t)

/** "LÍNGUA PORTUGUESA" → "Língua Portuguesa" (palavras pequenas em minúscula). */
export function tituloBonito(t: string): string {
  const peq = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'para'])
  return t.toLocaleLowerCase('pt-BR').split(/\s+/).map((p, i) => (i > 0 && peq.has(p) ? p : p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1))).join(' ')
}

/** Junta duas linhas: some a hifenização de fim de linha ("ruí-" + "dos" → "ruídos"); senão separa com espaço. */
export function juntarLinhas(a: string, b: string): string {
  if (!a) return b
  if (/[A-Za-zÀ-ÿ]-$/.test(a) && /^[a-zà-ÿ]/.test(b)) return a.slice(0, -1) + b
  if (/[A-Za-zÀ-ÿ]\s-$/.test(a) && /^[a-zà-ÿ]/.test(b)) return a.slice(0, -2) + b
  return `${a} ${b}`
}
/** Provas com as alternativas na mesma linha ("(A) I, apenas. (B) II, apenas. …"): parte onde começa a próxima letra da sequência. */
function separarNaLinha(c: { alt: Partial<Record<Letter, string>>; atual: Letter | null }) {
  for (;;) {
    const prox = LETRAS[Object.keys(c.alt).length]
    if (!prox || !c.atual) return
    const texto = c.alt[c.atual] ?? ''
    const m = new RegExp(`\\s\\(${prox}\\)\\s*`).exec(texto)
    if (!m) return
    c.alt[c.atual] = texto.slice(0, m.index)
    c.alt[prox] = texto.slice(m.index + m[0].length)
    c.atual = prox
  }
}
const limpa = (t: string) => t.replace(/\s+/g, ' ').trim()

const margens = new WeakMap<readonly Linha[], Map<string, number>>()
/** Margem esquerda de cada página/coluna: onde ficam os números das questões (o texto-base costuma ter recuo). */
function margemDe(linhas: readonly Linha[], l: Linha): number {
  let m = margens.get(linhas)
  if (!m) {
    m = new Map()
    for (const x of linhas) if (x.texto.length >= 12) { const k = `${x.pagina}:${x.coluna}`; m.set(k, Math.min(m.get(k) ?? Infinity, x.x0)) }
    margens.set(linhas, m)
  }
  return m.get(`${l.pagina}:${l.coluna}`) ?? l.x0
}
const naMargem = (linhas: readonly Linha[], l: Linha) => l.x0 <= margemDe(linhas, l) + 6

/**
 * O número sozinho na linha só abre uma questão se (1) está na margem esquerda da coluna (números soltos dentro de tabelas ficam fora) e (2) a próxima
 * "(A)" vem antes de qualquer outro número sozinho NA MARGEM: numeração de linhas do texto (5, 10, 15…) não conta.
 */
export function abreQuestao(linhas: readonly Linha[], i: number): boolean {
  if (!naMargem(linhas, linhas[i])) return false
  for (let j = i + 1; j < Math.min(linhas.length, i + 80); j++) {
    const t = linhas[j].texto
    if (ALTERNATIVA.test(t)) return t.startsWith('(A)')
    if (SO_NUMERO.test(t) && naMargem(linhas, linhas[j])) return false
  }
  return false
}

/** Entre os números que aparecem sozinhos numa linha, acha onde a sequência 1, 2, 3… (ou N, N+1…) vai mais longe: serve para PDFs que começam no meio da prova. */
export function escolherInicio(linhas: readonly Linha[]): number {
  const nums = linhas.map((l, i) => (abreQuestao(linhas, i) ? SO_NUMERO.exec(l.texto) : null)).filter(Boolean).map((m) => Number(m![1]))
  if (!nums.length) return 1
  let melhor = { inicio: 1, cadeia: 0 }
  for (const ini of new Set(nums)) {
    if (ini > 200) continue
    let esperado = ini, cadeia = 0
    for (const n of nums) if (n === esperado) { cadeia++; esperado++ }
    if (cadeia > melhor.cadeia || (cadeia === melhor.cadeia && ini < melhor.inicio)) melhor = { inicio: ini, cadeia }
  }
  return melhor.inicio
}

interface Em { altX: number; numero: number; materia: string; bloco: 'B' | 'E' | null; apoio: string; enun: string; alt: Partial<Record<Letter, string>>; atual: Letter | null; pagina: number; linhas: Linha[] }

export function lerProva(linhas: readonly Linha[], opcoes: { primeira?: number } = {}): ProvaLida {
  const avisos: string[] = []
  const questoes: QuestaoLida[] = []
  let esperado = opcoes.primeira ?? 1
  let cur = null as Em | null
  let materia = '', bloco: 'B' | 'E' | null = null
  let lacuna: string[] = [] // linhas entre o fim de uma questão e o começo da próxima (texto-base ou instruções)
  let apoioAtivo: { texto: string; ate: number } | null = null
  const recuos: number[] = [] // recuo das linhas de continuação das alternativas A–D (para reconhecer as da E)

  const fechar = () => {
    if (!cur) return
    let { enun } = cur
    let apoio = cur.apoio
    // texto-base escrito logo depois do número (ex.: "Disponível em: ... Acesso em ...") antes do comando da questão
    if (!apoio) {
      const partes = enun.split(/(?<=\.|>|\))\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
      let fim = -1
      partes.forEach((p, i) => { if (FONTE.test(p) || /Acesso em: ?\d/.test(p)) fim = i })
      if (fim >= 0 && fim < partes.length - 1) { apoio = partes.slice(0, fim + 1).join(' '); enun = partes.slice(fim + 1).join(' ') }
    }
    const qa: string[] = []
    const alts = Object.keys(cur.alt).length
    if (alts < 5) qa.push(`só ${alts} alternativa(s) encontrada(s)`)
    if (!limpa(enun)) qa.push('enunciado vazio')
    if (/\b(figura|gr[áa]fico|tabela|quadro|imagem|f[óo]rmula)\b/i.test(`${apoio} ${enun}`)) qa.push('menciona figura, gráfico ou tabela: confira a imagem')
    const regioes = regioesDe(cur.linhas)
    questoes.push({ numero: cur.numero, materia: cur.materia, bloco: cur.bloco, apoio: limpa(apoio), enunciado: limpa(enun), alternativas: Object.fromEntries(Object.entries(cur.alt).map(([k, v]) => [k, limpa(v)])), pagina: cur.pagina, regioes, avisos: qa })
    cur = null
  }

  const comecar = (n: number, l: Linha) => {
    fechar()
    // texto-base: o que veio entre as questões. "Questões 3 a 5" no começo vale para todas elas.
    const texto = lacuna.reduce((a, l) => juntarLinhas(a, l), '')
    if (texto) {
      const m = /quest(?:[õo]es|[ãa]o)\s+(?:de\s+)?(\d{1,3})\s*(?:a|à|e|até|ao)\s*(\d{1,3})/i.exec(texto)
      apoioAtivo = { texto, ate: m && Number(m[2]) >= n ? Number(m[2]) : n }
    }
    lacuna = []
    const apoio = apoioAtivo && n <= apoioAtivo.ate ? apoioAtivo.texto : ''
    cur = { altX: 0, numero: n, materia, bloco, apoio, enun: '', alt: {}, atual: null, pagina: l.pagina, linhas: [l] }
    esperado = n + 1
  }

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]
    const t = l.texto
    const num = SO_NUMERO.exec(t)
    const alts = cur ? Object.keys(cur.alt).length : 0
    // começo de questão: só o número esperado, e só depois de a anterior ter ao menos uma alternativa (senão é um número dentro de uma tabela)
    if (num && Number(num[1]) >= esperado && Number(num[1]) <= esperado + SALTO_MAX && (!cur || alts >= 1) && abreQuestao(linhas, i)) { comecar(Number(num[1]), l); continue }

    if (cur) {
      const a = ALTERNATIVA.exec(t)
      const proxima = LETRAS[alts]
      if (a && a[1] === proxima) { cur.atual = proxima; cur.alt[proxima] = a[2]; cur.altX = l.x0; separarNaLinha(cur); cur.linhas.push(l); continue }
      if (cur.atual === null) { cur.enun = juntarLinhas(cur.enun, t); cur.linhas.push(l); continue }
      const ultima = cur.alt[cur.atual] ?? ''
      // depois da alternativa E, o que vem pode ser continuação dela ou já o texto-base/título da próxima parte
      const depoisDaUltima = alts >= 5
      const ehTitulo = soLetrasMaiusculas(t) && !TITULOS_IGNORADOS.test(t)
      // as linhas seguintes de uma alternativa ficam com o recuo das outras alternativas desta prova (≈ 17 pt); texto-base e títulos não
      const recuo = l.x0 - cur.altX
      const recuoTipico = recuos.length ? [...recuos].sort((x, y) => x - y)[Math.floor(recuos.length / 2)] : 17
      const continua = !depoisDaUltima || (Math.abs(recuo - recuoTipico) <= 4 && !ehTitulo) || (/^[a-zà-ÿ,;.)]/.test(t) && Math.abs(recuo) <= 4)
      if (continua) {
        if (!depoisDaUltima && recuo > 3 && recuo < 40) recuos.push(recuo)
        cur.alt[cur.atual] = juntarLinhas(ultima, t); separarNaLinha(cur); cur.linhas.push(l); continue
      }
      fechar()
    }
    // fora de uma questão: título (matéria/bloco) ou texto-base
    if (soLetrasMaiusculas(t) && !TITULOS_IGNORADOS.test(t)) {
      if (/^CONHECIMENTOS B[ÁA]SICOS$/.test(t)) { bloco = 'B'; continue }
      if (/^CONHECIMENTOS ESPEC[ÍI]FICOS$/.test(t)) { bloco = 'E'; continue }
      materia = tituloBonito(t); lacuna = []; apoioAtivo = null; continue
    }
    if (TITULOS_IGNORADOS.test(t) && soLetrasMaiusculas(t)) continue
    lacuna.push(t)
  }
  fechar()

  // numeração: avisa o que falta no meio
  const nums = questoes.map((q) => q.numero)
  const faltam: number[] = []
  if (nums.length) for (let n = nums[0]; n <= nums[nums.length - 1]; n++) if (!nums.includes(n)) faltam.push(n)
  if (faltam.length) avisos.push(`faltam as questões ${faltam.join(', ')}`)
  if (!questoes.length) avisos.push('nenhuma questão encontrada: o PDF pode ser escaneado (só imagem) ou ter um formato que não conheço')
  return { questoes, avisos }
}

/** Uma região por página/coluna que a questão ocupa (para recortar a imagem). */
export function regioesDe(linhas: readonly Linha[]): Regiao[] {
  const por = new Map<string, Regiao>()
  for (const l of linhas) {
    const k = `${l.pagina}:${l.coluna}`
    const r = por.get(k)
    if (!r) por.set(k, { pagina: l.pagina, coluna: l.coluna, x0: l.x0, x1: l.x1, yTopo: l.y, yBase: l.y })
    else { r.x0 = Math.min(r.x0, l.x0); r.x1 = Math.max(r.x1, l.x1); r.yTopo = Math.max(r.yTopo, l.y); r.yBase = Math.min(r.yBase, l.y) }
  }
  return [...por.values()]
}
