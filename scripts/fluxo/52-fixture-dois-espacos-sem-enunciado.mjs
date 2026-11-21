// Monta scripts/fluxo/dados/banco-v7-dois.json a partir do banco v7 realista: DOIS espaços com questões SEM enunciado (prova importada + geradas em cada um), mais o "Meu BB".
// Espaço "Concurso X" (já existe: 8 da prova + 9 geradas) e "Segundo" (cópia com ids novos, material copiado). Linhas antigas: sem `enun`, e = id do espaço (o defeito do C-10).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const D = (n) => join(process.cwd(), 'scripts', 'fluxo', 'dados', n)
const v7 = JSON.parse(readFileSync(D('banco-v7.json'), 'utf8'))
const esp = v7.stores.espacos.valores.find((e) => e.nome === 'Concurso X')
const novoId = 'e2segundoxx'
v7.stores.espacos.valores.push({ ...JSON.parse(JSON.stringify(esp)), id: novoId, nome: 'Segundo' })
const qs = v7.stores.questoes.valores.filter((q) => q.e === esp.id)
for (const q of qs) v7.stores.questoes.valores.push({ ...JSON.parse(JSON.stringify(q)), id: q.id + 'b', e: novoId })
const mats = v7.stores.materiais.valores.filter((m) => m.e === esp.id)
for (const m of mats) { v7.stores.materiais.valores.push({ ...JSON.parse(JSON.stringify(m)), id: m.id + 'b', e: novoId }) }
for (const t of v7.stores.trechos.valores.filter((t) => t.e === esp.id)) v7.stores.trechos.valores.push({ ...JSON.parse(JSON.stringify(t)), id: t.id + 'b', m: t.m + 'b', e: novoId })
for (const s of Object.values(v7.stores)) void s
writeFileSync(D('banco-v7-dois.json'), JSON.stringify(v7))
console.log('espaços:', v7.stores.espacos.valores.map((e) => e.nome).join(', '), '| questões:', v7.stores.questoes.valores.length, '| materiais:', v7.stores.materiais.valores.length, '| trechos:', v7.stores.trechos.valores.length)
const porEsp = {}; for (const q of v7.stores.questoes.valores) { const k = q.e; (porEsp[k] ??= { prova: 0, ger: 0 })[q.ger ? 'ger' : 'prova']++ }
console.log('por espaço (id):', JSON.stringify(porEsp))
