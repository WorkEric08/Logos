// Roda TODA a verificação do projeto, uma etapa depois da outra, e mostra uma tabela com o resultado de cada uma.
// Uso: npm run verificar        (precisa do Chrome instalado; sobe o `vite preview` na 4173 se ainda não estiver rodando)
import { execSync, spawn } from 'node:child_process'

const PORTA = 4173
const etapas = [
  ['testes de unidade e de estado (vitest)', 'npm test --silent'],
  ['tipos (tsc)', 'npx tsc --noEmit'],
  ['build de produção', 'npm run build --silent'],
  ['integridade dos dados', 'node scripts/verificar-dados.mjs'],
  ['imagens (corte, em branco)', 'node scripts/verificar-imagens.mjs'],
  ['amostra de 40 questões no navegador', 'node scripts/verificar-amostra.mjs'],
  ['regras do app e responsividade (e2e)', 'node scripts/e2e.mjs'],
  ['offline e cache de imagens', 'node scripts/e2e-offline.mjs'],
  ['Treinar: provas em 3 ordens, filtros da prova, página inteira e ícone da barra', 'node scripts/e2e-treinar.mjs'],
  ['Início no monitor: cartões de matéria + pastas dos bancos; celular como antes', 'node scripts/e2e-inicio-largo.mjs'],
  ['Desempenho: gráfico do mês inteiro e simulados abaixo, em 2 colunas alternadas', 'node scripts/e2e-desempenho-mes.mjs'],
  ['Questão no monitor: painel da prova alargável arrastando a borda esquerda', 'node scripts/e2e-painel-questao.mjs'],
  ['Treinar: quantidade 10 · 20 · 30 · 40 · 50 · Todas numa linha só (320 a 1920 px)', 'node scripts/e2e-quantidade.mjs'],
  ['Cards: o texto do cartão encolhe até caber na tela, sem rolagem vertical', 'node scripts/e2e-cards-cabe.mjs'],
  ['Movimento do app todo: telas deslizam, cascata, gráficos, aviso; "reduzir movimento"', 'node scripts/e2e-movimento.mjs'],
  ['Sincronização (parte B): eventos gravados junto com o progresso, base, zerar e desfazer', 'node scripts/e2e-sync-base.mjs'],
  ['histórico, marcações, anotações e backup completo', 'node scripts/e2e-historico.mjs'],
  ['flashcards: baralhos, cartões, estudo, backup e celular', 'node scripts/e2e-cards.mjs'],
  ['Assistente: importar prova em PDF + gabarito, espaços, cartões, IA opcional (API simulada), comandos escritos', 'node scripts/e2e-assistente.mjs'],
  ['Assistente: movimento da entrada à saída (digitando, pílulas, painéis, erro, sucesso, troca de aba)', 'node scripts/e2e-assistente-movimento.mjs'],
  ['Assistente: diálogo (pedidos com detalhes, perguntas do que falta, sugestões ao digitar, desfazer, histórico, limpar)', 'node scripts/e2e-assistente-dialogo.mjs'],
  ['REGRA DO TECLADO: nenhum botão acima do teclado, em todos os campos (4 celulares)', 'node scripts/e2e-teclado.mjs'],
  ['Cards: editor (cartão salvo 1,5 s, rolar com teclado, sequências)', 'node scripts/e2e-cards-editor.mjs'],
  ['botão voltar: cada voltar sobe um nível (Cards, provas, simulado, barra)', 'node scripts/e2e-voltar.mjs'],
  ['avisos rápidos numa linha só (320 a 1440 px)', 'node scripts/medir-avisos.mjs'],
  ['simulado: cronômetro escondido e aviso ao encerrar', 'node scripts/e2e-simulado.mjs'],
  ['barra de navegação (rail): aba retrátil, arrastar, memória, voltar, temas, deitado', 'node scripts/e2e-rail.mjs'],
  ['celular: alvos de toque, rolagem, texto cortado e teclado (9 tamanhos)', 'node scripts/medir-mobile.mjs'],
  ['APK: pacote do Android com a ponte do Capacitor simulada', 'node scripts/e2e-android.mjs'],
  ['abertura animada: 2 s, preto na 1ª pintura, centralizada, movimento reduzido', 'node scripts/e2e-splash.mjs'],
  ['visual: 6 tamanhos × 2 temas × 7 telas', 'node scripts/e2e-visual.mjs'],
  ['atualização real: versão antiga → nova, backup e restauração', 'node scripts/e2e-migracao.mjs'],
]
const noAr = async () => { try { return (await fetch(`http://localhost:${PORTA}/`)).ok } catch { return false } }
let servidor = null
const resultado = []
for (const [nome, cmd] of etapas) {
  if (cmd.startsWith('node scripts/') && !cmd.includes('migracao') && !cmd.includes('dados') && !(await noAr())) {
    servidor = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore', shell: true })
    for (let i = 0; i < 40 && !(await noAr()); i++) await new Promise((r) => setTimeout(r, 400))
  }
  const t0 = Date.now()
  let ok = true
  try { execSync(cmd, { stdio: 'pipe', maxBuffer: 1 << 26 }) } catch (e) { ok = false; console.log(`\n--- ${nome} FALHOU ---\n${String(e.stdout ?? '').split('\n').filter((l) => /FALHOU|FALHA|Error|failed/i.test(l)).slice(0, 15).join('\n')}${String(e.stderr ?? '').trim() ? `\n[stderr] ${String(e.stderr).trim().split('\n').slice(0, 8).join('\n')}` : ''}`) } // stderr junto: sem ele uma falha de partida (porta presa, arquivo travado) saía sem explicação
  resultado.push([ok ? 'OK    ' : 'FALHOU', nome, `${((Date.now() - t0) / 1000).toFixed(0)} s`])
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}`)
}
if (servidor) servidor.kill()
console.log('\n' + resultado.map(([s, n, t]) => `${s}  ${n.padEnd(62)} ${t}`).join('\n'))
process.exit(resultado.some(([s]) => s === 'FALHOU') ? 1 : 0)
