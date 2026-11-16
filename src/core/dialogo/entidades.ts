// As "entidades" da fala: o que a pessoa disse ALÉM do que quer fazer (de que matéria, quantas questões, de qual prova, "essa prova", que espaço, que nome).
// Sem IA: compara palavras pelo radical (core/busca/radical.ts) com o que existe no espaço ativo (o `Contexto`). Puro: sem DOM, banco nem estado.
import { radical } from '../busca/radical'
import { PALAVRAS_VAZIAS, palavras, semAcento } from '../busca/texto'

export interface CtxMateria { nome: string; curto: string }
export interface CtxProva { chave: string; rotulo: string }
export interface CtxEspaco { id: string; nome: string }
/** O que o assistente sabe do momento: o que existe no espaço ativo e o que acabou de acontecer na conversa. */
export interface Contexto {
  materias: CtxMateria[]
  provas: CtxProva[]
  espacos: CtxEspaco[]
  espacoAtivo: string
  /** O espaço tem regras de edital (simulado de verdade com nota e aprovação)? */
  temRegras: boolean
  /** A última prova importada na conversa ("dessa prova"). */
  ultimaProva?: CtxProva
}

export interface Entidades {
  /** Nome exato da matéria no espaço. */
  materia?: string
  quantidade?: number
  /** Provas citadas ("bb 2021"); mais de uma quando o nome serve para várias ("bb 2015" = março e outubro). */
  provas?: CtxProva[]
  espaco?: CtxEspaco
  /** "todas as matérias", "qualquer", "geral". */
  todas?: boolean
  tempo?: 'hoje' | 'semana'
  /** Nome de um espaço novo ("criar espaço Direito Penal"). */
  nome?: string
}

const NUMEROS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
}
/** Palavras que, antes de um número, mostram que ele NÃO é uma quantidade de questões ("questão 12", "lei 8", "artigo 5"). */
const NUMERO_DE_OUTRA_COISA = new Set(['questao', 'lei', 'art', 'artigo', 'numero', 'n', 'item', 'pagina', 'p'])
/** Palavras genéricas de nomes de matéria: sozinhas não identificam a matéria. */
const GENERICAS = new Set(['lingua', 'conhecimentos', 'conhecimento', 'nocoes', 'nocao', 'nos', 'dos', 'das'])

const rad = (p: string) => radical(p.toLowerCase())
const sig = (t: string): string[] => palavras(t, true).filter((p) => !PALAVRAS_VAZIAS.has(semAcento(p)) && !GENERICAS.has(semAcento(p)) && p.length >= 3).map(rad)

/** A matéria do espaço que a fala cita (a mais específica). Palavra que existe em só uma matéria já basta; palavra repartida ("financeiro") só junto com as outras. */
export function acharMateria(texto: string, materias: readonly CtxMateria[]): string | undefined {
  const falados = new Set(palavras(texto, true).map(rad))
  const palavrasDe = materias.map((m) => ({ m, p: [...new Set([...sig(m.nome), ...sig(m.curto)])] }))
  const frequencia = new Map<string, number>()
  for (const { p } of palavrasDe) for (const w of p) frequencia.set(w, (frequencia.get(w) ?? 0) + 1)
  let melhor: { nome: string; pontos: number } | undefined
  for (const { m, p } of palavrasDe) {
    const nomeDaMateria = sig(m.nome)
    const todasFaladas = nomeDaMateria.length > 0 && nomeDaMateria.every((w) => falados.has(w))
    const unicaFalada = nomeDaMateria.some((w) => falados.has(w) && frequencia.get(w) === 1)
    const curtoFalado = sig(m.curto).length > 0 && sig(m.curto).every((w) => falados.has(w))
    if (!todasFaladas && !unicaFalada && !curtoFalado) continue
    const pontos = p.filter((w) => falados.has(w)).length * 10 + nomeDaMateria.length
    if (!melhor || pontos > melhor.pontos) melhor = { nome: m.nome, pontos }
  }
  return melhor?.nome
}

/** Quantidade de questões dita: "20 questões", "de 15", "vinte questões". Ignora ano, número de questão/lei e o que faz parte do nome de uma prova. */
export function acharQuantidade(texto: string, ignorar: ReadonlySet<string> = new Set()): number | undefined {
  const ps = palavras(texto)
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i], antes = ps[i - 1] ?? '', depois = ps[i + 1] ?? ''
    if (ignorar.has(p) || NUMERO_DE_OUTRA_COISA.has(antes)) continue
    if (/^\d{1,3}$/.test(p)) { const n = Number(p); if (n >= 1 && n <= 200) return n; continue }
    const n = NUMEROS[p]
    // número por extenso só vale com "questões" depois ou "de/com/só" antes ("um" e "uma" soltos não são quantidade)
    if (n && (/^(questoes|questao|perguntas|itens)$/.test(depois) || ['de', 'com', 'so', 'apenas', 'somente'].includes(antes)) && !['um', 'uma'].includes(p)) return n
  }
  return undefined
}

/**
 * As provas citadas ("bb 2021", "caixa 2024", "banco da amazônia 2018"): o nome do banco e o ano têm de aparecer. O mês ("03/2015") só conta se vier escrito junto do ano
 * ("10/2015"): um "10" solto costuma ser a quantidade. Prova de TI só entra se a pessoa disser "TI" ou "tecnologia". Vale a mais específica ("caixa rs 2024" > "caixa 2024").
 */
export function acharProvas(texto: string, provas: readonly CtxProva[]): CtxProva[] {
  const falados = new Set(palavras(texto, true).map(rad))
  const mesDito = /\b(\d{1,2})\s*[/-]\s*(\d{4})\b/.exec(semAcento(texto))?.[1]?.replace(/^0/, '')
  const achadas: { p: CtxProva; n: number }[] = []
  for (const p of provas) {
    const ts = palavras(p.rotulo.split(' · ')[0], true).map(rad) // "BB 03/2015" → bb, 03, 2015
    const ano = ts.find((t) => /^\d{4}$/.test(t))
    if (!ano) continue
    const letras = ts.filter((t) => /\D/.test(t))
    const mes = ts.find((t) => /^\d{1,2}$/.test(t))?.replace(/^0/, '')
    if (!falados.has(ano) || !letras.every((t) => falados.has(t))) continue
    if (mes && mesDito && mes !== mesDito) continue
    achadas.push({ p, n: letras.length })
  }
  if (!achadas.length) return []
  const queroTI = /\b(ti|tecnologia)\b/.test(semAcento(texto))
  const maisEspecifico = Math.max(...achadas.map((a) => a.n))
  const ehTI = (p: CtxProva) => /\(TI\)\s*$/.test(p.rotulo)
  const nivel = achadas.filter((a) => a.n === maisEspecifico)
  // pediu TI: só as de TI (se houver); não pediu: nunca as de TI
  return (queroTI && nivel.some((a) => ehTI(a.p)) ? nivel.filter((a) => ehTI(a.p)) : nivel.filter((a) => !ehTI(a.p))).map((a) => a.p)
}

const REFERE_ULTIMA = /\b(essa|esta|dessa|desta|nessa|nesta|ultima|ultimo|acabei de importar|importada|que importei)\b/

/** Tudo o que a fala traz além do pedido. */
export function extrairEntidades(bruto: string, ctx: Contexto): Entidades {
  const sem = semAcento(bruto).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim()
  const e: Entidades = {}
  const materia = acharMateria(bruto, ctx.materias)
  if (materia) e.materia = materia
  let provas = acharProvas(bruto, ctx.provas)
  if (!provas.length && ctx.ultimaProva && REFERE_ULTIMA.test(sem) && /\bprova\b/.test(sem)) provas = [ctx.ultimaProva]
  if (provas.length) e.provas = provas
  const usados = new Set(provas.flatMap((p) => palavras(p.rotulo.split(' · ')[0]).filter((t) => /^\d+$/.test(t))))
  const q = acharQuantidade(bruto, usados)
  if (q) e.quantidade = q
  if (/\b(todas|todos|qualquer|geral|misturad[oa]s?|tudo)\b/.test(sem)) e.todas = true
  if (/\bhoje\b/.test(sem)) e.tempo = 'hoje'; else if (/\bsemana\b/.test(sem)) e.tempo = 'semana'
  // espaço citado pelo nome (todas as palavras significativas do nome aparecem)
  const falados = new Set(palavras(bruto, true).map(rad))
  for (const sp of ctx.espacos) { const w = sig(sp.nome); if (w.length && w.every((x) => falados.has(x))) { e.espaco = sp; break } }
  // nome novo: o que vem depois de "espaço" (ou "chamado")
  const nome = /(?:espa[cç]o|chamad[oa]|de nome|nome)\s+(?:novo\s+|nova\s+|chamad[oa]\s+|de nome\s+)?["“']?([^"”'?!.\n]{2,40}?)["”']?\s*$/i.exec(bruto.trim())
  if (nome) {
    const limpo = nome[1].trim()
    const sem2 = semAcento(limpo)
    if (limpo && !/^(novo|nova|vazio|vazia|com|as|os|meu|minha|um|uma)\b/.test(sem2) && !PALAVRAS_VAZIAS.has(sem2) && !(e.espaco && semAcento(e.espaco.nome) === sem2)) e.nome = limpo
  }
  return e
}
