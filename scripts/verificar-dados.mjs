// Verifica a integridade dos dados do app contra o banco original (banco/*.json) e o banco antigo (backup/).
// Só lê; não altera nada. Sai com código ≠ 0 se algum item FALHAR.
// Defeitos de dados já conhecidos e que dependem de decisão do dono aparecem como CONHECIDO e só fazem sair com código ≠ 0 com --estrito.
// Uso (da raiz do projeto):  node scripts/verificar-dados.mjs [--estrito]
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ESTRITO = process.argv.includes('--estrito')
const R = process.cwd()
const ler = (p) => JSON.parse(readFileSync(join(R, p), 'utf8'))
const app = ler('src/data/bank.json')
const mapa = ler('src/data/id-map.json')
const antigo = ler('backup/bank.antigo-2026-11-06.json')
const IMAGENS = existsSync(join(R, 'banco/imagens')) ? 'banco/imagens' : 'banco/Imagens'
const banco = readdirSync(join(R, 'banco')).filter((f) => f.endsWith('.json')).sort().flatMap((f) => ler(`banco/${f}`).map((r) => ({ ...r, _arq: f })))
const letras = ['A', 'B', 'C', 'D', 'E']
const MATERIA = { 'Português': 'Língua Portuguesa', 'Inglês': 'Língua Inglesa', 'Informática': 'Conhecimentos de Informática', 'Atualidades': 'Atualidades do Mercado Financeiro', 'Vendas': 'Vendas e Negociação', 'Atendimento': 'Vendas e Negociação' }
const mat = (m) => MATERIA[m] ?? m
// Defeitos de dados conhecidos, a decidir pelo dono (nada aqui é corrigido por este script).
const CONHECIDOS = { 'BB-2018-AC-INF-55': 'recorte de página inteira traz, embaixo, sobra cortada da coluna seguinte (alternativas D e E repetidas); as cinco alternativas aparecem completas na parte de cima' }

let falhas = 0, conhecidos = 0, avisos = 0
const linha = (estado, item, detalhe = '') => { console.log(`${estado.padEnd(9)} ${item}${detalhe ? ' — ' + detalhe : ''}`); if (estado === 'FALHOU') falhas++; if (estado === 'CONHECIDO') conhecidos++; if (estado === 'AVISO') avisos++ }
const checa = (ok, item, detalhe = '') => linha(ok ? 'OK' : 'FALHOU', item, detalhe)
const conta = (l, f) => l.reduce((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m }, {})
const tabela = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' | ')
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

const Q = app.q
const novas = Q.filter((q) => !q.ant)
const bancoValidas = banco.filter((r) => r.status === 'valida')
const porId = new Map(Q.map((q) => [q.id, q]))
const bancoPorId = new Map(bancoValidas.map((r) => [r.id, r]))

// ---------- 1. totais ----------
console.log('\n== 1. Totais ==')
checa(Q.length === 1168, 'total no app = 1.168', `app=${Q.length}`)
checa(banco.length === 1163 && bancoValidas.length === 1158, 'banco/*.json: 1.163 questões, 1.158 válidas', `lidas=${banco.length}, válidas=${bancoValidas.length}, anuladas=${banco.length - bancoValidas.length}`)
checa(novas.length === bancoValidas.length && Q.length - novas.length === 10, 'app = 1.158 do banco novo + 10 antigas sem par', `novas=${novas.length}, antigas mantidas=${Q.length - novas.length}`)
const idsBanco = new Set(bancoValidas.map((r) => r.id)), idsNovas = new Set(novas.map((q) => q.id))
const faltam = [...idsBanco].filter((i) => !idsNovas.has(i)), sobram = [...idsNovas].filter((i) => !idsBanco.has(i))
checa(!faltam.length && !sobram.length, 'mesmos ids do banco novo (válidas) no app', `faltam=${faltam.length}, sobram=${sobram.length}`)
const anuladasNoApp = banco.filter((r) => r.status !== 'valida' && porId.has(r.id))
checa(!anuladasNoApp.length, 'nenhuma anulada no app', banco.filter((r) => r.status !== 'valida').map((r) => r.id).join(', '))
console.log('por matéria (app):', tabela(conta(Q, (q) => q.m)))
console.log('por matéria (banco, nome do app):', tabela(conta(bancoValidas, (r) => mat(r.materia))))
const diffMat2 = novas.filter((q) => mat(bancoPorId.get(q.id).materia) !== q.m)
checa(diffMat2.every((q) => q.m === 'Matemática Financeira' && bancoPorId.get(q.id).materia === 'Matemática'), 'diferenças de matéria só nas Matemática→Matemática Financeira herdadas do banco antigo', `${diffMat2.length} questões (esperado 21)`)
console.log('por prova (app):', tabela(conta(Q, (q) => q.s)))
console.log('por origem (app):', tabela(conta(Q, (q) => (q.ant ? 'antigo sem par' : q.ti ? 'TI reaproveitada' : 'cargo do Agente Comercial'))))
const provasBanco = conta(bancoValidas, (r) => `${r.banco}|${r.edicao ?? r.ano}|${r.cargoOrigem}`)
console.log('provas no banco (banco|edição|cargo):', tabela(provasBanco))
const rotulosFaltando = [...new Set(Q.map((q) => q.s))].filter((s) => !app.sources[s])
checa(!rotulosFaltando.length && Object.keys(app.sources).every((s) => Q.some((q) => q.s === s)), 'toda prova tem rótulo e todo rótulo tem questão', rotulosFaltando.join(', '))

// ---------- 2. campos ----------
console.log('\n== 2. Campos ==')
checa(new Set(Q.map((q) => q.id)).size === Q.length, 'ids únicos')
const semEnun = Q.filter((q) => !q.e?.trim()), gabRuim = Q.filter((q) => !letras.includes(q.g))
checa(!semEnun.length, 'nenhum enunciado vazio', semEnun.map((q) => q.id).join(', '))
checa(!gabRuim.length, 'gabarito sempre A–E', gabRuim.map((q) => q.id).join(', '))
const altRuim = Q.filter((q) => !q.ia && !letras.every((l) => q.o[l]?.trim()))
checa(!altRuim.length, '5 alternativas preenchidas (ou marcada só-imagem)', altRuim.map((q) => q.id).join(', '))
const iaSemImg = Q.filter((q) => q.ia && !q.img)
checa(!iaSemImg.length && Q.filter((q) => q.ia).length === 11, 'as 11 só-imagem têm imagem', `ia=${Q.filter((q) => q.ia).length}`)
const camposObrig = Q.filter((q) => !q.id || !q.m || !q.t || !q.s || !(q.y > 2000) || !(q.n > 0))
checa(!camposObrig.length, 'matéria, tema, prova, ano e número preenchidos', camposObrig.map((q) => q.id).join(', '))
const gabForaDasAlt = Q.filter((q) => !(q.g in q.o))
checa(!gabForaDasAlt.length, 'gabarito é uma das chaves de alternativas')
console.log('(a "assunto" `a` vazio é normal nas questões novas sem par: o app mostra o tema)')

// ---------- 3. imagens ----------
console.log('\n== 3. Imagens (arquivos) ==')
const comImg = Q.filter((q) => q.img)
const arquivos = readdirSync(join(R, 'public/q'))
const refs = new Set(comImg.map((q) => q.img))
const faltamArq = [...refs].filter((f) => !arquivos.includes(f)), orfaos = arquivos.filter((f) => !refs.has(f))
checa(!faltamArq.length, 'toda imagem referenciada existe em public/q', faltamArq.join(', '))
checa(!orfaos.length, 'nenhum arquivo órfão em public/q', orfaos.join(', '))
const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ruins = [], diferemDoBanco = []
for (const f of arquivos) {
  const b = readFileSync(join(R, 'public/q', f))
  if (!b.subarray(0, 8).equals(sig) || b.toString('latin1', 12, 16) !== 'IHDR' || b.readUInt32BE(16) < 50 || b.readUInt32BE(20) < 50 || !b.subarray(-12).toString('latin1').includes('IEND')) ruins.push(f)
  const o = join(R, IMAGENS, f)
  if (!existsSync(o) || createHash('md5').update(readFileSync(o)).digest('hex') !== createHash('md5').update(b).digest('hex')) diferemDoBanco.push(f)
}
checa(!ruins.length, 'todos os arquivos são PNG válidos (assinatura, IHDR, IEND, tamanho)', ruins.join(', '))
checa(!diferemDoBanco.length, 'cada PNG é idêntico ao de banco/Imagens (md5)', diferemDoBanco.join(', '))
const imgBancoNaoUsada = banco.filter((r) => r.imagem && r.status === 'valida' && !refs.has(r.imagem.replace(/^imagens\//i, '')))
checa(!imgBancoNaoUsada.length, 'toda imagem de questão válida do banco está no app', imgBancoNaoUsada.map((r) => r.id).join(', '))
const imgDiverge = novas.filter((q) => (q.img ?? null) !== (bancoPorId.get(q.id).imagem?.replace(/^imagens\//i, '') ?? null))
checa(!imgDiverge.length, 'campo img do app = campo imagem do banco, questão por questão', imgDiverge.map((q) => q.id).join(', '))
checa(comImg.length === 400, '400 questões com imagem', `${comImg.length}`)

// ---------- 3b. páginas inteiras das provas ----------
console.log('\n== 3b. Páginas inteiras das provas (public/pages) ==')
const pg2 = (n) => String(n).padStart(2, '0')
const arqPagina = (q, n) => join(R, 'public/pages', `p${q.ps ?? q.s}-${pg2(n)}.jpg`)
const semPagina = Q.filter((q) => !q.p)
checa(!semPagina.length, 'toda questão tem a página inteira da prova (p)', `${semPagina.length} sem: ${semPagina.slice(0, 8).map((q) => q.id).join(', ')}`)
const paginaFalta = Q.filter((q) => (q.p && !existsSync(arqPagina(q, q.p))) || (q.bp && !existsSync(arqPagina(q, q.bp))))
checa(!paginaFalta.length, 'todo arquivo de página referenciado (p e bp) existe', paginaFalta.slice(0, 8).map((q) => q.id).join(', '))
const paginaDiverge = novas.filter((q) => q.p && bancoPorId.get(q.id)?.pagina && !q.ant && q.p !== bancoPorId.get(q.id).pagina)
checa(!paginaDiverge.length, 'p = campo pagina do PDF (banco), questão por questão', paginaDiverge.map((q) => q.id).join(', '))
const jpgRuim = []
for (const f of readdirSync(join(R, 'public/pages'))) { const b = readFileSync(join(R, 'public/pages', f)); if (b[0] !== 0xff || b[1] !== 0xd8 || b.length < 20_000) jpgRuim.push(f) }
checa(!jpgRuim.length, 'todas as páginas são JPEG válidos e não vazios (> 20 KB)', jpgRuim.join(', '))

// ---------- 4. textos-base ----------
console.log('\n== 4. Textos-base ==')
const baseFalta = Q.filter((q) => q.b && !app.bases[q.b]), baseVazia = Object.entries(app.bases).filter(([, t]) => !t?.trim())
checa(!baseFalta.length, 'todo b aponta para um texto existente', baseFalta.map((q) => q.id).join(', '))
checa(!baseVazia.length, 'nenhum texto-base vazio')
const usados = new Set(Q.map((q) => q.b).filter(Boolean)), baseOrfa = Object.keys(app.bases).filter((b) => !usados.has(b))
checa(!baseOrfa.length, 'nenhum texto-base órfão', baseOrfa.join(', '))
const apoioBanco = bancoValidas.filter((r) => r.textoApoio?.trim()), semBase = apoioBanco.filter((r) => !porId.get(r.id)?.b)
checa(!semBase.length, 'toda questão com textoApoio no banco tem texto-base no app', `${apoioBanco.length} com texto; sem base no app: ${semBase.length}`)
const apoioDiff = apoioBanco.filter((r) => porId.get(r.id)?.b && norm(app.bases[porId.get(r.id).b]) !== norm(r.textoApoio))
checa(!apoioDiff.length, 'texto-base do app = textoApoio do banco (normalizado)', apoioDiff.map((r) => r.id).join(', '))

// ---------- 5. gabaritos ----------
console.log('\n== 5. Gabaritos do app x banco/*.json ==')
const gabDiff = novas.filter((q) => q.g !== bancoPorId.get(q.id).gabarito)
checa(!gabDiff.length, 'gabarito do app = gabarito do banco em todas as 1.158', gabDiff.map((q) => `${q.id} app=${q.g} banco=${bancoPorId.get(q.id).gabarito}`).join('; '))
const mantidas = Q.filter((q) => q.ant)
const esperadas = ['2010-26', '2010-27', '2010-28', '2010-29', '2010-30', '2012-26', '2012-27', '2012-28', '2012-29', '2012-30']
checa(mantidas.length === 10 && esperadas.every((i) => mantidas.some((q) => q.id === i)), 'as 10 antigas mantidas são BB 2010 e 2012 Q26–30, marcadas ant (gabarito não conferido)', mantidas.map((q) => q.id).join(', '))
const mantidasGab = mantidas.filter((q) => q.g !== antigo.q.find((o) => o.id === q.id).g)
checa(!mantidasGab.length, 'as 10 mantidas conservam o gabarito antigo, sem mudança')

// ---------- 6. as 82 divergências ----------
console.log('\n== 6. As 82 divergências de gabarito ==')
const md = readFileSync(join(R, 'banco/divergencias-gabarito.md'), 'utf8')
const linhas = md.split('\n').filter((l) => l.startsWith('| ') && /\| [A-E] → [A-E] \|/.test(l)).map((l) => l.split('|').map((c) => c.trim()))
checa(linhas.length === 82, 'banco/divergencias-gabarito.md lista 82 questões', `${linhas.length}`)
const erradas6 = linhas.filter((c) => { const [de, para] = c[4].split(' → '); const q = porId.get(c[2]); return !q || q.g !== para || bancoPorId.get(c[2])?.gabarito !== para || antigo.q.find((o) => o.id === c[3])?.g !== de })
checa(!erradas6.length, 'nas 82, o app tem o gabarito novo = banco novo, e o gabarito antigo bate com o backup', erradas6.map((c) => c[2]).join(', '))
checa(Object.keys(mapa.trocas).length === 82 && Object.entries(mapa.trocas).every(([o, [de, para]]) => antigo.q.find((q) => q.id === o).g === de && porId.get(mapa.ids[o]).g === para), 'id-map.trocas tem as mesmas 82 (de/para corretos)')
const antigasSemTroca = antigo.q.filter((o) => mapa.ids[o.id] && !mapa.trocas[o.id] && o.g !== porId.get(mapa.ids[o.id]).g)
checa(!antigasSemTroca.length, 'nenhuma questão trocada de gabarito fora do id-map.trocas', antigasSemTroca.map((o) => o.id).join(', '))

const conferidas = linhas.filter((c) => c[1].startsWith('✔')), pendentes = linhas.filter((c) => !c[1].startsWith('✔'))
checa(conferidas.length === 81 && pendentes.length === 1 && pendentes[0][2] === 'BB-2023-AC-ATU-23' && pendentes[0][1].includes('não conferido na norma do Banco Central'), 'conferência manual: 81 das 82 com ✔; a única pendente é BB-2023-AC-ATU-23 (gabarito oficial, não conferido na norma do Banco Central)', `✔=${conferidas.length}, pendentes=${pendentes.map((c) => c[2]).join(', ')}`)
checa(!linhas.some((c) => c[2] === 'BB-2010-AC-POR-03') && porId.get('BB-2010-AC-POR-03')?.g === antigo.q.find((o) => o.id === '2010-3')?.g, 'BB 2010 Q3 não é divergência: gabarito antigo = novo')

// ---------- 7. mapa de ids ----------
console.log('\n== 7. id-map.json ==')
const destinos = conta(Object.values(mapa.ids), (x) => x)
const doisParaUm = Object.entries(destinos).filter(([, n]) => n > 1)
checa(antigo.q.length === 478 && antigo.q.every((o) => mapa.ids[o.id] || porId.has(o.id)), 'os 478 ids antigos: ou estão no mapa ou continuam no app', `no mapa=${Object.keys(mapa.ids).length}, mantidos=${antigo.q.filter((o) => !mapa.ids[o.id] && porId.has(o.id)).length}`)
checa(Object.values(mapa.ids).every((n) => porId.has(n)), 'nenhum id antigo aponta para id novo inexistente')
checa(!antigo.q.some((o) => mapa.ids[o.id] && porId.has(o.id)), 'nenhum id antigo mapeado continua existindo no app (sem ambiguidade)')
checa(!doisParaUm.length, 'nenhum caso de dois ids antigos para o mesmo id novo', doisParaUm.map(([n, k]) => `${n} ← ${k}`).join('; ') || 'nenhum')
const mapIncons = Object.entries(mapa.ids).filter(([o, n]) => { const a = antigo.q.find((x) => x.id === o), b = porId.get(n); return a.n !== b.n || a.y !== b.y })
checa(!mapIncons.length, 'cada par antigo→novo tem mesmo número e ano', mapIncons.map(([o, n]) => `${o}→${n}`).join(', '))

// ---------- 8. duplicatas ----------
console.log('\n== 8. Duplicatas ==')
const sn = conta(Q, (q) => `${q.s}|${q.n}`), snDup = Object.entries(sn).filter(([, n]) => n > 1)
checa(!snDup.length, 'nenhuma prova+número repetida', snDup.map(([k]) => k).join(', '))
const chave = (q) => letras.every((l) => q.o[l]) ? letras.map((l) => norm(q.o[l]).slice(0, 60)).join('|') : `e:${norm(q.e).slice(0, 160)}`
// Mesma questão = alternativas iguais E enunciado muito parecido (só alternativas iguais dá falso positivo: "I, apenas", "2", "empatia").
const palavras = (t) => new Set(String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2))
const jaccard = (x, y) => { const A = palavras(x), B = palavras(y); let i = 0; for (const w of A) if (B.has(w)) i++; return i / (A.size + B.size - i || 1) }
const grupos = {}; for (const q of Q.filter((x) => !x.ia)) (grupos[chave(q)] ??= []).push(q)
const txtDup = []
for (const g of Object.values(grupos)) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (jaccard(g[i].e, g[j].e) >= 0.6) txtDup.push([g[i], g[j]])
const falsosPositivos = Object.values(grupos).filter((g) => g.length > 1).length - new Set(txtDup.map(([x]) => chave(x))).size
if (txtDup.length) linha('AVISO', 'mesma questão (texto igual) em provas diferentes — a banca reaproveita; podem aparecer duas vezes num mesmo treino', txtDup.map(([x, y]) => `${x.id} = ${y.id}`).join('; '))
else linha('OK', 'nenhuma questão com texto igual em duas provas', `${falsosPositivos} grupos de alternativas iguais descartados por enunciado diferente (alternativas genéricas)`)
const mesmaProva = txtDup.filter(([x, y]) => x.s === y.s)
checa(!mesmaProva.length, 'nenhuma repetição de texto dentro da mesma prova', mesmaProva.map(([x, y]) => `${x.id} = ${y.id}`).join('; '))

// ---------- 9. defeitos conhecidos ----------
console.log('\n== 9. Defeitos de dados conhecidos (decisão do dono) ==')
for (const [id, d] of Object.entries(CONHECIDOS)) linha('CONHECIDO', id, d)

console.log(`\nResumo: ${falhas} falha(s), ${conhecidos} defeito(s) conhecido(s) à espera de decisão, ${avisos} aviso(s).`)
process.exit(falhas || (ESTRITO && conhecidos) ? 1 : 0)
