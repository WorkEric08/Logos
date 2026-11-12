// Preparação da sincronização na abertura do app: id deste aparelho, evento-base (só na 1ª vez, se já havia progresso), conferência de que o
// progresso derivado dos eventos é igual ao que a tela mostra e, se não for, a cura. O resultado fica em meta['sync:conferencia'].
import type { Hist } from '../../core/historico'
import { conferir } from '../../core/sync/conferir'
import { baseDe, derivar } from '../../core/sync/eventos'
import type { ProgressMap } from '../../core/types'
import { gravarBase, gravarConferencia, idDoAparelho, lerEventos, refazerEventosDoAparelho } from '../db'

/** Devolve o id do aparelho. Quem chama trata o erro: a sincronização nunca pode impedir o app de abrir. */
export async function prepararSincronizacao(prog: ProgressMap, hist: Hist, agora = Date.now()): Promise<string> {
  const dev = await idDoAparelho()
  let eventos = await lerEventos()
  const temDados = Object.keys(prog).length > 0 || Object.keys(hist.dias).length > 0 || hist.sims.length > 0
  // 1ª abertura com sincronização e progresso de antes: tudo o que já existe entra como UM evento-base (depois, cada resposta é um evento)
  if (eventos.length === 0 && temDados) { await gravarBase(baseDe(dev, agora, prog, hist)); eventos = await lerEventos() }
  let dif = conferir(derivar(eventos), { prog, hist })
  let curou = 0
  // Cura: se os eventos ficaram para trás (ex.: uma abertura em que a preparação falhou e as respostas só foram pelo caminho antigo) ou nasceram com ids
  // antigos, o que a tela mostra é a verdade e os eventos DESTE aparelho são refeitos como uma base. Só enquanto nenhum outro aparelho escreveu eventos:
  // depois que houver registros de outros aparelhos (ou já enviados à nuvem), refazer os próprios eventos os afastaria dos que já saíram daqui.
  if (dif.length && eventos.every((e) => e.dev === dev)) {
    curou = dif.length
    await refazerEventosDoAparelho(dev, temDados ? baseDe(dev, agora, prog, hist) : null)
    eventos = await lerEventos(); dif = conferir(derivar(eventos), { prog, hist })
    console.warn(`[sync] os eventos estavam diferentes do progresso em ${curou} ponto(s): refeitos como uma base do que a tela mostra`)
  }
  await gravarConferencia({ ok: dif.length === 0, t: agora, eventos: eventos.length, ...(curou ? { curou } : {}), diferencas: dif.slice(0, 5) })
  if (dif.length) console.warn(`[sync] o progresso derivado dos eventos difere do guardado em ${dif.length} ponto(s)`, dif.slice(0, 3))
  return dev
}
