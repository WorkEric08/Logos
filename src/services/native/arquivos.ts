import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { ehNativo } from './index'

export type ResultadoSalvar = 'compartilhado' | 'baixado' | 'cancelado'

/**
 * Salva um texto como arquivo para a pessoa guardar ou enviar (backup, lista de cartões).
 * No APK, `<a download>` não faz nada na WebView: grava no cache do app (sem pedir permissão) e abre a folha de compartilhar do
 * Android ("Salvar em Arquivos", Drive, WhatsApp…). No navegador do celular: compartilha o arquivo se der; senão (e no computador) baixa.
 */
export async function salvarArquivo(nome: string, conteudo: string, mime: string): Promise<ResultadoSalvar> {
  if (ehNativo()) {
    try {
      const { uri } = await Filesystem.writeFile({ path: nome, data: conteudo, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: nome, dialogTitle: 'Salvar ou enviar o arquivo', files: [uri] })
      return 'compartilhado'
    } catch (e) {
      if (/cancel/i.test(String((e as Error)?.message ?? e))) return 'cancelado'
      throw e
    }
  }
  const arquivo = new File([conteudo], nome, { type: mime })
  try {
    // só em aparelho de toque: no computador a folha de compartilhar do sistema atrapalha, o download comum é o esperado
    if (window.matchMedia?.('(pointer: coarse)').matches && navigator.canShare?.({ files: [arquivo] })) { await navigator.share({ files: [arquivo] }); return 'compartilhado' }
  } catch (e) { if ((e as Error).name === 'AbortError') return 'cancelado' }
  const url = URL.createObjectURL(arquivo)
  const a = document.createElement('a'); a.href = url; a.download = arquivo.name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000) // só depois de uns segundos: um disco lento cancelaria o download
  return 'baixado'
}
