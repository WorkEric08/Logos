// Conferência: o progresso e o histórico DERIVADOS dos eventos têm de ser iguais aos que o app guarda e mostra. Enquanto os dois caminhos convivem
// (o progresso atual e o registro de eventos), esta conta avisa se algum deixou de acompanhar o outro. Função pura.
import type { Hist } from '../historico'
import type { ProgressMap } from '../types'

export interface Divergencia { onde: 'progresso' | 'dia' | 'simulados'; chave: string; derivado: string; local: string }

// JSON com as chaves em ordem fixa e sem campos indefinidos: "{n:1}" e "{n:1, last: undefined}" são o mesmo registro.
const norm = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).filter(([, y]) => y !== undefined).sort(([a], [b]) => (a < b ? -1 : 1))) : x))

/** As diferenças entre o que vem dos eventos (`derivado`) e o que o app tem (`local`); lista vazia = iguais. */
export function conferir(derivado: { prog: ProgressMap; hist: Hist }, local: { prog: ProgressMap; hist: Hist }): Divergencia[] {
  const out: Divergencia[] = []
  for (const q of new Set([...Object.keys(derivado.prog), ...Object.keys(local.prog)])) {
    const a = norm(derivado.prog[q]), b = norm(local.prog[q])
    if (a !== b) out.push({ onde: 'progresso', chave: q, derivado: a, local: b })
  }
  for (const d of new Set([...Object.keys(derivado.hist.dias), ...Object.keys(local.hist.dias)])) {
    const a = norm(derivado.hist.dias[d]), b = norm(local.hist.dias[d])
    if (a !== b) out.push({ onde: 'dia', chave: d, derivado: a, local: b })
  }
  const sa = norm(derivado.hist.sims), sb = norm(local.hist.sims)
  if (sa !== sb) out.push({ onde: 'simulados', chave: `${derivado.hist.sims.length} × ${local.hist.sims.length}`, derivado: sa.slice(0, 120), local: sb.slice(0, 120) })
  return out
}
