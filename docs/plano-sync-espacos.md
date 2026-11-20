# Plano F6 — sincronizar espaços, questões, materiais e imagens pela conta Google

> Só plano (2026-11-20). Nada em `src/`, `scripts/` nem `package.json` foi mexido. Custos e limites em dinheiro do Firebase: `docs/plano-sync-custos.md` (outro agente); aqui só se cita o que mexe no desenho (ver seção 8).
> Regras que NÃO mudam: banco `treino-bb` (nome, chaves de `localStorage`, `appId`), Dexie só acrescenta tabelas/colunas em versão nova, o app funciona sem login e sem internet, o motor só envia depois de ver o servidor, nada local é apagado pelo motor a não ser por lápide, chave de IA nunca sai do aparelho.

## 0. Resumo em 8 linhas

1. Sobe: o espaço (nome, criado, se usa as questões do BB), as questões importadas/geradas (com os textos-base), os materiais e os trechos, as imagens recortadas. **Não sobe**: o PDF original (o app nem o guarda), o índice de busca, a conversa do assistente, o espaço ativo, lembrete, plano em andamento, a chave de IA.
2. Em vez de um documento por questão/trecho (centenas de documentos), o conteúdo vai em **pacotes** de até ~500 KB (uma importação de prova = 1 pacote; um material = 1 ou poucos). Um espaço típico (10 provas + 5 materiais) = **~15 documentos pesados** e ~0,5 MB de texto.
3. Cada pacote tem um **catálogo** pequeno (entra no motor atual como item `p:<id>`, a última alteração vence, com lápide) e um **corpo** pesado (baixado à parte, em segundo plano). Assim a barra de andamento sabe o total sem baixar tudo.
4. **Imagens**: por último, sob demanda e em segundo plano, convertidas para WebP, **como `Bytes` dentro de documentos do Firestore, uma imagem por documento**. Firebase Storage fica de fora: desde 03/02/2026 exige Blaze (cartão) e em São Paulo não tem cota grátis (`plano-sync-custos.md`). Só imagens de figura/tabela (padrão do app).
4b. **Antes de acrescentar dados novos, a leitura precisa ficar incremental** (F6.3a): hoje o app ouve as coleções `itens` e `eventos` inteiras e, depois de 30 min sem conexão, o Firestore cobra tudo de novo a cada abertura. Os pacotes herdariam esse defeito.
5. Progresso por questão **já sobe** (eventos): questão de espaço que ainda não chegou só fica sem aparecer, nada quebra (a conferir em teste, fase F6.2).
6. Antes de tudo (**F6.0**): testar com a conta Google REAL o que já existe. Hoje só foi testado com nuvem simulada.
7. Dois defeitos do que existe hoje que a sincronização pioraria e entram no plano: o id do espaço é aleatório (dois aparelhos criam dois espaços "iguais") e a questão importada tem uma chave só (`id`), então a mesma questão em dois espaços **troca de dono** na tabela `questoes` (seção 2.6).
8. 10 fases pequenas (F6.0 a F6.8, com a F6.3a no meio), ~15 a 19 dias de trabalho no total, cada uma com teste próprio (seção 6).

## 1. O que subir e o que não subir

### 1.1 Medido com os dados reais (22 provas Cesgranrio em `~/Documents/Banco de questões Bancos Cesgranrio`, 16 PDFs de uma disciplina de faculdade, scripts descartáveis fora do repositório)

| Coisa | Medida real |
|---|---|
| Prova (PDF) | ~515 KB, ~20 páginas, ~53 questões (22 provas: 11,1 MB, 432 páginas, 1.164 questões) |
| Questões da prova já montadas (`Question` + textos-base) | **~48 KB em JSON** por prova (~930 B por questão); gzip ~14 KB. Todas as 22: 1,06 MB (gzip 0,3 MB) |
| Imagem recortada de uma questão (PNG, escala 2,2, como o app faz) | média **145 a 180 KB**, máxima 730 KB |
| Imagens no modo padrão do app (`figuras`: só questão com figura/tabela, 3 a 10 por prova) | **0,3 a 2,7 MB por prova** (média ~1,2 MB). Com a opção "todas": **10 a 12 MB por prova** |
| Mesmas imagens em WebP qualidade 0,85 | **~3,5× menores**: figuras 0,2 a 0,7 MB por prova; "todas" ~3 MB por prova |
| Material de estudo (16 PDFs, 474 páginas) | PDFs somam **79 MB**, mas o texto útil é 464 mil letras = 3.256 trechos = **711 KB de JSON** (gzip 183 KB): ~200 trechos e ~45 KB por material |
| Espaço típico (10 provas + 5 materiais) | texto **~0,7 MB** (≈ 15 pacotes); imagens ~12 MB em PNG (padrão) ou ~3 MB em WebP; até ~100 a 300 MB só se a pessoa importar "todas as imagens" de muitas provas em PNG |

Conclusões que embasam as escolhas: (a) o **texto é pequeno** (cabe de sobra em Firestore); (b) a **imagem é que pesa** (uma ordem de grandeza acima do texto) e é onde mora o risco de custo; (c) o **PDF é a parte mais pesada e a menos útil** (o app não precisa dele depois de extrair).

### 1.2 Decisão

| Dado (tabela Dexie) | Sobe? | Como |
|---|---|---|
| `espacos` (linha do espaço criado) | **Sim** | só o mínimo: `nome`, `criado`, `usaBB`. O resto (`fontes`, `bases`, `bancos`, `materias`, `extras`) é derivado das questões e vai dentro dos pacotes (2.2) |
| `questoes` (importadas e geradas, `ger:1` e `fonte`) | **Sim** | em pacotes `q` |
| `materiais` + `trechos` | **Sim** | em pacotes `m` (metadados + trechos) |
| `imagens` (recortes) | **Sim, só as de figura/tabela, por último e sob demanda** | WebP em `Bytes` no Firestore (2.4); "todas as questões como imagem" fica local |
| PDF original da prova/material | **Não** | o app não o guarda hoje (só texto e imagem recortada); também não é necessário para estudar. O arquivo continua no computador/Drive da pessoa. Ocuparia 0,5 MB a 5 MB por arquivo à toa e custaria o maior pedaço da cota |
| Índice de busca (MiniSearch) | **Não** | é derivado e refeito em memória (já é regra do F1 do agente offline) |
| `conversa` do assistente | **Não** | é do aparelho (300 falas, ligada ao uso de cada um, pode ter nome de arquivos e dúvidas pessoais). A cópia de segurança em arquivo continua para quem quiser |
| `meta`: `espaco:ativo`, `plano:ativo`, `lembrete`, `copia:ultima`, `sync:*` | **Não** | por aparelho (notificação, permissão e "onde estou" são do aparelho) |
| Chave de IA (`localStorage.logos_ia_chave`) | **Nunca** | continua só no aparelho, fora de nuvem e de backup |
| Espaço **embutido do BB** e as 1.168 questões embutidas | **Nunca** | vêm no app; o espaço "com as questões do BB" sobe só com `usaBB:true` e **as questões próprias** |
| Progresso, marcações, cartões | **Já sobem** | motor atual (`eventos`, `itens`), sem mudança |

## 2. Modelo de dados

### 2.1 Visão geral (tudo em `users/{uid}/...`, a mesma regra de hoje)

```
users/{uid}/itens/e:{eid}       ESPAÇO   {u, dev, x?, v:{nome, criado, usaBB, local?}}      (LWW + lápide: o motor de hoje)
users/{uid}/itens/p:{pid}       CATÁLOGO {u, dev, x?, v:{e, k:'q'|'m', n, b, de, ...}}      (LWW + lápide: o motor de hoje)
users/{uid}/corpo/{pid}         CORPO    {e, k, d:'<JSON em texto>', z?:1}                 (pesado, imutável, baixado à parte)
users/{uid}/imagens/{qid}       IMAGEM   {e, w:Bytes(WebP), t:'webp', u, dev}               (1 por documento, baixada sob demanda; ver 2.4)
```
Subcoleções fechadas e conhecidas: `itens`, `eventos`, `corpo`, `imagens` (as regras trocam o `{documento=**}` livre por essa lista, 5.1).

- **Por que no `itens` e não coleção nova para espaço e catálogo?** O motor já faz tudo com `ItemNuvem {key,u,dev,x?,v}`: carimbo em `sinc`, `aEnviarItens`, `aplicarItens`, lápide, semear no primeiro login, só enviar depois de ver o servidor. Os tipos novos entram em `tipoDe` (`core/sync/nuvem.ts`: prefixos `e:` e `p:`), em `valoresDe`/`aplicarItens` (`services/db.ts`) e em `itemValido`. Pouco código novo e nada do que já funciona muda.
- **Por que separar catálogo e corpo?** O Firestore não devolve só alguns campos de um documento: ouvir uma coleção baixa tudo. O catálogo (poucas centenas de bytes cada) é ouvido ao vivo como hoje (barato, entra no cache offline) e diz **quantos pacotes existem, de que espaço, quantos bytes**: é o que dá a **barra de andamento** e permite baixar o corpo **um por vez, em segundo plano, com `getDoc`**. O corpo nunca é ouvido em tempo real.
- Escrita do catálogo + corpo **no mesmo lote** (`writeBatch`, ≤ ~600 KB): ou os dois aparecem ou nenhum (o outro aparelho nunca vê catálogo sem corpo).

### 2.2 Pacote (o corpo)

- `d` = **um campo de texto** com o JSON do conteúdo (não um mapa/array de campos do Firestore): evita que o Firestore crie milhares de entradas de índice por documento (limite por documento) e deixa o tamanho previsível. Planejado também `firestore.indexes.json` com `fieldOverrides` desligando a indexação de `d`.
- **Limite do pacote: 500 KB** de JSON (1 MiB é o limite do documento; acento conta 2 bytes; sobra folga). Medição: prova típica 48 KB, a maior das 22 ~86 KB; material típico 45 KB. Material grande (o limite do app é 20 mil trechos / 4 milhões de letras ≈ 4 MB) vira **partes** `m-<materialId>-0`, `-1`… de até 500 KB. Compressão (gzip via `CompressionStream`) fica como **campo reservado `z`**, não ligada na primeira versão (JSON legível ajuda a depurar; o texto é pequeno).
- **Pacote `q`** (uma importação, ou um lote de gerar-questões): `{ questoes:[Question sem o campo e], bases:{id→texto}, fontes:{chave→rótulo}, bancos:[{id,nome}] }`. Id do pacote = `q-<eid>-<hash dos ids das questões, ordenados>`: **o mesmo conjunto de questões dá o mesmo pacote**, então a mesma prova importada em dois aparelhos (no mesmo espaço) cai no mesmo documento: não duplica. Imagem **não** vai junto (o campo `img: "u:<id>"` já aponta para ela).
- **Pacote `m`** (um material): parte 0 leva `{id,nome,tipo,criado,trechos,caracteres}` + os primeiros trechos como `[{i,t}]` (sem repetir `m`, `e`, `id`, que se refazem); as demais partes só trechos. Id = `m-<materialId>-<parte>`; o `materialId` já vem do conteúdo (`'M' + hashTexto(espaço|trechos)`).
- Pacotes são **imutáveis**: mudou o conteúdo, é outro id. Não existe "editar um pacote" (e o app já funciona assim: a correção da IA acontece na prévia, antes de importar, e o id da questão não muda). Reimportar uma prova com mais questões gera um pacote novo; o mesmo `id` de questão em dois pacotes é resolvido na aplicação (união por id, 3.4).

### 2.3 Espaço (catálogo `e:`)

`v = {nome, criado, usaBB, local?}`. `local:true` = "só neste aparelho" (2.5/7.3): nesse caso **nada** do espaço sobe (nem o catálogo). Renomear = nova versão do item `e:` (a última alteração vence). Apagar = lápide `x:1` + apagar os corpos na nuvem (3.1). O espaço do BB **não tem** item `e:` (embutido, nunca sobe).

### 2.4 Imagens

Decisão tomada com base em `plano-sync-custos.md`: **Firestore com `Bytes`, um documento por imagem** (`users/{uid}/imagens/{qid}` = `{e, w, t:'webp', u, dev}`, ≤ 600 KB; a maior imagem medida em PNG foi 730 KB). **Firebase Storage fica de fora** (exige Blaze com cartão desde 03/02/2026 e não tem cota grátis em `southamerica-east1`); se um dia o projeto for para o Blaze, migrar as imagens para um bucket em `us-central1` é uma fase à parte e o desenho local não muda (a porta de imagens é uma interface).
- **Só sobem as imagens de figura/tabela** (o padrão `figuras` do app: 3 a 10 por prova, 0,3 a 2,7 MB em PNG). A opção "todas as questões como imagem" (10 a 12 MB por prova em PNG; ~30 MB por espaço) fica **só no aparelho**, com aviso (decisão 7.9).
- **Quem sobe**: o aparelho que tem a imagem local e vê (pelo catálogo do pacote `q`, campo `im` = ids das imagens que ele tem na nuvem) que falta; fila por último, em Wi-Fi.
- **Quem recebe**: **sob demanda**: o gancho `ui/useUrlImagem.ts` hoje, se `lerImagem(id)` não acha, mostra o aviso; passa a buscar com `getDoc` (com internet), guardar o blob no Dexie e mostrar. Além disso, a fila de segundo plano baixa as que faltam (4.1). Nunca com `onSnapshot` de coleção (cada leitura é cobrada).
- **Formato**: a cópia local continua o PNG recortado; só o que **sobe** é convertido. Medido no Chrome (BB 2018, `canvas.toBlob`): WebP q0,85 = 28 % do PNG (com perda); WebP q1,0 = 38 % (todas) e 51 % (figuras, pelo canvas; o pesquisador mediu 26 % com `sharp` sem perda, mas `sharp` não roda no app e o canvas não garante sem perda). Recomendo **q1,0 do canvas** (menos risco de letra borrada) e conferir 5 imagens com fórmula/tabela (decisão 7.4); com q1,0 as figuras de uma prova ficam em 0,3 a 1,4 MB.

### 2.5 Como encaixa no motor atual sem quebrar nada

| Ponto | O que muda | O que não muda |
|---|---|---|
| `core/sync/nuvem.ts` | `tipoDe` entende `e:` e `p:`; `itemValido` valida o `v` deles (tamanhos, tipos); novas funções puras de empacotar/aplicar (arquivo novo `core/sync/espacos.ts`) | `b:`, `c:`, `m:`, `fc`, `fch`; `maisNovo`; `eventos` |
| `services/db.ts` | **Dexie v8**: acrescenta a tabela `pacotes` (`id, e, estado`: o registro local de cada pacote: `q`/`m`, bytes, `estado: 'local'|'a-baixar'|'baixando'|'subindo'`) e a coluna `pk` (opcional, sem índice) em cada linha de `questoes`/`trechos`/`materiais` (de qual pacote veio, para o "desfazer" e o "apagar material" saberem o pacote). Funções que gravam espaço/questão/material (`salvarEspaco`, `apagarEspaco`, `removerQuestoesDoEspaco`, `salvarMaterial`, `apagarMaterial`, `acrescentarConteudoDoAparelho`, `gravarImagem`) **carimbam em `sinc` na mesma transação**, como `saveCartao` faz hoje. `semearSinc` ganha espaços/pacotes que já existiam | `prog`, `meta`, `decks`, `cards`, `eventos`, `sinc` (v4), `espacos`, `questoes`, `imagens`, `materiais`, `trechos`, `conversa`; o nome `treino-bb`; ids por conteúdo |
| `services/sync/motor.ts` | `Porta` ganha: `enviarCorpo(pid, corpo)`, `baixarCorpo(pid)`, `apagarCorpos(pids)`; nova **fila de download** (um corpo por vez) depois de eventos e itens; envio de corpo antes/junto do catálogo (lote) | as regras 1 a 4 do cabeçalho do motor; ordem: itens e eventos primeiro |
| `services/sync/firestore.ts` | métodos novos da porta; leitura do corpo com `getDoc` (não `onSnapshot`); **F6.3a: `ouvirItens`/`ouvirEventos` passam de "coleção inteira" a consulta incremental** (seção 6) | persistência offline, lotes de 400, `emLotes` |
| `Efeitos` | `aoReceber` ganha `espacos:boolean` → `useEspacos` recarrega a lista (hoje só cartões/marcas/progresso) | |
| Telas | "Mais › Conta e sincronização": "Espaços e materiais: 7 de 12 pacotes"; "Meus espaços": selo por espaço | regra do teclado, câmera, `ConfirmarAcao` para apagar |

### 2.6 Dois problemas que já existem hoje e a sincronização agravaria (tratados em fases)

1. **Id do espaço é aleatório** (`novoId()` = `'e' + Date.now() base36 + 2 dígitos`). Dois aparelhos que criam "Concurso X" separados produzem **dois espaços**; depois de sincronizar a pessoa vê os dois. Não dá para derivar o id do nome (renomear não pode mudar o id; nomes iguais podem ser espaços diferentes). Solução planejada: ação **"Juntar com outro espaço"** (F6.7), que faz a união por ids de conteúdo (mesma lógica de 3.4) e põe lápide no outro. Sem juntar automático: nunca decidir sozinho que dois espaços são o mesmo.
2. **Chave única nas questões importadas**: `questoes` tem chave primária `id` (e índice `e`); `imagens` também. Como o id da questão é o **hash do conteúdo**, a mesma questão importada em **dois espaços** (ex.: dois espaços "com as questões do BB" onde se importou a mesma prova) tem **uma só linha**, que passa a pertencer ao último espaço; apagar um espaço apaga a questão do outro. Hoje isso é raro; com a sincronização (espaço A criado no celular, B no PC, mesma prova) vira comum. Plano (F6.2): no Dexie v8, tabelas novas `questoesE` e `imagensE` com chave composta `[e+id]` (Dexie aceita), cópia na migração, e **as antigas ficam intactas** (nunca se apaga tabela, só se acrescenta; leitura passa a ser das novas, as antigas viram "legado" e podem sair numa versão futura). Se o dono preferir não mexer nisso agora: limite aceito e documentado, e o pacote sobe com `e` do jeito que está. **Recomendo consertar** (decisão 7.5): é a fase com mais risco de regressão local, por isso vem com teste de migração e cópia de segurança antes.

## 3. Conflitos e remoção

### 3.1 Espaço apagado num aparelho
- Apagar = lápide `x:1` no item `e:<eid>` + lápide nos itens `p:` dele + **apagar os corpos** (e imagens) na nuvem em lotes (quem apagou faz; se cair a internet no meio, a lápide fica e o resto é terminado na próxima sincronização: a fila de limpeza é "pacotes de espaço com lápide que ainda têm corpo na nuvem").
- Os outros aparelhos recebem a lápide e **apagam o espaço localmente** (mesma função `apagarEspaco`, sem gerar nova lápide). O motor atual já aceita isso para cartões; a regra "nada local é apagado pelo motor" continua valendo: **apaga só por lápide**.
- O **progresso e as marcações das questões não são apagados** (já é assim hoje: ids por conteúdo; importar de novo recupera).
- Se o espaço apagado era o ativo naquele aparelho: volta para o do Banco do Brasil (como `useEspacos.apagar` faz).
- **Edição mais nova que a lápide vence a lápide**: se o aparelho B (offline) importou uma prova depois que A apagou o espaço, a versão de B (`u` maior) ressuscita o espaço e B reenvia o que tem; ninguém perde o que acabou de importar. O contrário (apagou depois de editar) apaga. É a mesma regra "a última alteração vence" dos cartões, e `apagar` pede confirmação em aviso central (já existe). **Decisão 7.6**: ter ou não uma "lixeira" de 7 dias; recomendo **não** na primeira versão.

### 3.2 Mesmo PDF importado em dois aparelhos
- No **mesmo espaço** (mesmo `eid`, depois de sincronizar): mesmos ids de questão → mesmo conjunto → **mesmo `pid`** → um documento só (escrita idempotente). Se um aparelho importou "figuras" e o outro "todas as imagens", os `pid` são iguais (o id não depende de imagem) e a **imagem é por questão, sem versão**: quem tem manda; ficam as duas (união).
- Em **espaços diferentes** (cada aparelho criou o seu): são dois espaços; vale 2.6 item 1.
- Material igual no mesmo espaço: mesmo `materialId` (conteúdo + espaço) → não duplica (como hoje).

### 3.3 "Desfazer" de importação (C-9) e geradas
- Desfazer hoje (`removerQuestoesDoEspaco`): tira só as questões que a ação trouxe e devolve a linha do espaço ao que era. Com a sincronização: o pacote `q` dessa importação (achado pela coluna `pk`) recebe **lápide** (`p:` com `x:1`), o corpo é apagado, as imagens das questões somem da nuvem. Os outros aparelhos aplicam a lápide e tiram **só as questões daquele pacote que nenhum outro pacote traz** (contagem de referências por `id`: a mesma questão pode estar em dois pacotes).
- A regra do C-9 ("só enquanto nada foi respondido") vale **no aparelho que desfaz**; os outros aparelhos não perguntam: se já respondeu, o progresso fica (ids por conteúdo) e a questão volta se o pacote voltar. Aceito e documentado.
- "Desfazer" do aviso de apagar (material): hoje devolve o material com os trechos. Na nuvem: nova versão do item (`u` maior) volta a valer e o pacote é reenviado (idempotente).

### 3.4 Aplicar um pacote que chega (regras do lado de quem recebe)
- União por `id`, **sem reduzir o que existe**: questão já presente fica; se a que chega tem `img` e a local não, ganha. Para as `bases`/`fontes`/`bancos`: união. Depois recalcula `materias`/`extras` do espaço com a mesma função de hoje (`materiasDasQuestoes`) e grava tudo **numa transação por pacote** (ou entra inteiro ou nada). Pacote de espaço que ainda não chegou (ordem de rede): espera; o catálogo `e:` sempre vem primeiro (fila).
- Documento de nuvem **nunca é confiado**: `pacoteValido` confere forma, tamanhos e limites (como `itemValido` e `eventoValido`) e descarta lixo sem quebrar a abertura.

### 3.5 Espaço embutido do BB
Nunca tem item `e:` nem pacote. Espaço "com as questões do BB" sobe com `usaBB:true`; as embutidas vêm do app em cada aparelho. Cuidado de teste: pacote `q` jamais inclui questão com id do banco embutido (filtro e teste).

### 3.6 Progresso de questão cujo espaço ainda não chegou
- Os eventos de resposta já chegam por `eventos` e viram `prog[id]` sem precisar da questão (a derivação é por id). Enquanto a questão não existe localmente: ela não aparece em Treinar/Desempenho por matéria (as telas partem de `BANK`), **mas a contagem geral e a sequência do dia contam** (vêm dos eventos/hist). Sem erro.
- **A conferir no F6.2 com teste**: caderno de erros, "Rever erros", desempenho por matéria e "matéria fraca" com `prog` de id inexistente (não podem lançar exceção nem contar a questão fantasma). Quando o pacote chega, o espaço recarrega (`aoReceber.espacos`) e a questão aparece com seu progresso já pronto.
- Marcações (`m:<id>`) idem.

### 3.7 Outros casos
- **Espaço renomeado nos dois**: a última alteração vence (nome só).
- **Pacote chega e o espaço local está aberto**: a troca de espaço recomeça as telas (`versao`), mas **não se recarrega o espaço ativo no meio de um treino/simulado**: aplica na gravação e só recarrega a lista; o espaço ativo é reaplicado quando a pessoa sai da sessão (regra de não regredir: nada mexe numa questão em andamento).
- **Cota estourada ou arquivo gigante**: o item fica "só neste aparelho" com aviso na tela; nunca perde dado local.
- **Mais de uma conta no aparelho**: já tratado (`meta['sync:uid']`).

## 4. Primeiro login em aparelho novo: ordem, offline, rede

### 4.1 Ordem
1. Login → o motor de hoje baixa `eventos` e `itens`. Isso já traz **progresso, cartões, marcações e o catálogo de espaços/pacotes (`e:` e `p:`)**: poucos KB. A tela já mostra "Meus espaços" com selos "na nuvem · N pacotes · X MB".
2. **Fila de download em segundo plano**, um corpo por vez, nesta ordem: (a) espaço **ativo/mais recente** (pacotes `q` e `m`), (b) os outros espaços, do mais usado ao menos, (c) **imagens**, só depois do texto. Cada pacote entra numa transação; pacote parcial não existe. Se o app fechar, no próximo início a fila **recomeça do que falta** (diferença entre o catálogo e a tabela local `pacotes`: não precisa de estado especial).
3. Barra de andamento em "Mais › Conta e sincronização": "Baixando espaços: 7 de 12 pacotes (5,3 de 8,1 MB)". Na lista de espaços, o espaço que ainda não terminou mostra "baixando…" e fica **utilizável com o que já chegou** (as questões entram à medida que os pacotes entram).
4. Primeiro login no aparelho que **já tem** espaços locais: `semearSinc` cria os pacotes locais (um por prova `s` e um por material), sobe tudo (fila de envio, **Wi-Fi**, imagens por último). O que a nuvem já tem não é reenviado (mesmo `pid`). **Freio de escrita**: a cota grátis é de 20.000 escritas/dia para o projeto todo; a primeira subida (pacotes + imagens + o progresso antigo, se também ainda não subiu) **para em ~15.000 escritas por dia e continua no dia seguinte** (`sync:escritas` = contagem do dia em `meta`; erro `resource-exhausted` vira estado "cota do dia, volto amanhã", não falha).

### 4.2 Offline e Wi-Fi
- Tudo continua funcionando sem internet com o que já está no Dexie; o que não chegou **só não aparece** (nada de erro).
- **Conexão móvel**: texto (catálogo e pacotes `q`/`m`, ~0,7 MB por espaço) baixa em qualquer rede (é pequeno). **Imagens e envio em lote só em Wi-Fi por padrão** (`navigator.connection` não existe no Safari; no Android WebView/Chrome existe `connection.type`; quando não dá para saber, trata como "não sei": pergunta uma vez, "baixar imagens também no 4G/5G?"). Interruptor em "Conta e sincronização": **"Usar dados móveis para imagens"** (desligado de fábrica). **Decisão 7.7**.
- **Limites de tamanho** (valores de partida; a cota grátis do projeto todo é 1 GiB, seção 8): pacote 500 KB; documento 1 MiB (Firestore); imagem enviada ≤ 600 KB depois do WebP; **espaço ≤ 25 MB** e **conta ≤ 100 MB** somando texto e imagem (um espaço típico tem ~3,5 MB; o dono medido em `plano-sync-custos.md` ~12 MB no total). Passou: o item fica "só neste aparelho" com aviso claro (e a pessoa pode apagar para liberar).
- A fila não bloqueia nada: erro vira estado ("Espaços: erro, tentando de novo"), com tentativas espaçadas (1 min, 5 min, 30 min).

## 5. Segurança e privacidade

### 5.1 Regras do Firestore (`firestore.rules`) — hoje: só `users/{uid}/**` para o dono
Acrescentar **validação de formato e de tamanho** (a "Fase 5" que o arquivo já cita) com testes no emulador:
- `users/{uid}/corpo/{pid}`: só o dono; `request.resource.data.keys().hasOnly(['e','k','d','z'])`; `d is string && d.size() <= 600000`; `k in ['q','m']`; `pid` em formato esperado (`matches('^[qm]-[A-Za-z0-9_-]{1,80}$')`).
- `users/{uid}/itens/{chave}`: continua aceitando tudo do dono, mas com `u` número, `dev` texto, e `v` mapa quando não é lápide; para `p:` e `e:` limitar tamanho dos campos.
- `users/{uid}/imagens/{qid}`: `keys().hasOnly(['e','w','t','u','dev'])`, `w is bytes && w.size() <= 600000` (sintaxe de `size()` em `bytes` a confirmar no emulador).
- Todo o resto continua `allow ... if false`. **Trocar** `match /users/{uid}/{documento=**}` por uma lista fechada (`itens`, `eventos`, `corpo`, `imagens`), cada uma com a sua validação.
- **Sem `get()`/`exists()` nas regras de sincronização** (cada um é uma leitura cobrada, achado do pesquisador de custos).
- **Cota por usuário**: o Firestore não soma tamanho por usuário em regras de forma simples. Primeira versão: **cota no cliente** (o app não envia acima do limite) + limite por documento nas regras. Opção futura mais rígida (só se o app abrir ao público): documento `users/{uid}/meta/uso` com o total de bytes, atualizado no mesmo lote, e regra com `getAfter()` (custa 1 leitura por escrita). No plano grátis um abusador só consegue esgotar a cota do projeto, não gerar conta.
- Testes: `@firebase/rules-unit-testing` + emulador (`firebase.json` já tem `firestore` 8080 e `auth` 9099): dono lê/escreve; outro usuário e anônimo negados; `d` grande demais negado; campo extra negado; `corpo` de outro `uid` negado. É o que falta da F5 antiga.

### 5.2 Storage: fora deste plano
Não há `storage.rules` nem Storage ligado (o bucket só aparece em `firebaseConfig.ts`). Se um dia o projeto for para o Blaze e as imagens migrarem para o Cloud Storage, entram então `storage.rules` (dono lê/escreve em `users/{uid}/...`, tamanho e tipo limitados), bloco `"storage"` em `firebase.json` e o emulador na porta 9199.
**App Check**: só ao abrir o app ao público (Play Integrity pode recusar APK instalado fora da Play Store, não confirmado).

### 5.3 Privacidade (material pode ser autoral ou pessoal)
- O conteúdo fica **só na conta da pessoa** (regras de dono), sem compartilhar com ninguém e sem uso pelo app para nada além de devolver ao próprio dono. Mas **não é criptografado de ponta a ponta**: o Google guarda em servidores (a conta e o projeto são do dono). Criptografar no aparelho (senha própria) é possível mas impede abrir em aparelho novo sem a senha e quebra a busca em segundo plano: **fora do escopo**, anotado como opção futura.
- **Por espaço, interruptor "Só neste aparelho"** (`local:true`): quem tem material que não quer na nuvem (provas pagas de cursinho, apostilas com nome, anotações pessoais) mantém local. **Decisão 7.3**: padrão ligado (sobe) ou desligado (pergunta antes de subir pela primeira vez)? Recomendo: **sobe, mas na primeira vez que o aparelho for subir um espaço, um aviso central explica o que sobe e oferece "Manter só aqui"** (um toque, sem pergunta no meio do caminho depois).
- **Excluir conta / "Apagar tudo da nuvem"**: hoje não existe (conferido no código). Entra na F6.7: apaga `itens`, `eventos`, `corpo`, `imagens`/Storage do `uid` em lotes e desfaz o vínculo do aparelho (`sync:uid`); o app local não perde nada.
- Nada de chave de administrador no projeto; nada de dado pessoal em nomes de arquivo/URL (o `pid` é hash; o nome do material só vive dentro do catálogo `v`).
- Direito autoral: o dono é quem escolhe o que importa; a nuvem é privada dele. Se um dia o app for público, rever (termos de uso).

## 6. Fases (cada uma pequena, com teste)

Estimativa de esforço em dias de trabalho de desenvolvimento (já inclui os testes). Cada fase termina com `npm run verificar` e, se mexer em tela, `node scripts/e2e-teclado.mjs` (e `e2e-camera.mjs` se algo surgir por toque).

### F6.0 — Testar o que já existe com a conta Google REAL (primeiro, antes de escrever código novo) · 0,5 dia + ~1 h do dono
Objetivo: descobrir se a base (login, Firestore, regras, motor) funciona de verdade, porque **só foi testado com nuvem simulada**.
- **Eu faço**: rodar os emuladores (`firebase emulators:start --only auth,firestore`) e um e2e novo `scripts/e2e-sync-emulador.mjs` (dois contextos de navegador = dois "aparelhos", login simulado no emulador de Auth) que cobre: cartão criado no A aparece no B; resposta do A chega ao B; apagar baralho no A apaga no B; B offline volta e junta; "zerar" + "desfazer". Conferir `firestore.rules` publicadas (`firebase deploy --only firestore:rules` só se o dono mandar; hoje não há registro de deploy).
- **O dono faz (checklist com a conta real)** — vira `docs/fluxos/TESTES-SYNC-REAL.md`:
  1. No console Firebase: Authentication › Método de login › Google **ligado**; domínios autorizados incluem o do Hosting.
  2. Site: abrir o endereço do Hosting, Mais › Conta e sincronização › Entrar com Google. Conferir "ok" (sem "erro").
  3. APK: entrar com a mesma conta (SHA-1 do `debug.keystore` cadastrado: já anotado no README). Conferir o mesmo e-mail.
  4. Criar um baralho com 2 cartões no site; abrir no celular: aparece em segundos? Responder 3 questões no celular; ver o progresso no site.
  5. Modo avião no celular: estudar 2 cartões; ligar a internet: chegam ao site?
  6. No console Firestore: aparecem `users/<uid>/eventos` e `itens`? Não aparece nada de outro usuário (testar com outra conta Google: tem de ser recusada com a mensagem do app).
- **Critério para seguir**: os 6 itens passam. Se falhar, **a F6 espera** e a correção entra como F6.0b.
- Risco: SHA-1/consentimento do Google, domínio não autorizado, regras não publicadas.

### F6.1 — Núcleo puro: modelo, pacotes e regras de aplicar (sem banco nem rede) · 1,5 dia
- `src/core/sync/espacos.ts` (novo): chaves `e:`/`p:`, `empacotarQuestoes(questoes, bases, fontes, bancos, eid)` (≤ 500 KB, id pelo hash dos ids), `empacotarMaterial(material, trechos)`, `desempacotar*`, `aplicarPacote(local, pacote)` (união sem reduzir), `pacoteValido`/`catalogoValido` (limites), contagem de referências de questão entre pacotes (para o desfazer), `limites` (constantes).
- Testes vitest (`espacos.test.ts`): mesmo conjunto = mesmo `pid`; ordem dos ids não muda o `pid`; prova de 70 questões cabe em 1 pacote; material de 20 mil trechos vira N partes ≤ 500 KB; pacote com lixo é recusado; aplicar duas vezes não muda; aplicar em qualquer ordem dá o mesmo resultado (propriedade); id do banco embutido nunca entra; acentos contam 2 bytes na conta do tamanho.
- Dados de teste: usar uma das 22 provas reais já medidas (só os números, sem o PDF no repositório).
- Risco baixo.

### F6.2 — Banco local v8: tabela `pacotes`, coluna `pk`, chave composta das questões, carimbos · 2 a 3 dias (a mais delicada)
- Dexie **v8** (só acrescenta): `pacotes`, `questoesE` `[e+id]`, `imagensE` `[e+id]` com migração por cópia das antigas; as antigas ficam como estão. Leitura/gravação passam para as novas; `lerConteudoDoAparelho`/`acrescentarConteudoDoAparelho` (cópia de segurança) lidos dos dois lados no mesmo formato de arquivo (a cópia **v2 continua válida**).
- Carimbo em `sinc` na mesma transação de `salvarEspaco`, `apagarEspaco`, `removerQuestoesDoEspaco`, `salvarMaterial`, `apagarMaterial`, `gravarImagem`, `acrescentar...` e restauração de cópia.
- `semearSinc` com espaços/pacotes/materiais existentes.
- Testes: `services/db.test.ts` (migração v7→v8 com dados: espaços, questões, imagens, materiais; atomicidade); `scripts/e2e-migracao.mjs` (banco de verdade vindo da v7: nada some, progresso intacto); **teste do caso 2.6 item 2** (mesma questão em dois espaços; apagar um não mexe no outro); teste do caso **3.6** (evento de questão inexistente não derruba caderno/desempenho/"Rever erros"/matéria fraca); `e2e-copia.mjs` e `e2e-assistente.mjs` continuam passando.
- O dono: **faz uma cópia de segurança antes** de instalar o APK desta fase (Mais › Cópia de segurança) e confere que espaços, materiais e imagens continuam iguais (item 1 e 7 de `TESTES-NO-APARELHO.md`).
- Risco: **regressão de dados locais** (a mais séria do projeto). Mitigação: nada é apagado, migração por cópia, teste com banco v7 real, atualização por cima como sempre.

### F6.3a — Leitura incremental do que já existe (antes de pôr dados novos) · 1,5 a 2 dias
Achado do pesquisador de custos: `services/sync/firestore.ts` usa `onSnapshot(collection(...))` sem filtro em `itens` e `eventos`; com o cache offline ligado, depois de 30 min sem conexão o Firestore cobra **todos** os documentos de novo a cada abertura (palpite: 13.000 leituras por abertura fria do dono = 26 % da cota diária; em 100 usuários, ~US$ 11/mês só de progresso). Pacotes e catálogo herdariam isso.
- **O que fazer**: `ouvirItens` e `ouvirEventos` passam a consulta `where('u','>', cursor - margem)` + `orderBy('u')` (eventos: o campo de tempo `t`, que o app já grava na linha local e provavelmente já vai no documento: **conferir no emulador**; evento sem `t` no topo não apareceria na consulta). `cursor` fica em `meta['sync:cursor']` por coleção (maior `u`/`t` visto do **servidor**). **Margem de 7 dias** para relógio atrasado de outro aparelho (as repetições são inofensivas: juntar é união idempotente). A **primeira vez** num aparelho (sem cursor) lê tudo uma vez, como hoje.
- **Exclusão não aparece em consulta incremental**: hoje "Desfazer zerar" **apaga o documento** do evento (`apagarEvento`), e um aparelho que já passou do cursor nunca saberia. Troca: o desfazer vira um **evento novo "desfeito"** (ou lápide com `t` novo) que o `derivar` entende; documentos antigos apagados continuam valendo na leitura completa da primeira vez. Mexe em `core/sync/eventos.ts` (puro, com testes de propriedade já existentes: juntar em qualquer ordem, repetir não duplica).
- **Testes**: `motor.test.ts` com porta que só devolve o que passou do cursor; e2e do emulador (F6.0) com um aparelho "dormindo" 40 min simulados e contagem de leituras do emulador (comparar antes e depois: meta = dezenas, não milhares); `e2e-sync-base.mjs` continua passando.
- Riscos: perder uma alteração por relógio muito errado (margem + a leitura completa manual "Sincronizar tudo de novo" em Conta e sincronização); desfazer-zerar mal traduzido. Mesmo se o dono nunca usar espaços, esta fase vale sozinha.

### F6.3 — Porta e motor: enviar/baixar pacotes (texto) · 2 dias
- `Porta`: `enviarCorpo`, `baixarCorpo`, `apagarCorpos`; `portaFirestore` com `getDoc` e lote catálogo+corpo; fila de download no motor; `Efeitos.aoReceber.espacos`; `useEspacos` recarrega a lista; **não** recarrega espaço ativo em treino em curso.
- Testes: `motor.test.ts` com porta de mentira (envio só depois do servidor; corpo antes do catálogo; baixar um por vez; retomada depois de queda; pacote inválido ignorado; lápide apaga local sem gerar lápide nova; ressuscitar por edição mais nova); e2e no emulador com **dois aparelhos**: importar uma prova no A (PDF gerado pelo Chrome como em `e2e-assistente.mjs`) e ver as questões no B, treinar, desfazer a importação no A e ver sumir no B.
- Risco: ordem de eventos de rede, pacote que chega antes do espaço (fila garante `e:` primeiro).

### F6.4 — Regras do Firestore validando formato e tamanho + testes no emulador · 1 dia
- Seção 5.1; `firestore.indexes.json` com `fieldOverrides` (sem índice em `d`); testes `scripts/rules-firestore.test` (ou vitest com `@firebase/rules-unit-testing`, dependência de desenvolvimento a decidir no passo — **não** instalar sem avisar).
- O dono: `firebase deploy --only firestore:rules` (ou eu o faço se mandar) e repetir F6.0 itens 4 e 6.

### F6.5 — Telas: andamento, selos e interruptores · 1,5 dia
- "Mais › Conta e sincronização": linha "Espaços e materiais" com barra de andamento, "Pausar", "Usar dados móveis para imagens" (desligado), "Tentar de novo" no erro. "Meus espaços": selo por espaço (na nuvem / baixando N de M / só neste aparelho), "Só neste aparelho" (aviso central na 1ª vez; usa `ConfirmarAcao`).
- Sem campo de texto novo (então `campos-de-texto.json` não muda); mesmo assim `e2e-teclado.mjs`, `e2e-camera.mjs` (aviso que surge por toque), `e2e-voltar.mjs` (as camadas novas entram na pilha do voltar), 320 px e temas claro/escuro.
- Risco: baixo; texto cortado em 320 px.

### F6.6 — Imagens: WebP, envio, download sob demanda · 2 dias
- Só imagens de questões com figura/tabela (`img: "u:..."` que o modo `figuras` criou). Conversão WebP no envio (`canvas.toBlob('image/webp', 1)`; fallback PNG se o aparelho não gerar WebP); `Bytes` em `users/{uid}/imagens/{qid}` (≤ 600 KB, regra no emulador); fila de imagens depois do texto, em Wi-Fi; `useUrlImagem` busca com `getDoc` se faltar e guarda no Dexie; limpeza de imagem órfã da nuvem quando a questão sai (exclusão: cota de 20.000/dia basta).
- Testes: unitário da fila e do limite de tamanho; e2e com dois aparelhos: prova com figura no A → figura aparece no B (primeiro offline: aviso "imagem ainda não baixada", depois com internet aparece). Teste de **legibilidade** feito pelo dono (decisão 7.4).
- Risco: WebP do canvas não é garantido sem perda (tabela pequena pode borrar): conferir; plano B = manter PNG (3 a 4× mais peso, ainda cabe: ~1 a 3 MB por prova no modo figuras).

### F6.7 — Casos difíceis: juntar espaços, excluir tudo da nuvem, limpeza · 1,5 dia
- "Juntar com outro espaço" (união por id, lápide no outro); "Apagar tudo da nuvem" (e "Excluir conta"); fila de limpeza de corpos órfãos (lápide sem corpo apagado); aviso de cota perto do limite.
- Testes: `store/espacos.test.ts` (juntar: nada de questão, material, imagem some; progresso intacto), unitário da limpeza, e2e emulador.

### F6.8 — Teste real em dois aparelhos + revisão final · ~1 dia (dono: ~1 h) 
- Checklist no aparelho (`docs/fluxos/TESTES-SYNC-ESPACOS.md`): importar uma prova no celular → aparece no PC; importar material no PC → pesquisa no celular ("o que é…?"); apagar o espaço no PC → some no celular; modo avião; limpar dados do app e entrar de novo: tudo volta (**o teste que o dono pediu**); 4G sem baixar imagens; atualizar APK por cima.
- Atualizar README ("Sincronização…" e "Não verificado"), `docs/assistente.md` (remover "não sincroniza ainda") e `CLAUDE.md` (regras novas), e a memória do projeto.

**Total estimado: 15 a 19 dias de desenvolvimento** (F6.0 0,5 · F6.1 1,5 · F6.2 2–3 · F6.3a 1,5–2 · F6.3 2 · F6.4 1 · F6.5 1,5 · F6.6 2 · F6.7 1,5 · F6.8 1). O dono gasta ~1 h em F6.0, ~30 min em F6.2 e ~1 h em F6.8.
Ordem: F6.0 → F6.1 → F6.2 → **F6.3a** → F6.3 → F6.4 → F6.5 → F6.6 → F6.7 → F6.8 (a F6.1 pode andar em paralelo à F6.0, porque é pura). Pode parar depois de **F6.5**: o **texto** (questões e materiais) já está na conta e as imagens (F6.6) ficam para depois.

### Riscos principais (resumo)
| Risco | Efeito | Mitigação |
|---|---|---|
| Login real nunca testado | tudo abaixo para | F6.0 primeiro |
| Migração Dexie v8 (chave composta) | perda/duplicação de dados locais | tabelas novas, cópia (nunca apaga as antigas), teste com banco v7, cópia de segurança antes |
| Espaço apagado por engano propaga | perde material em todos os aparelhos | aviso central já existente; lápide só vence edição mais antiga; avaliar lixeira (7.6) |
| Imagens grandes | cota de 1 GiB, tempo | WebP, só figuras (padrão), só Wi-Fi, 600 KB por imagem, 25 MB por espaço, 100 MB por conta |
| Leitura de coleção inteira (já existe hoje) | cobra tudo a cada abertura após 30 min | F6.3a antes de qualquer dado novo |
| Primeira subida passa de 20.000 escritas/dia | operação recusada (não cobra, no plano grátis) | freio em ~15.000/dia, retoma no dia seguinte |
| Relógio de um aparelho muito atrasado | alteração fica fora da consulta incremental | margem de 7 dias + "Sincronizar tudo de novo" |
| Pacote maior que 1 MiB | escrita recusada | limite 500 KB com partes, `d` como texto, validação nas regras |
| Dois espaços "iguais" | confusão | "Juntar espaços" (F6.7), nunca automático |
| Ordem de rede (pacote antes do espaço) | questão sem espaço | fila garante `e:` primeiro |
| Material com direitos autorais na nuvem | privacidade | interruptor por espaço, aviso na 1ª vez, regras de dono, apagar tudo |
| Conferência real só no aparelho | bug aparece depois | F6.8 e checklist; README mantém "Não verificado" até o dono confirmar |

## 7. Perguntas de decisão para o dono

1. **Subir o texto (questões e materiais) já, antes das imagens?** (A) Sim, F6.1 a F6.5 primeiro e imagens depois **(recomendo)**: o ganho principal (não perder provas e materiais ao trocar de celular) vem do texto, que é pequeno e barato. (B) Tudo junto.
2. **Onde guardar as imagens?** (A) **Dentro do Firestore, como `Bytes`** **(recomendo)**: continua no plano grátis (Spark), que **nunca cobra**: passou da cota, o Firebase só recusa. (B) Firebase Storage: exige o plano Blaze (cartão) desde 03/02/2026, sem cota grátis em São Paulo, e **não há teto de gastos** para ele. Só vale se você já for ligar o Blaze por causa do assistente de IA com Cloud Functions.
2b. **Ficar no plano grátis (Spark) por enquanto?** **Sim (recomendo)**: o espaço típico tem ~3,5 MB e o seu uso medido ~12 MB, 1 a 5 % da cota de 1 GiB. Gatilhos para rever, do arquivo de custos: armazenamento > 700 MiB, leituras > 35.000/dia ou escritas > 14.000/dia por 3 dias, ou ~60 usuários pesados.
3. **O que acontece na primeira vez que um espaço vai subir?** (A) sobe direto; (B) aviso explicando e botão "Manter só aqui" **(recomendo)**; (C) fica local até você ligar espaço por espaço.
4. **Imagem em WebP ao subir?** (A) WebP qualidade 1,0 do navegador (~2 a 2,6× menor que o PNG, praticamente sem perda) depois de você conferir 5 imagens com fórmula/tabela no celular **(recomendo)**; (B) WebP 0,85 (~3,5× menor, com perda leve: pode borrar letra pequena); (C) manter PNG (mais peso, sem risco de nitidez; ainda cabe no grátis no modo "só figuras").
5. **Consertar agora a chave única das questões (a mesma questão em dois espaços)?** (A) Sim, em F6.2, com cópia de segurança antes **(recomendo)**; (B) não, aceitar o limite e documentar.
6. **Lixeira de 7 dias para espaço apagado?** (A) Não, só o aviso central de hoje **(recomendo para começar)**; (B) sim (um espaço apagado fica escondido 7 dias e pode voltar, em todos os aparelhos).
7. **Imagens no 4G/5G?** (A) Só Wi-Fi, com interruptor para liberar **(recomendo)**; (B) sempre.
8. **Limite por conta e por espaço** (valor de partida: 100 MB e 25 MB; um espaço típico tem 3,5 MB). Se você é a única pessoa usando, pode ser mais largo (a cota é 1 GiB para o projeto todo).
8b. **Trocar a leitura de `itens`/`eventos` por consulta incremental (F6.3a) mesmo que você nunca use espaços?** **Sim (recomendo)**: reduz a cobrança de leituras do que já existe e protege a cota.
8c. **Comprimir os pacotes com gzip?** Não na primeira versão (JSON legível, texto é pequeno); o campo `z` fica reservado. O pesquisador mediu 30 % do tamanho se um dia o armazenamento apertar.
9. **Importar "todas as imagens" de cada questão** (10 a 12 MB por prova em PNG): continuar permitindo? (A) sim, mas **só sobe a imagem das figuras/tabelas** e o resto fica local (recomendo); (B) sobe tudo.
10. **A conversa do assistente** fica só no aparelho? Recomendo **sim** (pessoal e sem utilidade em outro aparelho). Se quiser o contrário, é outra fase e outra decisão de privacidade.

## 8. Limites e custos (citados do arquivo do pesquisador)

Do `docs/plano-sync-custos.md` (pesquisa de 2026-11-20; marcas [confirmado]/[não confirmado] estão lá). O que mexe no desenho:
- **Spark (grátis) é o único teto garantido**: sem cartão, passou da cota a operação só falha. No Blaze **não existe corte automático** para Firestore/Storage (o "spend cap" só cobre IA, App Hosting, Functions; alerta de orçamento não limita nada).
- **Cota grátis do Firestore (projeto todo)**: 1 GiB armazenado; 50.000 leituras/dia; 20.000 escritas/dia; 20.000 exclusões/dia; 10 GiB/mês de saída. Documento 1 MiB; lote 500 (o app usa 400); valor indexado truncado em 1.500 bytes (por isso `d` como texto com índice desligado). Preço acima da cota em São Paulo: leitura US$ 0,045/100 mil, escrita 0,135/100 mil, ~0,135/GiB-mês.
- **Storage**: Blaze obrigatório desde 03/02/2026 e sem cota grátis em `southamerica-east1` → **não usado** (seção 2.4).
- **Contas do pesquisador para o primeiro login num aparelho novo**: 20 pacotes + 100 documentos de catálogo ≈ 120 leituras (+30 a 100 imagens); 10 espaços típicos ≈ 1.200 a 2.200 leituras (2 a 4 % da cota diária). **Só vale com `getDoc`/`getDocs` pontuais ou consulta incremental** (F6.3a).
- **Cenários** (com este desenho + incremental): 1 usuário ~12 MB e US$ 0; 100 usuários US$ 0 a ~0,05; 1.000 usuários ~US$ 3 a 8/mês e precisa de Blaze. Sem a leitura incremental, 100 usuários custariam ~US$ 11/mês e 1.000 mais de US$ 100.
- **Regras**: validar tamanho e `hasOnly`, **sem `get()`/`exists()`** (cada um é leitura cobrada), subcoleções fechadas; App Check só no lançamento público.
- **Não confirmado lá**: preço de saída de rede acima da cota; Play Integrity com APK fora da Play Store; se o WebP do canvas pode ser sem perda (por isso o teste de legibilidade da F6.6); texto real dos resumos do dono (palpite 150 KB; medi ~45 KB por material em 16 PDFs reais).
- Diferença de medida: o pesquisador mediu as 400 imagens já recortadas do banco embutido (média 81 KB, 26 % em WebP sem perda); as que o app gera ao importar (`recorte.ts`, 2,2×) são maiores (média 145 a 180 KB, até 730 KB), por isso o limite por imagem é 600 KB depois do WebP.

## 9. O que NÃO está neste plano
Criptografia de ponta a ponta, compartilhar espaços com outras pessoas, sincronizar a conversa, versões antigas de espaço, mesclagem automática de espaços. Cloud Functions (limpeza automática no servidor, IA) ficam para o plano do assistente e dependem do Blaze.

## 10. Como medi (para repetir)
Scripts descartáveis fora do repositório (leem os PDFs de `~/Documents/Banco de questões Bancos Cesgranrio` com o leitor do app; imagens recortadas com o mesmo `recortarQuestao` num Chrome real). Resultado resumido na seção 1.1. Refazer: rodar o leitor (`lerProva`, `montarQuestoes`) por prova e somar `JSON.stringify(questoes)` e `blob.size` dos recortes; para materiais, `prepararMaterial` sobre cada PDF. Não mexeram em `scripts/` do projeto.
