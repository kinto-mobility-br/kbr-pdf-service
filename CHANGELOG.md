# Changelog

Histórico de mudanças deste repositório. Entradas são organizadas por data
(mais recente no topo).

## 2026-09-20 — Selo de severidade como prefixo do título, ícone no título, overrides de tema (densidade) e correção de tamanho de página

- `components/text-fallback.ts`: nova `drawTextInFallbackFont()` — sempre
  desenha na fonte de fallback (Inter, tamanho equalizado), sem checar
  glifos. `sections/section-renderer.ts` passa a usar essa função para
  `PdfItemRow.description` (descrição de linha dentro de um card), em vez de
  `drawTextWithFallback()`. Motivo: a troca de fonte depende do texto inteiro
  conter algum caractere não suportado pela Toyota Type (`ã`, `ç`, `õ` etc.)
  — descrições como "Locação acima de 15 dias" sempre caíam no fallback
  (Inter), enquanto outras como "PROMOCODE - 50% Desconto Concessionário"
  (sem esses caracteres específicos) permaneciam na fonte de marca, fazendo
  duas descrições do mesmo card parecerem em fontes diferentes. Forçando
  sempre o fallback para esse campo, todas as descrições de linha ficam no
  mesmo padrão visual, independente do conteúdo.
- `sections/section-renderer.ts`: **inverte os lados** do ícone do título
  (`titleIcon`) e do selo de severidade — o ícone passa a ser o prefixo à
  esquerda do título, e o selo de severidade passa a ficar alinhado à
  direita (antes era o oposto).
- `sections/section-renderer.ts`: o selo de severidade (`HIGH`/`MEDIUM`/`LOW`)
  passa a ser desenhado como **prefixo inline** do título do card (mesma
  linha, alinhado verticalmente), em vez de ocupar uma linha própria acima —
  e um divisor horizontal (mesmo estilo do divisor de `rows`) passa a ser
  desenhado logo após o título, separando-o do restante do conteúdo do card.
  Funciona também com título de 2+ linhas e simultaneamente com `titleIcon`.
- `types.ts`/`section-renderer.ts`: novo `PdfSectionItem.titleIcon?: string`
  — nome de um asset SVG (`assets/svg/`) desenhado alinhado à direita, na
  mesma linha do título do card.
- `components/badge.ts`: novo `measureSeverityBadgeBox()` (mede a caixa do
  selo sem desenhar), necessário para reservar o espaço do prefixo antes de
  posicionar o título.
- `index.ts`: novo `PdfThemeOverrides` (parâmetro opcional de `generatePdf`)
  para ajustar densidade (espaçamento/tamanho de fonte) sem reconstruir o
  theme inteiro. Restrito, de propósito, aos campos usados exclusivamente
  pelos cards de item/tabela (`spacing.itemCardGap`/`itemRowGap`/
  `cardPaddingDefault`, `fontSizes.body`/`itemTitle`) — nunca aos campos que
  também controlam a capa (`cardPaddingLarge`/`cardPaddingSmall`,
  `fontSizes.metricBig` etc.). Motivo: um preset de densidade que reduzia
  esses campos "de capa" empurrava o texto dos overview cards além da
  margem inferior, disparando a paginação automática silenciosa do pdfkit
  (páginas extras quebradas no meio da capa) — restringir o tipo evita essa
  classe de erro para qualquer uso futuro.
- `pdf-builder.ts`: **correção de bug** — `doc.addPage({ layout: ... })` (capa
  e primeira página de cada seção) não herdava `size: 'A4'` do documento; o
  pdfkit não mescla `addPage(options)` com as opções do construtor quando
  qualquer objeto de opções é passado, caindo no padrão `letter` para campos
  não especificados. Resultado: páginas com tamanhos inconsistentes dentro
  do mesmo PDF (capa/1ª página de seção em `letter`, páginas seguintes via
  paginação automática em `A4`). Corrigido especificando `size: 'A4'`
  explicitamente nas duas chamadas.
- `sections/section-renderer.ts`: linhas de `PdfItemRow` (label/description/
  value) passam a usar `drawTextWithFallback` (mecanismo de fallback de
  fonte) em vez de `.text()` direto — corrige glifos quebrados (ex.:
  "Locação") quando a fonte principal não cobre certos acentos.
- Validado: `tsc --noEmit` e `vitest run` (61 testes, sem regressão) a cada
  mudança; PDFs reais gerados localmente e inspecionados visualmente
  (rasterização via `mupdf`) para os dois bugs e para o novo layout de
  selo/divisor.
- Motivada pela demanda de redesenho de card de comissão do
  `kbr-domain-dealers-commissions` (ícone Kinto no lugar da row "Veiculo
  Kinto", densidade para caber 2 cards por página) — os dois bugs foram
  encontrados durante a validação visual local desse trabalho, não
  reportados previamente.

## 2026-09-20 — 3ª coluna (`description`) e divisor (`dividerBefore`) em `PdfItemRow`, orientação landscape

- `types.ts`: `PdfItemRow` ganha `description?: string` (coluna do meio,
  opcional — presente vira 3 colunas) e `dividerBefore?: boolean` (traço
  horizontal acima da linha); `PdfReportConfig` ganha
  `orientation?: 'portrait' | 'landscape'` (default `'portrait'`). Extensão
  aditiva — nenhum campo existente muda de tipo/obrigatoriedade.
- `sections/section-renderer.ts`: `computeRowLayout` passa a decidir 2 ou 3
  colunas **por linha** (permite misturar linhas com e sem `description` no
  mesmo card); `measureRowHeight` soma a altura do divisor quando
  `dividerBefore`; o laço de desenho passa a desenhar o traço (cor
  `n100LightGray`) antes da linha e a coluna de `description` (cor
  `n600DarkElectricBlue`) quando presente.
- `pdf-builder.ts`: `layout: config.orientation` repassado na criação do
  `PDFDocument` **e** em cada `doc.addPage()` (capa e por seção) — o pdfkit
  não herda `layout` automaticamente entre páginas.
- Novo `__tests__/pdf-geometry.ts` com helpers de oráculo forte via PDF real:
  `searchTextBoxes` (posição de texto), `extractPageSizes` (orientação),
  `countPixelsOfColor` (rasterização real da página para detectar o traço
  do divisor).
- `__tests__/section-item-rows.test.ts` (+4 testes) e
  `__tests__/generate-pdf.test.ts` (+3 testes).
- Validado: `vitest run` (61 testes, sem regressão), `tsc --noEmit` limpo,
  `npm run build` sem erros.
- Motivada pela demanda `card-item-descricao-divisor-orientacao-paisagem`,
  pré-requisito bloqueante para os cards de comissão do
  `kbr-domain-dealers-commissions` (relatório em orientação paisagem com
  descrição de itens e separador visual antes do total).

## 2026-09-19 — Card de item ganha `rows` (linhas de duas colunas) e `suggestionLabel` customizável

- `types.ts`: novo `PdfItemRow { label: string; value: string }`; `PdfSectionItem`
  ganha `rows?: PdfItemRow[]` (renderizado após `description`, antes do bloco
  de `suggestion`) e `suggestionLabel?: string` (rótulo do bloco destacado,
  default `'SUGGESTION'` quando ausente). Extensão aditiva — nenhum campo
  existente muda de tipo/obrigatoriedade.
- `sections/section-renderer.ts`: soma a altura de cada `PdfItemRow` na medição
  do card (entra no cálculo passado a `ensureSpaceOrNewPage`, então um card com
  `rows` grande nunca é cortado entre páginas); desenha cada linha com `label`
  à esquerda e `value` alinhado à direita, em colunas sem overlap mesmo com
  quebra de linha do `value`; troca o literal fixo `'SUGGESTION'` por
  `item.suggestionLabel ?? 'SUGGESTION'`.
- `theme.ts`: novo `spacing.itemRowGap` (espaçamento vertical entre rows).
- Novo `__tests__/section-item-rows.test.ts` (6 testes) com oráculo forte via
  extração de texto real do PDF gerado (`mupdf`, novo helper
  `__tests__/pdf-text.ts`), cobrindo: regressão sem os campos novos, N rows
  renderizadas com label/value, card com rows grande não cortado entre
  páginas, `suggestionLabel` customizado, regressão do rótulo default, e
  quebra de linha de `value` longo sem sobrepor `label`.
- Validado: `vitest run` (55 testes, sem regressão), `tsc --noEmit` limpo.
- Motivada pela demanda `card-linhas-e-rotulo-customizavel`, pré-requisito
  aditivo para os cards de comissão por invoice do
  `kbr-domain-dealers-commissions`.

## 2026-08-27 — Entry point raiz deixa de reexportar `processing/*` (isola `sharp`/`mupdf`)

- `index.ts`: removidos os reexports de `ImageCompressionService`/
  `imageCompressionService`/`PdfAttachmentService`/`pdfAttachmentService`/
  `rasterizePdfToJpegs`/`CompressionOptions`/`CompressionResult` do entry point
  raiz (`.`). Motivo: `sharp` (dependência nativa por plataforma, ~15 pacotes
  `@img/sharp-*` distintos por SO/arquitetura) era carregado transitivamente
  por qualquer consumidor de `generatePdf`, mesmo sem uso de compressão de
  imagem/rasterização — risco concreto para consumidores serverless (ex.: AWS
  Lambda) que só precisam do núcleo de geração de PDF e não podem garantir que
  o binário nativo instalado bata com o runtime de destino.
- Esses símbolos continuam disponíveis, sem mudança de contrato, via o subpath
  já existente `@kbr/pdf-service/processing`. `package.json` não foi alterado
  (o subpath já estava declarado em `exports`).
- Novo teste `__tests__/entry-points.test.ts` cobrindo a separação (raiz sem os
  símbolos de `processing`, subpath preservado, ausência de `sharp`/`mupdf` em
  `index.ts`).
- Validado: `vitest run` (49 testes, sem regressão), `tsc --noEmit`, `npm run
  build` (bundle raiz sem referência a `processing`/`sharp`/`mupdf`).
- Motivada pela demanda `relatorio-pdf-kbr-pdf-service` do
  `kbr-domain-dealers-commissions` (nova Lambda que passa a consumir
  `@kbr/pdf-service` como dependência git e não pode arrastar um binário
  nativo incompatível com o runtime Lambda).

## 2026-08-27 — Remove senha hardcoded de script local e apaga arquivo com credencial de exemplo

- `scripts/kinto-api-auth-pdf.ts`: `openPassword` hardcoded (`'k1nt02zfl33t'`)
  substituído por `process.env.PDF_PASSWORD` (mesma convenção já usada em
  `scripts/json-fields-pdf.ts`) — script nunca havia sido versionado
  (`git status` mostrava `??`), mas evita introduzir a senha no histórico ao
  ser adicionado agora.
- Removido `tmp/exemplo.json` (não versionado, já coberto por `.gitignore`):
  continha um `secret`/`token_url` de aparência real apontando para um
  domínio `prod` do Cognito — achado ao avaliar se este repositório poderia
  se tornar público para contornar um bloqueio de acesso do GitHub Actions em
  `kbr-domain-dealers-commissions`.

## 2026-07-21 — Seção de tabela (`PdfTable`) como alternativa aos cards

- Novo tipo de seção `table` em `PdfSection` (`PdfTable`/`PdfTableColumn`/
  `PdfTableRow` em `types.ts`, renderer novo em
  `sections/table-renderer.ts`, plugado no `pdf-builder.ts`): permite
  exibir os registros de uma seção como uma tabela compacta (cabeçalho +
  várias linhas por página) em vez de um card por item — motivado pelo
  `kbr-nfse-invoices`, cujo resumo diário de NFSe virava dezenas de páginas
  com 1 card por tentativa (ex.: 119 tentativas ≈ 25 páginas com cards,
  ~13 páginas com tabela).
- `items` virou opcional em `PdfSection` (retrocompatível — seções
  existentes continuam funcionando sem alteração). `severity` de
  `PdfTableRow` pinta o texto da linha (vermelho para `high`, laranja para
  `medium`), já que não há espaço pra um badge por linha como nos cards.
- Colunas suportam largura relativa (`width`, fração de 0 a 1); colunas sem
  `width` dividem igualmente o espaço restante.
- Novos testes em `__tests__/generate-pdf.test.ts` (seção de tabela simples
  e tabela com 120 linhas pra validar quebra de página).
- Validado: `tsc --noEmit`, `vitest run` (45 testes), `npm run build`.

## 2026-07-15 — Script de PDF a partir de JSON, senha de abertura e fonte Toyota Type

- Novo script `scripts/json-fields-pdf.ts` (`npm run json-to-pdf`): gera um PDF a
  partir de um JSON chave/valor, renderizando cada campo como texto simples
  (rótulo + valor em linha própria) para facilitar a seleção e cópia dos
  valores. Suporta achatamento de objetos aninhados e arrays.
- Suporte a senha de abertura (`PdfReportConfig.openPassword`), com
  criptografia AES-256 via PDFKit, disponível tanto em `generatePdf` quanto no
  novo script (`--senha`/`PDF_PASSWORD`).
- Aviso visível (`SENSITIVE_DOCUMENT_NOTICE`) exibido no documento e nos
  metadados (`Subject`) sempre que o PDF é protegido por senha.
- Troca da fonte do serviço de Inter para Toyota Type
  (`assets/fonts/Toyota-Type-*.ttf`).
- Fallback automático de fonte (`components/text-fallback.ts`, usando
  `fontkit`) para caracteres que a Toyota Type não suporta (`ã, ç, õ, â, ê, ô,
  à`, travessão `—`), trocando para Inter por trecho/palavra inteira (nunca no
  meio de uma palavra, para evitar desalinhamento de linha de base) e com
  escala de tamanho equalizada entre as fontes.
- Opção `--descricao`/`-d` no script `json-fields-pdf.ts`: texto descritivo
  exibido como parágrafo (com quebra de linha automática) antes dos campos de
  dados, entre o título e o aviso de senha.
