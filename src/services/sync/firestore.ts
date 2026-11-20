// A porta REAL da nuvem: Firestore (projeto logos-f9d33). Tudo da pessoa fica em users/{uid}/..., que é o único lugar que as regras (firestore.rules)
// deixam ler e gravar, e só para quem tem aquele uid.
//   users/{uid}/itens/{chave}   cartões, baralhos, marcações, ajustes   → { u, dev, x? , v }
//   users/{uid}/eventos/{id}    respostas, simulados, zerar, base        → o evento como está
// O Firebase só é carregado quando a pessoa entra com a conta (import dinâmico): o app abre e funciona sem ele.
import type { Firestore } from 'firebase/firestore'
import type { Evento } from '../../core/sync/eventos'
import { chaveDeDoc, docId, eventoValido, itemValido, type ItemNuvem } from '../../core/sync/nuvem'
import { appFirebase } from './firebase'
import { configEmulador } from './emulador'
import type { Porta } from './motor'

let dbPromise: Promise<Firestore> | null = null
/** Firestore com cache offline no aparelho (o que foi baixado continua à mão sem internet e o que se grava offline sai quando voltar). */
function firestore(): Promise<Firestore> {
  return (dbPromise ??= (async () => {
    const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, connectFirestoreEmulator } = await import('firebase/firestore')
    const app = await appFirebase()
    let db: Firestore
    try { db = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) }
    catch { db = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: memoryLocalCache() }) } // navegador sem IndexedDB (aba privada): funciona, só sem cache
    const emu = configEmulador() // só em teste (localStorage.logos_emulador): o Firestore é o do emulador
    if (emu) connectFirestoreEmulator(db, emu.firestore[0], emu.firestore[1])
    return db
  })())
}

/** Escreve em lotes de até 400 (o limite do Firestore é 500 por lote). */
async function emLotes<T>(lista: readonly T[], aplica: (batch: import('firebase/firestore').WriteBatch, x: T) => void, porLote = 400): Promise<void> {
  const { writeBatch } = await import('firebase/firestore')
  const db = await firestore()
  for (let i = 0; i < lista.length; i += porLote) {
    const batch = writeBatch(db)
    for (const x of lista.slice(i, i + porLote)) aplica(batch, x)
    await batch.commit()
  }
}

/** Só no modo emulador (testes): conta quantos documentos chegaram do servidor em cada coleção, para provar que a leitura incremental lê pouco. Fora dele não faz nada. */
const contar = (colecao: 'itens' | 'eventos', n: number) => { if (!configEmulador()) return; const g = globalThis as unknown as { __logosLeituras?: Record<string, number> }; (g.__logosLeituras ??= {})[colecao] = (g.__logosLeituras[colecao] ?? 0) + n }

export function portaFirestore(uid: string): Porta {
  const caminho = (sub: string) => `users/${uid}/${sub}`
  return {
    ouvirItens(aoMudar, aoFalhar, desde) {
      let cancela = () => {}, parou = false
      void (async () => {
        const { collection, onSnapshot, query, where, orderBy } = await import('firebase/firestore')
        if (parou) return
        const db = await firestore()
        const col = collection(db, caminho('itens'))
        cancela = onSnapshot(desde ? query(col, where('u', '>', desde), orderBy('u')) : col, { includeMetadataChanges: true }, (snap) => { // incremental: só o que mudou depois do cursor (F6.3a)
          const itens: ItemNuvem[] = []
          if (!snap.metadata.fromCache) contar('itens', snap.docChanges().length)
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
    ouvirEventos(aoMudar, aoFalhar, desde) {
      let cancela = () => {}, parou = false
      void (async () => {
        const { collection, onSnapshot, query, where, orderBy } = await import('firebase/firestore')
        if (parou) return
        const db = await firestore()
        const col = collection(db, caminho('eventos'))
        cancela = onSnapshot(desde ? query(col, where('t', '>', desde), orderBy('t')) : col, { includeMetadataChanges: true }, (snap) => {
          const novos: Evento[] = [], removidos: string[] = []
          if (!snap.metadata.fromCache) contar('eventos', snap.docChanges().length)
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
    // F6.3: o corpo dos pacotes fica em users/{uid}/corpo/{pid}; é lido com getDoc (um por vez) e NUNCA ouvido ao vivo (cada leitura é cobrada).
    async enviarCorpos(corpos) {
      const { doc } = await import('firebase/firestore')
      const db = await firestore()
      await emLotes(corpos, (b, c) => b.set(doc(db, caminho('corpo'), c.pid), { e: c.corpo.e, k: c.corpo.k, d: c.corpo.d }), 2) // 2 por lote: cada corpo pode ter até ~600 KB e o lote aceita ~10 MB
    },
    async baixarCorpo(pid) {
      const { doc, getDoc } = await import('firebase/firestore')
      const snap = await getDoc(doc(await firestore(), caminho('corpo'), pid))
      return snap.exists() ? snap.data() : null
    },
    async apagarCorpos(pids) {
      const { doc } = await import('firebase/firestore')
      const db = await firestore()
      await emLotes(pids, (b, pid) => b.delete(doc(db, caminho('corpo'), pid)))
    },
  }
}
