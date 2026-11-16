// Alternativas erradas (distratores) para as questões geradas do material (F4). Puro e determinístico (o sorteio vem de um gerador por parâmetro: o mesmo material
// gera sempre as mesmas questões, com os mesmos ids, e gerar de novo não duplica).
//
// Regras (o que faz uma alternativa errada ser BOA): do mesmo tipo da certa (outro termo, outra sigla, outra definição do próprio material), de tamanho parecido
// (a certa nunca se destaca pelo tamanho), nunca igual nem "quase igual" à certa (duas alternativas certas = questão ruim) e sem repetir entre si.
import type { Rng } from '../weights'

export const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** A forma de uma resposta: número ("45 dias", "R$ 250 mil"), nome curto ("Selic", "CMN", "Risco de crédito") ou frase. Alternativas erradas têm de ter a mesma forma da certa. */
export type Forma = 'numero' | 'curta' | 'longa'
export function formaDe(t: string): Forma {
  const s = t.trim()
  if (/^(R\$\s?)?\d/.test(s)) return 'numero'
  return s.split(/\s+/).length <= 3 && s.length <= 30 ? 'curta' : 'longa'
}

/** Palavras de conteúdo em comum / palavras do menor texto (0 a 1). */
export function semelhanca(a: string, b: string): number {
  const pa = new Set(norm(a).split(' ').filter((p) => p.length > 2)), pb = new Set(norm(b).split(' ').filter((p) => p.length > 2))
  if (!pa.size || !pb.size) return norm(a) === norm(b) ? 1 : 0
  let comum = 0
  for (const p of pa) if (pb.has(p)) comum++
  return comum / Math.min(pa.size, pb.size)
}

/** O candidato pode ser alternativa errada desta certa? (diferente, não contido, não quase igual) */
export function serveComoErrada(certa: string, candidato: string): boolean {
  const c = norm(certa), d = norm(candidato)
  if (!d || c === d || c.includes(d) || d.includes(c)) return false
  return semelhanca(certa, candidato) < 0.8
}

/** Gerador de números repetível a partir de um texto (mulberry32 sobre um hash FNV-1a). */
export function rngDe(semente: string): Rng {
  let h = 0x811c9dc5
  for (let i = 0; i < semente.length; i++) h = Math.imul(h ^ semente.charCodeAt(i), 0x01000193) >>> 0
  let a = h || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Escolhe `n` alternativas erradas entre os candidatos: as de tamanho mais parecido com o da certa (janela dos n+2 mais próximos), sorteadas dali. Null se não houver
 * `n` candidatos que sirvam (o chamador então não gera a questão, em vez de inventar uma alternativa absurda).
 */
export function escolherDistratores(certa: string, candidatos: readonly string[], n: number, rng: Rng): string[] | null {
  const vistos = new Set<string>()
  const bons: string[] = []
  for (const c of candidatos) {
    const k = norm(c)
    if (vistos.has(k) || !serveComoErrada(certa, c)) continue
    vistos.add(k)
    bons.push(c)
  }
  if (bons.length < n) return null
  const janela = bons.map((c, i) => ({ c, i, d: Math.abs(c.length - certa.length) })).sort((x, y) => x.d - y.d || x.i - y.i).slice(0, Math.min(bons.length, n + 2))
  // sorteio sem repetição dentro da janela
  const saida: string[] = []
  const resto = janela.map((x) => x.c)
  while (saida.length < n) saida.push(resto.splice(Math.floor(rng() * resto.length), 1)[0])
  // as escolhidas são muito parecidas entre si? (evita três variações da mesma frase)
  for (let i = 0; i < saida.length; i++) for (let j = i + 1; j < saida.length; j++) if (semelhanca(saida[i], saida[j]) >= 0.9) return null
  return saida
}

/** A certa se destaca pelo tamanho? (mais de 1,8 vez a maior errada, ou menos de 0,35 da menor, quando as alternativas são frases) */
export function destacaPeloTamanho(certa: string, erradas: readonly string[]): boolean {
  const todas = [...erradas.map((e) => e.length)]
  const maior = Math.max(...todas), menor = Math.min(...todas)
  if (Math.max(certa.length, maior) < 24) return false // palavras curtas: tamanho não entrega nada
  return certa.length > maior * 1.8 || certa.length < menor * 0.35 && certa.length < 40
}
