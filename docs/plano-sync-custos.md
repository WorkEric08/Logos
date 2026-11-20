# Sincronizar espaços e materiais: custos e limites do Firebase

Pesquisa de 2026-11-20 (só leitura, nenhum código alterado). Autor: pesquisador de custos. Complementa `docs/plano-sync-espacos.md` (arquiteto).
Marcas: **[confirmado]** = li na documentação oficial hoje; **[não confirmado]** = não consegui verificar, trate como estimativa.

## Resumo (a decisão em 6 linhas)

1. **Fique no plano Spark (grátis, sem cartão).** Firestore funciona nele e, passando da cota, o Firebase só **recusa** a operação: **não existe conta surpresa**. É o melhor "teto de gastos" para um projeto de garagem.
2. **Não use Firebase Storage por enquanto.** Desde 03/02/2026 ele exige Blaze (cartão) mesmo para projetos novos, e na região `southamerica-east1` não há cota grátis. Guarde as imagens no **Firestore como `Bytes`** (WebP sem perda, uma imagem por documento).
3. **Imagens:** recompactar de PNG para **WebP sem perda** (o mesmo desenho, sem perder nitidez) tira ~75 % do peso: as 400 imagens do banco passam de 31,6 MB para 8,2 MB (medido).
4. **Texto:** um documento de "pacote" por espaço, comprimido com gzip (30 % do tamanho, medido). Muito menos leituras que um documento por questão.
5. **O maior risco de custo NÃO é o material novo: é o que já existe.** `services/sync/firestore.ts` escuta as coleções `itens` e `eventos` inteiras com `onSnapshot` e sem filtro. Pela regra de cobrança, depois de 30 min sem conexão o app **relê tudo** (ver seção 3). Trocar por consulta incremental (`where('u','>',último)`) é a economia mais importante.
6. **Gatilho para sair do Spark:** 70 % de uso de qualquer cota por vários dias, ou ~60 usuários "pesados" (ver seção 7).

## 1. Firestore (Standard): cotas e preços

Fonte: <https://firebase.google.com/docs/firestore/pricing> e <https://firebase.google.com/pricing> (lidas em 2026-11-20); preços por região em <https://cloud.google.com/firestore/pricing> (tabela "Pricing by location", extraída do código da página; **confira no console antes de decidir**).

**Cota grátis (por projeto, 1 banco grátis)** [confirmado]: 1 GiB armazenado; 50.000 leituras/dia; 20.000 escritas/dia; 20.000 exclusões/dia; 10 GiB/mês de saída de rede. A cota diária zera por volta da meia-noite do Pacífico (04h/05h de Brasília). Vale para o **projeto todo**, não por usuário.

**Preço acima da cota, `southamerica-east1` (São Paulo)** [lido da tabela da página, confirmar no console]:
- leituras US$ 0,045 por 100 mil; escritas US$ 0,135 por 100 mil; exclusões US$ 0,015 por 100 mil;
- armazenamento ~US$ 0,135 por GiB/mês (a tabela mostra US$ 0,000184932 por GiB-hora).
- Para comparação, Iowa (`us-central1`) é 1/3 mais barato (0,03 / 0,09 / 0,01 / 0,15). A região já está definida como São Paulo; mudar de região exige banco novo, **não vale a pena** pelo centavo.

**Como contam as leituras** [confirmado]:
- Cada documento devolvido por consulta = 1 leitura. Consulta sem resultado = 1 leitura mínima.
- `onSnapshot`: paga 1 leitura por documento que entra ou muda no resultado.
- **"Se o cache offline está ligado e o ouvinte ficou desconectado mais de 30 minutos, você paga como se fosse uma consulta nova"** (o resultado inteiro de novo). Sem cache offline, paga de novo a cada reconexão.
- Regras de segurança com `get()`/`exists()` cobram leituras extras: **não usar** nas regras de sincronização.
- Índices não cobram operação, mas **ocupam armazenamento** (cada campo ganha índice automático; ver limites).

**Limites** (<https://firebase.google.com/docs/firestore/quotas>, lido hoje) [confirmado]:
- Documento: **1 MiB** (1.048.576 bytes). Valor de um campo: 1 MiB - 89 bytes. Requisição (lote): 10 MiB. Lote de escritas: 500 (o app já usa 400).
- Entradas de índice por documento: 40.000; cada valor indexado é truncado em 1.500 bytes.
- Índices compostos: 200 por banco sem faturamento (1.000 com).
- Escrita sequencial em campo indexado (ex.: timestamp crescente) numa coleção: ~500 escritas/s (boas práticas). Para nós irrelevante.
- "1 escrita por segundo por documento" é a regra conhecida, mas a página atual **não** traz o número [não confirmado]. Não importa: cada espaço/item é gravado poucas vezes.

## 2. Cloud Storage (Firebase Storage)

Fontes: <https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024>, <https://firebase.google.com/pricing>, <https://cloud.google.com/storage/pricing> (todas 2026-11-20).

- **Exige Blaze** (pago por uso, com cartão) desde **03/02/2026**; no Spark as chamadas dão erro 402/403 [confirmado]. Só o dono (Owner) do projeto pode migrar.
- Cota "sempre grátis" do bucket novo (`.firebasestorage.app`): **só nas regiões US `us-central1`, `us-east1`, `us-west1`** (5 GB). Em São Paulo **não há cota grátis** [confirmado]. Preço Standard em São Paulo: **US$ 0,035/GiB/mês** [lido da página]; em Iowa/Carolina do Sul ~US$ 0,02.
- Buckets antigos (`.appspot.com`) mantêm: 5 GB, 1 GB/dia de download, 20 mil uploads/dia, 50 mil downloads/dia [confirmado], mas projeto novo não ganha mais esse bucket.
- Regras de segurança do Storage aceitam limitar tamanho e tipo (`request.resource.size`, `contentType`) [conhecimento geral; a página lida não traz o código, **não confirmado hoje**]. Limite por arquivo do serviço: 5 TB (cota do Cloud Storage) [conhecimento geral].
- Veredito: serve para 1.000+ usuários, **não para agora**: exige cartão, sem cota grátis na nossa região e sem teto de gasto.

## 3. Onde o custo REAL aparece (achado no código)

`src/services/sync/firestore.ts` (linhas ~43 e ~61): `onSnapshot(collection(db, 'users/{uid}/itens'))` e `.../eventos` **sem `where`**. Com cache offline ligado (`persistentLocalCache`, também no código), a regra de 30 min acima faz cada abertura do app depois de meia hora **reler todos os documentos** dessas coleções.

Conta para o dono: 10.000 eventos + 3.000 itens (palpite para alguns meses de uso; **não medi** a nuvem real) = 13.000 leituras por abertura fria. Três aberturas por dia = 39.000 de 50.000. Em 100 usuários isso vira ~3,9 milhões de leituras/dia = ~US$ 1,75/dia (~US$ 53/mês) só de progresso, sem nenhum material novo.

**Correção barata:** consulta incremental com o carimbo `u` que os itens já têm (`where('u','>',ultimoVisto)` + `orderBy('u')`; para `eventos`, um campo de tempo): só traz o que mudou. Custo cai de "tudo" para "o que mudou desde a última vez" (dezenas de leituras por dia). Precisa de índice de campo único em `u` (automático). Isso vale **antes** de acrescentar espaços e materiais, porque eles herdarão o mesmo padrão. Para os pacotes de espaço e imagens usar `getDoc`/`getDocs` pontuais (sem ouvinte) ou ouvinte só dos documentos de "versão" (poucos).

## 4. Medidas reais no projeto (feitas hoje)

| O que | Medida |
|---|---|
| `src/data/bank.json` (1.168 questões) | 1,1 MB; média **844 bytes por questão** (máx. 2.584); com gzip -9: **331 KB** (30 %) |
| `banco/*.json` (fontes) | 1,9 MB |
| `public/q/` (400 imagens PNG de questões) | 31,6 MB; média **81 KB**, máximo 379 KB; largura média 533 px |
| Mesmas 400 em **WebP sem perda** | **8,2 MB** (média ~20 KB; 26 % do PNG); nitidez idêntica |
| Em PNG com paleta (alternativa) | 7,8 MB |
| WebP com perda, qualidade 80 / 60 | 14,8 MB / 12,4 MB (pior que o sem perda neste caso: imagens de texto; **não use**) |
| JPEG qualidade 70 | 19,3 MB (também pior, e borra letras) |
| Recorte novo de PDF (`recorte.ts`) | PNG a 2,2× do PDF, hoje sem recompactar (então 2 a 4 vezes mais pesado que o WebP sem perda) |
| Material de estudo (`material.ts`) | limite por material: 4 milhões de letras e 20 mil trechos; resumo típico **não medido** (estimo 150 KB de texto, ~45 KB com gzip) [não confirmado] |
| Cada questão importada tem os mesmos campos do banco | ~850 bytes sem imagem |

Conclusão de peso para o "dono" (10 espaços, 2.000 questões, 400 imagens de ~100 KB, 30 resumos):
- Questões: 2.000 x 850 B = 1,7 MB, gzip ~0,5 MB.
- Imagens: 400 x 100 KB = 40 MB em PNG; em WebP sem perda ~10 MB.
- Resumos: 30 x 150 KB = 4,5 MB, gzip ~1,4 MB.
- **Total: ~12 MB (otimizado) contra ~46 MB (bruto).**

## 5. Estimativas por cenário

Hipóteses: usuário "pesado" = o perfil do dono acima. Progresso (eventos/itens) fora da conta de armazenamento (~5 MB por usuário, palpite). Gravação de índices some no armazenamento: **desligar índice** nos campos grandes (bytes e texto do pacote) para não pagar até 3 KB extras por documento. Preços de São Paulo da seção 1.

Dois desenhos comparados:
- **A (ingênuo):** 1 documento por questão, por imagem, por trecho; ouvinte da coleção toda.
- **B (recomendado):** 1 documento "pacote" (gzip, ≤ ~700 KB cada) por espaço para questões, 1 documento por imagem (`Bytes`, WebP), pacotes de material em partes ≤ 700 KB, 1 documento "versão" por espaço; baixar sob demanda; consulta incremental.

### (a) 1 usuário (o dono)
- Armazenado: **~12 MB (B)** ou ~50 MB (A com PNG): 1 a 5 % do 1 GiB grátis.
- Primeiro login em aparelho novo, só o material: A ≈ 2.000 questões + 400 imagens + ~120 trechos de material + 10 espaços ≈ **2.500 leituras**; B ≈ 10 pacotes + 10 versões + 400 imagens + ~60 partes de resumo ≈ **~480 leituras** (as imagens podem vir só quando a questão aparece: menos ainda).
- O progresso antigo entra em cima (13.000 leituras no palpite acima, se baixar tudo).
- Primeira subida (aparelho que já tem tudo): A ≈ 2.500 escritas; B ≈ 500. **Com o progresso antigo junto pode passar de 20.000 escritas**: o motor precisa parar em ~15.000/dia e continuar no dia seguinte (no Spark a escrita excedente falha, não cobra).
- Uso normal: importar uma prova = A ~50 escritas, B ~12; estudar = dezenas de escritas de eventos/itens por dia. Leituras: com consulta incremental, dezenas por dia.
- **Cabe no plano grátis com folga. Custo: US$ 0.**

### (b) 100 usuários
- Armazenado: 100 x 12 MB = **1,2 GB** se todos fossem pesados (passa 1 GiB por ~0,2 GiB = ~US$ 0,03/mês). Realisticamente a maioria é bem mais leve (~1/3): **~400 MB**, dentro.
- Leituras/dia com o desenho **atual** (ouvinte da coleção inteira, 3 aberturas frias, 3.000 documentos por usuário): 100 x 9.000 = 900.000/dia, **US$ ~11/mês** (acima da cota); com consulta incremental: ~100 x 100 = 10.000/dia, **grátis**.
- Escritas/dia: ~100 x 100 = 10.000: dentro (20.000), mas se 20 usuários importarem provas no mesmo dia chega perto.
- Saída de rede: aparelhos novos baixando 10 MB cada: 100 x 10 MB = 1 GB/mês, dentro dos 10 GiB.
- **Cabe no grátis com B + consulta incremental. Sem isso: ~US$ 11/mês, e no Spark o app simplesmente trava quando acaba a cota.**

### (c) 1.000 usuários
- Armazenado: se todos pesados, **12 GB**: Firestore ~US$ 1,5/mês (11 GiB x 0,135) ou imagens no Cloud Storage (10 GB x US$ 0,035 = US$ 0,35/mês, mas sem cota grátis em São Paulo). Realisticamente ~4 GB: ~US$ 0,4/mês.
- Leituras/dia: incremental ~100 por usuário = 100.000: 50.000 pagas = **US$ 0,02/dia (~US$ 0,7/mês)**. Desenho atual: 9 milhões/dia = **~US$ 120/mês** (o risco).
- Escritas/dia: ~100 x 1.000 = 100.000, 80.000 pagas = **US$ 0,11/dia (~US$ 3,3/mês)**.
- Saída de rede: 1.000 x 10 MB (aparelho novo ao mês) = 10 GB/mês, no limite do grátis; acima disso, preço por GB de saída **[não confirmado; a página não lista]**.
- **Total ~US$ 3 a 8 por mês com B + incremental; > US$ 100 sem isso.** Precisa Blaze.

Resumo:

| Cenário | Armazenado (B) | Cabe no Spark? | Custo/mês (B + incremental) |
|---|---|---|---|
| 1 usuário | ~12 MB | sim | US$ 0 |
| 100 | 0,4 a 1,2 GB | sim, perto do limite se todos forem pesados | US$ 0 a ~0,05 |
| 1.000 | 4 a 12 GB | **não** (passa de 1 GiB, leituras e escritas) | ~US$ 3 a 8 |

## 6. Plano Blaze, teto de gastos e proteção

Fontes: <https://firebase.google.com/docs/projects/billing/budget-alerts>, <https://firebase.google.com/docs/projects/billing/spend-caps>, <https://docs.cloud.google.com/billing/docs/how-to/budgets>, <https://firebase.google.com/docs/app-check> (todas 2026-11-20).

- Blaze = pago por uso, mantém as mesmas cotas grátis e cobra só o que passar. A página de preços não diz "cartão obrigatório" com todas as letras, mas só o Spark diz "sem forma de pagamento"; conte com cartão [não confirmado palavra por palavra]. Pode haver crédito de até US$ 300 para quem é elegível.
- **Alerta de orçamento NÃO limita nada** ("um orçamento só de alertas não limita o uso nem o gasto") e o e-mail pode demorar de horas a dias [confirmado]. Padrões: 50 %, 90 %, 100 %. Para produção a doc sugere 50 % e 100 % do real e 150 % da previsão.
- **"Spend cap" (corte automático) existe, mas só para Firebase AI Logic, App Hosting, Cloud Functions e Extensions.** **Firestore, Cloud Storage e Hosting comum NÃO estão na lista** [confirmado, recurso em Preview]. Não há corte nativo para o nosso uso. O jeito de cortar é montar uma notificação do orçamento (Pub/Sub) que desliga o faturamento do projeto (e isso derruba o app; manual e perigoso).
- Por isso, **ficar no Spark é a única forma de teto garantido.** No Blaze, o teto é "você olha o painel de uso" + regras defensivas.
- **App Check** (<https://firebase.google.com/docs/app-check>): protege Firestore e Storage contra clientes falsos. Web: reCAPTCHA Enterprise (10.000 avaliações/mês grátis, depois cobra). Android: Play Integrity (10.000 chamadas/dia no padrão grátis) ou reCAPTCHA Enterprise. **Risco:** o Play Integrity pressupõe app instalado pela Play Store; o APK instalado à mão do dono pode ser recusado quando o "enforcement" estiver ligado [não confirmado; testar antes de ligar]. Recomendação: só ligar o App Check quando for distribuir publicamente, em modo "monitorar" antes.
- **Regras de segurança defensivas** (testar no emulador, como o README exige):
  - manter `users/{uid}/...` só para o dono (já feito);
  - validar formato e **tamanho** de cada documento (por exemplo imagem `Bytes` até ~300 KB, pacote de texto até ~800 KB; `.size()` em `Bytes`/`String` nas regras [conhecimento geral, **confirmar no emulador**]) e `hasOnly` nos campos esperados;
  - **não** usar `get()`/`exists()` nas regras (cada um é uma leitura cobrada);
  - lista fechada de subcoleções (`espacos`, `imagens`, `materiais`, `itens`, `eventos`) em vez de `{documento=**}` livre.
- **Cota por usuário:** as regras não somam bytes. Opções: (1) limite no app (por exemplo 25 MB de material por conta, 600 imagens, 50 materiais) e (2) o limite de documento nas regras; (3) o mais forte, um documento contador `users/{uid}/meta/uso` atualizado no mesmo lote e checado com `getAfter()` (custa 1 leitura por escrita; só se virar público). No Spark, um abusador só consegue **esgotar a cota do projeto** (derrubar o serviço para todos), nunca gerar conta.

## 7. Estratégias de economia (ordem de impacto)

1. **Consulta incremental (`u > último`) em vez de ouvinte da coleção inteira** (seção 3). Maior economia, serve ao progresso atual e aos materiais.
2. **Pacote por espaço, comprimido:** questões de um espaço num único documento (JSON + gzip, cortado em partes ≤ 700 KB se passar). 2.000 questões = ~15 partes em vez de 2.000 documentos. Imagens separadas (1 por documento, `Bytes`) para baixar só as que aparecem.
3. **WebP sem perda** nas imagens novas e nas já guardadas (`recorte.ts`: trocar `image/png` por `image/webp` com qualidade 1,0; `canvas.toBlob(..., 'image/webp', 1)` pode ser com perda leve em alguns navegadores, então validar: gerar com `sharp` no teste e comparar) [o 8,2 MB medido foi com `sharp lossless`; o canvas do navegador não garante sem perda: **não confirmado**].
4. **Sincronizar só o que mudou:** versão por espaço (número ou hash do conteúdo); o aparelho compara a versão e só baixa pacotes diferentes. Ids por conteúdo (já é assim) evitam duplicar.
5. **Só imagens vistas:** baixar a imagem da questão na hora de mostrar, guardar no Dexie. Aparelho novo não precisa baixar 400 imagens de uma vez.
6. **Só Wi-Fi para o material pesado** (opção "Baixar imagens só no Wi-Fi", via `navigator.connection` no navegador e plugin de rede no Capacitor, **não confirmado** que o plugin está instalado): economiza dados do celular, não a cota (a cota de saída já é folgada).
7. **Escritas com freio:** primeira subida em lotes de 400, parando em ~15.000 por dia e retomando no dia seguinte.
8. **Apagar rápido:** ao apagar espaço, apagar o pacote e as imagens (200 exclusões custam US$ 0,003; só preocupa a cota de 20.000/dia).
9. **Índices:** desligar a indexação (`firestore.indexes.json`, `fieldOverrides`) nos campos grandes (`bytes`, `dados`, texto do pacote); evita até ~3 KB de índice por documento.
10. **Não repetir progresso:** compactar eventos antigos (um "ponto de partida" com o resumo por questão e apagar os eventos velhos) quando passarem de ~20.000, para o primeiro login em aparelho novo não ler tudo.

## 8. Recomendação final e gatilhos

**Arquitetura mais barata que mantém tudo funcionando:**
- Spark, Firestore em São Paulo (como já está), **sem Storage**.
- Espaços, questões e resumos em pacotes gzip por espaço; imagens WebP como `Bytes`, uma por documento; documento "versão" por espaço para comparar sem baixar.
- Consulta incremental para tudo (progresso e materiais), sem ouvinte de coleção inteira.
- Limites no app e nas regras (documento, formato, subcoleções fechadas); App Check só no lançamento público.

**Gatilhos para migrar para Blaze (olhar o painel "Uso" do Firestore uma vez por mês):**
- armazenamento acima de **700 MiB** (70 % de 1 GiB), ou
- leituras acima de **35.000/dia** ou escritas acima de **14.000/dia** por 3 dias seguidos, ou
- ~**60 usuários pesados** (ou ~180 médios), ou o primeiro erro "resource-exhausted" que não seja da primeira subida.

**Ao migrar:** (1) criar orçamento com alertas 50 %/100 % e previsão 150 %; (2) manter a cota grátis (Blaze mantém); (3) mover as imagens para um bucket do Cloud Storage **em `us-central1`** (cota grátis de 5 GB, latência a mais é pequena para imagens de 20 KB) ou aceitar US$ 0,035/GB em São Paulo; (4) ligar App Check em modo monitorar e depois exigir; (5) ligar o contador de uso por usuário; (6) avaliar o desligamento automático de faturamento por Pub/Sub só como última defesa.

**Gatilho de outro tipo:** se o dono resolver abrir o app ao público, **só depois** de (1) a consulta incremental, (2) as regras com tamanho e (3) o contador por usuário estarem prontos.

## 9. O que não consegui confirmar

- Preço de saída de rede do Firestore/Storage acima da cota grátis.
- Se o Play Integrity aceita o APK instalado fora da Play Store.
- Se `canvas.toBlob(image/webp)` pode ser sem perda em todos os WebViews (o número de 8,2 MB foi com a biblioteca `sharp`).
- Tamanho real do progresso do dono na nuvem (eventos/itens) e do texto dos resumos dele (usei 150 KB por resumo como palpite).
- Sintaxe exata e limites de `request.resource.data.size()` e `Bytes.size()` nas regras: testar no emulador.
- Preço por GiB do Firestore em São Paulo foi derivado da tabela por hora da página oficial.

## 10. Números do arquiteto e respostas diretas (2026-11-20)

Medidas do arquiteto (22 provas reais, 1.164 questões): prova ~53 questões = ~48 KB de JSON (gzip ~14 KB); recorte PNG de 145 a 180 KB por questão (só figuras: 0,3 a 2,7 MB por prova; todas: 10 a 12 MB por prova), ~3,5x menor em WebP q0,85; material real (16 PDFs) = 711 KB de JSON (gzip 183 KB), ~200 trechos e ~45 KB por material. Espaço típico (10 provas + 5 materiais) = ~0,5 MB de texto, 10 a 20 pacotes (<= 500 KB), 30 a 100 imagens de figura (~3 MB em WebP) ou até ~30 MB se todas.

Esses números batem com os meus (844 B por questão; gzip 30 %). As imagens dele são maiores que as do banco embutido (81 KB), por isso o cenário "todas as imagens" fica em ~30 MB por espaço: **sincronize só figuras/tabelas** (padrão do app), que é o caso barato.

1. **Storage exige Blaze hoje?** Sim, desde 03/02/2026, inclusive projeto novo (seção 2). Em `southamerica-east1` não há cota grátis. Recomendação: não usar agora.
2. **Cotas grátis.** Firestore: 1 GiB armazenado, 50.000 leituras/dia, 20.000 escritas/dia, 20.000 exclusões/dia, 10 GiB/mês de saída (seção 1). Storage (só no Blaze): 5 GB grátis apenas em `us-central1`/`us-east1`/`us-west1`; bucket antigo `.appspot.com` mantém 5 GB, 1 GB/dia de download, 20 mil uploads/dia, 50 mil downloads/dia.
3. **Primeiro login em aparelho novo, só o material de UM espaço típico:** 20 pacotes + 100 documentos de catálogo = **~120 leituras**; mais as imagens, 1 leitura cada (30 a 100): **~150 a 220 leituras**, ou ~120 se as imagens forem baixadas só quando a questão aparecer. Para 10 espaços típicos: ~1.200 a 2.200 leituras (2 a 4 % da cota diária). Se o catálogo tiver 1 documento por questão em vez de 1 por prova, some ~500 leituras por espaço. **Importante:** isso só vale com `getDocs` pontual ou consulta incremental. Com `onSnapshot` de coleção inteira, essas leituras se repetem a cada abertura após 30 minutos (seção 3). Armazenamento de um espaço típico: ~0,5 MB + ~3 MB = **~3,5 MB**; 285 espaços desses cabem em 1 GiB.
