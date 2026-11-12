// Confere um APK antes de dizer que a versão está pronta: assinatura (a MESMA do APK anterior, senão o Android recusa
// a atualização por cima e o usuário acaba desinstalando e perdendo os dados), versionCode (tem de ser MAIOR que o
// instalado), permissões e se as frases da interface nova estão dentro do pacote.
//
// Uso (da raiz do projeto; precisa de ANDROID_HOME ou ANDROID_SDK_ROOT com build-tools):
//   node verificar-apk.mjs <apk> [--sha256 <impressão esperada>] [--versao-maior-que N] [--texto "frase"]...
//   node verificar-apk.mjs android/app/build/outputs/apk/debug/app-debug.apk --sha256 74:3D:6D:EF:... \
//        --versao-maior-que 29894175 --texto "Permitir alarmes exatos"
// Sai com código 2 se algo falhar. Depois de gerar um APK, rebuilde o web (npm run build): o dist/ é compartilhado.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'

const args = process.argv.slice(2)
const apk = args.find((a) => !a.startsWith('--') && (args[args.indexOf(a) - 1] ?? '').startsWith('--') === false)
const pegar = (nome) => {
  const valores = []
  args.forEach((a, i) => a === nome && valores.push(args[i + 1]))
  return valores
}
if (!apk || !existsSync(apk)) {
  console.error('Uso: node verificar-apk.mjs <apk> [--sha256 X] [--versao-maior-que N] [--texto "frase"]...')
  process.exit(1)
}

// Acha as ferramentas do SDK (a versão mais nova de build-tools).
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
const pastaTools = sdk && join(sdk, 'build-tools')
if (!pastaTools || !existsSync(pastaTools)) {
  console.error('Defina ANDROID_HOME (ou ANDROID_SDK_ROOT) com a pasta build-tools do Android SDK.')
  process.exit(1)
}
const versoes = readdirSync(pastaTools).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
const win = process.platform === 'win32'
const ferramenta = (nome) => {
  for (const v of versoes) {
    const caminho = join(pastaTools, v, win ? (nome === 'apksigner' ? 'apksigner.bat' : `${nome}.exe`) : nome)
    if (existsSync(caminho)) return caminho
  }
  throw new Error(`${nome} não encontrado em ${pastaTools}`)
}
const rodar = (caminho, argumentos) =>
  spawnSync(caminho, argumentos, { encoding: 'utf8', shell: win && caminho.endsWith('.bat') })

let falhou = false
const ok = (m) => console.log('OK   ', m)
const ruim = (m) => {
  falhou = true
  console.log('FALHA', m)
}

// 1. Assinatura.
const assinatura = rodar(ferramenta('apksigner'), ['verify', '--print-certs', apk])
const sha = /SHA-256 digest: ([0-9a-f]+)/i.exec(assinatura.stdout)?.[1]?.toLowerCase()
if (!sha) ruim(`assinatura inválida ou ilegível: ${assinatura.stderr || assinatura.stdout}`)
else {
  ok(`assinatura SHA-256 ${sha.match(/../g).join(':')}`)
  for (const esperada of pegar('--sha256')) {
    const alvo = esperada.replace(/[:\s]/g, '').toLowerCase()
    sha === alvo ? ok('é a MESMA assinatura esperada (atualiza por cima)') : ruim(`assinatura DIFERENTE da esperada (${esperada})`)
  }
}

// 2. Versão e permissões.
const badging = rodar(ferramenta('aapt'), ['dump', 'badging', apk]).stdout
const versionCode = Number(/versionCode='(\d+)'/.exec(badging)?.[1])
const versionName = /versionName='([^']*)'/.exec(badging)?.[1]
const pacote = /package: name='([^']+)'/.exec(badging)?.[1]
if (!versionCode) ruim('versionCode ilegível')
else {
  ok(`pacote ${pacote}, versionCode ${versionCode}, versionName ${versionName}`)
  for (const n of pegar('--versao-maior-que')) {
    versionCode > Number(n) ? ok(`versionCode > ${n}`) : ruim(`versionCode ${versionCode} NÃO é maior que ${n}: o instalador recusa a atualização`)
  }
}
const permissoes = [...badging.matchAll(/uses-permission: name='([^']+)'/g)].map((m) => m[1].replace('android.permission.', ''))
ok(`permissões: ${permissoes.join(', ') || '(nenhuma)'}`)

// 3. Frases da interface dentro do pacote (lê o ZIP do APK sem dependências).
const frases = pegar('--texto')
if (frases.length) {
  const zip = readFileSync(apk)
  const fim = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const entradas = zip.readUInt16LE(fim + 10)
  let pos = zip.readUInt32LE(fim + 16)
  let texto = ''
  for (let i = 0; i < entradas; i++) {
    const metodo = zip.readUInt16LE(pos + 10)
    const tamanho = zip.readUInt32LE(pos + 20)
    const nomeLen = zip.readUInt16LE(pos + 28)
    const extraLen = zip.readUInt16LE(pos + 30)
    const comentLen = zip.readUInt16LE(pos + 32)
    const local = zip.readUInt32LE(pos + 42)
    const nome = zip.subarray(pos + 46, pos + 46 + nomeLen).toString('utf8')
    pos += 46 + nomeLen + extraLen + comentLen
    if (!/^assets\/.*\.(js|html|css|json)$/.test(nome)) continue
    const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    const bytes = zip.subarray(inicio, inicio + tamanho)
    texto += (metodo === 8 ? inflateRawSync(bytes) : bytes).toString('utf8') + '\n'
  }
  for (const frase of frases) {
    texto.includes(frase) ? ok(`texto no pacote: "${frase}"`) : ruim(`texto NÃO está no pacote: "${frase}" (o build Android usou código velho?)`)
  }
}

process.exit(falhou ? 2 : 0)
