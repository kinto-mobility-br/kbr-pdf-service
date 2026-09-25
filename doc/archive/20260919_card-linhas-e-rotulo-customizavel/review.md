> Constitution aplicável: nenhuma — `kbr-pdf-service` não tem constitution própria.
> Spec: [spec.md](./spec.md) · Plan: [plan.md](./plan.md) · Verification: [verification.md](./verification.md) · Tasks: [tasks.md](./tasks.md) · Evidence: [implementation-evidence.md](./implementation-evidence.md)

# Independent Review — Linhas de duas colunas e rótulo customizável no card de item

## Identificação

- Demanda: `card-linhas-e-rotulo-customizavel`
- Tasks: T01, T02, T03 (todas concluídas)
- Base do diff: branch `feature/pdf-item-rows-suggestion-label`, commit base
  `b80616f` (working tree, 4 arquivos modificados + 2 novos, nada commitado)
- Risco: **Médio** (mudança aditiva num contrato consumido por dois domínios
  via dependência de git pinada em branch, sem dado financeiro/PII/IAM neste
  pacote)
- Data: 2026-09-19

> Nota de independência: esta revisão foi conduzida na **mesma sessão** que
> implementou a mudança (variante experimental `kbr-orchestrator-agent`). Para
> mitigar viés de confirmação, o contrato foi reconstruído relendo
> `spec.md`/`verification.md` do disco, os cenários independentes usaram
> **fixtures próprias** (diferentes das do Builder — inputs `title`/`description`
> distintos, `rows: []`, ausência de `description`, contagem de linhas
> diferente para o teste de quebra de página) e comandos reproduzidos do zero
> (não aceitos por relato). Ainda assim, o risco de viés de confirmação por
> ser a mesma sessão é real — se o usuário quiser uma segunda opinião mais
> forte, recomenda-se rodar `kbr-review-agent` em sessão nova, especialmente
> antes do merge em `main` (dois domínios consomem este pacote).

## Contrato reconstruído

- Comportamentos esperados:
  - `PdfItemRow { label, value }` novo, `PdfSectionItem.rows?`/`.suggestionLabel?`
    ambos opcionais e aditivos (RF001, RF002, RN001).
  - `rows` ausente/vazio → nenhuma linha desenhada (equivalente a hoje).
  - `rows` com N elementos → N linhas, `label` à esquerda, `value` alinhado à
    direita da largura útil do card, sem sobreposição mesmo com quebra de
    linha (RN002).
  - `cardHeight` soma a altura de cada `row` antes de `ensureSpaceOrNewPage`
    — nenhum card com `rows` é cortado entre páginas (RF003, O004).
  - `suggestionLabel` substitui o literal `'SUGGESTION'` apenas quando
    `suggestion` também está presente (RF002).
  - Ordem de desenho: `description` (se houver) → `rows` (se houver) → bloco
    `suggestion` (RN003).
- Invariantes: INV001 (suíte pré-existente intacta, nenhuma asserção alterada,
  build/typecheck limpos), INV002 (`kbr-domain-billing` não precisa mudar
  código).
- Comportamentos proibidos: alterar posição/pixel/default de qualquer
  `PdfReportInput` que não usa os campos novos; cortar card com `rows` entre
  páginas; desenhar `suggestionLabel` sem `suggestion` presente.
- Failure modes: nenhum novo erro observável esperado (`rows`/`suggestionLabel`
  ausentes ou vazios não lançam exceção).

## Evidências reproduzidas

| ID/VER | Comando ou cenário | Esperado | Observado | Resultado |
| --- | --- | --- | --- | --- |
| VER001, VER007 | `npx vitest run` + `npm run typecheck` (suíte completa, do zero) | 55 testes PASS, nenhuma asserção pré-existente alterada, typecheck limpo | 55/55 PASS (5 arquivos); `tsc --noEmit` sem erro | Reproduzido |
| VER002 | teste `section-item-rows.test.ts` (CA002) | N linhas com label/value corretos | Confirmado ao reexecutar a suíte (mesmo arquivo, não modificado pelo Verifier) | Reproduzido |
| VER003/VER009 | teste `section-item-rows.test.ts` (CA003, 15 rows) + cenário independente do Verifier (18 rows, fixture própria, filler diferente) | card não é cortado entre páginas | Ambos: card inicia e termina na mesma página (script `tsx` ad-hoc, removido após uso) | Reproduzido (Builder + independente) |
| VER004/VER005 | CA004/CA005 (`suggestionLabel` customizado e ausente) | `'CÁLCULO'` ou `'SUGGESTION'` conforme o caso | Confirmado ao reexecutar a suíte | Reproduzido |
| VER006 | CA006 (`value` longo quebra sem sobrepor `label`) | texto completo presente, sem sobreposição | Confirmado ao reexecutar a suíte | Reproduzido |
| VER008 | cenário independente: fixture própria sem `rows`/`suggestionLabel`, gerada com `git stash` (código antes) vs. código depois | buffer idêntico exceto metadados não-determinísticos do `pdfkit` | Diferença de apenas 59 bytes, 100% localizados em `/CreationDate` (timestamp da execução) e `/ID` (hash aleatório do `pdfkit`, gerado a cada chamada mesmo sem nenhuma mudança de código) — ver achado REV001 | Reproduzido, com ressalva (achado Baixo) |

## Cenários independentes

| Cenário | Propriedade | Resultado | Evidência |
| --- | --- | --- | --- |
| `rows: []` vs. `rows` ausente, mesmo item | RF001 ("rows vazio equivale a ausente") | Texto extraído do PDF idêntico nos dois casos | script `tsx` ad-hoc contra `generatePdf` (removido após uso) |
| Item sem `description`, com `rows` | RF001 (rows "no lugar" da description) | `label`/`value` aparecem no texto extraído mesmo sem `description` | idem |
| `suggestionLabel` presente **sem** `suggestion` | RF002 ("bloco só aparece se `suggestion` presente") | Texto do label customizado não aparece no PDF — código não desenha o bloco | idem |
| `label` longo (não só `value`) forçando quebra | RN002 (quebra bilateral, não só do lado do valor) | Texto completo do label presente, `value` também presente, sem sobreposição | idem |
| Quebra de página com contagem de linhas diferente da do Builder (18 rows + 6 itens de preenchimento, fixture própria) | RF003, O004, VER009 | Card inicia e termina na mesma página (página 3 de 3) | idem |
| Buffer antes/depois da mudança (`git stash`), mesmo input, sem campos novos | O001, VER008 | Diferença de 59 bytes, todos em `/CreationDate` e `/ID` (metadados não-determinísticos do `pdfkit`, confirmados também entre duas chamadas consecutivas com o **mesmo** código, sem stash) | comparação `cmp -l` reproduzida pelo Verifier |

### Suposições desafiadas

- "O oráculo O001/VER008 exige buffer **byte-idêntico**" — desafiada e
  refutada como literalmente inalcançável: `pdfkit` grava `/ID` (hash
  aleatório) e `/CreationDate` (timestamp) a cada chamada de `generatePdf`,
  mesmo sem nenhuma alteração de código (confirmado gerando o mesmo input
  duas vezes seguidas com o código atual, sem `git stash` envolvido — buffers
  de mesmo tamanho, porém não idênticos). Isso é um comportamento pré-existente
  do `pdfkit`, não introduzido por esta mudança. Ver achado REV001.
- "`description` teria virado opcional para permitir `rows` 'no lugar dela'"
  — o tipo público (`types.ts`) mantém `description: string` **obrigatório**
  (não alterado por este diff); o comportamento "rows no lugar de description"
  só é alcançável na prática passando `description: ''` (falsy, tratado como
  ausente pelo código pré-existente `item.description ?? ''`). Não é uma
  regressão desta mudança (código pré-existente já tratava assim), mas o
  texto da spec ("quando description não é fornecida") é levemente impreciso
  para consumidores TypeScript, que são obrigados a fornecer o campo. Ver
  achado REV002.

### Limitações do ambiente

- VER010 (regressão da suíte de `kbr-domain-billing` após o merge) não foi
  executada — é uma checagem recomendada, não bloqueante, e depende do merge
  real em `main` (fora do escopo desta revisão de branch de feature).
- VER011 (PR revisado antes do merge) ainda não se aplica — a branch de
  feature existe, mas não há PR aberto/mergeado até o momento desta revisão.

## Achados

| ID | Severidade | Categoria | Descrição | Impacto | Direcionamento |
| --- | --- | --- | --- | --- | --- |
| ~~REV001~~ | ~~Baixo~~ → **Corrigido** | Contrato de verificação | O oráculo O001/VER008, como redigido ("buffer idêntico... hash/byte-a-byte"), era inalcançável devido a `/CreationDate`/`/ID` não-determinísticos do próprio `pdfkit`. | Nenhum impacto funcional; risco de um futuro Verifier reportar falso-negativo. | **Corrigido nesta sessão** (a pedido do usuário): O001/VER008 em `verification.md` reescritos para "byte-idêntico exceto `/CreationDate` e `/ID`". Responsável: Architecture — aplicado. |
| ~~REV002~~ | ~~Baixo~~ → **Corrigido** | Documentação/spec | RF001/Escopo descreviam o cenário "quando `description` não é fornecida", mas o tipo público continua obrigatório. | Nenhum impacto funcional; imprecisão textual da spec. | **Corrigido nesta sessão**: redação de `spec.md` (seção Escopo) ajustada para "quando `description` é string vazia (`''`)". |

Nenhum achado de severidade Média, Alta ou Crítica.

## Cobertura e limitações

- Confirmado: VER001-VER009 (todos os checks obrigatórios do Builder e do
  Verifier), reproduzidos com fixtures e comandos próprios do Verifier onde
  aplicável (VER008, VER009).
- Não verificado: VER010 (regressão de `kbr-domain-billing`, recomendada e
  não bloqueante, depende de merge real) e VER011 (PR revisado — gate humano
  de processo, ainda pendente).
- Limitações: revisão feita na mesma sessão de implementação (ver nota de
  independência acima); nenhuma inspeção visual humana do PDF renderizado
  (apenas extração estrutural de texto via `mupdf`).

## Riscos residuais

- VER010/VER011 (gates de processo/consumidor real) permanecem pendentes até
  o merge — já documentados como não-bloqueantes em `verification.md`.
- ~~REV001/REV002~~ — corrigidos nesta sessão (redação de `verification.md`/
  `spec.md` ajustada); não restam achados abertos sobre o contrato/spec.

## Promoção durável

- `kbr-pdf-service` não tem `CONTEXT.md` por módulo nem convenção de ADR na
  kb identificada durante o grounding desta demanda — não há decisão
  arquitetural durável além do que já está registrado em `spec.md`/`plan.md`
  (aprovados). O `CHANGELOG.md` do pacote já documenta a extensão aditiva.
- Status: **N/A** (nada adicional para promover além dos artefatos desta
  própria demanda e do `CHANGELOG.md` já atualizado).

## Veredito

`APROVADO COM OBSERVAÇÕES`

Justificativa: todos os guards obrigatórios foram reproduzidos com sucesso
(VER001-VER009); os dois achados (REV001, REV002), de severidade Baixa sobre
a redação do contrato de verificação/spec (não sobre defeito de código),
foram corrigidos nesta sessão a pedido do usuário — não restam achados
abertos.
