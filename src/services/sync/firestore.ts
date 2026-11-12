// A porta REAL da nuvem: Firestore (projeto logos-f9d33). Tudo da pessoa fica em users/{uid}/..., que é o único lugar que as regras (firestore.rules)
// deixam ler e gravar, e só para quem tem aquele uid.
//   users/{uid}/itens/{chave}   cartões, baralhos, marcações, ajustes   → { u, dev, x? , v }
//   users/{uid}/eventos/{id}    respostas, simulados, zerar, base        → o evento como está
// O Firebase só é carregado quando a pessoa entra com a conta (import dinâmico): o app abre e funciona sem ele.
import type { Firestore } from 'firebase/firestore'
import type { Evento } from '../../core/sync/eventos'
import { chaveDeDoc, docId, eventoValido, itemValido, type ItemNuvem } from '../../core/sync/nuvem'
import { appFirebase } from './firebase'
import type { Porta } from './motor'

let dbPromise: Promise<Firestore> | null = null
/** Firestore com cache offline no aparelho (o que foi baixado continua à mão sem internet e o que se grava offline sai quando voltar). */
function firestore(): Promise<Firestore> {
  return (dbPromise ??= (async () => {
    const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } = await import('firebase/firestore')
    const app = await appFirebase()
    try { return initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) }
    catch { return initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: memoryLocalCache() }) } // navegador sem IndexedDB (aba privada): funciona, só sem cache
  })())
}

/** Escreve em lotes de até 400 (o limite do Firestore é 500 por lote). */
async function emLotes<T>(lista: readonly T[], aplica: (batch: import('firebase/firestore').WriteBatch, x: T) => void): Promise<void> {
  const { writeBatch } = await import('firebase/firestore')
  const db = await firestore()
  for (let i = 0; i < lista.length; i += 400) {
    const batch = writeBatch(db)
    for (const x of lista.slice(i, i + 400)) aplica(batch, x)
    await batch.commit()
  }
}

export function portaFirestore(uid: string): Porta {
  const caminho = (sub: string) => `users/${uid}/${sub}`
  return {
    ouvirItens(aoMudar, aoFalhar) {
      let cancela = () => {}, parou = false
      void (async () => {
        const { collection, onSnapshot } = await import('firebase/firestore')
        if (parou) return
        const db = await firestore()
        cancela = onSnapshot(collection(db, caminho('itens')), { includeMetadataChanges: true }, (snap) => {
          const itens: ItemNuvem[] = []
          for (const c of snap.docChanges()) {
            if (c.type === 'removed') continue
            const it = itemValido(chaveDeDoc(c.doc.id), c.doc.data())
            if (it) itens.push(it)
          }
          aoMudar({ itens, doServidor: !snap.metadata.fromCache })
        }, aoFalhar)
      })().catch(aoFalhar)
      return () => { parou = true; cancela() }
    },
    ouvirEventos(aoMudar, aoFalhar) {
      let cancela = () => {}, parou = false
      void (async () => {
        const { collection, onSnapshot } = await import('firebase/firestore')
        if (parou) return
        const db = await firestore()
        cancela = onSnapshot(collection(db, caminho('eventos')), { includeMetadataChanges: true }, (snap) => {
          const novos: Evento[] = [], removidos: string[] = []
          for (const c of snap.docChanges()) {
            if (c.type === 'removed') { removidos.push(c.doc.id); continue }
            const ev = eventoValido(c.doc.id, c.doc.data())
            if (ev) novos.push(ev)
          }
          aoMudar({ novos, removidos, doServidor: !snap.metadata.fromCache })
        }, aoFalhar)
      })().catch(aoFalhar)
      return () => { parou = true; cancela() }
    },
    async enviarItens(itens) {
      const { doc } = await import('firebase/firestore')
      const db = await firestore()
      await emLotes(itens, (b, i) => b.set(doc(db, caminho('itens'), docId(i.key)), i.x ? { u: i.u, dev: i.dev, x: 1 } : { u: i.u, dev: i.dev, v: i.v }))
    },
    async enviarEventos(eventos) {
      const { doc } = await import('firebase/firestore')
      const db = await firestore()
      await emLotes(eventos, (b, e) => b.set(doc(db, caminho('eventos'), e.id), e))
    },
    async apagarEvento(id) {
      const { doc, deleteDoc } = await import('firebase/firestore')
      await deleteDoc(doc(await firestore(), caminho('eventos'), id))
    },
  }
}
