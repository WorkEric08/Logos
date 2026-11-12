// Firebase (projeto logos-f9d33): o app e o login. Carregado SOB DEMANDA (import dinâmico) para o app abrir e funcionar sem ele, offline e sem conta.
import { Capacitor } from '@capacitor/core'
import type { FirebaseApp } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import { firebaseConfig } from './firebaseConfig'

export const ehAndroid = () => { try { return Capacitor.isNativePlatform() } catch { return false } }

let appP: Promise<FirebaseApp> | null = null
export function appFirebase(): Promise<FirebaseApp> {
  return (appP ??= import('firebase/app').then(({ initializeApp, getApps, getApp }) => (getApps().length ? getApp() : initializeApp(firebaseConfig))))
}

let authP: Promise<Auth> | null = null
/** No site: o `getAuth` de sempre (que sabe abrir o popup do Google). No Android (WebView): `initializeAuth` só com o armazenamento do IndexedDB, sem popup. */
export function authFirebase(): Promise<Auth> {
  return (authP ??= (async () => {
    const [app, mod] = await Promise.all([appFirebase(), import('firebase/auth')])
    return ehAndroid() ? mod.initializeAuth(app, { persistence: mod.indexedDBLocalPersistence }) : mod.getAuth(app)
  })())
}

/** Escuta quem está logado (nulo = ninguém). Devolve a função que para de escutar. */
export async function observarUsuario(aoMudar: (u: User | null) => void, aoFalhar: (e: unknown) => void): Promise<() => void> {
  const [auth, { onAuthStateChanged }] = await Promise.all([authFirebase(), import('firebase/auth')])
  return onAuthStateChanged(auth, aoMudar, aoFalhar)
}

/**
 * Entra com o Google. Site: popup. Android: o seletor de contas nativo do Google devolve um token, e ele é repassado ao SDK web
 * (signInWithCredential): assim o Firestore enxerga o MESMO uid do site (a autenticação nativa fica desligada: skipNativeAuth em capacitor.config.ts).
 */
export async function entrarComGoogle(): Promise<void> {
  const [auth, mod] = await Promise.all([authFirebase(), import('firebase/auth')])
  if (ehAndroid()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
    const r = await FirebaseAuthentication.signInWithGoogle()
    const idToken = r.credential?.idToken
    if (!idToken) throw new Error('O Google não devolveu o token de acesso.')
    await mod.signInWithCredential(auth, mod.GoogleAuthProvider.credential(idToken, r.credential?.accessToken))
  } else {
    const provedor = new mod.GoogleAuthProvider()
    provedor.setCustomParameters({ prompt: 'select_account' })
    await mod.signInWithPopup(auth, provedor)
  }
}

export async function sairDaConta(): Promise<void> {
  const [auth, mod] = await Promise.all([authFirebase(), import('firebase/auth')])
  await mod.signOut(auth)
  if (ehAndroid()) { try { const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication'); await FirebaseAuthentication.signOut() } catch { /* já estava fora na camada nativa */ } }
}

/** Mensagem em português para o que pode dar errado no login. `codigo` é o que o Firebase ou o plugin devolvem. */
export function mensagemDeErro(e: unknown): string {
  const txt = e instanceof Error ? e.message : String(e)
  const cod = (e as { code?: string })?.code ?? ''
  if (/popup-closed-by-user|cancel|12501|canceled/i.test(cod + txt)) return 'Login cancelado.'
  if (/popup-blocked/i.test(cod + txt)) return 'O navegador bloqueou a janela do Google. Libere pop-ups para este site e tente de novo.'
  if (/network|offline/i.test(cod + txt)) return 'Sem internet. Para entrar é preciso estar online.'
  if (/unauthorized-domain/i.test(cod + txt)) return 'Este endereço do site não está autorizado no Firebase (Authentication › Settings › Authorized domains).'
  if (/DEVELOPER_ERROR|\b10\b|12500/.test(cod + txt)) return 'O Google recusou este app (erro de configuração: SHA-1 do APK não cadastrado no Firebase).'
  return 'Não foi possível entrar: ' + txt
}
