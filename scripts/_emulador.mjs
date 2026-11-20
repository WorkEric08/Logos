// Emuladores do Firebase (Auth + Firestore) para os testes da sincronização. NUNCA fala com o Firebase real: o app só conecta neles se o navegador tiver
// localStorage.logos_emulador (src/services/sync/emulador.ts). Se os emuladores já estão no ar (ex.: o testador os deixou ligados), usa os que estão; senão sobe e derruba no fim.
import { spawn, spawnSync } from 'node:child_process'

export const PROJETO = 'logos-f9d33'
export const AUTH = 'http://127.0.0.1:9099', FIRESTORE = ['127.0.0.1', 8080]
const noAr = async (url) => { try { await fetch(url); return true } catch { return false } }

export async function garantirEmuladores() {
  let proc = null
  if (!(await noAr('http://127.0.0.1:8080/')) || !(await noAr(AUTH + '/'))) {
    proc = spawn('npx', ['firebase', 'emulators:start', '--only', 'auth,firestore', '--project', PROJETO], { shell: true, stdio: 'ignore' })
    for (let i = 0; i < 120; i++) { if ((await noAr('http://127.0.0.1:8080/')) && (await noAr(AUTH + '/'))) break; await new Promise((r) => setTimeout(r, 500)) }
  }
  const parar = () => { if (proc) { try { spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* já saiu */ } } }
  process.on('exit', parar)
  return { parar, subiu: !!proc }
}

/** Zera tudo no emulador (documentos e contas): cada teste começa do zero. */
export async function limparEmuladores() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, { method: 'DELETE' })
  await fetch(`${AUTH}/emulator/v1/projects/${PROJETO}/accounts`, { method: 'DELETE' })
}

/** Os documentos de uma coleção do emulador (lê como administrador: o emulador aceita "Bearer owner"). */
export async function lerColecao(caminho) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJETO}/databases/(default)/documents/${caminho}?pageSize=1000&showMissing=true`, { headers: { Authorization: 'Bearer owner' } })
  const j = await r.json()
  return j.documents ?? []
}
/** O uid da conta falsa (a primeira pasta em users/). */
export async function uidDaConta() { const d = await lerColecao('users'); return d.length ? d[0].name.split('/').pop() : null }

/** Um "aparelho": contexto de navegador com o app apontado para os emuladores e uma conta falsa. */
export async function novoAparelho(navegador, novoContexto, { email = 'alice@teste.com', viewport = { width: 390, height: 844 }, ...resto } = {}) {
  const ctx = await novoContexto(navegador, { viewport, hasTouch: true, isMobile: true, colorScheme: 'dark', ...resto })
  await ctx.addInitScript(({ auth, fs, email }) => { try { if (!localStorage.getItem('logos_emulador')) localStorage.setItem('logos_emulador', JSON.stringify({ auth, firestore: fs, conta: { email, nome: email.split('@')[0] } })) } catch { /* sem armazenamento */ } }, { auth: AUTH, fs: FIRESTORE, email })
  return ctx
}

/** O uid da conta logada NESTE aparelho (lido do que o SDK guarda no navegador): não depende de quem mais usa os emuladores ao mesmo tempo. */
export const uidDoAparelho = (pagina) => pagina.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('firebaseLocalStorageDb')
  r.onerror = () => res(null)
  r.onsuccess = () => {
    try {
      const g = r.result.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll()
      g.onsuccess = () => { const u = g.result.find((x) => String(x.fbase_key).startsWith('firebase:authUser:')); r.result.close(); res(u?.value?.uid ?? null) }
      g.onerror = () => res(null)
    } catch { res(null) }
  }
}))
