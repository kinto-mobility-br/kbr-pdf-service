# Implementation Evidence

## Identificação

- Demanda: `20260920_card-item-descricao-divisor-orientacao-paisagem`
- Tasks: T01, T02, T03 (todas de `tasks.md`)
- Base: `spec.md`, `plan.md`, `verification.md` (todos aprovados em 2026-09-20)
- Branch: `feature/pdf-item-row-description-divider-orientation`
- Data: 2026-09-20

## Escopo

- Requisitos: RF001, RF002, RF003, RN001, RN002, INV001
- Verificações (Builder): VER001, VER002, VER003, VER004, VER005, VER006,
  VER007, VER008, VER009
- Verificações fora do escopo do Builder: VER010, VER011, VER012 (cenários
  independentes do Verifier), VER013 (gate humano de merge em `main`)

## Mudanças

### Arquivos

- `types.ts`: `PdfItemRow` ganha `description?: string` e
  `dividerBefore?: boolean`; `PdfReportConfig` ganha
  `orientation?: 'portrait' | 'landscape'`. Extensão puramente aditiva —
  nenhum campo existente mudou de tipo/obrigatoriedade.
- `sections/section-renderer.ts`: `computeRowLayout(textWidth, hasDescription)`
  passa a decidir 2 ou 3 colunas **por linha** (não por card), permitindo
  misturar `PdfItemRow` com e sem `description` no mesmo card; novas
  constantes `DIVIDER_HEIGHT`/`DIVIDER_GAP`; `measureRowHeight` soma a altura
  do traço + 2×gap quando `row.dividerBefore`; o laço de desenho de
  `item.rows` passa a: (1) desenhar um traço horizontal (`n100LightGray`)
  antes da linha quando `dividerBefore`, (2) desenhar `description` (cor
  `n600DarkElectricBlue`) na coluna do meio quando presente.
- `pdf-builder.ts`: `DEFAULT_CONFIG.orientation = 'portrait'`; `layout:
  config.orientation` repassado na criação do `PDFDocument` **e** em cada
  `doc.addPage()` (capa e por seção) — confirmado por teste que o pdfkit
  não herda `layout` automaticamente entre páginas, precisa ser repassado
  em cada `addPage()`.
- `__tests__/pdf-geometry.ts` (novo): helpers `searchTextBoxes` (bbox de um
  texto via `StructuredText.search`, usado para checar ordem/posição
  label→description→value sem overlap), `extractPageSizes` (via
  `page.getBounds()`, usado para orientação) e `countPixelsOfColor`
  (rasteriza a página real via `page.toPixmap(Matrix.scale(2,2),
  DeviceRGB)` e conta pixels que batem com uma cor do tema — usado para
  detectar o traço do divisor).
- `__tests__/section-item-rows.test.ts`: +4 testes (VER001-VER004).
- `__tests__/generate-pdf.test.ts`: +3 testes (VER005/VER006/VER007 e
  VER008 de regressão).
- `CHANGELOG.md`: entrada `2026-09-20` documentando a extensão aditiva.

## RED

| Critério | Comando | Falha observada | Motivo esperado |
| --- | --- | --- | --- |
| VER001 | `npx vitest run __tests__/section-item-rows.test.ts` | inicialmente falhou por bug no próprio teste (filtro char-a-char pegava caracteres repetidos de header/footer) — corrigido trocando para `StructuredText.search()`; após a correção, VER001 passou de imediato (2 colunas sem `description` já era o comportamento existente) | confirma que o teste mede o que diz medir, não um falso-positivo do helper |
| VER002/VER003 | idem | `expected '...' to contain 'Fatura de deposito #2130968'` | `description` ainda não era lido por `section-renderer.ts` |
| VER004 | idem | `expected 0 to be greater than 0` (tentativa 1, via `onVector`/`collect-vectors`) → depois `Unused stext arguments found` (opção inválida) → depois `expected 1174 to be greater than 1174` (pixel count idêntico, pois o teste comparava a página 0 = capa, não a página com o card) | 3 iterações de ajuste do **oráculo de teste** (não da implementação) até isolar corretamente a página do card; a 4ª tentativa (pixel count na página correta) confirmou RED pelo motivo certo: divisor não implementado |
| VER006/VER007 | `npx vitest run __tests__/generate-pdf.test.ts` | `expected 595.28 to be greater than 841.89` | `orientation` ainda não lido por `pdf-builder.ts` |

## GREEN e regressão

| Comando | Resultado | Evidência relevante |
| --- | --- | --- |
| `npx vitest run __tests__/section-item-rows.test.ts` | 9 passed | VER001-VER004 + os 6 CAs pré-existentes (regressão) |
| `npx vitest run __tests__/generate-pdf.test.ts` | 20 passed | VER005-VER008 + os 17 testes pré-existentes (regressão) |
| `npx vitest run` (suíte completa) | 61 passed (5 arquivos) | nenhuma asserção pré-existente mudou |
| `npx tsc --noEmit` | sem output, exit 0 | VER009 — tipagem consistente em todo o pacote |
| `npm run build` | sem erros | `dist/` gerado com sucesso (consumido via dependência git + `prepare` script) |

## Guards

| VER | Comando/cenário | Resultado | Evidência |
| --- | --- | --- | --- |
| VER001 (regressão) | teste homônimo em `section-item-rows.test.ts` | PASSED | `label.x1 < value.x0` — 2 colunas sem overlap, igual ao comportamento anterior |
| VER002/VER003 | teste homônimo | PASSED | `label.x1 < description.x0 < description.x1 < value.x0` — 3 colunas sem overlap num card real |
| VER004 | teste homônimo | PASSED | contagem de pixels da cor `#D3D9DD` na página do card é maior com `dividerBefore: true` do que sem |
| VER005 (regressão) | teste homônimo em `generate-pdf.test.ts` | PASSED | todas as páginas com `width < height` quando `orientation` não é informado |
| VER006/VER007 | teste homônimo | PASSED | todas as páginas (capa e seção) com `width > height` quando `orientation: 'landscape'` — confirma que `layout` repassado em cada `addPage()` funciona, resolvendo a hipótese/risco do plan.md |
| VER008 (regressão) | teste homônimo | PASSED | `rows` continuam sendo renderizadas corretamente (texto presente) em landscape |
| VER009 | `npx tsc --noEmit` | PASSED | exit 0, sem erros |

VER010/VER011/VER012 (fixtures independentes do Verifier) e VER013 (gate
humano de merge em `main`) não executados pelo Builder — fora do escopo
desta implementação.

## Diff review

- Escopo: alterações restritas a `types.ts`, `sections/section-renderer.ts`,
  `pdf-builder.ts`, `__tests__/pdf-geometry.ts` (novo),
  `__tests__/section-item-rows.test.ts`, `__tests__/generate-pdf.test.ts` e
  `CHANGELOG.md`. `sections/page-chrome.ts` e `components/card.ts` **não**
  foram tocados, conforme previsto no plan.md (já dependem dinamicamente de
  `doc.page.width`/`height`).
- Resíduos: um arquivo de debug temporário (`__tests__/debug-divider.test.ts`)
  foi criado para investigar a página correta do card (capa vs. seção) e
  removido antes do commit — não faz parte do diff final.
- Nenhum `console.log`/TODO/código comentado deixado no código de produção.

## Divergências e limitações

- **`onVector`/`collect-vectors` da mupdf não são um oráculo confiável para
  o divisor**: a opção de string `'collect-vectors'` não é reconhecida pelo
  build wasm instalado (`Unused stext arguments found`), e mesmo sem opção
  o `walk()` não expôs blocos de vetor para o traço desenhado via
  `moveTo/lineTo/stroke` do pdfkit nos testes de repro. Trocado por
  rasterização real da página (`page.toPixmap` + contagem de pixels de uma
  cor específica) — mais robusto e também um oráculo "black-box" real
  (mede o resultado visual, não a estrutura interna do PDF).
- **VER013 pendente**: branch de feature criada (`git checkout -b`); commit,
  push, PR e merge em `main` ainda não realizados — fora do escopo desta
  sessão de implementação, aguardando handoff de release. Isso também
  bloqueia o início da Fase 5 em `kbr-domain-dealers-commissions`.

## Promoção de conhecimento durável

- N/A — este repositório não possui `CONTEXT.md`/ADRs próprias (biblioteca
  de infraestrutura pequena, sem esse artefato até o momento); nenhuma
  decisão desta demanda foi considerada durável o suficiente para justificar
  criar o artefato agora (mudança aditiva, sem novo padrão arquitetural).
