> Constitution aplicável: nenhuma — `kbr-pdf-service` não tem constitution própria.
> Spec: [spec.md](./spec.md) · Plan: [plan.md](./plan.md) · Verification: [verification.md](./verification.md)

# Tasks — Linhas de duas colunas e rótulo customizável no card de item

## Pré-requisito (antes da Onda 1)

- [x] Criar branch de feature `feature/pdf-item-rows-suggestion-label` a
      partir de `main` (VER011 — gate humano/processo, decisão já tomada na
      spec).

## Onda 1

## T01 — Tipos novos + renderização de `rows` (linhas de duas colunas)

Relacionamentos: RF001, RF003, RN001, RN002, RN003, CA002, CA003, CA006 · VER002, VER003, VER006
Arquivos-alvo: `types.ts`, `sections/section-renderer.ts`, `__tests__/layout-components.test.ts` (ou novo arquivo de teste)
Contratos congelados: `PdfItemRow { label: string; value: string }` e `PdfSectionItem.rows?: PdfItemRow[]` (definidos em [plan.md](./plan.md#contratos-técnicos)); nenhuma outra task edita esses tipos.

- [x] Escrever teste: item com `rows: [{label, value}, ...]` (N elementos)
      renderiza N linhas, `value` alinhado à direita da largura útil do card
      (CA002/VER002)
- [x] Confirmar RED (campo `rows` ainda não existe/não é lido pelo renderer)
- [x] Adicionar `PdfItemRow`/`PdfSectionItem.rows` em `types.ts`; em
      `section-renderer.ts`, somar a altura de cada linha de `rows` na
      medição do card e desenhar cada linha (label esquerda/value direita)
      entre `description` e `suggestion`
- [x] Confirmar GREEN
- [x] Escrever teste: `rows` grande o bastante para não caber no restante da
      página atual força `doc.addPage()` antes de desenhar; card aparece
      inteiro na página seguinte, nunca cortado (CA003/VER003)
- [x] Confirmar RED pelo motivo esperado (altura de `rows` ainda não entra no
      cálculo passado a `ensureSpaceOrNewPage`)
- [x] Ajustar a soma de altura para incluir `rows` antes da chamada de
      `ensureSpaceOrNewPage` (sem alterar a função em si)
- [x] Confirmar GREEN
- [x] Escrever teste: `PdfItemRow.value` mais longo que a largura da coluna
      quebra linha sem sobrepor `label` (CA006/VER006)
- [x] Confirmar RED/GREEN conforme o comportamento de quebra implementado
- [x] Registrar evidências (comando, saída, RED/GREEN) em
      `implementation-evidence.md`

## Onda 2

## T02 — Rótulo customizável do bloco destacado (`suggestionLabel`)

Relacionamentos: RF002, RN001, CA004, CA005 · VER004, VER005
Arquivos-alvo: `types.ts`, `sections/section-renderer.ts`, mesmo arquivo de teste de T01
Contratos congelados: `PdfSectionItem.suggestionLabel?: string`; consome a renderização de `rows` de T01 sem alterá-la.

- [x] Escrever teste: item com `suggestion` + `suggestionLabel: 'CÁLCULO'`
      desenha `'CÁLCULO'` no bloco destacado (CA004/VER004)
- [x] Confirmar RED (rótulo ainda fixo em `'SUGGESTION'`)
- [x] Adicionar `suggestionLabel?: string` a `PdfSectionItem`; trocar o
      literal fixo por `item.suggestionLabel ?? 'SUGGESTION'` no bloco
      destacado
- [x] Confirmar GREEN
- [x] Escrever/confirmar teste de regressão: item com `suggestion` **sem**
      `suggestionLabel` continua desenhando `'SUGGESTION'` (CA005/VER005)
- [x] Confirmar GREEN
- [x] Registrar evidências em `implementation-evidence.md`

## Onda 3

## T03 — Regressão completa, typecheck e CHANGELOG

Relacionamentos: RN001, INV001 · VER001, VER007
Arquivos-alvo: `CHANGELOG.md`, toda a suíte `__tests__/`
Contratos congelados: nenhum novo — só valida o que T01/T02 já implementaram.

- [x] Rodar `npx vitest run` completo do pacote e confirmar que nenhuma
      asserção pré-existente mudou (CA001/VER001)
- [x] Rodar `npm run typecheck` (ou `tsc --noEmit`) do pacote (VER007)
- [x] Adicionar entrada no `CHANGELOG.md` documentando a extensão aditiva
      (`rows`/`PdfItemRow`, `suggestionLabel`)
- [x] Registrar evidências em `implementation-evidence.md`

## Fora das ondas — cenários independentes e gates humanos

- VER008 (byte-identidade do PDF para input sem os campos novos, fixture
  própria) e VER009 (card com `rows` grande não corta entre páginas, fixture
  própria) — cenários independentes do **Verifier**, contexto limpo, ver
  `verification.md`.
- VER010 (checagem recomendada, não bloqueante: suíte de
  `kbr-domain-billing` roda verde após o merge) — **gate humano**, executado
  depois do merge em `main`.
- VER011 (branch de feature + PR revisado antes do merge) — **gate
  humano/processo**, já iniciado no pré-requisito acima; concluído no merge.

---

**Você aprova o plano de execução?**
