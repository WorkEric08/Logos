// Organização das provas do Início: Banco → Cargo (Agente Comercial / TI) → provas, com ordem. Puro (sem DOM nem banco).

export type Cargo = 'ac' | 'ti'
export type OrdemProvas = 'novas' | 'antigas' | 'menos-vistas'

export const CARGOS: Record<Cargo, string> = { ac: 'Agente Comercial', ti: 'TI' }
export const ORDENS: Record<OrdemProvas, string> = { novas: 'Mais novas', antigas: 'Mais antigas', 'menos-vistas': 'Menos vistas' }

/** Bancos na ordem em que aparecem. Um banco que não estiver aqui entra no fim, com o nome em maiúsculas. */
export const BANCOS_BB: { id: string; nome: string }[] = [
  { id: 'bb', nome: 'Banco do Brasil' },
  { id: 'caixa', nome: 'Caixa' },
  { id: 'bnb', nome: 'BNB' },
  { id: 'bancodaamazonia', nome: 'Banco da Amazônia' },
  { id: 'banese', nome: 'Banese' },
]

/** Os bancos do espaço ativo (começa com os do BB; store/espacos.ts troca ao mudar de espaço). */
export let BANCOS: { id: string; nome: string }[] = BANCOS_BB
export const definirBancos = (b: { id: string; nome: string }[]) => { BANCOS = b }

export interface InfoProva {
  /** Chave da prova (a mesma de SOURCES e de Question.s). */
  s: string
  banco: string
  cargo: Cargo
  ano: number
  /** Mês, quando a chave o traz (ex.: bb-032015 → 3); senão null. */
  mes: number | null
  rotulo: string
}

/** Lê a chave "<banco>-<ano>", "<banco>-<mm><ano>", "<banco>-rs<mm><ano>" ou o mesmo com "-ti" no fim. */
export function lerChave(s: string, rotulo = s): InfoProva {
  const m = /^(.+?)-(?:rs)?(\d{2})?(\d{4})(-ti)?$/.exec(s)
  if (!m) return { s, banco: s.split('-')[0], cargo: s.endsWith('-ti') ? 'ti' : 'ac', ano: 0, mes: null, rotulo }
  return { s, banco: m[1].replace(/-rs$/, ''), cargo: m[4] ? 'ti' : 'ac', ano: Number(m[3]), mes: m[2] ? Number(m[2]) : null, rotulo }
}

export const descreverProvas = (sources: Record<string, string>): InfoProva[] => Object.entries(sources).map(([s, r]) => lerChave(s, r))

export const nomeDoBanco = (id: string) => BANCOS.find((b) => b.id === id)?.nome ?? id.toUpperCase()

/** Ids dos bancos que têm prova, na ordem de BANCOS (os desconhecidos no fim). */
export function bancosPresentes(l: InfoProva[]): string[] {
  const ids = [...new Set(l.map((p) => p.banco))]
  const pos = (id: string) => { const i = BANCOS.findIndex((b) => b.id === id); return i < 0 ? BANCOS.length : i }
  return ids.sort((a, b) => pos(a) - pos(b) || a.localeCompare(b))
}

export interface ProvaComDados extends InfoProva { n: number; vistas: number }

const data = (p: InfoProva) => p.ano * 100 + (p.mes ?? 0)
const maisNova = (a: InfoProva, b: InfoProva) => data(b) - data(a) || a.rotulo.localeCompare(b.rotulo, 'pt-BR')

/** Ordena sem mexer na lista original. "Menos vistas" = menor % de questões vistas primeiro; empate: mais nova primeiro. */
export function ordenarProvas<T extends ProvaComDados>(l: T[], ordem: OrdemProvas): T[] {
  const c = [...l]
  if (ordem === 'novas') return c.sort(maisNova)
  if (ordem === 'antigas') return c.sort((a, b) => -maisNova(a, b))
  const pc = (p: T) => (p.n ? p.vistas / p.n : 0)
  return c.sort((a, b) => pc(a) - pc(b) || maisNova(a, b))
}
