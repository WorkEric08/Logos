// Modo EMULADOR (só para testes): se o navegador tiver `localStorage.logos_emulador` (um JSON com os endereços dos emuladores do Firebase), o app conecta o login e o
// Firestore a eles em vez de ao projeto real, e o botão "Entrar com Google" entra com uma conta FALSA do emulador. Sem essa chave (o uso normal: ninguém a cria) nada disto
// existe: o app fala com o Firebase real como sempre. É uma chave nova de localStorage, no mesmo espírito de `treino_skip_splash`; nenhuma chave existente muda.
// Formato: {"auth":"http://127.0.0.1:9099","firestore":["127.0.0.1",8080],"conta":{"email":"alice@teste.com","nome":"Alice"}}
export interface ConfigEmulador { auth: string; firestore: [string, number]; conta: { email: string; nome: string } }

export function configEmulador(): ConfigEmulador | null {
  try {
    const bruto = localStorage.getItem('logos_emulador')
    if (!bruto) return null
    const o = JSON.parse(bruto) as Partial<ConfigEmulador>
    if (typeof o.auth !== 'string' || !Array.isArray(o.firestore) || typeof o.firestore[0] !== 'string' || typeof o.firestore[1] !== 'number') return null
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(o.auth) || !/^(127\.0\.0\.1|localhost)$/.test(o.firestore[0])) return null // só endereços da própria máquina: nunca um servidor de fora
    return { auth: o.auth, firestore: [o.firestore[0], o.firestore[1]], conta: { email: o.conta?.email ?? 'teste@teste.com', nome: o.conta?.nome ?? 'Teste' } }
  } catch { return null }
}

/** O "token do Google" que o emulador de Auth aceita: um JSON com a identidade da conta falsa (o `sub` fixo faz a mesma conta ter sempre o mesmo uid). */
export const tokenFalsoDoGoogle = (c: ConfigEmulador): string => JSON.stringify({ sub: 'google-' + c.conta.email, email: c.conta.email, email_verified: true, name: c.conta.nome })
