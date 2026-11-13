// Como a pessoa "fala" com o assistente, sem IA: um entendedor de comandos digitados. Tira acento e maiúscula, aceita erro de digitação de uma letra e
// pontua palavras-chave de cada ação. Se uma ação ganha com folga, é ela; se duas empatam, o assistente PERGUNTA qual; se nenhuma pontua, diz que não entendeu
// e oferece as sugestões. Puro: sem DOM nem estado (o fluxo está em store/assistente.ts). O desenho da conversa está em docs/assistente-conversa.md.
import type { IdAcao } from './assistente'

export type Intencao =
  | { tipo: 'acao'; id: IdAcao }
  | { tipo: 'ajuda' }
  | { tipo: 'cancelar' }
  | { tipo: 'oi' }
  | { tipo: 'obrigado' }
  | { tipo: 'ambigua'; opcoes: IdAcao[] }
  | { tipo: 'nao-entendi' }
  | { tipo: 'vazio' }

type Alvo = IdAcao | 'ajuda' | 'cancelar' | 'oi' | 'obrigado'

/** Termos (já sem acento, minúsculos) e o peso de cada um. Termo com mais de uma palavra só vale se todas aparecem. */
const TERMOS: Record<Alvo, [string, number][]> = {
  prova: [['importar', 3], ['importa', 3], ['prova', 3], ['provas', 3], ['pdf', 2], ['gabarito', 2], ['gabaritos', 2], ['questoes', 1], ['questao', 1], ['enviar', 1], ['adicionar', 1], ['subir', 1], ['carregar', 1], ['concurso', 1], ['ler prova', 3]],
  cartoes: [['cartao', 3], ['cartoes', 3], ['flashcard', 3], ['flashcards', 3], ['resumo', 2], ['apostila', 2], ['memorizar', 2], ['decorar', 2], ['baralho', 2], ['criar cartoes', 3]],
  simulado: [['simulado', 5], ['simulados', 5], ['simular', 3], ['cronometrado', 2], ['prova simulada', 8], ['treino cronometrado', 3]],
  espaco: [['espaco', 4], ['espacos', 4], ['trocar', 2], ['mudar', 2], ['novo', 1], ['criar', 1], ['apagar', 1], ['ativar', 1], ['meus espacos', 3]],
  resumo: [['tenho', 3], ['quantas', 3], ['quantos', 3], ['status', 2], ['numeros', 2], ['total', 1], ['o que eu ja tenho', 4], ['resumo do espaco', 4]],
  ia: [['ia', 4], ['inteligencia', 3], ['artificial', 3], ['chave', 3], ['claude', 3], ['anthropic', 3], ['reler', 3], ['api', 2]],
  ajuda: [['ajuda', 4], ['ajudar', 3], ['comandos', 4], ['menu', 3], ['opcoes', 3], ['funciona', 2], ['como funciona', 4], ['o que voce sabe fazer', 6], ['o que voce faz', 5], ['fazer', 1], ['sabe', 1]],
  cancelar: [['cancelar', 4], ['voltar', 4], ['desistir', 4], ['sair', 3], ['parar', 3], ['esquece', 3], ['deixa pra la', 4]],
  oi: [['oi', 4], ['ola', 4], ['hello', 3], ['hey', 3], ['bom dia', 4], ['boa tarde', 4], ['boa noite', 4], ['e ai', 3], ['opa', 3]],
  obrigado: [['obrigado', 4], ['obrigada', 4], ['valeu', 4], ['brigadao', 4], ['vlw', 3], ['agradeco', 3]],
}

export const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Distância de edição entre duas palavras curtas (inserção, remoção, troca). */
function distancia(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 1) return 2
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/** A palavra do texto vale pelo termo? Igual; ou, se longa (≥ 5 letras), com uma letra de erro ("importr", "cartaos") ou começando igual ("importa" ~ "importar"). */
function casa(palavra: string, termo: string): boolean {
  if (palavra === termo) return true
  if (termo.length < 5 || palavra.length < 5) return false
  if (distancia(palavra, termo) <= 1) return true
  return Math.min(palavra.length, termo.length) >= 6 && (palavra.startsWith(termo) || termo.startsWith(palavra))
}

/** Nota de uma ação: o termo que mais pesa conta inteiro, o segundo pela metade e os outros por um quarto (variantes da mesma palavra, como "prova" e "provas", não inflam a nota). */
function pontuar(palavras: string[], texto: string, termos: [string, number][]): number {
  const pesos: number[] = []
  for (const [termo, peso] of termos) {
    const partes = termo.split(' ')
    const achou = partes.length === 1 ? palavras.some((p) => casa(p, termo)) : texto.includes(termo) || partes.every((parte) => palavras.some((p) => casa(p, parte)))
    if (achou) pesos.push(peso)
  }
  pesos.sort((a, b) => b - a)
  return pesos.reduce((t, p, i) => t + p * (i === 0 ? 1 : i === 1 ? 0.5 : 0.25), 0)
}

/** Nota de cada alvo para o texto, da maior para a menor (só quem pontuou). */
export function pontuacoes(bruto: string): [string, number][] {
  const texto = semAcento(bruto), palavras = texto.split(' ')
  return (Object.keys(TERMOS) as Alvo[]).map((a) => [a, pontuar(palavras, texto, TERMOS[a])] as [string, number]).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1])
}

export function entender(bruto: string): Intencao {
  const texto = semAcento(bruto)
  if (!texto) return { tipo: 'vazio' }
  const notas = pontuacoes(bruto) as [Alvo, number][]
  if (!notas.length || notas[0][1] < 2) return { tipo: 'nao-entendi' }
  const [melhor, nota] = notas[0]
  const segundo = notas[1]
  // empate de verdade entre duas AÇÕES (cumprimento e agradecimento não entram na disputa): pergunta qual
  const ehAcao = (a: Alvo): a is IdAcao => !['ajuda', 'cancelar', 'oi', 'obrigado'].includes(a)
  if (segundo && segundo[1] >= 2 && segundo[1] >= nota * 0.6 && ehAcao(melhor) && ehAcao(segundo[0])) return { tipo: 'ambigua', opcoes: [melhor, segundo[0]] }
  if (melhor === 'ajuda' || melhor === 'cancelar' || melhor === 'oi' || melhor === 'obrigado') return { tipo: melhor }
  return { tipo: 'acao', id: melhor }
}
