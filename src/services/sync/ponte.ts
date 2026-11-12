// Ponte entre as telas/estados (store/app.ts) e a sincronização em andamento, sem importar um do outro (evita ciclo).
// Sem conta logada, tudo aqui é "não faz nada": o app funciona igual, só no aparelho.
let apagar: ((id: string) => void) | null = null
export const registrarApagarEvento = (fn: ((id: string) => void) | null) => { apagar = fn }
/** O evento "zerar" foi desfeito aqui: some também da nuvem (senão o outro aparelho o devolveria). */
export const apagarEventoNaNuvem = (id: string) => { try { apagar?.(id) } catch { /* a nuvem é opcional */ } }
