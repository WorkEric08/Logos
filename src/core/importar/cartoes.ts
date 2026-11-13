// De texto de estudo (resumos, apostilas, anotações em PDF/TXT/MD) para cartões (frente/verso), SEM IA: só padrões que se reconhecem com segurança.
// O que não casa com nenhum padrão não vira cartão (a tela diz quantos parágrafos ficaram de fora). Puro.
import type { Linha } from './layout'

export type TipoCartao = 'definicao' | 'pergunta' | 'titulo' | 'verbo' | 'lacuna'
export interface CartaoSugerido { f: string; v: string; tipo: TipoCartao; origem: string }
export interface Sugestoes { cartoes: CartaoSugerido[]; paragrafos: number; sobraram: number }

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

export function sugerirCartoes(paragrafos: readonly string[]): Sugestoes {
  const cartoes: CartaoSugerido[] = []
  const vistos = new Set<string>()
  let sobraram = 0
  const add = (c: CartaoSugerido) => {
    const f = corta(c.f.trim(), TAM_FRENTE), v = corta(c.v.trim(), TAM_VERSO)
    const k = f.toLowerCase().replace(/\W+/g, '')
    if (!f || !v || vistos.has(k) || cartoes.length >= MAX) return false
    vistos.add(k); cartoes.push({ ...c, f, v }); return true
  }
  for (let i = 0; i < paragrafos.length; i++) {
    const p = limpa(paragrafos[i].replace(/\*\*/g, '**'))
    if (!p) continue
    let m: RegExpExecArray | null
    if ((m = PERGUNTA.exec(p))) { if (add({ f: m[1], v: m[2], tipo: 'pergunta', origem: p })) continue }
    if (/^#{1,6}\s/.test(paragrafos[i])) {
      // título de markdown + o parágrafo seguinte (se não for outro título ou lista)
      const prox = paragrafos[i + 1]
      if (prox && !/^#{1,6}\s/.test(prox) && !/^\s*[-*•]\s/.test(prox) && limpa(prox).length >= 25) { if (add({ f: p.replace(/^#+\s*/, ''), v: limpa(prox), tipo: 'titulo', origem: p })) { i++; continue } }
      continue
    }
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
    sobraram++
  }
  return { cartoes, paragrafos: paragrafos.length, sobraram }
}
