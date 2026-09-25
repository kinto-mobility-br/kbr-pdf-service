# Independent Review

## Identificação

- Demanda: `card-item-descricao-divisor-orientacao-paisagem`
- Tasks: T01 (types), T02 (section-renderer, 3ª coluna + divisor), T03
  (orientação)
- Base do diff: `f521eb6` (main, antes da demanda) vs. `c1b4793` (main,
  merge commit do PR #5) — `git diff f521eb6 c1b4793 --stat`
- Risco: **Médio** (biblioteca compartilhada consumida por múltiplos
  domínios; mudança aditiva/opt-in reduz risco, mas regressão afeta vários
  consumidores ao mesmo tempo)
- Data: 2026-09-20
- **Nota de independência**: este review foi conduzido na mesma sessão que
  implementou a mudança (experimento `kbr-orchestrator-agent`, decisão
  explícita do usuário de prosseguir apesar do risco de viés de
  confirmação sinalizado). Tratar as conclusões abaixo com ceticismo
  proporcional a essa limitação — reprodução independente (cenários
  próprios, fixtures distintas) foi priorizada exatamente para mitigar
  esse risco, mas não o elimina.

## Contrato reconstruído

(a partir de `spec.md`/`plan.md`/`verification.md`, lidos do disco antes
de reexaminar a implementação)

- **Comportamentos esperados**: `PdfItemRow` sem `description` renderiza em
  2 colunas (label/value), igual ao layout anterior (O001); com
  `description` não vazia, renderiza em 3 colunas sem overlap (O002);
  `dividerBefore: true` sempre desenha um traço horizontal imediatamente
  acima da linha, sem a flag nenhum traço é desenhado (O003);
  `orientation: 'landscape'` resulta em todas as páginas (capa + seções)
  com `width > height`; ausente/`'portrait'` mantém `width < height`
  (O004); linhas com e sem `description` podem coexistir no mesmo card,
  cada uma layoutada independentemente (O006, RN001).
- **Invariantes**: (INV001/O005) `PdfReportInput` sem nenhum campo novo
  gera PDF estruturalmente idêntico ao comportamento pré-demanda
  (regressão); (INV002) `types.ts` compila com os 3 campos novos opcionais
  sem quebrar consumo existente.
- **Comportamentos proibidos**: nenhuma mudança de layout em 2 colunas para
  quem não usa `description`; nenhuma perda de conteúdo (texto cortado)
  quando 3 colunas são usadas; orientação não pode ser "meio aplicada"
  (capa em um formato, seções em outro).
- **Failure modes**: nenhum documentado como best-effort — todos os
  oráculos são determinísticos/síncronos (geração de PDF é uma função
  pura de input para buffer).

## Escopo analisado

- Arquivos: `types.ts`, `sections/section-renderer.ts`, `pdf-builder.ts`,
  `__tests__/pdf-geometry.ts` (novo), `__tests__/section-item-rows.test.ts`,
  `__tests__/generate-pdf.test.ts`, `CHANGELOG.md`, `doc/20260920_.../*.md`.
- Consumidores: `kbr-domain-billing`, `kbr-domain-invoices` (uso legado,
  sem alteração de código necessária — mudança opt-in) e
  `kbr-domain-dealers-commissions` (consumidor imediato, dependente deste
  merge).
- Contratos: `PdfReportInput`/`PdfSectionItem`/`PdfItemRow`/`PdfReportConfig`
  (extensão puramente aditiva, confirmado por leitura de `types.ts` — nenhum
  campo existente mudou de tipo/obrigatoriedade).

## Evidências reproduzidas

| ID/VER | Comando ou cenário | Esperado | Observado | Resultado |
| --- | --- | --- | --- | --- |
| VER001-VER004 | `npx vitest run __tests__/section-item-rows.test.ts` | 9 testes PASS | 9 passed | PASS |
| VER005-VER008 | `npx vitest run __tests__/generate-pdf.test.ts` | 20 testes PASS | 20 passed | PASS |
| — | `npx vitest run` (suíte completa) | 61 passed (5 arquivos) | 61 passed (5 arquivos) | PASS |
| VER009 | `npx tsc --noEmit` | sem output, exit 0 | sem output, exit 0 | PASS |
| — | `git diff f521eb6 c1b4793 --stat` | escopo restrito aos arquivos previstos no plan.md | 12 arquivos (`types.ts`, `section-renderer.ts`, `pdf-builder.ts`, 2 test files + `pdf-geometry.ts` novo, `CHANGELOG.md`, 5 docs da demanda) — `page-chrome.ts`/`components/card.ts` **não** tocados | PASS |

## Cenários independentes

| Cenário | Propriedade validada | Resultado | Evidência |
| --- | --- | --- | --- |
| VER010 | Card com 5 linhas misturando 2 e 3 colunas (fixture própria, textos/valores distintos dos usados pelo Builder), incluindo uma descrição longa | nenhum overlap entre label/description/value em nenhuma das linhas mistas | PASS | teste temporário `zz-review-ver010-012.test.ts` (executado e removido) |
| VER011 | Card com 2 `dividerBefore: true` no mesmo array de `rows` | 2 traços desenhados (contagem de pixels da cor do divisor no card com 2 flags maior que no card de controle com 1 flag) | PASS | idem |
| VER012 | Seção com `table` (não `items`) + `orientation: 'landscape'`, fixture própria com 3 colunas e 2 linhas | todas as páginas com `width > height`; texto da última coluna/linha não ultrapassa a largura da página | PASS | idem |

Nota: o arquivo de teste usado nos 3 cenários foi criado fora do fluxo de
aprovação (fixtures próprias, distintas das do Builder), executado com
sucesso, e **removido** do repositório logo em seguida — `git status
--short` confirmado limpo (sem resíduo `zz-review-*`) após a limpeza.

## Achados

Nenhum achado crítico, alto ou médio identificado.

- **REV001 (Baixo, observação)**: VER013 (gate humano — "confirmar, antes
  do merge em main, que nenhum consumidor precisa de ação imediata") não
  tem um registro formal explícito de confirmação nesta demanda além da
  decisão do usuário de autorizar o merge diretamente (capturada via
  `vscode_askQuestions` nesta mesma sessão, opção mais agressiva escolhida
  explicitamente). Como a mudança é aditiva/opt-in (nenhum campo
  obrigatório novo, nenhum comportamento existente alterado sem flag), o
  risco residual é baixo, mas o artefato não tem uma linha textual
  separada documentando essa confirmação — só o histórico de decisão do
  usuário na conversa. Direcionamento: registrar essa confirmação
  explicitamente no `implementation-evidence.md` ou nesta seção (feito
  aqui) da próxima vez que uma mudança de biblioteca compartilhada exigir
  VER013-like gate.

## Cobertura da verificação

- **Confirmado**: VER001-VER009 reproduzidos independentemente com
  resultado idêntico ao relatado pelo Builder; VER010-VER012 executados
  como cenários adversariais próprios (fixtures distintas, incluindo
  combinação de 5 linhas mistas 2/3 colunas e tabela em paisagem — cenário
  não coberto tal qual pelos testes do Builder). Escopo do diff confirmado
  via `git diff --stat` direto, não apenas via relato.
- **Não verificado**: uso real em produção pelos consumidores após o merge
  (limitação já assumida em `verification.md` — "nenhum teste cobre o
  volume real de consumidores gerando PDF em produção após o merge").
  Nenhum teste de "byte-identidade" exata do PDF (hash binário) — o
  `verification.md` já documenta essa limitação (metadados
  não-determinísticos do PDFKit).
- **Limitações**: nota de independência registrada acima (revisão feita na
  mesma sessão do Builder).

## Riscos residuais

- Nenhum risco novo além dos já documentados em `plan.md`/`verification.md`.
- VER013 (gate humano pré-merge): satisfeito pela decisão explícita do
  usuário de autorizar commit+push+merge nesta sessão — ver REV001 acima
  para a observação sobre registro formal.

## Veredito

APROVADO COM OBSERVAÇÕES

## Promoção durável

- **concluída** — `implementation-evidence.md` registra explicitamente
  "N/A" para promoção de conhecimento durável, com justificativa
  verificada nesta revisão: `file_search` confirma que este repositório
  não possui `CONTEXT.md`; a mudança é extensão aditiva de tipos +
  ajustes de layout, sem novo padrão arquitetural que justifique uma ADR.
  Documentação viva (README/CHANGELOG) atualizada consistentemente com o
  diff (`CHANGELOG.md` reflete exatamente os 3 campos novos e a mudança de
  `addPage`).

