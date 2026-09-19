# Implementation Evidence

## Identificação

- Demanda: `20260919_card-linhas-e-rotulo-customizavel`
- Tasks: T01, T02, T03 (todas de `tasks.md`)
- Base: `spec.md`, `plan.md`, `verification.md` (todos aprovados em 2026-09-19)
- Branch: `feature/pdf-item-rows-suggestion-label`
- Data: 2026-09-19

## Escopo

- Requisitos: RF001, RF002, RF003, RN001, RN002, RN003
- Verificações (Builder): VER001, VER002, VER003, VER004, VER005, VER006, VER007
- Verificações fora do escopo do Builder: VER008/VER009 (cenários independentes
  do Verifier, fixtures próprias), VER010 (gate humano pós-merge, suíte de
  `kbr-domain-billing`), VER011 (gate humano/processo — branch de feature já
  criada, PR/merge ainda pendentes)

## Mudanças

### Arquivos

- `types.ts`: novo `PdfItemRow { label: string; value: string }`;
  `PdfSectionItem` ganha `rows?: PdfItemRow[]` e `suggestionLabel?: string`.
  Extensão puramente aditiva — nenhum campo existente mudou de tipo ou
  obrigatoriedade.
- `sections/section-renderer.ts`: `cardHeight` passa a somar `rowsHeight`
  (soma de `measureRowHeight` por `PdfItemRow`, via novos helpers
  `computeRowLayout`/`measureRowHeight`) antes de chamar
  `ensureSpaceOrNewPage`; desenha cada row (label à esquerda, value alinhado
  à direita, colunas sem overlap mesmo com quebra de linha do `value`) entre
  `description` e o bloco de `suggestion`; troca o literal fixo
  `'SUGGESTION'` por `item.suggestionLabel ?? 'SUGGESTION'`.
- `theme.ts`: novo `spacing.itemRowGap: 4`.
- `__tests__/pdf-text.ts` (novo): helper `extractPagesText(buffer)` — abre o
  PDF gerado via `mupdf.Document.openDocument` e extrai o texto real de cada
  página (`page.toStructuredText().asText()`), permitindo oráculos fortes
  (conteúdo/paginação) em vez de só validar `buffer.length`/prefixo `%PDF-`.
- `__tests__/section-item-rows.test.ts` (novo, 6 testes): CA001 (regressão
  sem campos novos), CA002 (N rows renderizadas com label/value), CA003
  (rows grande o bastante não corta o card entre páginas), CA004
  (`suggestionLabel` customizado), CA005 (regressão do rótulo default), CA006
  (quebra de linha de `value` longo sem sobrepor `label`).
- `CHANGELOG.md`: entrada `2026-09-19` documentando a extensão aditiva.

## RED

| Critério | Comando | Falha observada | Motivo esperado |
| --- | --- | --- | --- |
| CA002/VER002, CA003/VER003, CA004/VER004, CA006/VER006 | `npx vitest run __tests__/section-item-rows.test.ts` | 4 de 6 falharam: `expected '...' to contain 'Deposito - Fatura #123'` / `'Linha de desconto numero 0'` / `'CÁLCULO'` / conteúdo de `rows` | `rows`/`suggestionLabel` ainda não existiam em `types.ts` nem eram lidos por `section-renderer.ts` — CA001 e CA005 (regressão, sem campos novos) já passavam nesse primeiro RED, confirmando que a falha era especificamente dos campos novos |

## GREEN e regressão

| Comando | Resultado | Evidência relevante |
| --- | --- | --- |
| `npx vitest run __tests__/section-item-rows.test.ts` | 6 passed | todos os CAs (001-006) verdes após implementar `rows`/`suggestionLabel` |
| `npx vitest run` (suíte completa do pacote) | 55 passed (5 arquivos) | nenhuma asserção pré-existente mudou — `entry-points`, `layout-components`, `processing`, `generate-pdf`, `section-item-rows` |
| `npm run typecheck` (`tsc --noEmit`) | sem output, exit 0 | tipagem consistente em todo o pacote |

## Guards

| VER | Comando/cenário | Resultado | Evidência |
| --- | --- | --- | --- |
| VER001 (regressão) | CA001 em `section-item-rows.test.ts` | PASSED | item sem `rows`/`suggestionLabel` renderiza `description`/`suggestion`/`'SUGGESTION'` como antes |
| VER002 | CA002 | PASSED | `pageText` contém label e value de cada `PdfItemRow` |
| VER003 | CA003 | PASSED | card com 15 rows aparece inteiro (linha 0 e linha 14) na mesma página, mesmo forçado a uma página seguinte por um item anterior extenso |
| VER004 | CA004 | PASSED | `'CÁLCULO'` presente, `'SUGGESTION'` ausente quando `suggestionLabel` é informado |
| VER005 (regressão) | CA005 | PASSED | `'SUGGESTION'` continua presente quando `suggestionLabel` está ausente |
| VER006 | CA006 | PASSED | `value` longo quebra em múltiplas linhas (confirmado via texto extraído, espaços normalizados) sem perder conteúdo de `label` |
| VER007 | `npm run typecheck` | PASSED | exit 0, sem erros |

VER008/VER009 (fixtures independentes do Verifier) e VER010/VER011 (gates
humanos pós-merge) não executados pelo Builder — fora do escopo desta
implementação.

## Diff review

- Escopo: alterações restritas a `types.ts`, `sections/section-renderer.ts`,
  `theme.ts`, `__tests__/pdf-text.ts` (novo), `__tests__/section-item-rows.test.ts`
  (novo) e `CHANGELOG.md`. Nenhum arquivo fora do escopo desta demanda foi
  tocado.
- Resíduos: nenhum `console.log`/debug/`TODO`/código comentado.
- Teste inicial (CA003) usava 40 rows, o que tornava o card maior que
  qualquer página inteira — ajustado para 15 rows durante o próprio ciclo
  RED/GREEN, já que o critério (CA003/RN002) é "não cortar um card que
  cabe numa página", não "nunca haver corte independente do tamanho".

## Divergências e limitações

- **Oráculo de teste mais forte que o padrão pré-existente do pacote**: os
  testes de `generate-pdf.test.ts` já existentes só validam prefixo `%PDF-`
  e `buffer.length`. Os novos testes usam `mupdf` (já dependência do
  pacote) para extrair texto real por página — decisão técnica não coberta
  literalmente por `tasks.md`, mas alinhada ao rigor exigido por
  VER002-VER006 em `verification.md` (que pedem conteúdo/posicionamento, não
  só "gerou um PDF").
- **VER011 parcialmente concluído**: branch de feature criada; PR e merge
  em `main` ainda não abertos (fora do escopo desta sessão de implementação —
  aguardando o handoff de release).
