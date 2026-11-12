// Simula a ponte do Capacitor num Chrome comum, para ver e testar telas que só existem no APK (lembretes, backup
// automático, seletor de hora…) sem aparelho. NÃO prova o código Java: prova a interface e o contrato com o plugin.
//
// Passos:
//   1. Compile o app com a flag do Android:   VITE_ANDROID=1 npx vite build   (a flag é de BUILD, não de execução)
//   2. Sirva o dist/:                          npx vite preview --port 4318
//   3. No seu script Playwright, ANTES de abrir a página:
//        import { instalarPonteNativa, definirResposta, chamadas } from './ponte-nativa-simulada.mjs'
//        await instalarPonteNativa(contexto, {
//          localStorage: { meuapp_skip_splash: '1' },
//          plugins: {
//            LocalNotifications: { checkPermissions: { display: 'granted' }, getPending: { notifications: [] } },
//            MeuPlugin: { getAlgo: { ok: true }, openAlgo: { opened: true } },
//          },
//        })
//        await pagina.goto('http://localhost:4318/')
//        ...
//        await definirResposta(pagina, 'MeuPlugin', 'getAlgo', { ok: false })   // muda o cenário no meio do teste
//        console.log(await chamadas(pagina))   // [{ plugin, method, options }] na ordem em que o app chamou
//   4. Depois: rebuilde o web (npm run build) e ENCERRE o servidor da porta 4318 (o dist/ é compartilhado).
//
// Cada método que não tem resposta configurada devolve {}. `App` já vem com exitApp/getInfo. Eventos nativos
// (addListener) devolvem um identificador qualquer e nunca disparam: para testar um evento, chame a função que o trata.
// Os erros de console "<plugin> plugin is not implemented" (ex.: SystemBars) são esperados e inofensivos.

/** Instala a ponte em um contexto ou página do Playwright (antes de `goto`). */
export async function instalarPonteNativa(alvo, opcoes = {}) {
  const { plugins = {}, localStorage: chaves = {} } = opcoes
  const todos = { App: { exitApp: {}, getInfo: { name: 'app', id: 'app', build: '1', version: '1' } }, ...plugins }
  await alvo.addInitScript(
    ({ plugins, chaves }) => {
      for (const [k, v] of Object.entries(chaves)) localStorage.setItem(k, v)
      window.__chamadas = []
      window.__respostas = plugins
      // Só para o Capacitor achar que está no Android.
      window.androidBridge = {}
      const cabecalho = (nome, metodos) => ({
        name: nome,
        methods: [
          ...metodos.map((n) => ({ name: n, rtype: 'promise' })),
          { name: 'addListener', rtype: 'callback' },
          { name: 'removeListener', rtype: 'promise' },
        ],
      })
      window.Capacitor = {
        PluginHeaders: Object.entries(plugins).map(([nome, metodos]) => cabecalho(nome, Object.keys(metodos))),
        nativeCallback: () => 'cb',
        nativePromise: async (plugin, method, options) => {
          window.__chamadas.push({ plugin, method, options })
          const resposta = window.__respostas?.[plugin]?.[method]
          return resposta === undefined ? {} : resposta
        },
      }
    },
    { plugins: todos, chaves },
  )
}

/** Troca a resposta de um método no meio do teste (ex.: "agora a permissão foi liberada"). */
export function definirResposta(pagina, plugin, metodo, valor) {
  return pagina.evaluate(
    ([p, m, v]) => {
      window.__respostas[p] = { ...(window.__respostas[p] ?? {}), [m]: v }
    },
    [plugin, metodo, valor],
  )
}

/** As chamadas que o app fez ao plugin, em ordem: [{ plugin, method, options }]. */
export function chamadas(pagina) {
  return pagina.evaluate(() => window.__chamadas ?? [])
}
