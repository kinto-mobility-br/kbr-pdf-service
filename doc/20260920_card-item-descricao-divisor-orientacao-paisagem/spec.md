> Constitution aplicável: nenhuma — `kbr-pdf-service` não tem constitution própria (biblioteca de infraestrutura consumida por vários domínios, não um domínio de negócio).
> Branch de trabalho: seguir o mesmo padrão já usado em `20260919_card-linhas-e-rotulo-customizavel` — criar branch de feature (ex.: `feature/pdf-item-row-description-divider-orientation`), sem commit direto em `main`. Consumidores (`kbr-domain-billing`, `kbr-domain-dealers-commissions`) apontam a dependência para `github:kinto-mobility-br/kbr-pdf-service#main` (sem pin de commit/tag) — qualquer merge em `main` é consumido no próximo `npm install`/build deles.

# Spec — Terceira coluna (descrição) em `PdfItemRow`, divisor entre linhas e orientação de página opt-in

## Objetivo e resultado de negócio

Estender `@kbr/pdf-service` com 3 capacidades novas, motivadas pelo card de
lançamento de comissão do `kbr-domain-dealers-commissions` (spec própria
nesse repositório):

1. **Terceira coluna opcional (descrição)** em `PdfItemRow` — hoje a linha é
   só `label`/`value` (2 colunas); alguns consumidores precisam mostrar o
   texto original do line item (ex.: "Fatura de depósito #2130968") entre o
   rótulo e o valor.
2. **Divisor visual** entre linhas de um mesmo card — hoje não existe
   nenhuma forma de separar visualmente um grupo de linhas (ex.: separar as
   linhas de composição do cálculo da linha de resultado final).
3. **Orientação de página opt-in** (`portrait`/`landscape`) por relatório —
   hoje o documento é sempre A4 retrato; alguns relatórios com linhas de 3
   colunas precisam de mais largura.

## Problema e evidências

- [types.ts](../../types.ts) — `PdfItemRow` só tem `label`/`value`;
  `PdfReportConfig` não tem nenhum campo de orientação; não existe nenhum
  tipo/flag de "divisor" em `PdfSectionItem`/`PdfItemRow`.
- [sections/section-renderer.ts](../../sections/section-renderer.ts) —
  `computeRowLayout`/rendering de `item.rows` desenha exatamente 2 blocos de
  texto por linha (`row.label` à esquerda, `row.value` à direita), sem
  espaço reservado para uma 3ª coluna nem qualquer desenho de linha
  horizontal entre `rows`.
- [pdf-builder.ts](../../pdf-builder.ts) — `new PDFDocument({ size: 'A4', ... })`
  fixo, sem `layout`; todas as chamadas `doc.addPage()` (capa e cada seção)
  não passam opções, herdando o tamanho/layout definido na construção do
  documento.
- [sections/page-chrome.ts](../../sections/page-chrome.ts) — header/footer já
  usam `doc.page.width`/`doc.page.height` dinamicamente (não hardcoded) —
  uma mudança de orientação não exige mudança nesses dois arquivos.
- `kbr-domain-billing` e `kbr-domain-dealers-commissions` dependem via
  `github:...#main` (sem pin) — mudança aqui é consumida por ambos; as 3
  capacidades desta spec são **aditivas e opt-in** (nenhum campo novo é
  obrigatório), então nenhum consumidor existente muda de comportamento sem
  alteração explícita do seu próprio `PdfReportInput`.

## Contexto atual

`generatePdf`/`buildPdf` cria um único `PDFDocument` com `size: 'A4'` e
margens fixas, desenha a capa e depois, para cada `PdfSection`, uma página
nova por seção (`doc.addPage()`) contendo `table` e/ou cards (`items`).
Dentro de um card, `renderSection` desenha `title`, `description` opcional,
depois cada linha de `rows` (label à esquerda, value à direita, 2 colunas
fixas) e por fim um bloco `suggestion` opcional.

## Escopo

- **`PdfItemRow`** ganha 2 campos opcionais, ambos sem quebrar consumidores
  existentes (nenhum é obrigatório):
  - `description?: string` — quando presente, a linha renderiza em **3
    colunas** (`label` | `description` | `value`, description ficando entre
    label e value, value continua alinhado à direita); quando ausente,
    renderiza exatamente como hoje (2 colunas).
  - `dividerBefore?: boolean` — quando `true`, desenha uma linha horizontal
    fina (mesmo padrão visual do separador já usado no footer/header,
    `theme.colors.n100LightGray`) **acima** dessa linha, com um respiro
    vertical extra antes e depois do traço. Quando ausente/`false`, sem
    mudança de comportamento.
- **`PdfReportConfig`** ganha `orientation?: 'portrait' | 'landscape'`
  (default `'portrait'` quando ausente — nenhuma mudança de comportamento
  para consumidores que não setam o campo).
- **`pdf-builder.ts`**: `new PDFDocument({ size: 'A4', layout: config.orientation ?? 'portrait', ... })`;
  todas as chamadas subsequentes de `doc.addPage()` (capa e cada seção)
  devem herdar o mesmo `layout` (ou passar `{ size: 'A4', layout }`
  explicitamente se o pdfkit não propagar automaticamente — validar no
  Plan/Build com um teste de output real, não assumir).
- **`sections/section-renderer.ts`**: `computeRowLayout`/`measureRowHeight`
  passam a considerar 3 colunas quando qualquer linha do card tiver
  `description` (largura de cada coluna recalculada a partir da largura
  total disponível, que já é dinâmica via `getContentArea`/`doc.page.width`
  — item já coberto pela infraestrutura existente, só o cálculo de colunas
  muda). Linhas sem `description` dentro do mesmo card continuam 2 colunas
  (label mais largo, sem coluna do meio) — **mistura de linhas 2col/3col no
  mesmo card é suportada**.
- Nenhuma mudança em `PdfTable`/`PdfTableColumn`/`PdfTableRow` (tabelas
  compactas) — escopo restrito a `PdfItemRow`/cards e à orientação global do
  documento.

## Fora de escopo

- Orientação por seção/página individual (mista dentro do mesmo PDF) — a
  orientação é **por documento inteiro** (todo o relatório), não por seção.
- Qualquer novo componente de destaque além do divisor simples (sem cor
  customizável, sem espessura configurável pelo consumidor).
- Migração automática de consumidores existentes para usar as capacidades
  novas — cada consumidor decide, na sua própria spec, se/como usa.

## Atores e consumidores

- `kbr-domain-dealers-commissions` (`lambdas/report-pdf-email`) — primeiro
  consumidor real das 3 capacidades (spec própria nesse repositório).
- `kbr-domain-billing` (`lambdas/fatura-batch`, `lambdas/fatura-daily-report`)
  e `kbr-nfse-invoices`/`kbr-domain-invoices` (relatórios legados) — não
  alterados; devem continuar gerando PDF idêntico ao atual (retrato, linhas
  2 colunas, sem divisor) sem setar os campos novos.

## Requisitos funcionais

### RF001 — Renderizar linha de 3 colunas quando `description` presente
- **Input**: `PdfItemRow` com `description` definida (string não vazia).
- **Output**: linha desenhada com 3 blocos de texto (`label` à esquerda,
  `description` no meio, `value` à direita), larguras recalculadas para
  caber os 3 dentro da largura útil da página.
- **Erros observáveis**: nenhum — `description` ausente ou string vazia
  mantém o layout de 2 colunas atual (fallback, não erro).
- **Relacionados**: RN001.

### RF002 — Desenhar divisor antes de uma linha
- **Input**: `PdfItemRow` com `dividerBefore: true`.
- **Output**: uma linha horizontal fina desenhada entre a linha anterior
  (ou o topo do bloco de `rows`, se for a primeira) e esta linha, com
  espaçamento vertical extra nos dois lados do traço.
- **Erros observáveis**: nenhum — `dividerBefore` ausente/`false` não
  desenha nada (comportamento atual).
- **Relacionados**: RN002.

### RF003 — Orientação de página configurável por relatório
- **Input**: `PdfReportConfig.orientation` (`'portrait'` | `'landscape'` |
  ausente).
- **Output**: documento inteiro (capa + todas as seções) gerado na
  orientação pedida; ausente → `'portrait'` (comportamento atual,
  byte-idêntico para quem não seta o campo).
- **Erros observáveis**: nenhum novo.
- **Relacionados**: RN003.

## Regras de negócio

- **RN001 — Coexistência de linhas 2 e 3 colunas no mesmo card**: dentro de
  um mesmo `PdfSectionItem.rows`, algumas linhas podem ter `description` e
  outras não — cada linha é layoutada independentemente (não força o card
  inteiro a um único modo).
- **RN002 — Divisor é por linha, não por posição fixa**: qualquer linha do
  array pode ter `dividerBefore: true`, incluindo a primeira (desenha o
  divisor logo abaixo do título/descrição do card, antes da primeira linha)
  — decisão de onde colocar o divisor é do consumidor, não da lib.
  Múltiplas linhas com `dividerBefore: true` no mesmo card são permitidas
  (múltiplos divisores), sem validação/erro.
- **RN003 — Orientação é do documento inteiro**: não existe orientação por
  seção; `config.orientation` (ou o default retrato) vale para todas as
  páginas do PDF gerado numa única chamada de `buildPdf`/`generatePdf`.

## Invariantes

- **INV001**: consumidor que não seta `description`/`dividerBefore` em
  nenhum `PdfItemRow` nem `orientation` em `PdfReportConfig` produz um PDF
  byte-a-byte (ou visualmente) idêntico ao gerado antes desta spec —
  garantido por teste de regressão comparando snapshot/estrutura do PDF
  atual dos consumidores existentes (`kbr-domain-billing` e relatórios
  legados de `kbr-domain-invoices`, via fixtures já existentes no repo,
  se houver, ou teste novo de regressão neste repo).
- **INV002**: nenhuma mudança de assinatura obrigatória — `PdfItemRow`,
  `PdfReportConfig` continuam aceitando o shape mínimo já usado hoje pelos
  consumidores existentes sem exigir novos campos.

## Cenários / Critérios de aceitação

- **CA001**: `PdfItemRow` sem `description` → renderizado em 2 colunas,
  idêntico ao comportamento atual.
- **CA002**: `PdfItemRow` com `description: 'Fatura de depósito #123'` →
  renderizado em 3 colunas (label | descrição | valor), texto da descrição
  visível e não sobreposto ao valor.
- **CA003**: card com 2 linhas, a 2ª com `dividerBefore: true` → traço
  horizontal desenhado entre a 1ª e a 2ª linha, altura do card recalculada
  para incluir o espaço do divisor.
- **CA004**: card com todas as linhas sem `dividerBefore` → nenhum traço
  desenhado (regressão).
- **CA005**: `PdfReportConfig.orientation: 'landscape'` → todas as páginas
  do PDF (capa + seções) em paisagem; header/footer/section-title
  continuam alinhados à largura real da página (sem overflow/corte).
- **CA006**: `PdfReportConfig` sem `orientation` → PDF em retrato,
  idêntico ao gerado antes desta spec (regressão, INV001).
- **CA007**: card com linhas 2 colunas e 3 colunas misturadas → cada linha
  layoutada corretamente, sem sobreposição de texto entre colunas
  adjacentes de linhas diferentes.

## Dependências

- Nenhuma dependência externa nova. Consumida futuramente por
  `kbr-domain-dealers-commissions` (spec própria, referenciando esta como
  pré-requisito).

## Premissas

- PDFKit permite trocar `layout`/`size` na construção do `PDFDocument` e
  ter esse valor refletido em `doc.page.width`/`doc.page.height` para todas
  as páginas subsequentes sem reconfiguração manual por página — a validar
  no Plan/Build com uma geração real de PDF em paisagem (não assumir só
  pela documentação do pdfkit).
- Nenhum consumidor atual precisa de orientação mista dentro do mesmo
  documento (RN003 aceito como suficiente).

## Riscos e mitigação

- **Risco**: recalcular largura de colunas para 3-col pode quebrar o
  cálculo de altura (`measureRowHeight`) já usado para paginação
  (`ensureSpaceOrNewPage`), cortando um card entre páginas. Mitigação:
  cobrir com teste que gera um PDF real (buffer) e inspeciona nº de
  páginas/posições, não só snapshot de tipos.
- **Risco**: mudar `layout` do documento pode exigir passar as mesmas
  opções em cada `doc.addPage()` (pdfkit não documenta claramente se
  reaproveita as opções do construtor) — validar cedo no Plan com uma
  geração de teste antes de escrever o restante da spec de
  `kbr-domain-dealers-commissions` depender disso.

## Dúvidas abertas

- Nenhuma — decisões fechadas com o usuário na grelha de alinhamento
  (ver sessão de trabalho, 2026-09-20).
