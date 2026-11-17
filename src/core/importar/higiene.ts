// Higiene do texto de estudo, ANTES de gerar cartões e questões: tira o que não é conteúdo para aprender e só atrapalha (lista de referências bibliográficas, créditos e
// diretoria no fim do documento) e arruma símbolos que o PDF entrega trocados. Puro: quem chama diz à pessoa quantos trechos foram ignorados e por quê (nada some em silêncio).
// Sem isso, um manual científico rendia cartões como "O que significa a sigla SP? → Santos Vilela" (um nome da página da diretoria) e questões com as referências como fonte.

export interface Higiene {
  paragrafos: string[]
  /** Quantos trechos ficaram de fora. */
  ignorados: number
  /** O que foi tirado, em palavras, para a tela dizer ("lista de referências bibliográficas (46 trechos)"). */
  motivos: string[]
}

const UF = /\((?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\)/g
/** Créditos e diretorias listam muitos nomes com o estado entre parênteses: "Maria Souza (SP) João Lima (RJ)…". Texto corrido quase nunca tem 6 numa mesma passagem; com 3 a 5 só vale se quase tudo for nome próprio. */
const MIN_UF = 6, MIN_UF_DE_NOMES = 3
/** Pistas de uma referência bibliográfica; duas bastam. */
const PISTAS_REFERENCIA: readonly RegExp[] = [
  /\bet al\b\.?/i,
  /\b(?:19|20)\d{2};\s?\d+(?:\(\d+\))?\s?:\s?[\dA-Za-z–-]+/, // "2016;57(3):271–92"
  /\[(?:cited|citado|Internet)\b/i,
  /\bAvailable (?:from|at)\b|\bDispon[ií]vel em\b/i,
  /\bdoi:?\s?10\.\d{3,}/i,
  /\bhttps?:\/\/\S+/i,
  /;\s*(?:19|20)\d{2}\b/, // "Barueri, SP: Manole; 2015" (editora; ano)
  /\bIn:\s/, // capítulo de livro
  /\b(?:editors?|organizadores?|org\.|eds?\.)(?=[\s,.)])/i,
  /\b\d{2,4}\s?p\.(?:\s|$)/, // "848 p."
  /^\d{1,3}\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'’-]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'’-]+)?\s+[A-Z]{1,3}[,.]/, // "12. Bailey A," / "46. Klin A,"
]

export const ehReferencia = (p: string): boolean => PISTAS_REFERENCIA.filter((r) => r.test(p)).length >= 2
/** Parte das palavras de conteúdo que começa com maiúscula (nomes próprios). */
const parteMaiuscula = (p: string) => { const w = p.split(/[\s,;()]+/).filter((x) => x && !/^(?:d[aeo]s?|e|y)$/i.test(x)); return w.length ? w.filter((x) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(x)).length / w.length : 0 }
/** Um crédito de uma pessoa só: "Paulo Cesar Koch Nogueira (SP)" (o parágrafo inteiro é um nome seguido do estado). */
const NOME_COM_UF = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ.'’-]*(?:\s+(?:d[aeo]s?\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ.'’-]*){1,5}\s+\((?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\)$/
export const ehCredito = (p: string): boolean => {
  const n = (p.match(UF) ?? []).length
  return n >= MIN_UF || (n >= MIN_UF_DE_NOMES && parteMaiuscula(p) >= 0.55) || NOME_COM_UF.test(p.trim())
}
/** Uma linha curta e solta ("Membros:", "Coordenadores:", "PEDIATRIA E HUMANIDADE") no meio de créditos: sozinha não parece crédito, mas é do mesmo bloco. */
const ehLinhaCurta = (p: string) => p.length <= 70 && !/[.!?]$/.test(p.trim())

/**
 * "Childhood Autism Rating Scale (CARS) É a escala mais antiga…": o título de uma seção (nome + sigla entre parênteses) que o PDF deixou colado ao primeiro parágrafo vira um
 * parágrafo à parte, para as frases dele terem o título como assunto (e não começarem sem dizer de quê falam).
 */
const TITULO_COM_SIGLA = /^((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'’-]*\s+){1,7}\([A-Z][A-Z0-9/-]{1,9}\))\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/
export function separarTituloComSigla(p: string): string[] {
  const m = TITULO_COM_SIGLA.exec(p)
  return m && p.length > m[0].length + 20 ? [m[1], p.slice(m[0].length)] : [p]
}

/** A seta ou o marcador que o PDF entrega como "Æ" (fonte de símbolos) é um marcador de lista: vira "•". */
const arrumarSimbolos = (p: string) => p.replace(/^[ÆÅ]\s+/, '• ').replace(/\s[ÆÅ]\s/g, ' • ').replace(/\s*(?:https?:\/\/|www\.)\S+/gi, ' ').replace(/\s{2,}/g, ' ').trim() // (endereços da internet não servem de frente nem de verso)

/**
 * Tira do texto o que não é para estudar: a lista de referências e os créditos no fim, e qualquer trecho solto que seja só isso. O fim do documento é cortado de uma vez quando
 * 85 % ou mais do que sobra nele (pelo menos 4 trechos, na metade final) é referência ou crédito: assim títulos e linhas de apoio dessa parte (que sozinhos não parecem
 * referência) também saem.
 */
export function limparParagrafos(paragrafos: readonly string[]): Higiene {
  const lista = paragrafos.map(arrumarSimbolos)
  const n = lista.length
  const tipo = lista.map((p) => (ehReferencia(p) ? 'ref' : ehCredito(p) ? 'cred' : ''))
  // as linhas curtas coladas a créditos ou referências (títulos e rótulos do mesmo bloco) acompanham a vizinhança
  for (let volta = 0; volta < 3; volta++) for (let i = 0; i < n; i++) if (!tipo[i] && ehLinhaCurta(lista[i]) && (tipo[i - 1] || tipo[i + 1])) tipo[i] = tipo[i - 1] || tipo[i + 1]
  // o corte do fim: o menor k (na metade final) a partir do qual quase tudo é referência ou crédito
  let corte = n
  let ruins = 0
  for (let k = n - 1; k >= Math.floor(n / 2); k--) {
    if (tipo[k]) ruins++
    if (n - k >= 4 && ruins / (n - k) >= 0.85 && tipo[k]) corte = k
  }
  const fora = lista.map((_, i) => i >= corte || !!tipo[i])
  const out = lista.filter((_, i) => !fora[i]).flatMap(separarTituloComSigla)
  const refs = lista.filter((_, i) => fora[i] && (tipo[i] === 'ref' || (i >= corte && tipo[i] !== 'cred'))).length
  const creds = lista.filter((_, i) => fora[i] && tipo[i] === 'cred').length
  const outros = lista.filter((_, i) => fora[i]).length - refs - creds
  const motivos: string[] = []
  if (refs + outros) motivos.push(`lista de referências bibliográficas e fim do documento (${refs + outros} trechos)`)
  if (creds) motivos.push(`créditos e diretoria (${creds} trechos)`)
  return { paragrafos: out, ignorados: n - out.length, motivos }
}
