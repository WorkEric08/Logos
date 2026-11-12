// Liga o banco novo (pasta banco/, questões Cesgranrio de Agente Comercial) ao app.
//  1. guarda uma cópia do bank.json antigo em backup/ (só na primeira vez; nas seguintes lê o backup, então é repetível);
//  2. converte banco/*.json para o formato de core/types.ts: Question;
//  3. casa cada questão antiga com a nova (mesma prova + mesmo número + texto parecido): fica só a nova, herdando tema,
//     matéria, tema, assunto e páginas da prova do antigo; o gabarito é o do banco novo;
//  4. grava src/data/bank.json (novo), src/data/id-map.json (id antigo -> id novo, para migrar o progresso) e copia as imagens
//     das questões para public/q/ (carregadas sob demanda; fora do precache, ver vite.config.ts).
// Uso (da raiz do projeto):  node scripts/importar-banco.mjs
import { createHash } from 'node:crypto'
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const PASTA = join(RAIZ, 'banco')
const IMAGENS = existsSync(join(PASTA, 'imagens')) ? join(PASTA, 'imagens') : join(PASTA, 'Imagens')
const BANK = join(RAIZ, 'src', 'data', 'bank.json')
const BACKUP = join(RAIZ, 'backup', 'bank.antigo-2026-11-06.json')
const MAPA = join(RAIZ, 'src', 'data', 'id-map.json')
const PUBLIC_Q = join(RAIZ, 'public', 'q')
const letras = ['A', 'B', 'C', 'D', 'E']

// ---- 1. backup do banco antigo (nunca sobrescreve) ----
if (!existsSync(BACKUP)) {
  const atual = JSON.parse(readFileSync(BANK, 'utf8'))
  if (atual.q.length !== 478) throw new Error('bank.json não é o banco antigo (478 questões) e não há backup: parei para não perder o original.')
  mkdirSync(join(RAIZ, 'backup'), { recursive: true })
  copyFileSync(BANK, BACKUP)
  console.log('Backup criado:', BACKUP.replace(RAIZ, '.'))
}
const antigo = JSON.parse(readFileSync(BACKUP, 'utf8'))

// Nome da matéria no banco novo -> nome usado pelo app (core/subjects.ts).
const MATERIA = {
  'Português': 'Língua Portuguesa', 'Inglês': 'Língua Inglesa', 'Informática': 'Conhecimentos de Informática',
  'Atualidades': 'Atualidades do Mercado Financeiro', 'Vendas': 'Vendas e Negociação', 'Atendimento': 'Vendas e Negociação',
  'Matemática': 'Matemática', 'Matemática Financeira': 'Matemática Financeira', 'Conhecimentos Bancários': 'Conhecimentos Bancários',
  'Estatística': 'Estatística', 'Ética': 'Ética', 'Legislação': 'Legislação', 'Conhecimentos Digitais': 'Conhecimentos Digitais',
}
// Chave da prova antiga -> chave da prova no banco novo (a mesma prova do BB).
const PROVA_ANTIGA = { '2010': 'bb-2010', '2012': 'bb-2012', '2014': 'bb-2014', '2015a': 'bb-032015', '2015b': 'bb-102015', '2018': 'bb-2018', '2021': 'bb-2021', '2023': 'bb-2023' }
const AVISO_ALTERNATIVAS = ['texto_alternativas_incompletas', 'alternativas_sao_graficos__usar_imagem', 'enunciado_incompleto', 'questao_em_2_paginas__usar_imagem']

// Largura do PNG lida do cabeçalho (bytes 16–19), sem decodificar a imagem.
const larguraPng = (arq) => { const fd = openSync(arq, 'r'); const b = Buffer.alloc(24); readSync(fd, b, 0, 24, 0); closeSync(fd); return b.readUInt32BE(16) }
const sa = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() // sem acento, minúsculo
const norm = (s) => sa(s).replace(/[^a-z0-9]+/g, '')
const slug = (s) => norm(String(s).replace(/[\s/]+/g, '-')) || 'x'
const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 7)
const semData = (prova) => prova.replace(/\s*\(\d{2}\/\d{2}\/\d{4}\)\s*$/, '').replace(/\(Prova ([A-Z])\)/, 'Prova $1').trim()
const palavras = (q) => new Set(sa(`${q.e} ${Object.values(q.o).join(' ')}`).split(/[^a-z0-9]+/).filter((w) => w.length > 2))
const jaccard = (a, b) => { const A = palavras(a), B = palavras(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1) }

// ---- tema por palavra-chave (o banco novo não traz tema). Ordem importa: a primeira regra que casar vale. ----
const REGRAS = {
  'Língua Portuguesa': { campo: 'e', padrao: 'Interpretação', regras: [
    ['Crase', /crase|acento grave/], ['Colocação pronominal', /pronome (obliquo|atono|destacado)|colocacao|posicao (correta|do pronome)|enclise|proclise|mesoclise/],
    ['Concordância', /concordancia/], ['Regência', /regencia/],
    ['Pontuação', /pontuacao|virgula|ponto e virgula|dois-pontos|dois pontos|travessao|aspas|parenteses/],
    ['Coesão e conectivos', /conectiv|coesao|coerencia|conjuncao|valor semantico|relacao (de sentido|logica)|retoma|referente|pronome relativo|oracao (destacada|subordinada)/],
    ['Reescrita e sintaxe', /reescrit|reescrev|substitu|sinonim|funcao sintatica|sujeito|predicado|complemento|adjunto|aposto|voz (passiva|ativa)|equivalente|sem alteracao de sentido|classe de palavra|termo destacado|palavra destacada|prefixo|sufixo|flexao/]] },
  'Língua Inglesa': { campo: 'e', padrao: 'Interpretação', regras: [
    ['Vocabulário', /meaning|synonym|closest in meaning|can be replaced|equivalent|antonym|opposite|expression/],
    ['Gramática', /grammar|tense|verb|preposition|pronoun|conjunction|article|modal|gerund|infinitive|passive|conditional|comparative|completes|fills? (in )?the|correct (form|option|alternative)/]] },
  'Matemática': { campo: 'ea', padrao: 'Álgebra e funções', regras: [
    ['Contagem e probabilidade', /probabilidade|sorteio|sorteado|aleatori/],
    ['Contagem', /de quantas (maneiras|formas)|combinac|permuta|arranjo|anagrama|principio multiplicativo|quantos (numeros|codigos|grupos|comites|modos)/],
    ['Sequências', /sequencia|progressao|termo geral|\bpa\b|\bpg\b|n-esimo|primeiros termos/],
    ['Porcentagem e proporção', /porcent|\d\s?%|proporcao|proporcional|razao|regra de tres|desconto|aumento|reducao|diretamente|inversamente/],
    ['Lógica', /proposic|logic|verdade|falsa|falso|verdadeir|diagrama|conjunto|afirmacao|implicacao|negacao/]] },
  'Matemática Financeira': { campo: 'ea', padrao: 'Juros e taxas', regras: [
    ['Amortização', /amortizac|\bsac\b|\bprice\b|sistema (de )?(amortizacao|frances|constante)/],
    ['Equivalência de capitais', /equivalen(cia|te).*(capita|pagament)|valor presente|desconto (comercial|racional|simples|composto)|fluxo de caixa|renda|serie de pagamentos|anuidade|taxa interna/],
    ['Juros simples', /juros simples|regime simples|capitalizacao simples/], ['Juros compostos', /juros compostos|regime composto|capitalizacao composta/]] },
  'Atualidades do Mercado Financeiro': { campo: 'ea', padrao: 'Moeda e SFN', regras: [
    ['Política monetária', /selic|copom|politica monetaria|inflacao|ipca|meta de inflacao|taxa basica|compulsorio/],
    ['Digital e fintechs', /\bpix\b|fintech|open (banking|finance)|drex|blockchain|cripto|bitcoin|inteligencia artificial|digital|tecnologia|bigtech|nuvem/],
    ['Shadow banking', /shadow|sistema bancario paralelo|bancos? sombra/], ['Regulação e ética', /regulac|compliance|lavagem|esg|etica|sustentab|governanca/]] },
  'Conhecimentos Bancários': { campo: 'ea', padrao: 'Tesouraria', regras: [
    ['Segurança cibernética', /ciber|phishing|golpe|fraude|seguranca da informacao|engenharia social/],
    ['Socioambiental', /socioambiental|sustentabilidade|\besg\b|risco ambiental|responsabilidade social/],
    ['Câmbio', /cambio|cambial|moeda estrangeira|dolar|exporta|importa|swift|ptax/],
    ['Política monetária', /politica monetaria|selic|copom|compulsorio|redesconto|open market|compromissadas|encaixe/],
    ['Regulação e ética', /lavagem|\bpld\b|compliance|etica|codigo de (etica|conduta)|coaf|sigilo|lgpd|conformidade|integridade|corrupcao/],
    ['Sistema Financeiro (SFN)', /sistema financeiro nacional|\bsfn\b|conselho monetario|\bcmn\b|banco central|\bbacen\b|\bcvm\b|\bsusep\b|\bprevic\b|bndes|\bfgc\b/]] },
  'Conhecimentos de Informática': { campo: 'ea', padrao: 'Sistemas e redes', regras: [
    ['Segurança', /seguranca|malware|virus|ransomware|criptograf|firewall|antivirus|phishing|spyware|autenticacao|certificado digital|assinatura digital/],
    ['Excel e Office', /excel|planilha|\bword\b|powerpoint|libreoffice|writer|\bcalc\b|celula|documento de texto|apresentac/],
    ['Colaboração e nuvem', /nuvem|cloud|teams|google (drive|meet|docs)|onedrive|videoconferencia|colabora|trabalho remoto|\bsaas\b|\biaas\b|\bpaas\b/],
    ['Mídia e EaD', /\bead\b|ensino a distancia|streaming|multimidia|midia|moodle|e-learning/],
    ['Redes e web', /\brede|internet|navegador|protocolo|http|tcp|\bip\b|\bdns\b|\bweb\b|e-?mail|wi-?fi|browser|\burl\b/],
    ['BI e dados', /banco de dados|\bsql\b|nosql|big data|analytics|\bbi\b|business intelligence|data (lake|warehouse)|python|java|hive|mineracao|dados/]] },
  'Vendas e Negociação': { campo: 'ea', padrao: 'Técnicas de vendas', regras: [
    ['Legislação', /codigo de defesa|\bcdc\b|lei (no|n)|lei federal|decreto|\blgpd\b|procon|direito do consumidor|lei geral/],
    ['Comportamento do consumidor', /comportamento do consumidor|motivacao|percepcao|maslow|decisao de compra|perfil do consumidor/],
    ['Marketing digital e estratégia', /marketing|digital|redes sociais|estrategia|\b4 ?ps\b|segmentac|posicionamento|e-?commerce|omnichannel|funil|inbound|swot/],
    ['Marketing de serviços', /intangibilidade|inseparabilidade|perecibilidade|variabilidade/],
    ['Qualidade e satisfação', /qualidade|satisfacao|\bnps\b|reclamacao|fidelizacao|encantamento/],
    ['Ética e relacionamento', /etica|relacionamento|\bcrm\b|ponto de contato/]] },
  'Estatística': { campo: 'ea', padrao: 'Gráficos e tabelas', regras: [
    ['Probabilidade', /probabilidade|evento|aleatori|experimento|esperanca/], ['Distribuições', /distribuicao|normal|binomial|poisson|uniforme|densidade/],
    ['Amostragem e inferência', /amostra|intervalo de confianca|hipotese|populacao|erro padrao|estimador|inferencia/], ['Correlação e regressão', /correlacao|regressao|coeficiente/],
    ['Medidas descritivas', /media|mediana|moda|variancia|desvio|quartil|amplitude|percentil/]] },
  'Ética': { campo: 'ea', padrao: 'Código de ética', regras: [
    ['Compliance e integridade', /compliance|integridade|conformidade|lavagem|corrupcao|programa de/], ['Socioambiental', /socioambiental|\besg\b|sustentab|responsabilidade social|ambient/]] },
  'Legislação': { campo: 'e', padrao: 'Legislação', regras: [] },
  'Conhecimentos Digitais': { campo: 'ea', padrao: 'Liderança e comportamento', regras: [['Metodologias ágeis e lean', /\blean\b|\bokr|agil|scrum|kanban|metodolog|kaizen/]] },
}
function classificar(m, materiaBanco, r) {
  if (materiaBanco === 'Atendimento') return ['Atendimento', 'materia']
  const cfg = REGRAS[m]
  if (!cfg) return ['Geral', 'padrao']
  const acha = (texto) => cfg.regras.find(([, re]) => re.test(texto))?.[0]
  const enunciado = sa(r.enunciado)
  // Primeiro só o enunciado; só se nada casar olha também as alternativas (evita tema puxado por uma alternativa).
  const achou = acha(enunciado) ?? (cfg.campo === 'ea' ? acha(`${enunciado} ${sa(Object.values(r.alternativas ?? {}).join(' '))}`) : undefined)
  return achou ? [achou, 'regra'] : [cfg.padrao, 'padrao']
}

// ---- 2. conversão do banco novo ----
const arquivos = readdirSync(PASTA).filter((f) => f.endsWith('.json')).sort()
const brutas = arquivos.flatMap((f) => JSON.parse(readFileSync(join(PASTA, f), 'utf8')))
const fontes = {}
const bases = {}
const novas = []
const viaPorId = new Map() // id -> como o tema foi atribuído (regra | padrao | materia), só para o relatório
const fora = []
const semImagem = []
const ordenadas = brutas.slice().sort((a, b) => a.ano - b.ano || a.banco.localeCompare(b.banco) || String(a.edicao).localeCompare(String(b.edicao)) || a.numero - b.numero || a.id.localeCompare(b.id))
for (const r of ordenadas) {
  if (r.status !== 'valida' || !letras.includes(r.gabarito)) { fora.push(`${r.id} (${r.status})`); continue }
  const ti = r.cargoOrigem === 'TI' ? 1 : 0
  const s = [slug(r.banco), slug(r.edicao ?? r.ano), ti ? 'ti' : ''].filter(Boolean).join('-')
  fontes[s] ??= `${r.banco} ${r.edicao ?? r.ano} · ${semData(r.prova)}${ti ? ' (TI)' : ''}`
  const avisos = r.revisar ?? []
  const o = Object.fromEntries(letras.map((l) => [l, String(r.alternativas?.[l] ?? '').trim()]))
  const altOk = letras.every((l) => o[l]) && !avisos.some((a) => AVISO_ALTERNATIVAS.includes(a))
  const img = r.imagem ? r.imagem.replace(/^imagens\//i, '') : ''
  if (img && !existsSync(join(IMAGENS, img))) semImagem.push(r.id)
  let b = ''
  if (r.textoApoio?.trim()) { b = `c${hash(norm(r.textoApoio))}`; bases[b] ??= r.textoApoio.trim() }
  const m = MATERIA[r.materia] ?? r.materia
  const [tema, via] = classificar(m, r.materia, r)
  viaPorId.set(r.id, via)
  const q = { id: r.id, y: r.ano, n: r.numero, m, t: tema, a: '', e: r.enunciado.trim(), b, o, g: r.gabarito,
    p: null, bp: null, f: img || avisos.length ? 1 : 0, s, ol: r.ano <= 2015 ? 1 : 0 }
  if (img) q.img = img
  if (img && !semImagem.includes(r.id) && larguraPng(join(IMAGENS, img)) >= 900) q.ig = 1 // recorte é uma página inteira: no celular só lê com zoom
  if (!altOk) q.ia = 1
  if (ti) q.ti = 1
  if (avisos.length) q.rv = avisos
  novas.push(q)
}

// ---- 3. casar antigas com novas (mesma prova + mesmo número + texto parecido) ----
const porProvaNum = new Map(novas.map((q) => [`${q.s}|${q.n}`, q]))
const ids = {}
const trocas = {}
const usadas = new Set()
const mantidas = []
const naoConfere = []
for (const o of antigo.q) {
  const n = porProvaNum.get(`${PROVA_ANTIGA[o.s]}|${o.n}`)
  const j = n ? jaccard(o, n) : 0
  if (!n || j < 0.4 || usadas.has(n.id)) { mantidas.push(o); continue }
  usadas.add(n.id)
  ids[o.id] = n.id
  if (o.g !== n.g) trocas[o.id] = [o.g, n.g]
  n.m = o.m; n.t = o.t; n.a = o.a; n.p = o.p; n.bp = o.bp; n.ps = o.s; n.f = o.f || n.f ? 1 : 0
  if (!n.b && o.b && antigo.bases[o.b]) { n.b = o.b; bases[o.b] ??= antigo.bases[o.b] }
  if (j < 0.6) naoConfere.push(`${o.id}→${n.id} (${j.toFixed(2)})`)
}
// Antigas sem par ficam como estavam (não removo nenhuma), só trocando para a chave nova da prova; ps guarda a chave das páginas.
for (const o of mantidas) {
  const nova = { ...o, ps: o.s, s: PROVA_ANTIGA[o.s], ant: 1 }
  if (!fontes[nova.s]) throw new Error(`prova ${nova.s} sem rótulo`)
  if (o.b && antigo.bases[o.b]) bases[o.b] ??= antigo.bases[o.b]
  novas.push(nova)
}

// ---- 3b. página inteira da prova (public/pages, geradas por scripts/gerar-paginas.mjs): toda questão cuja página existe ganha p (e ps, a chave dos arquivos).
//      O campo `pagina` do PDF vale mais que o p herdado do banco antigo (BB 2015-03 Q70 vinha com a página do texto-base, 18, e está na 19). ----
const FAMILIA = Object.fromEntries(Object.entries(PROVA_ANTIGA).map(([a, b]) => [b, a])) // bb-2010 -> 2010 (as provas do BB que já tinham páginas)
const registroDe = new Map(brutas.map((r) => [r.id, r]))
let comPagina = 0
for (const q of novas) {
  const r = registroDe.get(q.id)
  if (!r?.pagina) continue
  const fam = q.ps ?? FAMILIA[q.s] ?? q.s
  if (existsSync(join(RAIZ, 'public', 'pages', `p${fam}-${String(r.pagina).padStart(2, '0')}.jpg`))) { if (q.p !== r.pagina) comPagina++; q.p = r.pagina; if (fam !== q.s) q.ps = fam }
}

// ---- 4. saída ----
writeFileSync(BANK, JSON.stringify({ q: novas, bases, sources: fontes }))
writeFileSync(MAPA, JSON.stringify({ ids, trocas }))
mkdirSync(PUBLIC_Q, { recursive: true })
let copiadas = 0
for (const q of novas) {
  if (!q.img) continue
  const de = join(IMAGENS, q.img), para = join(PUBLIC_Q, q.img)
  if (existsSync(de) && (!existsSync(para) || statSync(para).size !== statSync(de).size)) { copyFileSync(de, para); copiadas++ }
}

// ---- relatório ----
const cont = (lista, f) => lista.reduce((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m }, {})
console.log(`Lidas ${brutas.length} questões novas; válidas ${brutas.length - fora.length}; de fora: ${fora.join(', ') || '-'}`)
console.log(`Antigas: ${antigo.q.length} → casadas e substituídas pela nova ${Object.keys(ids).length}; mantidas sem par ${mantidas.length} (${mantidas.map((x) => x.id).join(', ')})`)
console.log(`Gabarito trocado (antigo → novo) em ${Object.keys(trocas).length} questões; casamento com texto pouco parecido (<0,60): ${naoConfere.length ? naoConfere.join(', ') : 'nenhum'}`)
console.log(`Páginas inteiras da prova ligadas agora: ${comPagina}; questões com página: ${novas.filter((q) => q.p).length} de ${novas.length}`)
console.log(`bank.json: ${novas.length} questões, ${Object.keys(bases).length} textos-base, ${Object.keys(fontes).length} provas · imagens copiadas agora: ${copiadas} · com imagem: ${novas.filter((q) => q.img).length}`)
if (semImagem.length) console.log(`ATENÇÃO: imagem citada mas sem arquivo: ${semImagem.join(', ')}`)
console.log('\nQuestões por matéria:', cont(novas, (q) => q.m))
const temas = {}; for (const q of novas) { (temas[q.m] ??= {}); temas[q.m][q.t] = (temas[q.m][q.t] ?? 0) + 1 }
console.log('\nTemas por matéria:'); for (const [m, t] of Object.entries(temas)) console.log(`  ${m}: ${Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' | ')}`)
const porM = {}
for (const q of novas) { if (!viaPorId.has(q.id) || usadas.has(q.id)) continue; const x = (porM[q.m] ??= { n: 0, padrao: 0 }); x.n++; if (viaPorId.get(q.id) === 'padrao') x.padrao++ }
console.log('\nTemas por palavra-chave, só questões novas sem par (as pareadas herdam o tema antigo). "Padrão" = nenhuma regra casou:')
for (const [m, x] of Object.entries(porM)) console.log(`  ${m.padEnd(36)} ${String(x.n).padStart(4)} questões · ${String(x.padrao).padStart(4)} no tema padrão (${((100 * x.padrao) / x.n).toFixed(0)}%)`)
console.log(`\nSó na imagem (ia): ${novas.filter((q) => q.ia).length} · de TI: ${novas.filter((q) => q.ti).length} · prova antiga: ${novas.filter((q) => q.ol).length}`)

if (process.argv.includes('--amostra')) {
  let sem = 5; const rnd = () => (sem = (sem * 16807) % 2147483647) / 2147483647
  const lista = novas.filter((q) => viaPorId.has(q.id) && !usadas.has(q.id)); const a = []
  while (a.length < 30) a.push(lista.splice(Math.floor(rnd() * lista.length), 1)[0])
  console.log('\nAmostra de 30 (matéria | tema | como | enunciado):')
  for (const q of a) console.log(`${q.m} | ${q.t} | ${viaPorId.get(q.id)} | ${q.e.replace(/\s+/g, ' ').slice(0, 150)}`)
}
