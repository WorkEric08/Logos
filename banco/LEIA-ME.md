# agente_comercial_portugues_ingles.json
219 questões (164 Português + 55 Inglês) para o Agente Comercial: 170 das provas de Agente Comercial e 49 reaproveitadas das provas de TI (`cargoOrigem: "TI"`).

Campos: `id`, `banco`, `ano`, `edicao`, `cargoOrigem` ("Agente Comercial" | "TI"), `prova`, `numero`, `materia`, `pagina` (página no PDF `arquivoProva`, na pasta Organizado), `textoApoio` (texto-base; repetido nas questões que usam o mesmo texto), `enunciado`, `alternativas` {A..E}, `gabarito` (Gabarito 1), `status` (valida | anulada | sem_gabarito), `revisar` (lista de avisos), `arquivoProva`.

Avisos em `revisar`: `ver_figura_no_pdf` = a questão menciona figura/tabela/quadro; conferir na página do PDF.
Limites: extração automática de PDF. Marcas de linha dos textos foram removidas, mas pode sobrar algum número solto no `textoApoio`. Gabaritos: só o Gabarito 1 (BB 2012 lido da imagem do gabarito). Nenhuma das 209 é anulada.
Não inclui as questões de Português/Inglês de Caixa 2021 TI e Caixa 2024 TI (repetem as de Técnico Bancário).


# agente_comercial_matematica.json
139 questões (99 Matemática + 40 Matemática Financeira): 134 de Agente Comercial e 5 da TI (BB 2021 Agente de Tecnologia, Q16–20).
Cada questão tem `imagem` (PNG recortado direto do PDF, em `imagens/`). **Para Matemática, use a imagem como fonte principal**: o campo `enunciado`/`alternativas` vem do texto do PDF e pode perder fórmulas, frações e símbolos (todas as questões têm o aviso `texto_pode_ter_perdido_formulas__usar_imagem`).
Mesmos campos do outro arquivo, sem `textoApoio` (o texto-base, quando existe, já aparece na imagem).


# agente_comercial_bancarios.json
291 questões de Conhecimentos Bancários (266 de Agente Comercial + 25 reaproveitadas da TI: BB 2021 Q31–35, Amazônia 2021 Q11–20, Amazônia 2024 Q11–20). 4 anuladas (`status: "anulada"`, `gabarito: null`): BB 2014 Q58, BNB 2024 Q54, Amazônia 2018 Q42, Caixa RS 2024 Q39. Inclui o texto da questão; quando há texto-base ele vem junto no `enunciado`.
`imagem` só existe em 48 questões que têm tabela, figura, lista ou números que podem ter se perdido no texto (campo `revisar`); nas demais é `null`.

# agente_comercial_portugues_ingles.json (atualizado)
Agora 219 questões (164 Português + 55 Inglês): entrou o Inglês das provas BB 2015-03 e 2015-10 (Q66–70), que estava faltando.


# agente_comercial_informatica.json e agente_comercial_atualidades.json
Informática: 135 questões. Atualidades: 70 questões.
`imagem` existe só nas questões com figura, código, tabela ou texto longo (60 em Informática, 32 em Atualidades); nas demais é `null`.
Atenção: BB 2018 tem 25 questões de "Informática" com conteúdo técnico (NoSQL, Python, Java, Hive). BB 2018 Q67 ocupa duas páginas: use a imagem. BB 2018 Q68 e as demais com `ver_imagem` devem ser conferidas pela imagem.
BB 2010 e 2012: Atualidades é só Q21–25 (Q26–30 é Raciocínio Lógico). Gabarito BB 2012 lido de imagem.
Atualidades envelhece: as questões de dados e fatos da época servem pouco; use como treino de estilo da banca.


# agente_comercial_vendas_atendimento.json, agente_comercial_estatistica.json, agente_comercial_etica.json
- Vendas e Atendimento: 194 questões (campo `materia` = "Vendas" ou "Atendimento"); 54 com imagem. Inclui 5 de Atendimento vindas da TI (Amazônia 2024).
- Estatística (Probabilidade e Estatística): 50 questões, TODAS com imagem (fórmulas, tabelas e gráficos se perdem no texto). Inclui 10 vindas da TI (BB 2021 Q26–30 e Banese Desenvolvimento Q15–19). Use a imagem como fonte.
- Ética/Compliance: 35 questões; 11 com imagem. Inclui 10 vindas da TI (Amazônia 2024 Q21–25 e Banese Desenvolvimento Q26–30). Amazônia 2024 Q16–20 mistura Socioambiental e Ética.
- Não incluído: Cultura Organizacional (BB 2014/2015), Legislação (Amazônia 2018/2021), Conhecimentos de Sergipe (Banese) e Conhecimentos Digitais (Caixa Q46–50). Dá para gerar depois se quiser.


# agente_comercial_digitais_legislacao.json
30 questões: 15 "Conhecimentos Digitais" (Caixa 2024 e 2024-RS Q46–50 + 5 da TI Caixa 2024 Q56–60) e 15 "Legislação" (Amazônia 2018 e 2021 Q11–15 + 5 da TI Amazônia 2021 Q21–25). Campo `materia` separa as duas. `imagem` só nas questões marcadas (7 com imagem).
Obs.: em "Conhecimentos Digitais" o conteúdo é comportamental/gestão (lean, OKR, inteligência emocional, liderança, teletrabalho), não tecnologia.
