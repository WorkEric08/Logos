// Ações de espaço/prova/material pela interface (usadas pelos testes de dois aparelhos)
import { irPara } from '../_ctx.mjs'
import { voltar } from './_base.mjs'
import { painelEspacos, esperar } from './_dois.mjs'

export const chat = async (p) => { await irPara(p, 'Assistente'); await p.waitForTimeout(1200); for (let i = 0; i < 4 && !(await p.locator('#as-msg').count()); i++) { await p.getByRole('button', { name: /^(Voltar|Cancelar)$|Mais sugestões/ }).first().click().catch(() => {}); await p.waitForTimeout(700) } }
export const dizer = async (p, t) => { await chat(p); await p.fill('#as-msg', t); await p.keyboard.press('Enter'); await p.waitForTimeout(1300) }
export const arquivos = (prova, gab) => async (p) => { await p.setInputFiles('#as-f-prova', { name: 'BB_2021_Escriturario_prova.pdf', mimeType: 'application/pdf', buffer: prova }); await p.setInputFiles('#as-f-gab', { name: 'BB_2021_Escriturario_gabarito.pdf', mimeType: 'application/pdf', buffer: gab }) }
/** O aviso central da 1ª vez que um espaço vai subir ("O que sobe para a sua conta"): `escolha` = 'enviar' (padrão) ou 'manter'. Devolve o texto do aviso, ou null se não apareceu. */
export const avisoDeSubida = async (p, escolha = 'enviar') => {
  const d = p.locator('.dialogo', { hasText: 'O que sobe para a sua conta' })
  if (!(await d.count())) return null
  const t = (await d.innerText()).split('\n').join(' | ')
  await d.getByRole('button', { name: escolha === 'manter' ? 'Manter só aqui' : 'Enviar para a conta' }).click(); await p.waitForTimeout(800)
  return t
}
export const novoEspaco = async (p, nome, escolha = 'enviar') => {
  await dizer(p, 'meus espaços'); await p.getByRole('button', { name: 'Novo espaço', exact: true }).click(); await p.waitForSelector('#as-espaco'); await p.fill('#as-espaco', nome); await p.getByRole('button', { name: 'Criar vazio' }).click(); await p.waitForTimeout(2000)
  return avisoDeSubida(p, escolha)
}
export const importarProva = async (p, pdfs) => {
  if (!(await p.locator('#as-f-prova').count())) await dizer(p, 'importar prova')
  await p.waitForSelector('#as-f-prova', { state: 'attached' }); await pdfs(p)
  await p.getByRole('button', { name: /Ler a prova/ }).click(); await p.waitForSelector('.as-qs', { timeout: 60000 }); await p.getByRole('button', { name: /Adicionar/ }).click(); await p.waitForSelector('.as-sucesso'); await p.waitForTimeout(1200); return avisoDeSubida(p)
}
export const guardarMaterial = async (p, nome, texto) => {
  await dizer(p, 'meus materiais'); await p.getByRole('button', { name: /Guardar (um|outro) material/ }).first().click(); await p.waitForSelector('#as-f-material', { state: 'attached' })
  await p.setInputFiles('#as-f-material', { name: nome, mimeType: 'text/markdown', buffer: Buffer.from(texto) }); await p.waitForTimeout(3000); return avisoDeSubida(p)
}
export const ativar = async (p, nome) => { await painelEspacos(p); await p.getByRole('button', { name: new RegExp(nome) }).first().click(); await p.waitForTimeout(1500) }
export const apagarEspaco = async (p, nome) => { await painelEspacos(p); await p.getByRole('button', { name: new RegExp('Apagar o espaço ' + nome) }).click(); await p.waitForTimeout(500); await p.locator('.dialogo .btn', { hasText: /Apagar/ }).last().click(); await p.waitForTimeout(1500); return avisoDeSubida(p) }
export const treinarN = async (p) => { await irPara(p, 'Treinar'); await p.waitForTimeout(400); if (!(await p.locator('.top small').count())) return 0; return parseInt((await p.locator('.top small').first().innerText()).replace(/\D/g, '') || '0') }
export const enunciados = async (p) => { await irPara(p, 'Treinar'); await p.locator('.chip', { hasText: 'Ordem da prova' }).click(); const n = parseInt((await p.locator('.btn.pri', { hasText: 'Começar' }).innerText()).replace(/\D/g, '')); await p.locator('.btn.pri', { hasText: 'Começar' }).click(); await p.waitForSelector('.sheet'); const v = []; for (let i = 0; i < n; i++) { v.push((await p.locator('.enun').innerText().catch(() => '')).trim()); if (i < n - 1) await p.locator('.foot .btn.pri').click(); await p.waitForTimeout(50) } await voltar(p); await p.waitForTimeout(300); return v }
export const temEspaco = async (p, nome) => (await painelEspacos(p)).some((t) => new RegExp(nome).test(t))
export const esperarEspaco = (p, nome, existe = true, ms = 45000) => esperar(async () => (await temEspaco(p, nome)) === existe, ms)
export const GLOSSARIO = ['Selic: taxa básica de juros da economia brasileira, definida pelo Copom a cada reunião.', 'Copom: comitê do Banco Central que define a meta da taxa Selic.', 'CMN: conselho monetário nacional, órgão que edita as normas gerais do sistema financeiro.', 'CVM: autarquia que fiscaliza e regula o mercado de valores mobiliários.', 'BNDES: banco público de fomento que financia projetos de longo prazo de empresas.', 'Febraban: federação que reúne e representa os bancos brasileiros.', 'IPCA: índice oficial de preços ao consumidor, medido pelo IBGE todos os meses.', 'Poupança: aplicação de baixo risco com rendimento mensal definido em lei.'].join('\n\n')
