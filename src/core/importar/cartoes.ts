// De texto de estudo (resumos, apostilas, anotações em PDF/TXT/MD) para cartões (frente/verso), SEM IA: só padrões que se reconhecem com segurança.
// O que não casa com nenhum padrão não vira cartão (a tela diz quantos parágrafos ficaram de fora). Puro.
import type { Linha } from './layout'

import { avaliar } from '../cartoes/qualidade'
import { cartoesDeLista, ehIntroducao, ehItemDeLista, itemLimpo, itensValidos, lerEnumeracaoInline } from '../cartoes/enumeracao'
import { lacunaNumerica } from '../cartoes/lacunas'
import { cartoesDeSiglas } from '../cartoes/siglas'
import { lerSintaxe, temSintaxe } from '../cartoes/sintaxe'
import type { CartaoSugerido, Descartado, Sugestoes } from '../cartoes/tipos'

export type { CartaoSugerido, Descartado, Sugestoes, TipoCartao } from '../cartoes/tipos'

const TAM_FRENTE = 300, TAM_VERSO = 1200, MAX = 300
const limpa = (t: string) => t.replace(/\s+/g, ' ').replace(/^[\s•·▪■□●○◦–—*>\-\d.)]+\s+(?=\S)/, '').trim()
const corta = (t: string, n: number) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…')

/** Linhas de um PDF → parágrafos: quebra onde o espaço vertical é maior que o normal, em marcador de lista e em título solto. */
export function linhasParaParagrafos(linhas: readonly Linha[]): string[] {
  const saida: string[] = []
  let atual = ''
  let anterior: Linha | null = null
  const gaps: number[] = []
  for (let i = 1; i < linhas.length; i++) if (linhas[i].pagina === linhas[i - 1].pagina && linhas[i].coluna === linhas[i - 1].coluna) { const d = linhas[i - 1].y - linhas[i].y; if (d > 2 && d < 40) gaps.push(d) }
  const tipico = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length * 0.3)] : 12
  const fecha = () => { if (atual.trim()) saida.push(atual.trim()); atual = '' }
  for (const l of linhas) {
    const quebra = !anterior || l.pagina !== anterior.pagina || l.coluna !== anterior.coluna || anterior.y - l.y > tipico * 1.55 || /^[•·▪■●○◦-]\s/.test(l.texto)
    if (quebra) fecha()
    atual = atual ? (/[A-Za-zÀ-ÿ]-$/.test(atual) && /^[a-zà-ÿ]/.test(l.texto) ? atual.slice(0, -1) + l.texto : `${atual} ${l.texto}`) : l.texto
    anterior = l
  }
  fecha()
  return saida
}

/** Texto puro (TXT/MD) → parágrafos, mantendo os títulos de markdown ("# …") como parágrafos próprios. */
export function textoParaParagrafos(texto: string): string[] {
  const saida: string[] = []
  for (const bloco of texto.replace(/\r/g, '').split(/\n\s*\n/)) {
    let atual: string[] = []
    for (const linha of bloco.split('\n')) {
      if (/^#{1,6}\s/.test(linha) || /^\s*[-*•]\s/.test(linha)) { if (atual.length) saida.push(atual.join(' ')); atual = []; saida.push(linha.trim()); continue }
      atual.push(linha.trim())
    }
    if (atual.length) saida.push(atual.join(' '))
  }
  return saida.map((p) => p.trim()).filter(Boolean)
}

const DEF_DOIS_PONTOS = /^(?:\*\*)?([^:.;?!]{2,70}?)(?:\*\*)?\s*:\s+(.{12,})$/
const DEF_TRACO = /^([^:.;?!–—-]{2,60}?)\s+[–—-]\s+(.{15,})$/
const PERGUNTA = /^(?:P|Pergunta|Q)\s*[:.)]\s*(.+?\?)\s*(?:R|Resposta|A)\s*[:.)]\s*(.+)$/i
const VERBO = /^((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'’-]*)(?:\s+(?:de|da|do|das|dos|e|em|para|a|o)?\s*[\wÀ-ÿ'’-]+){0,5})\s+(é|são|significa|consiste em|refere-se a|define-se como|chama-se|denomina-se)\s+(.{20,})$/

/**
 * Cartões a partir dos parágrafos. A ordem importa (do mais fiel ao mais adivinhado): marcação explícita da pessoa (`::`, `:::`, `==x==`, `{{x}}`, ` ? `) →
 * lista com marcadores → pergunta/resposta → título + parágrafo → enumeração dentro da frase → "termo: definição" → lacuna em negrito → "X é …" → lacuna em número.
 * Siglas ("Banco Central (BACEN)") rendem cartões ALÉM do que o parágrafo já rendeu. Tudo passa pelo filtro de qualidade (`cartoes/qualidade.ts`): o que for barrado
 * volta em `descartados`, com o motivo, em vez de sumir sem explicação.
 */
export function sugerirCartoes(paragrafos: readonly string[]): Sugestoes {
  const cartoes: CartaoSugerido[] = []
  const descartados: Descartado[] = []
  const vistos = new Set<string>()
  let sobraram = 0
  /** Entra se for novo e passar na qualidade. Devolve se entrou. */
  const add = (c: CartaoSugerido): boolean => {
    const f = corta(c.f.trim(), TAM_FRENTE), v = corta(c.v.trim(), TAM_VERSO)
    const k = f.toLowerCase().replace(/\W+/g, '')
    if (!f || !v || vistos.has(k) || cartoes.length >= MAX) return false
    const r = avaliar({ ...c, f, v })
    if (r.descartar) { descartados.push({ f, motivo: r.descartar }); return false }
    vistos.add(k); cartoes.push({ ...c, f, v, ...(r.aviso ? { aviso: r.aviso } : {}) }); return true
  }
  const addTodos = (lista: readonly CartaoSugerido[]) => lista.reduce((n, c) => n + (add(c) ? 1 : 0), 0)

  for (let i = 0; i < paragrafos.length; i++) {
    const bruto = paragrafos[i]
    const p = limpa(bruto.replace(/\*\*/g, '**'))
    if (!p) continue
    let m: RegExpExecArray | null
    // siglas: cartões a mais, sem consumir o parágrafo
    const dasSiglas = addTodos(cartoesDeSiglas(p))
    if (dasSiglas && p.length <= 100) continue // linha de glossário curta ("FGC – Fundo Garantidor de Créditos"): as siglas já disseram tudo
    // 1. marcação explícita da pessoa
    if (temSintaxe(bruto)) { if (addTodos(lerSintaxe(bruto))) continue }
    // 2. lista com marcadores depois de uma introdução ("Os poderes:")
    if (ehIntroducao(p) && !/^#/.test(bruto)) {
      const itens: string[] = []
      for (let j = i + 1; j < paragrafos.length && ehItemDeLista(paragrafos[j]); j++) itens.push(itemLimpo(paragrafos[j]))
      if (itensValidos(itens) && addTodos(cartoesDeLista(p, itens, [bruto, ...paragrafos.slice(i + 1, i + 1 + itens.length)].join('\n')))) { i += itens.length; continue }
    }
    if ((m = PERGUNTA.exec(p))) { if (add({ f: m[1], v: m[2], tipo: 'pergunta', origem: p })) continue }
    if (/^#{1,6}\s/.test(bruto)) {
      // título de markdown + o parágrafo seguinte (se não for outro título ou lista)
      const prox = paragrafos[i + 1]
      const proxEhOutroPadrao = !!prox && (DEF_DOIS_PONTOS.test(limpa(prox)) || DEF_TRACO.test(limpa(prox)) || PERGUNTA.test(limpa(prox)) || temSintaxe(prox) || ehIntroducao(limpa(prox))) // "# Juros" + "Juros simples: …": o parágrafo já é o seu próprio cartão, não a explicação do título
      if (prox && !proxEhOutroPadrao && !/^#{1,6}\s/.test(prox) && !/^\s*[-*•]\s/.test(prox) && limpa(prox).length >= 25) { if (add({ f: p.replace(/^#+\s*/, ''), v: limpa(prox), tipo: 'titulo', origem: p })) { i++; continue } }
      continue
    }
    // 3. enumeração dentro da frase ("Os princípios são: a, b e c.")
    const inline = lerEnumeracaoInline(p)
    if (inline && addTodos(inline)) continue
    if ((m = DEF_DOIS_PONTOS.exec(p)) && !/^https?/i.test(m[1]) && m[1].split(/\s+/).length <= 9 && !/\d{1,2}:\d{2}/.test(p.slice(0, 20))) { if (add({ f: m[1].replace(/\*\*/g, '').trim(), v: m[2].replace(/\*\*/g, ''), tipo: 'definicao', origem: p })) continue }
    if ((m = DEF_TRACO.exec(p)) && m[1].split(/\s+/).length <= 8) { if (add({ f: m[1], v: m[2], tipo: 'definicao', origem: p })) continue }
    const negritos = [...p.matchAll(/\*\*([^*]{2,50})\*\*/g)]
    if (negritos.length === 1 && p.length <= 400 && p.length > 40) {
      const termo = negritos[0][1]
      if (add({ f: p.replace(`**${termo}**`, '_____').replace(/\*\*/g, ''), v: termo, tipo: 'lacuna', origem: p })) continue
    }
    if ((m = VERBO.exec(p)) && !/^(Isso|Ele|Ela|Eles|Elas|Esse|Essa|Este|Esta|Aquele|Aquela|Tudo|Também)\b/.test(m[1])) {
      const frente = m[2] === 'é' ? `O que é ${m[1]}?` : m[2] === 'são' ? `O que são ${m[1]}?` : `${m[1]}: o que ${m[2] === 'chama-se' || m[2] === 'denomina-se' ? 'é' : 'significa'}?`
      if (add({ f: frente, v: `${m[1]} ${m[2]} ${m[3]}`, tipo: 'verbo', origem: p })) continue
    }
    // 4. último recurso: números, datas e valores em lacuna
    const numeros = lacunaNumerica(p)
    if (numeros && addTodos(numeros)) continue
    if (!dasSiglas) sobraram++
  }
  return { cartoes, paragrafos: paragrafos.length, sobraram, descartados }
}
