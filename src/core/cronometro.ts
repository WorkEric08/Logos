// Cronômetro do simulado: corre escondido (nada aparece na tela da prova) e o tempo só aparece no resultado e no histórico.
// Conta só o tempo com o app à vista: se o aparelho bloqueia a tela ou o app vai para segundo plano, o relógio pausa.
export interface Cron { acum: number; desde: number | null } // acum = ms já contados; desde = quando voltou a correr (null = pausado)

export const iniciarCron = (agora: number): Cron => ({ acum: 0, desde: agora })
export const pausarCron = (c: Cron, agora: number): Cron => (c.desde === null ? c : { acum: c.acum + Math.max(0, agora - c.desde), desde: null })
export const retomarCron = (c: Cron, agora: number): Cron => (c.desde === null ? { acum: c.acum, desde: agora } : c)
/** Milissegundos contados até `agora`. */
export const decorrido = (c: Cron, agora: number): number => c.acum + (c.desde === null ? 0 : Math.max(0, agora - c.desde))

/** "1 h 05 min 09 s", "12 min 05 s" ou "45 s". */
export function formatarDuracao(seg: number): string {
  const t = Math.max(0, Math.round(seg)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  const p2 = (n: number) => String(n).padStart(2, '0')
  return h ? `${h} h ${p2(m)} min ${p2(s)} s` : m ? `${m} min ${p2(s)} s` : `${s} s`
}
