// F6.4 — testa as REGRAS do Firestore (firestore.rules) no emulador: dono lê/escreve; outro usuário e visitante são negados; forma e tamanho dos documentos; subcoleções desconhecidas fechadas.
// Usa o próprio SDK `firebase` (o mesmo do app) contra os emuladores de Auth e Firestore, sem tocar no projeto real e sem dependência nova. Sobe os emuladores se não estiverem no ar
// e carrega o arquivo firestore.rules do disco no emulador antes de testar. Uso: node scripts/testar-regras.mjs
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, connectAuthEmulator, getAuth, signInWithCredential } from 'firebase/auth'
import { setLogLevel, connectFirestoreEmulator, doc, getDoc, initializeFirestore, setDoc, deleteDoc, getDocs, collection, Bytes } from 'firebase/firestore'
import { garantirEmuladores, limparEmuladores, PROJETO } from './_emulador.mjs'

setLogLevel('silent') // os avisos do SDK sobre as recusas ESPERADAS só atrapalham a leitura
const emu = await garantirEmuladores()
await limparEmuladores()
// carrega as regras do ARQUIVO no emulador (o que se testa é o que vai ser publicado)
const regras = readFileSync('firestore.rules', 'utf8')
const r = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJETO}:securityRules`, { method: 'PUT', body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: regras }] } }) })
if (!r.ok) { console.error('FALHOU: o emulador não aceitou as regras: ' + (await r.text())); emu.parar(); process.exit(1) }

const out = []
const ok = (n, c, x = '') => out.push(`${c ? 'OK      ' : 'FALHOU  '} ${n}${x ? ' — ' + x : ''}`)
const config = { apiKey: 'fake', authDomain: 'localhost', projectId: PROJETO }
let seq = 0
async function cliente(email) { // um "app" do Firebase por pessoa (ou sem login, se email = null)
  const app = initializeApp(config, 'c' + seq++)
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  let uid = null
  if (email) {
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    uid = (await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: 'google-' + email, email, email_verified: true })))).user.uid
  }
  return { db, uid }
}
const permitido = async (f) => { try { await f(); return true } catch (e) { if (e?.code === 'permission-denied') return false; throw e } }
const A = await cliente('alice@teste.com'), B = await cliente('bruno@teste.com'), V = await cliente(null)
const D = (c, ...caminho) => doc(c.db, ...caminho)

const item = { u: 1700000000000, dev: 'dA', v: { nome: 'Direito', criado: 5 } }
const corpoOk = { e: 'e1', k: 'q', d: JSON.stringify({ questoes: [] }) }
const evento = { k: 'r', id: 'r:dA:1:q1', dev: 'dA', q: 'q1', l: 'A', ok: true, t: 1 }

// ───── o dono ─────
ok('dono grava e lê um item (cartão, espaço, pacote)', await permitido(async () => { await setDoc(D(A, 'users', A.uid, 'itens', 'e:e1'), item); await getDoc(D(A, 'users', A.uid, 'itens', 'e:e1')) }))
ok('dono grava uma lápide (x:1, sem v)', await permitido(() => setDoc(D(A, 'users', A.uid, 'itens', 'p:q-e1-abc'), { u: 2, dev: 'dA', x: 1 })))
ok('dono grava um evento e lê a coleção', await permitido(async () => { await setDoc(D(A, 'users', A.uid, 'eventos', evento.id), evento); await getDocs(collection(A.db, 'users', A.uid, 'eventos')) }))
ok('dono grava o corpo de um pacote de questões e de material', await permitido(async () => { await setDoc(D(A, 'users', A.uid, 'corpo', 'q-e1-abc'), corpoOk); await setDoc(D(A, 'users', A.uid, 'corpo', 'm-Mxyz-0'), { e: 'e1', k: 'm', d: '{}' }) }))
ok('dono grava uma imagem (Bytes de até 600 KB)', await permitido(() => setDoc(D(A, 'users', A.uid, 'imagens', 'u1'), { e: 'e1', w: Bytes.fromUint8Array(new Uint8Array(1000)), t: 'webp', u: 1, dev: 'dA' })))
ok('dono apaga o que é dele', await permitido(async () => { await deleteDoc(D(A, 'users', A.uid, 'corpo', 'q-e1-abc')); await deleteDoc(D(A, 'users', A.uid, 'itens', 'e:e1')) }))

// ───── os outros ─────
ok('OUTRO usuário NÃO lê o que é do dono', !(await permitido(() => getDoc(D(B, 'users', A.uid, 'itens', 'p:q-e1-abc')))))
ok('OUTRO usuário NÃO lê a coleção de eventos nem de corpo do dono', !(await permitido(() => getDocs(collection(B.db, 'users', A.uid, 'eventos')))) && !(await permitido(() => getDocs(collection(B.db, 'users', A.uid, 'corpo')))))
ok('OUTRO usuário NÃO escreve na conta do dono (item, evento, corpo, imagem)', !(await permitido(() => setDoc(D(B, 'users', A.uid, 'itens', 'c:x'), item))) && !(await permitido(() => setDoc(D(B, 'users', A.uid, 'eventos', evento.id), evento))) && !(await permitido(() => setDoc(D(B, 'users', A.uid, 'corpo', 'q-e1-zzz'), corpoOk))) && !(await permitido(() => setDoc(D(B, 'users', A.uid, 'imagens', 'u9'), { e: 'e1', w: Bytes.fromUint8Array(new Uint8Array(1)), t: 'webp', u: 1, dev: 'x' }))))
ok('OUTRO usuário NÃO apaga o que é do dono', !(await permitido(() => deleteDoc(D(B, 'users', A.uid, 'itens', 'p:q-e1-abc')))))
ok('VISITANTE (sem login) não lê nem escreve nada', !(await permitido(() => getDoc(D(V, 'users', A.uid, 'itens', 'p:q-e1-abc')))) && !(await permitido(() => setDoc(D(V, 'users', 'qualquer', 'itens', 'c:x'), item))))
ok('cada um continua escrevendo na SUA conta (B grava na dele)', await permitido(() => setDoc(D(B, 'users', B.uid, 'itens', 'c:x'), item)))

// ───── forma e tamanho ─────
ok('corpo com `d` grande demais (600 001 caracteres) é recusado; no limite (600 000) é aceito', !(await permitido(() => setDoc(D(A, 'users', A.uid, 'corpo', 'q-e1-gigante'), { ...corpoOk, d: 'x'.repeat(600001) }))) && await permitido(() => setDoc(D(A, 'users', A.uid, 'corpo', 'q-e1-limite'), { ...corpoOk, d: 'x'.repeat(600000) })))
ok('corpo com campo a mais, tipo errado ou k que não bate com o id é recusado', !(await permitido(() => setDoc(D(A, 'users', A.uid, 'corpo', 'q-e1-a'), { ...corpoOk, extra: 1 }))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'corpo', 'q-e1-b'), { ...corpoOk, d: { objeto: 1 } }))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'corpo', 'm-e1-c'), corpoOk))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'corpo', 'q-e1-d'), { ...corpoOk, k: 'x' }))))
ok('id de corpo fora do formato (caractere estranho, tipo errado, longo demais) é recusado', !(await permitido(() => setDoc(D(A, 'users', A.uid, 'corpo', 'x-e1-abc'), corpoOk))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'corpo', 'q-e1 abc'), corpoOk))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'corpo', 'q-' + 'a'.repeat(90)), corpoOk))))
ok('imagem acima de 600 000 bytes, sem `w` Bytes ou com tipo estranho é recusada', !(await permitido(() => setDoc(D(A, 'users', A.uid, 'imagens', 'ug'), { e: 'e1', w: Bytes.fromUint8Array(new Uint8Array(600001)), t: 'webp', u: 1, dev: 'dA' }))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'imagens', 'ut'), { e: 'e1', w: 'texto', t: 'webp', u: 1, dev: 'dA' }))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'imagens', 'uf'), { e: 'e1', w: Bytes.fromUint8Array(new Uint8Array(10)), t: 'exe', u: 1, dev: 'dA' }))))
ok('item com `u` que não é número, sem `dev`, com campo a mais ou sem `v`/`x` é recusado', !(await permitido(() => setDoc(D(A, 'users', A.uid, 'itens', 'c:1'), { ...item, u: 'ontem' }))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'itens', 'c:2'), { u: 1, v: {} }))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'itens', 'c:3'), { ...item, lixo: 1 }))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'itens', 'c:4'), { u: 1, dev: 'd' }))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'itens', 'c:5'), { u: 1, dev: 'd', v: 'texto' }))))
ok('evento com `id` diferente do id do documento, tipo desconhecido ou campo estranho é recusado', !(await permitido(() => setDoc(D(A, 'users', A.uid, 'eventos', 'outro-id'), evento))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'eventos', evento.id), { ...evento, k: 'zz' }))) && !(await permitido(() => setDoc(D(A, 'users', A.uid, 'eventos', evento.id), { ...evento, segredo: 'x' }))))
ok('os eventos reais do app passam (resposta, simulado, base, zerar, desfeito)', await permitido(async () => {
  const ev = (o) => setDoc(D(A, 'users', A.uid, 'eventos', o.id), o)
  await ev({ k: 's', id: 's:dA:9', dev: 'dA', sim: { t: 9, p: 50, b: 1, e: 2, c: 3, n: 4, ok: true }, t: 9 })
  await ev({ k: 'b', id: 'b:dA', dev: 'dA', t: 5, prog: {}, dias: {}, sims: [] }); await ev({ k: 'z', id: 'z:dA:7', dev: 'dA', t: 7 }); await ev({ k: 'd', id: 'd:z:dA:7', dev: 'dA', t: 8, z: 'z:dA:7' })
}))

// ───── o resto está fechado ─────
ok('subcoleção desconhecida do dono e raiz do banco continuam fechadas', !(await permitido(() => setDoc(D(A, 'users', A.uid, 'segredos', 's1'), { a: 1 }))) && !(await permitido(() => setDoc(D(A, 'publico', 'x'), { a: 1 }))) && !(await permitido(() => getDoc(D(A, 'users', A.uid)))) )

console.log(out.join('\n'))
emu.parar()
process.exit(out.some((l) => l.startsWith('FALHOU')) ? 1 : 0)
