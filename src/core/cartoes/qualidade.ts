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

export interface Veredito { descartar?: string; aviso?: string }

export function avaliar(c: CartaoSugerido): Veredito {
  const f = c.f.trim(), v = c.v.trim()
  if (f.length < 2 || !v) return { descartar: 'frente ou verso vazio' }
  if (norm(f) === norm(v)) return { descartar: 'frente igual ao verso' }
  const aviso = v.length > VERSO_LONGO ? `verso longo (${v.length} letras): talvez valha dividir em mais de um cartão` : f.length > FRENTE_LONGA && !TIPOS_DE_LACUNA.has(c.tipo) && c.tipo !== 'pergunta' ? `frente longa (${f.length} letras)` : undefined
  if (c.tipo === 'sintaxe') return aviso ? { aviso } : {}
  const termo = norm(f.replace(/^O que (?:é|são|significa)\s+/i, ''))
  if (TIPOS_DE_TERMO.has(c.tipo) && PRONOMES.test(termo)) return { descartar: 'pronome solto na frente (não diz de quê fala)' }
  if (TIPOS_DE_TERMO.has(c.tipo) && FRAGMENTO.test(termo)) return { descartar: 'a frente é um pedaço de frase' }
  if (TIPOS_DE_LACUNA.has(c.tipo)) {
    const resto = norm(f.replace(/_____/g, ' '))
    const resposta = norm(v)
    if (resposta.length >= 3 && new RegExp(`(^|[^a-z0-9])${resposta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(resto)) return { descartar: 'a resposta já aparece na frente (lacuna óbvia)' }
    if (/:\s*$/.test(v)) return { descartar: 'a lacuna é um rótulo (termina em ":"), não uma resposta' }
    if (v.length > LACUNA_LONGA) return { descartar: 'a lacuna é longa demais (mais de uma ideia)' }
  }
  return aviso ? { aviso } : {}
}
