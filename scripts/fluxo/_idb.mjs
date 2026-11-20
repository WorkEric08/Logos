// Despejo e restauração do IndexedDB inteiro (valores com Blob viram base64), para montar um banco v7 realista e atualizá-lo sem perder nada.
export const despejar = (p, nome = 'treino-bb') => p.evaluate((nome) => new Promise((res, rej) => {
  const rq = indexedDB.open(nome)
  rq.onerror = () => rej(rq.error)
  rq.onsuccess = async () => {
    const db = rq.result, out = { versao: db.version, stores: {} }
    const blobParaB64 = (b) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(b) })
    const conv = async (v) => {
      if (v instanceof Blob) return { __blob: await blobParaB64(v), type: v.type }
      if (Array.isArray(v)) return Promise.all(v.map(conv))
      if (v && typeof v === 'object' && !(v instanceof Date)) { const o = {}; for (const k of Object.keys(v)) o[k] = await conv(v[k]); return o }
      return v
    }
    for (const n of [...db.objectStoreNames]) {
      const os = db.transaction(n).objectStore(n)
      const vals = await new Promise((r) => { const g = os.getAll(); g.onsuccess = () => r(g.result) })
      out.stores[n] = { keyPath: os.keyPath, autoIncrement: os.autoIncrement, indexes: [...os.indexNames].map((i) => ({ nome: i, keyPath: os.index(i).keyPath, unique: os.index(i).unique, multi: os.index(i).multiEntry })), valores: await conv(vals) }
    }
    db.close(); res(out)
  }
}), nome)

// Recria o banco exatamente como o Dexie v7 o deixou (versão 70) com os valores; roda numa página da origem que NÃO inicia o app (ex.: /icon-192.png)
export const restaurar = (p, dump, nome = 'treino-bb') => p.evaluate(({ dump, nome }) => new Promise((res, rej) => {
  const b64ParaBlob = (b64, type) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }) }
  const rev = (v) => {
    if (v && typeof v === 'object' && '__blob' in v) return b64ParaBlob(v.__blob, v.type)
    if (Array.isArray(v)) return v.map(rev)
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = rev(v[k]); return o }
    return v
  }
  const del = indexedDB.deleteDatabase(nome)
  del.onsuccess = () => {
    const rq = indexedDB.open(nome, dump.versao)
    rq.onupgradeneeded = () => {
      const db = rq.result
      for (const [n, s] of Object.entries(dump.stores)) {
        const os = db.createObjectStore(n, { keyPath: s.keyPath, autoIncrement: s.autoIncrement })
        for (const i of s.indexes) os.createIndex(i.nome, i.keyPath, { unique: i.unique, multiEntry: i.multi })
      }
    }
    rq.onerror = () => rej(rq.error)
    rq.onsuccess = () => {
      const db = rq.result, nomes = Object.keys(dump.stores), tx = db.transaction(nomes, 'readwrite')
      for (const n of nomes) for (const v of dump.stores[n].valores) tx.objectStore(n).put(rev(v))
      tx.oncomplete = () => { db.close(); res(true) }; tx.onerror = () => rej(tx.error)
    }
  }
  del.onerror = () => rej(del.error)
}), { dump, nome })
