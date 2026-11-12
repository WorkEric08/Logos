// Gera o APK de teste: build web do Android (VITE_ANDROID=1 → dist-android/, sem service worker) → cap sync → gradlew assembleDebug →
// copia para apk/ → confere assinatura, versionCode e se o pacote tem o app. Uso: npm run apk   (precisa de JDK 17+ e Android SDK)
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const pacote = JSON.parse(readFileSync('package.json', 'utf8'))
// Impressão digital (SHA-256) da chave de assinatura do projeto (android/app/debug.keystore). Se mudar, o Android recusa instalar por cima.
const ASSINATURA = '74:3D:6D:EF:C0:22:4A:2A:DA:9D:8E:B3:E2:8A:07:E8:B7:04:B0:DE:06:9D:52:E4:A9:AF:B2:3E:D3:C2:D0:C8'
const win = process.platform === 'win32'
const roda = (cmd, args, opcoes = {}) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, cwd: raiz, ...opcoes, env: { ...process.env, ...(opcoes.env ?? {}) } })
  if (r.status !== 0) { console.error(`\nFALHOU: ${cmd} ${args.join(' ')} (código ${r.status})`); process.exit(r.status || 1) }
}

roda('npx', ['tsc', '--noEmit'])
roda('npx', ['vite', 'build'], { env: { VITE_ANDROID: '1' } })
if (existsSync('dist-android/sw.js')) { console.error('FALHOU: dist-android/sw.js existe (o APK não deve ter service worker)'); process.exit(1) }
roda('npx', ['cap', 'sync', 'android'])
roda(win ? '.\\gradlew.bat' : './gradlew', ['assembleDebug'], { cwd: join(raiz, 'android') })

const origem = join(raiz, 'android/app/build/outputs/apk/debug/app-debug.apk')
mkdirSync('apk', { recursive: true })
const destino = join('apk', 'logos.apk')
copyFileSync(origem, destino)
console.log(`\nAPK: ${destino} (${(statSync(destino).size / 1048576).toFixed(1)} MB)`)
roda('node', ['scripts/verificar-apk.mjs', destino, '--sha256', ASSINATURA, '--texto', 'Logos'])
console.log(`\nPronto. Versão ${pacote.version}. Instale por cima (nunca desinstale): adb install -r apk/logos.apk, ou copie o arquivo para o celular.`)
