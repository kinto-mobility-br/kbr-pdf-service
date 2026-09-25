> Constitution aplicável: nenhuma (biblioteca de infraestrutura, ver spec.md).
> Spec: [spec.md](./spec.md) · Plan: [plan.md](./plan.md) · Verification: [verification.md](./verification.md)

# Tasks — 3ª coluna, divisor e orientação em `@kbr/pdf-service`

## Onda 1

## T01 — Tipos novos (`types.ts`)

Relacionamentos: RF001, RF002, RF003 (tipos) · VER009
Arquivos-alvo: `types.ts`
Contratos congelados: `PdfItemRow` ganha `description?: string`,
`dividerBefore?: boolean`; `PdfReportConfig` ganha `orientation?: 'portrait'
| 'landscape'` (definidos em [plan.md](./plan.md#contratos-técnicos));
nenhum campo existente muda de tipo/obrigatoriedade.

- [ ] Adicionar `description?`/`dividerBefore?` a `PdfItemRow`
- [ ] Adicionar `orientation?` a `PdfReportConfig`
- [ ] Rodar `tsc --noEmit`/`npm run build` (VER009) — confirmar que nenhum
      arquivo existente do repo quebra com os campos novos
- [ ] Registrar evidências em `implementation-evidence.md`

## Onda 2

## T02 — 3 colunas e divisor (`sections/section-renderer.ts`)

Relacionamentos: RF001, RF002, RN001, RN002 · VER001, VER002, VER003, VER004
Arquivos-alvo: `sections/section-renderer.ts`, `__tests__/section-item-rows.test.ts`
Contratos congelados: `computeRowLayout`/`measureRowHeight` passam a
receber `hasDescription`/considerar `dividerBefore` por linha (assinatura
em [plan.md](./plan.md#contratos-técnicos)); consome os tipos de T01 sem
alterá-los; nenhuma mudança em `pdf-builder.ts`/`page-chrome.ts` nesta task.

- [ ] Escrever teste: `PdfItemRow` sem `description` gera as mesmas 2
      âncoras de coluna do comportamento atual (VER001)
- [ ] Confirmar GREEN (deve passar por construção — `computeRowLayout`
      ainda não mudou de comportamento para este caso)
- [ ] Escrever teste: `PdfItemRow` com `description` gera 3 âncoras de
      coluna sem overlap (VER002)
- [ ] Confirmar RED (3ª coluna ainda não existe)
- [ ] Implementar `computeRowLayout(textWidth, hasDescription)` com ramo de
      3 colunas; atualizar laço de desenho de `item.rows` para escolher o
      layout por linha (RN001) e desenhar `row.description` quando presente
- [ ] Confirmar GREEN
- [ ] Escrever teste: card com linhas com e sem `description` misturadas
      renderiza cada uma corretamente, sem erro (VER003)
- [ ] Confirmar GREEN
- [ ] Escrever teste: `measureRowHeight`/altura do card para uma linha com
      `dividerBefore: true` inclui altura do traço + gap; sem a flag, não
      inclui (VER004)
- [ ] Confirmar RED (divisor ainda não implementado)
- [ ] Implementar desenho do divisor antes da linha (`dividerBefore`) e
      ajuste de `measureRowHeight`/avanço de `innerY`
- [ ] Confirmar GREEN
- [ ] Registrar evidências em `implementation-evidence.md`

## Onda 3

## T03 — Orientação de página (`pdf-builder.ts`) e regressão end-to-end

Relacionamentos: RF003, INV001 · VER005, VER006, VER007, VER008
Arquivos-alvo: `pdf-builder.ts`, `__tests__/generate-pdf.test.ts`
Contratos congelados: `DEFAULT_CONFIG.orientation = 'portrait'`; `layout`
repassado na criação do `PDFDocument` e em cada `doc.addPage()`; consome
T01/T02 sem alterá-los; `getContentArea`/`page-chrome.ts` **não** são
tocados (já dinâmicos).

- [ ] Escrever teste (buffer PDF real): gerar 1 card com 2 linhas, a 2ª com
      `dividerBefore: true`, e confirmar exatamente 1 traço desenhado na
      posição esperada (VER005)
- [ ] Confirmar GREEN (deve passar por construção — divisor já implementado
      em T02; este teste valida a integração real via buffer)
- [ ] Escrever teste: `buildPdf` com `orientation: 'landscape'` gera todas
      as páginas com `width > height`; sem o campo, `width < height`
      (VER006)
- [ ] Confirmar RED (orientação ainda não implementada em `pdf-builder.ts`)
- [ ] Implementar `layout: config.orientation` na criação do `PDFDocument`
      e em cada `doc.addPage()` (capa + por seção)
- [ ] Confirmar GREEN — este mesmo teste também serve de evidência para a
      hipótese do plan sobre `addPage({ layout })` (VER007)
- [ ] Escrever teste (regressão): `PdfReportInput` sem nenhum campo novo
      gera PDF com mesma estrutura (nº de páginas) que antes desta demanda
      (VER008)
- [ ] Confirmar GREEN (sem quebrar nenhum teste de regressão pré-existente
      do repo — rodar toda a suíte, não só os testes novos)
- [ ] Registrar evidências em `implementation-evidence.md`

## Fora das ondas — cenários independentes e gates humanos

- VER010 (combinações adversariais de linhas 2/3 colunas sem overlap/corte
  de texto, fixtures próprias) e VER011 (múltiplos `dividerBefore` no
  mesmo card) — cenários independentes do **Verifier**, ver
  `verification.md`.
- VER012 (orientação + seção de tabela, não só cards) — cenário
  independente do **Verifier**.
- VER013 (confirmação humana de que a mudança é segura para os demais
  consumidores antes do merge em `main`) — **gate humano**, condição para
  liberar o merge (dependência bloqueante da spec de
  `kbr-domain-dealers-commissions`).

---

**Você aprova o plano de execução?**
