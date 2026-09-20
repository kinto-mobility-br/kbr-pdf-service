> Constitution aplicável: nenhuma (biblioteca de infraestrutura, ver spec.md).
> Spec: [spec.md](./spec.md) · Plan: [plan.md](./plan.md)

# Verification Contract — 3ª coluna, divisor e orientação em `@kbr/pdf-service`

## Identificação

- Demanda: `card-item-descricao-divisor-orientacao-paisagem`
- Versão da spec: 1.0 (aprovada 2026-09-20)
- Risco: **Médio** — biblioteca compartilhada consumida por 3 domínios
  (`kbr-domain-billing`, `kbr-domain-dealers-commissions`,
  `kbr-domain-invoices`/legado); mudança é aditiva/opt-in (reduz risco),
  mas uma regressão aqui afeta múltiplos consumidores ao mesmo tempo
  (eleva risco) — não é Alto porque nenhum dado financeiro/PII é
  processado por esta lib (só formatação de texto já fornecido pelo
  chamador).
- Aprovado por: _(pendente — gate humano desta fase)_
- Data: 2026-09-20

## Oráculos

- **O001**: `PdfItemRow` sem `description` renderiza em 2 colunas (label
  esquerda, value direita), idêntico ao layout anterior a esta demanda.
- **O002**: `PdfItemRow` com `description` não vazia renderiza em 3
  colunas (label, description, value), sem sobreposição de texto entre
  colunas adjacentes.
- **O003**: `PdfItemRow` com `dividerBefore: true` sempre tem um traço
  horizontal desenhado imediatamente acima dela; sem a flag (ausente ou
  `false`), nenhum traço é desenhado.
- **O004**: `PdfReportConfig.orientation: 'landscape'` resulta em todas as
  páginas do PDF gerado (capa + seções) com `doc.page.width >
  doc.page.height`; `orientation` ausente ou `'portrait'` resulta em todas
  as páginas com `doc.page.width < doc.page.height` (A4 retrato).
- **O005**: para um mesmo `PdfReportInput` sem nenhum dos campos novos
  (`description`/`dividerBefore`/`orientation`), a estrutura do PDF gerado
  (nº de páginas, posições dos elementos) é idêntica à gerada antes desta
  demanda (regressão, INV001).
- **O006**: dentro do mesmo card, linhas com e sem `description` podem
  coexistir, cada uma layoutada de forma independente (RN001).

## Matriz de verificação

| ID | Requisito/invariante | Tipo | Executor | Ambiente | Obrigatório | Critério de sucesso | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VER001 | RF001, O001 (regressão) | unitário | Builder | teste | sim | `PdfItemRow` sem `description` gera as mesmas 2 âncoras de coluna (`labelWidth`/`valueX`/`valueWidth`) que o comportamento atual | resultado `section-item-rows.test.ts` |
| VER002 | RF001, O002 | unitário | Builder | teste | sim | `PdfItemRow` com `description` gera 3 âncoras de coluna sem overlap (`labelWidth + gap <= descriptionX`, `descriptionX + descriptionWidth + gap <= valueX`) | resultado `section-item-rows.test.ts` |
| VER003 | O006 | unitário | Builder | teste | sim | card com `rows` misturando linhas com e sem `description` renderiza cada uma no layout correto, sem lançar erro | resultado `section-item-rows.test.ts` |
| VER004 | RF002, O003 | unitário | Builder | teste | sim | `measureRowHeight`/altura do card para uma linha com `dividerBefore: true` inclui a altura do traço + gap; sem a flag, não inclui | resultado `section-item-rows.test.ts` |
| VER005 | RF002, O003 (geração real) | integração | Builder | teste (buffer PDF real) | sim | gerar um PDF real com 1 card de 2 linhas, a 2ª com `dividerBefore: true`, e confirmar (via parse básico do buffer ou contagem de operações de desenho) que exatamente 1 traço foi desenhado na posição esperada | resultado `generate-pdf.test.ts` |
| VER006 | RF003, O004 | integração | Builder | teste (buffer PDF real) | sim | `buildPdf` com `orientation: 'landscape'` gera documento cujas páginas têm `width > height`; sem o campo, `width < height` | resultado `generate-pdf.test.ts` |
| VER007 | RF003 (hipótese do plan) | investigação | Builder | teste real | sim | confirmar que `doc.addPage({ layout })` de fato altera `doc.page.width/height` da nova página igual à passada no constructor — sem essa confirmação, resultado de VER006 já cobre isso na prática (mesmo teste serve de evidência) | resultado `generate-pdf.test.ts` (mesmo de VER006) |
| VER008 | INV001, O005 (regressão) | integração | Builder | teste (buffer PDF real) | sim | `PdfReportInput` idêntico ao usado por um teste de regressão pré-existente (sem os campos novos) gera PDF com mesma contagem de páginas/estrutura que antes desta demanda | resultado `generate-pdf.test.ts` (comparação com fixture/snapshot existente) |
| VER009 | INV002 (tipos) | estático | Builder | `tsc --noEmit` | sim | `types.ts` compila com os 3 campos novos opcionais, sem quebrar nenhum consumo existente dos tipos dentro deste repo | saída de `npm run build`/`tsc --noEmit` |
| VER010 | O001, O002, O006 (cenário independente) | black-box adversarial | Verifier | sandbox/teste | sim | a partir de fixtures próprias (não reaproveitar as do Builder), montar cards com combinações de linhas 2/3 colunas e confirmar ausência de overlap/corte de texto | resultado reproduzido pelo Verifier |
| VER011 | O003 (cenário independente) | black-box adversarial | Verifier | sandbox/teste | sim | card com múltiplos `dividerBefore: true` no mesmo array de rows (RN002) renderiza múltiplos traços, sem erro | resultado reproduzido pelo Verifier |
| VER012 | O004, O005 (cenário independente) | black-box adversarial | Verifier | sandbox/teste | sim | gerar PDF em paisagem com uma seção de tabela (`table`, não só `items`) e confirmar que a tabela também respeita a largura maior, sem overflow | resultado reproduzido pelo Verifier |
| VER013 | risco de regressão em consumidores externos | gate humano | Humano | leitura | sim | confirmar, antes do merge em `main`, que nenhum consumidor (`kbr-domain-billing`, `kbr-domain-invoices`) precisa de ação imediata (mudança é opt-in — confirmação de que a leitura do plan.md/spec.md está correta quanto a isso) | confirmação humana registrada nesta demanda |

## Checks do Builder

- TDD de `computeRowLayout`/`measureRowHeight` (2 vs 3 colunas, altura do
  divisor) — VER001-VER004.
- Teste de geração real de PDF (buffer), cobrindo divisor + orientação +
  regressão — VER005, VER006, VER007, VER008.
- `tsc --noEmit` — VER009.

## Checks independentes

- Combinações adversariais de linhas 2/3 colunas não previstas nas
  fixtures do Builder (VER010).
- Múltiplos divisores no mesmo card (VER011).
- Interação orientação + tabela (não só cards) (VER012).

## Gates humanos

- Aprovação da spec, deste plan/verification e das tasks.
- VER013: confirmação de que a mudança é segura para os demais
  consumidores antes do merge em `main` (dependência bloqueante da spec de
  `kbr-domain-dealers-commissions`).
- Veredito final do review (Fase 6).

## Critérios de aprovação

- Todos os VER obrigatórios executados e com evidência reproduzida.
- Nenhum achado crítico ou alto aberto no review.
- Merge em `main` só ocorre após veredito do review (o consumidor
  `kbr-domain-dealers-commissions` depende deste merge).

## Limitações conhecidas

- Verificação de "byte-identidade" (INV001/O005) depende de comparação de
  estrutura (nº de páginas, posições), não de hash binário exato do PDF —
  PDFKit pode incluir metadados não-determinísticos (timestamp) que
  variam entre gerações mesmo sem mudança de conteúdo.
- Nenhum teste cobre o volume real de consumidores (`kbr-domain-billing`)
  gerando PDF em produção após o merge — a confirmação de "nenhuma
  regressão real" só ocorre no primeiro uso pós-merge por cada consumidor.
