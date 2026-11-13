// "Reler com IA" (opcional, desligado por padrão): manda o recorte da página da questão e o texto lido para a API da Anthropic, com a chave da PRÓPRIA pessoa,
// e recebe uma transcrição estruturada. A chave fica só neste aparelho (localStorage; nunca no Firestore, nunca no backup) e só sai daqui para
// api.anthropic.com. Carrega o SDK sob demanda (import dinâmico). Nada é enviado sem a pessoa tocar em "Reler com IA".
import { ESQUEMA_RESPOSTA, INSTRUCOES, lerResposta, montarPedido, type Sugestao } from '../../core/importar/ia'
import type { QuestaoLida } from '../../core/importar/prova'

export const MODELOS_IA = [
  { id: 'claude-opus-5-5', rotulo: 'Claude Opus 5.5 (mais cuidadoso)' },
  { id: 'claude-sonnet-5-5', rotulo: 'Claude Sonnet 5.5 (mais barato)' },
  { id: 'claude-haiku-5-5', rotulo: 'Claude Haiku 5.5 (o mais barato)' },
] as const
export const MODELO_PADRAO: string = MODELOS_IA[0].id

const K_CHAVE = 'logos_ia_chave', K_MODELO = 'logos_ia_modelo'
const ler = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
export const lerChave = (): string => ler(K_CHAVE) ?? ''
export const gravarChave = (c: string) => { try { if (c.trim()) localStorage.setItem(K_CHAVE, c.trim()); else localStorage.removeItem(K_CHAVE) } catch { /* sem armazenamento: não guarda */ } }
export const lerModelo = (): string => { const m = ler(K_MODELO); return MODELOS_IA.some((x) => x.id === m) ? (m as string) : MODELO_PADRAO }
export const gravarModelo = (m: string) => { try { localStorage.setItem(K_MODELO, m) } catch { /* idem */ } }
export const iaLigada = () => lerChave().length > 20

/** O pedaço do cliente da Anthropic que usamos (injetável nos testes). */
export interface ClienteIA {
  beta: { messages: { create(p: Record<string, unknown>): Promise<{ stop_reason: string | null; content: { type: string; text?: string }[] }> } }
  messages: { countTokens(p: Record<string, unknown>): Promise<unknown> }
}
export type CriarCliente = (chave: string) => Promise<ClienteIA>
const criarPadrao: CriarCliente = async (chave) => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  // dangerouslyAllowBrowser: a chave é da própria pessoa e fica só no aparelho dela (é o que "traga a sua chave" significa)
  return new Anthropic({ apiKey: chave, dangerouslyAllowBrowser: true }) as unknown as ClienteIA
}

const paraBase64 = async (b: Blob): Promise<string> => {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Mensagem em português para os erros que a pessoa consegue resolver. */
export function mensagemErroIA(e: unknown): string {
  const status = (e as { status?: number })?.status
  const txt = e instanceof Error ? e.message : String(e)
  if (status === 401) return 'A chave foi recusada. Confira se copiou inteira (começa com "sk-ant-").'
  if (status === 403) return 'Esta chave não tem permissão para usar esse modelo.'
  if (status === 404) return 'Esse modelo não existe para a sua conta. Escolha outro em "Ajuda de IA".'
  if (status === 429) return 'Limite de uso da chave atingido. Espere um pouco e tente de novo.'
  if (status === 402 || /credit|billing|balance/i.test(txt)) return 'A conta da chave está sem crédito. Adicione crédito em console.anthropic.com.'
  if (/Failed to fetch|NetworkError|network/i.test(txt)) return 'Sem internet (ou o navegador bloqueou o pedido). Tente de novo online.'
  return 'A IA não respondeu: ' + txt
}

/** Confere a chave sem gastar nada (contar tokens é gratuito). */
export async function testarChave(chave: string, modelo: string, criar: CriarCliente = criarPadrao): Promise<void> {
  const c = await criar(chave)
  await c.messages.countTokens({ model: modelo, messages: [{ role: 'user', content: 'oi' }] })
}

export async function relerComIA(o: { chave: string; modelo: string; questao: QuestaoLida; imagem: Blob | null; criar?: CriarCliente }): Promise<Sugestao> {
  const c = await (o.criar ?? criarPadrao)(o.chave)
  const conteudo: Record<string, unknown>[] = []
  if (o.imagem) conteudo.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: await paraBase64(o.imagem) } })
  conteudo.push({ type: 'text', text: montarPedido(o.questao) })
  const r = await c.beta.messages.create({
    model: o.modelo, max_tokens: 4000,
    system: INSTRUCOES,
    // se um filtro de segurança recusar, a API refaz o pedido sozinha num modelo de reserva (e a cobrança segue o modelo que respondeu)
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_RESPOSTA } },
    messages: [{ role: 'user', content: conteudo }],
  })
  if (r.stop_reason === 'refusal') throw new Error('A IA recusou este conteúdo.')
  if (r.stop_reason === 'max_tokens') throw new Error('A resposta da IA foi cortada (questão muito longa).')
  const bloco = r.content.find((b) => b.type === 'text')
  const s = lerResposta(bloco?.text ?? '')
  if (!s) throw new Error('A IA não conseguiu transcrever esta questão com segurança. Ela continua como o leitor automático entendeu.')
  return s
}
