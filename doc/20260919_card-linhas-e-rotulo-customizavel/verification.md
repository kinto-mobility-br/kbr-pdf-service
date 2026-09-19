> Constitution aplicável: nenhuma — `kbr-pdf-service` não tem constitution própria.
> Spec: [spec.md](./spec.md) · Plan: [plan.md](./plan.md)

# Verification Contract — Linhas de duas colunas e rótulo customizável no card de item

## Identificação

- Demanda: `card-linhas-e-rotulo-customizavel`
- Versão da spec: 1.0 (aprovada 2026-09-19)
- Risco: **Médio** — mudança comportamental reversível num contrato
  consumido por dois domínios (`kbr-domain-billing`, `kbr-domain-dealers-commissions`)
  via dependência de git pinada em branch (sem tag/versão), elevado de Baixo
  por esse blast radius; não chega a Alto porque é estritamente aditiva
  (RN001), sem dado financeiro/PII/IAM/migration envolvido diretamente neste
  pacote.
- Aprovado por: _(pendente — gate humano desta fase)_
- Data: 2026-09-19

## Oráculos

- **O001**: para todo `PdfReportInput` que não usa `rows`/`suggestionLabel`,
  o PDF gerado é byte-idêntico ao gerado pela versão anterior do pacote
  (mesmo input), exceto os campos `/CreationDate` e `/ID` do trailer PDF —
  não-determinísticos no `pdfkit` (timestamp de execução e hash aleatório
  gerados a cada chamada, independentes do conteúdo/código), portanto fora
  do alcance de qualquer oráculo de igualdade de buffer neste pacote.
- **O002**: para todo `PdfSectionItem.rows` com N elementos, o card
  renderizado tem N linhas, cada uma com `label` alinhado à esquerda e
  `value` alinhado à direita da largura útil do card.
- **O003**: para todo `PdfSectionItem.suggestion` com `suggestionLabel`
  definido, o texto desenhado no bloco destacado é exatamente
  `suggestionLabel` (não `'SUGGESTION'`).
- **O004**: nenhum card com `rows` é desenhado cortado entre duas páginas —
  `ensureSpaceOrNewPage` recebe a altura total (incluindo `rows`) antes do
  primeiro traço do card.

## Matriz de verificação

| ID | Requisito/invariante | Tipo | Executor | Ambiente | Obrigatório | Critério de sucesso | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VER001 | CA001, RN001, INV001 | regressão | Builder | teste (`vitest`) | sim | suíte existente do pacote passa sem alterar nenhuma asserção pré-existente após a mudança | resultado `npx vitest run` |
| VER002 | CA002, O002 | unitário | Builder | teste | sim | item com `rows: [{label, value}, ...]` gera N linhas no card, `value` alinhado à direita | resultado de teste novo em `__tests__/` |
| VER003 | CA003, O004, RN002 | unitário | Builder | teste | sim | item com `rows` grande o bastante para não caber no restante da página força `doc.addPage()` antes de desenhar; card aparece inteiro na página seguinte | resultado de teste novo, inspecionando páginas do PDF gerado |
| VER004 | CA004, O003 | unitário | Builder | teste | sim | item com `suggestion` + `suggestionLabel: 'CÁLCULO'` desenha `'CÁLCULO'` no bloco destacado | resultado de teste novo |
| VER005 | CA005, RN001 (regressão) | unitário | Builder | teste | sim | item com `suggestion` sem `suggestionLabel` continua desenhando `'SUGGESTION'` | resultado de teste novo/estendido |
| VER006 | CA006, RN002 | unitário | Builder | teste | sim | `PdfItemRow.value` mais longo que a coluna quebra linha sem sobrepor `label` | resultado de teste novo |
| VER007 | INV001 (estático) | estático | Builder | `tsc`/`typecheck` | sim | `npm run typecheck` do próprio pacote passa após adicionar os tipos novos | saída do comando |
| VER008 | O001 (cenário independente) | black-box adversarial | Verifier | sandbox/teste | sim | a partir de um `PdfReportInput` de fixture próprio do Verifier (não reaproveitar fixture do Builder), sem `rows`/`suggestionLabel`, confirmar que o buffer gerado antes e depois da mudança é idêntico byte-a-byte, exceto `/CreationDate` e `/ID` (ver O001) | comparação reproduzida pelo Verifier |
| VER009 | O002, O004 (cenário independente) | black-box adversarial | Verifier | sandbox/teste | sim | montar item com `rows` deliberadamente grande (>1 página de conteúdo) e confirmar visualmente/estruturalmente que nenhum card é cortado entre páginas | inspeção do PDF gerado pelo Verifier |
| VER010 | INV002 (não regressão em consumidor real) | integração | Humano/Builder | `kbr-domain-billing` local | recomendado, não bloqueante | suíte de testes de `kbr-domain-billing` roda sem falhas após o merge desta mudança (dependência `@kbr/pdf-service#main` atualizada) | saída da suíte de `billing`, registrada após o merge |
| VER011 | gate de processo (spec: branch) | gate humano | Humano | repositório | sim | mudança implementada em branch de feature (`feature/pdf-item-rows-suggestion-label`), com PR revisado antes do merge em `main` | link do PR / confirmação humana |

## Checks do Builder

- Regressão da suíte existente sem alteração de asserção (VER001).
- TDD dos 4 cenários novos de `rows`/`suggestionLabel`/paginação/quebra de
  linha (VER002-VER006).
- `typecheck` do pacote (VER007).

## Checks independentes

- Byte-identidade do PDF para inputs sem os campos novos, a partir de
  fixture próprio do Verifier (VER008).
- Não corte de card com `rows` grande entre páginas (VER009).

## Gates humanos

- Aprovação da spec, deste plan/verification e das tasks.
- VER011: branch de feature + PR revisado antes do merge em `main`.
- VER010: checagem recomendada (não bloqueante) da suíte de `kbr-domain-billing`
  após o merge, dado o compartilhamento via dependência de git pinada em
  branch.
- Veredito final do review (Fase 6).

## Critérios de aprovação

- Todos os VER obrigatórios executados e com evidência reproduzida.
- Nenhum achado crítico ou alto aberto no review.
- Riscos residuais (VER010, checagem em `billing`) documentados e aceitos.

## Limitações conhecidas

- Não é possível garantir, só por este contrato, que `kbr-domain-billing`
  nunca vai quebrar com a mudança — só que a mudança é aditiva por
  construção e que a suíte de `billing` roda verde uma vez após o merge
  (VER010, checagem pontual, não contínua).
- Renderização visual "correta" (estética, não só estrutural) do card com
  `rows` só é confirmável por inspeção humana do PDF gerado, não por
  asserção automatizada de layout pixel-perfect.
