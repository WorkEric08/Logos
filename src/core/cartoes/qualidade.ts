// Regras de qualidade de um cartão (princípio da informação mínima, de Piotr Wozniak/SuperMemo): um cartão ruim é pior que nenhum, porque se estuda errado.
// Barra (descarta, com o motivo na tela) o que seria inútil ou enganoso; só AVISA do que é discutível. O que a pessoa marcou com a sintaxe explícita
// (`tipo: 'sintaxe'`) nunca é barrado por gosto: vale o que ela escreveu. Puro.
import type { CartaoSugerido } from './tipos'

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const PRONOMES = /^(isso|ele|ela|eles|elas|esse|essa|esses|essas|este|esta|estes|estas|aquele|aquela|aquilo|nisso|disso|tudo|tambem)(?![a-z])/
const FRAGMENTO = /^(e|mas|ou|porem|pois|que|se|porque|ja|entao|assim|logo)\s/
const TIPOS_DE_TERMO = new Set<CartaoSugerido['tipo']>(['definicao', 'titulo', 'verbo'])
const TIPOS_DE_LACUNA = new Set<CartaoSugerido['tipo']>(['lacuna', 'numero', 'lista'])
export const VERSO_LONGO = 450, FRENTE_LONGA = 180, LACUNA_LONGA = 60
/** Rótulos de aviso ("Atenção: …", "Nota: …") não são termos a definir. */
const ROTULO_DE_AVISO = new Set(['atencao', 'nota', 'notas', 'obs', 'observacao', 'observacoes', 'importante', 'dica', 'dicas', 'exemplo', 'exemplos', 'aviso', 'cuidado', 'lembrete', 'veja', 'ver', 'fonte', 'fontes'])
/** Verbos no imperativo ou no infinitivo que abrem uma INSTRUÇÃO ("Fazer um fluxograma:", "Veja a tabela:"), não um termo. */
const INSTRUCAO = /^(?:fazer|veja|ver|vide|confira|conferir|lembre|lembrar|observe|observar|note|notar|atente|considere|considerar|use|usar|siga|seguir|preencher|preencha)\b/i
const TERMINA_EM_LIGACAO = /(?:^|\s)(?:de|da|do|das|dos|para|com|em|e|ou|a|o|que|na|no|por|ao|aos|à|às|pelo|pela)$/i
/** O rótulo da frente é um termo de verdade? (começa com maiúscula, número ou aspas; não é aviso; não termina cortado nem numa ligação; não é longo) */
export function rotuloValido(r: string): boolean {
  const t = r.trim()
  if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“'‘(]/.test(t)) return false // "co para TEA", "nais adaptadas…": sobra de palavra partida
  if (ROTULO_DE_AVISO.has(norm(t))) return false
  if (/-$/.test(t) || TERMINA_EM_LIGACAO.test(t)) return false
  if (INSTRUCAO.test(norm(t)) || /\b[\wÀ-ÿ]+-se\b/i.test(t)) return false // "Fazer um fluxograma", "Deve-se identificar…": uma instrução ou uma frase, não um termo
  return t.split(/\s+/).length <= 8
}

/** O texto é uma lista de nomes próprios (créditos: "Adriana Auzier Loureiro, Ana Márcia Guimarães Alves…")? Quase todas as palavras de conteúdo começam com maiúscula. */
export function ehListaDeNomes(t: string): boolean {
  const palavras = t.split(/[\s,;]+/).filter((w) => w && !/^(?:d[aeo]s?|e|y)$/i.test(w))
  if (palavras.length < 4) return false
  const maiusculas = palavras.filter((w) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(w)).length
  return maiusculas / palavras.length >= 0.8
}

export interface Veredito { descartar?: string; aviso?: string }

export function avaliar(c: CartaoSugerido): Veredito {
  const f = c.f.trim(), v = c.v.trim()
  if (f.length < 2 || !v) return { descartar: 'frente ou verso vazio' }
  if (norm(f) === norm(v)) return { descartar: 'frente igual ao verso' }
  const aviso = v.length > VERSO_LONGO ? `verso longo (${v.length} letras): talvez valha dividir em mais de um cartão` : f.length > FRENTE_LONGA && !TIPOS_DE_LACUNA.has(c.tipo) && c.tipo !== 'pergunta' ? `frente longa (${f.length} letras)` : undefined
  if (c.tipo === 'sintaxe') return aviso ? { aviso } : {}
  if (/[A-Za-zÀ-ÿ]-$/.test(v) || /[A-Za-zÀ-ÿ]-$/.test(f)) return { descartar: 'termina no meio de uma palavra (texto cortado do PDF)' }
  if (!/[A-Za-zÀ-ÿ0-9]/.test(v)) return { descartar: 'o verso não tem conteúdo (linha para preencher)' }
  if (TIPOS_DE_TERMO.has(c.tipo) && ehListaDeNomes(v)) return { descartar: 'o verso é uma lista de nomes de pessoas (créditos), não uma explicação' }
  const termo = norm(f.replace(/^O que (?:é|são|significa)\s+/i, ''))
  if (TIPOS_DE_TERMO.has(c.tipo) && PRONOMES.test(termo)) return { descartar: 'pronome solto na frente (não diz de quê fala)' }
  if (TIPOS_DE_TERMO.has(c.tipo) && FRAGMENTO.test(termo)) return { descartar: 'a frente é um pedaço de frase' }
  if ((c.tipo === 'definicao' || c.tipo === 'titulo') && !rotuloValido(f)) return { descartar: 'a frente não é um termo (aviso, pedaço de frase ou texto cortado)' }
  if (TIPOS_DE_TERMO.has(c.tipo) && /^\s*(?:[•·-]\s*)?https?:\/\//i.test(v)) return { descartar: 'o verso é só um endereço da internet' }
  if (c.tipo === 'lista' && FRAGMENTO.test(norm(f.split('\n')[0]))) return { descartar: 'a lista começa num pedaço de frase (falta o contexto)' }
  if (c.tipo === 'numero' && /^[a-zà-ÿ]/.test(f)) return { descartar: 'a frase começa no meio (texto cortado)' }
  if (TIPOS_DE_LACUNA.has(c.tipo)) {
    const resto = norm(f.replace(/_____/g, ' '))
    const resposta = norm(v)
    if (resposta.length >= 3 && new RegExp(`(^|[^a-z0-9])${resposta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(resto)) return { descartar: 'a resposta já aparece na frente (lacuna óbvia)' }
    if (/:\s*$/.test(v)) return { descartar: 'a lacuna é um rótulo (termina em ":"), não uma resposta' }
    if (v.length > LACUNA_LONGA) return { descartar: 'a lacuna é longa demais (mais de uma ideia)' }
  }
  return aviso ? { aviso } : {}
}
