# Changelog

Histórico de mudanças deste repositório. Entradas são organizadas por data
(mais recente no topo).

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
