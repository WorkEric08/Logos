import { useEffect, useState } from 'react'
import { lerImagem } from '../services/db'

/** Imagem de uma questão. Do banco embutido: o arquivo em q/<nome>. Importada (`u:<id>`): o recorte guardado no aparelho, aberto como URL temporária. */
export function useUrlImagem(img: string): string | null {
  const local = img.startsWith('u:')
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!local) return
    let vivo = true, temp: string | null = null
    setUrl(null)
    void lerImagem(img.slice(2)).then((b) => { if (!vivo) return; if (!b) { setUrl(''); return }; temp = URL.createObjectURL(b); setUrl(temp) }).catch(() => { /* sem a imagem: a tela mostra o aviso */ })
    return () => { vivo = false; if (temp) URL.revokeObjectURL(temp) }
  }, [img, local])
  return local ? url : `q/${img}`
}
