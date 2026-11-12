// Semeia baralhos e cartões direto no IndexedDB do app (o Importar saiu da tela; digitar 30 cartões pela interface seria lento).
// Uso nos scripts: await semearCards(pagina, { baralhos: [...], cartoes: [...] }) com o app já aberto; recarrega a página no fim.
const DIA = 86_400_000
const meiaNoite = (agora, n = 0) => { const d = new Date(agora); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime() }

/** Cartão no formato do app. `estado`: 'novo' | 'aprendendo' | 'revisao'; `dias`: em revisão, daqui a quantos dias volta (≤ 0 = hoje). */
export function cartao(id, b, f, v, { estado = 'novo', dias = 0, agora = Date.now() } = {}) {
  const rev = estado === 'revisao'
  return { id, b, f, v, criado: agora - 1000 * (id.length + 1), estado, due: rev ? meiaNoite(agora, dias) : estado === 'aprendendo' ? agora - 60_000 : agora, ivl: rev ? Math.max(1, Math.abs(dias) || 3) : 0, fac: 2.5, reps: rev ? 2 : 0, lapsos: 0, ult: rev ? agora - 2 * DIA : 0 }
}

export async function semearCards(p, { baralhos, cartoes }) {
  await p.evaluate(async ({ baralhos, cartoes }) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    await new Promise((res, rej) => {
      const tx = db.transaction(['decks', 'cards'], 'readwrite')
      for (const b of baralhos) tx.objectStore('decks').put(b)
      for (const c of cartoes) tx.objectStore('cards').put(c)
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
    })
    db.close()
  }, { baralhos, cartoes })
  await p.reload(); await p.waitForSelector('.nav .rail-item', { state: 'attached' })
}

/** Um conjunto realista: 3 baralhos (um com nome longo), cartões novos, aprendendo e em revisão para hoje e para depois. */
export function conjuntoPadrao(agora = Date.now()) {
  const A = { id: 'bsfn', nome: 'Siglas do Sistema Financeiro Nacional', criado: agora - 5 * DIA }
  const B = { id: 'bmat', nome: 'Matemática financeira', criado: agora - 4 * DIA }
  const C = { id: 'bvaz', nome: 'Baralho sem cartões ainda', criado: agora - 1 * DIA }
  const T = [
    ['SELIC', 'Taxa básica de juros da economia, definida pelo Copom a cada reunião.', 'revisao', 0],
    ['CDI', 'Certificado de Depósito Interbancário: referência para a renda fixa.', 'revisao', -1],
    ['IPCA', 'Índice oficial de inflação, medido pelo IBGE.', 'aprendendo', 0],
    ['PIX', 'Sistema de pagamentos instantâneos do Banco Central.', 'novo', 0],
    ['COPOM', 'Comitê de Política Monetária do Banco Central.', 'novo', 0],
    ['FGC', 'Fundo Garantidor de Créditos: protege até R$ 250 mil por CPF e instituição.', 'revisao', 6],
    ['CMN', 'Conselho Monetário Nacional.', 'novo', 0],
    ['Qual a diferença entre juros simples e compostos, e em que situação cada um se aplica nas questões de prova?', 'Simples: J = C·i·t (cresce linearmente). Compostos: M = C·(1+i)^t (cresce exponencialmente). Em prova, atenção ao enunciado: se não diz "compostos", em geral o regime é simples.', 'revisao', 0],
  ]
  const cartoes = T.map(([f, v, e, d], i) => cartao(`c${i}`, i < 4 || i === 7 ? (i === 7 ? B.id : A.id) : A.id, f, v, { estado: e, dias: d, agora }))
  return { baralhos: [A, B, C], cartoes }
}

/** Id de um baralho pelo nome (para semear cartões num baralho criado pela interface). */
export async function idBaralho(p, nome) {
  return p.evaluate(async (nome) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('treino-bb'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const todos = await new Promise((res, rej) => { const r = db.transaction('decks').objectStore('decks').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    db.close()
    return todos.find((d) => d.nome === nome)?.id ?? null
  }, nome)
}
