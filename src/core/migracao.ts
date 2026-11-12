import type { Letter, Progress, ProgressMap } from './types'

/** id antigo -> id novo; trocas: id antigo -> [gabarito antigo, gabarito novo] (só onde o gabarito mudou). */
export interface MapaIds { ids: Record<string, string>; trocas: Record<string, [Letter, Letter]> }

export interface Migracao { prog: ProgressMap; movidas: number; corrigidas: number }

/**
 * Passa o progresso dos ids antigos para os novos (é seguro rodar de novo: o que já está no id novo não muda).
 * Onde o gabarito foi corrigido, a última resposta é reavaliada: se a letra marcada por último coincide com o gabarito novo,
 * conta como certa (e deixa de contar como certa se só batia com o antigo). As tentativas anteriores a essa não se podem
 * reavaliar porque o app nunca guardou cada resposta; ficam como estavam.
 */
export function migrarProgresso(prog: ProgressMap, mapa: MapaIds): Migracao {
  const out: ProgressMap = {}
  let movidas = 0, corrigidas = 0
  for (const [id, p] of Object.entries(prog)) {
    const novo = mapa.ids[id]
    if (!novo) { out[id] = mescla(out[id], p); continue }
    movidas++
    let q: Progress = { ...p }
    const troca = mapa.trocas[id]
    if (troca && p.last) {
      const [de, para] = troca
      const antes = p.last === de, depois = p.last === para
      q = { ...p, c: Math.min(p.n, Math.max(0, p.c - (antes ? 1 : 0) + (depois ? 1 : 0))), ok: depois }
      corrigidas++
    }
    out[novo] = mescla(out[novo], q)
  }
  return { prog: out, movidas, corrigidas }
}

function mescla(a: Progress | undefined, b: Progress): Progress {
  if (!a) return b
  const recente = (b.t ?? 0) >= (a.t ?? 0) ? b : a
  return { n: a.n + b.n, c: a.c + b.c, ok: recente.ok, last: recente.last, t: recente.t }
}
