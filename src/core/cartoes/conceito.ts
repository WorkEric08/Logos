// "X é …" como conceito: quando uma frase do material é de fato a definição de algo e vira o cartão "O que é X?". Puro.
// Medido num manual científico real: sem estas regras saíam cartões como "O que é O TEA?" (com o verso sendo o parágrafo inteiro de 900 letras), "O que é A avaliação formal
// do Desenvolvimento Neuropsicomotor?" (a frase diz que ela "é fundamental", o que não define nada) e "O que são Existe uma variedade de testes que?" (sujeito sem sentido).

const MAI = 'A-ZÁÉÍÓÚÂÊÔÃÕÇ'
const VERBO = /^((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'’-]*)(?:\s+(?:de|da|do|das|dos|e|em|para|a|o)?\s*[\wÀ-ÿ'’-]+){0,5})\s+(é|são|significa|consiste em|refere-se a|define-se como|chama-se|denomina-se)\s+(.{20,})$/
const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palavras que abrem uma frase comum: não são o assunto de uma definição ("Não é surpreendente…", "Quando é detectado…", "Existe uma variedade…"). */
const ABRE_FRASE = new Set(['nao', 'quando', 'se', 'como', 'mas', 'porem', 'portanto', 'assim', 'existe', 'existem', 'ha', 'foi', 'sao', 'segundo', 'para', 'em', 'com', 'por', 'sem',
  'alem', 'tambem', 'contudo', 'entretanto', 'dessa', 'desse', 'nesse', 'nessa', 'neste', 'nesta', 'isso', 'isto', 'ele', 'ela', 'eles', 'elas', 'esse', 'essa', 'este', 'esta', 'aquele', 'aquela',
  'tudo', 'cada', 'todo', 'toda', 'todos', 'todas', 'muitos', 'muitas', 'alguns', 'algumas', 'outros', 'outras', 'quanto', 'onde', 'enquanto', 'embora', 'apesar', 'dado', 'diante'])
/** Palavras que, dentro do "assunto", mostram que é um pedaço de frase e não um nome. */
const NAO_E_NOME = new Set(['principais', 'seguintes', 'demais', 'mesmos', 'mesmas', 'referidos', 'citados', 'que', 'se', 'nao', 'quando', 'como', 'onde', 'porque', 'mas', 'existe', 'ha', 'foi', 'tem', 'tem', 'pode', 'podem', 'deve', 'devem', 'ser', 'estao', 'esta', 'sera', 'seria'])
/** O que vem depois de "é/são" numa definição de verdade: um nome ("um/uma/o/a…"), não um adjetivo ou um particípio ("é fundamental", "é causado por"). */
const COMECO_DE_DEFINICAO = /^(?:um|uma|uns|umas|o|a|os|as|aquele|aquela|aquilo|todo|toda|qualquer)\s/i

/** Primeira frase de um trecho (corta em ". " seguido de maiúscula, sem cortar em abreviações como "n.", "ex.", "Dr."). */
export function primeiraFrase(t: string): string {
  const re = new RegExp(`([.!?])\\s+(?=[${MAI}])`, 'g')
  for (const m of t.matchAll(re)) {
    const antes = t.slice(0, m.index! + 1)
    const ultima = /(\S+)$/.exec(antes)?.[1] ?? ''
    if (/^(?:n|p|ex|etc|Dr|Dra|Sr|Sra|vs|cap|fig|art|inc|prof|av|pág|vol)\.$/i.test(ultima) || /^\w\.$/.test(ultima)) continue
    return antes.trim()
  }
  return t.trim()
}

export interface Conceito { sujeito: string; frente: string; verso: string }

/**
 * "A inflação é o aumento geral dos preços…" → frente "O que é a inflação?", verso "A inflação é o aumento geral dos preços." (só a primeira frase).
 * Null se a frase não for uma definição: sujeito que é pedaço de frase, ou "é" seguido de adjetivo/particípio.
 */
export function lerConceito(p: string): Conceito | null {
  const m = VERBO.exec(p)
  if (!m) return null
  const [, sujeitoBruto, verbo, resto] = m
  const art = /^(O|A|Os|As|Um|Uma)\s+(.+)$/.exec(sujeitoBruto)
  const nucleo = art ? art[2] : sujeitoBruto
  const palavras = nucleo.split(/\s+/)
  if (palavras.length > 5) return null
  if (ABRE_FRASE.has(semAcento(palavras[0].replace(/[^\wÀ-ÿ]/g, '')))) return null
  if (palavras.some((w) => NAO_E_NOME.has(semAcento(w.replace(/[^\wÀ-ÿ]/g, ''))))) return null
  if ((verbo === 'é' || verbo === 'são') && !COMECO_DE_DEFINICAO.test(resto)) return null
  const sujeito = art ? `${art[1].toLowerCase()} ${art[2]}` : sujeitoBruto
  const frente = verbo === 'é' ? `O que é ${sujeito}?` : verbo === 'são' ? `O que são ${sujeito}?` : `${sujeitoBruto}: o que ${verbo === 'chama-se' || verbo === 'denomina-se' ? 'é' : 'significa'}?`
  return { sujeito, frente, verso: primeiraFrase(`${sujeitoBruto} ${verbo} ${resto}`) }
}
