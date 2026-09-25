> Constitution aplicável: nenhuma — `kbr-pdf-service` não tem constitution própria (é uma biblioteca de infraestrutura consumida por vários domínios, não um domínio de negócio).
> Branch de trabalho: `main` era a única branch existente; **decisão do usuário: criar uma branch de feature** (ex.: `feature/pdf-item-rows-suggestion-label`) para esta implementação, sem commit direto em `main`.

# Spec — Linhas de duas colunas e rótulo customizável no card de item (`PdfSectionItem`)

## Objetivo e resultado de negócio

Permitir que consumidores do `@kbr/pdf-service` (hoje `kbr-domain-billing` e
`kbr-domain-dealers-commissions`) montem cards com uma **lista de linhas
alinhadas em duas colunas** (rótulo à esquerda, valor alinhado à direita — ex.:
um desconto e seu valor monetário) e um **bloco de destaque com rótulo
próprio** (hoje esse bloco existe mas exibe sempre o texto fixo "SUGGESTION").
Motivador imediato: o `kbr-domain-dealers-commissions` quer reestruturar o PDF
de comissão de uma tabela única para cards por invoice, mostrando os descontos
aplicados e o cálculo da comissão daquele invoice (demanda separada, tratada
em spec própria no repositório `kbr-domain-dealers-commissions`). Esta spec
cobre **somente** a extensão da biblioteca — nenhum consumidor é alterado
aqui.

## Problema e evidências

- [types.ts](../../types.ts) — `PdfSectionItem` hoje só tem `title`,
  `description` (texto livre, sem colunas), `suggestion?` (texto livre com
  rótulo fixo), `file?`/`line?`/`severity?`. Não existe um tipo para "lista de
  linhas rotulo+valor alinhadas".
- [sections/section-renderer.ts](../../sections/section-renderer.ts) — a
  renderização do bloco `suggestion` tem o rótulo `'SUGGESTION'` escrito
  diretamente no código (`.text('SUGGESTION', ...)`), sem vir de `theme` ou do
  próprio item.
- A mesma função já mede a altura de cada card antes de desenhar
  (`measureTextHeight`) e só desenha depois de garantir espaço na página
  (`ensureSpaceOrNewPage` — dá `doc.addPage()` se não couber) — ou seja, **já
  empacota vários cards por página e nunca corta um card entre páginas**; isso
  não precisa ser construído, só reaproveitado pelas novas linhas.
- `kbr-domain-billing` (`lambdas/fatura-batch`, `lambdas/fatura-daily-report`)
  e `kbr-domain-dealers-commissions` (`lambdas/report-pdf-email`) dependem de
  `@kbr/pdf-service` via `git+.../kbr-pdf-service.git#main` (sem pin de commit/tag)
  — qualquer merge no `main` deste repo é consumido por ambos no próximo
  `npm install`/build.

## Contexto atual

`generatePdf(input: PdfReportInput)` monta a capa e depois, para cada
`PdfSection`, desenha `table` (linhas compactas, várias por página) e/ou
`items: PdfSectionItem[]` (um card por item, com `title`/`description`
opcionalmente seguidos de um bloco `suggestion` destacado com barra azul e
rótulo fixo "SUGGESTION"). O layout foi originalmente pensado para relatórios
de findings técnicos (título do finding, descrição, sugestão de correção) —
os nomes dos campos carregam esse viés semântico.

## Escopo

- Novo tipo `PdfItemRow` em `types.ts`: `{ label: string; value: string }`.
- `PdfSectionItem` ganha campo opcional `rows?: PdfItemRow[]`.
- `PdfSectionItem` ganha campo opcional `suggestionLabel?: string` — rótulo
  exibido no bloco destacado no lugar de `"SUGGESTION"` quando fornecido junto
  com `suggestion`.
- `sections/section-renderer.ts`: renderiza `rows` (quando presentes) logo
  após `description` (ou no lugar dela, quando `description` é string vazia
  `''` — o campo continua obrigatório no tipo, `''` é o único valor que o
  código já tratava como ausente antes desta mudança)
  — uma linha por `PdfItemRow`, rótulo alinhado à esquerda e valor alinhado à
  direita dentro da largura do card; a altura do card passa a somar a altura
  de cada linha (mesma lógica de medição já usada para `description`/`suggestion`).
  Bloco `suggestion` passa a usar `item.suggestionLabel ?? 'SUGGESTION'`.
- Testes novos em `__tests__/` cobrindo os cenários de aceitação abaixo.
- `CHANGELOG.md` do `kbr-pdf-service` documentando a extensão.

## Fora de escopo

- Qualquer alteração em `kbr-domain-billing` ou `kbr-domain-dealers-commissions`
  para consumir os novos campos — isso é a demanda 3 (spec própria, depende
  desta e da spec de recálculo de comissão em `kbr-domain-dealers-commissions`).
- Alinhamento de colunas *dentro* de uma `PdfTable` (`PdfTable` já suporta
  larguras de coluna via `PdfTableColumn.width` — não é o problema aqui).
- Suporte a mais de duas colunas por linha, ou a linhas com múltiplos valores.
- Renomear/depreciar `description`/`suggestion`/`title` — continuam existindo
  exatamente como hoje.
- Mudar a paginação/medição de espaço (`ensureSpaceOrNewPage`) — já atende ao
  requisito de não cortar card entre páginas.

## Atores e consumidores

- `kbr-domain-dealers-commissions` (`lambdas/report-pdf-email`) — consumidor
  que motivou a mudança, vai usar `rows` (descontos do invoice) e
  `suggestionLabel` (ex.: `"CÁLCULO"`) numa demanda futura separada.
- `kbr-domain-billing` (`lambdas/fatura-batch`, `lambdas/fatura-daily-report`)
  — consumidor existente que **não** deve ter nenhum comportamento alterado.

## Requisitos funcionais

### RF001 — `PdfItemRow` e campo `rows` em `PdfSectionItem`
- **Input**: `item.rows?: { label: string; value: string }[]`.
- **Output**: quando `rows` tem 1+ elementos, o card renderiza uma linha por
  elemento, rótulo à esquerda (mesma fonte/cor de `description`) e valor
  alinhado à direita da largura útil do card; quando `rows` é `undefined` ou
  `[]`, nenhuma linha é desenhada (equivalente a hoje).
- **Erros observáveis**: nenhum novo — `rows` ausente/vazio não lança erro.
- **Relacionados**: RN001, RN002, INV001.

### RF002 — Rótulo customizável do bloco destacado
- **Input**: `item.suggestionLabel?: string`, junto de `item.suggestion` (o
  bloco só aparece se `suggestion` estiver presente, como hoje).
- **Output**: o texto do rótulo em caixa alta desenhado no topo do bloco passa
  a ser `item.suggestionLabel ?? 'SUGGESTION'` — mesma fonte/cor/posição de
  hoje, só o texto muda.
- **Erros observáveis**: nenhum novo.
- **Relacionados**: RN001, INV001.

### RF003 — Altura do card contabiliza as novas linhas sem cortar entre páginas
- **Input**: item com `rows` de tamanhos variados (labels/valores que podem
  quebrar em mais de uma linha dentro da largura do card).
- **Output**: `cardHeight` soma a altura de cada linha de `rows` (mesma
  função `measureTextHeight` já usada para `description`); `ensureSpaceOrNewPage`
  continua sendo chamado com a altura total antes de desenhar o card —
  garantindo que um card com `rows` nunca seja cortado entre duas páginas.
- **Erros observáveis**: nenhum novo.
- **Relacionados**: RN002.

## Regras de negócio

- **RN001 (aditivo)**: nenhum campo, valor default ou pixel de posição muda
  para um `PdfReportInput` que não usa `rows`/`suggestionLabel` — a saída
  binária do PDF para os inputs já existentes em `kbr-domain-billing` e nos
  testes atuais do próprio `kbr-pdf-service` não muda.
- **RN002**: um `PdfItemRow` cujo `label` ou `value` seja muito longo para a
  largura da coluna quebra linha (mesma política de `drawTextWithFallback`
  usada em `description`) — nunca sobrepõe a outra coluna nem estoura a
  largura do card.
- **RN003**: quando `description` e `rows` estão ambos presentes no mesmo
  item, `description` renderiza primeiro (texto livre, ex.: um resumo) e
  `rows` logo abaixo (lista estruturada) — ordem de leitura top-to-bottom
  preservada.

## Invariantes

- **INV001**: build (`tsc`), `typecheck` e toda a suíte `npx vitest run` do
  `kbr-pdf-service` passam sem nenhuma alteração de asserção em teste
  pré-existente — a mudança é aditiva por construção.
- **INV002**: `kbr-domain-billing` (consumidor real via `@kbr/pdf-service#main`)
  não precisa de nenhuma alteração de código para continuar funcionando após
  o merge desta mudança.

## Cenários / Critérios de aceitação

- **CA001** (regressão): `PdfReportInput` com um `item` sem `rows` e sem
  `suggestionLabel` gera um PDF cuja renderização é idêntica à de hoje (mesmo
  buffer/mesmas posições — teste de regressão comparando com o comportamento
  atual antes da mudança).
- **CA002**: item com `rows: [{label: 'Depósito - Fatura #123', value: '-R$ 799,42'}, ...]`
  renderiza uma linha por elemento, valor alinhado à direita da largura do
  card.
- **CA003**: item com muitas `rows` (o suficiente para não caber no restante
  da página atual) força `doc.addPage()` antes de desenhar o card — o card
  aparece inteiro na página seguinte, nunca cortado entre as duas.
- **CA004**: item com `suggestion` e `suggestionLabel: 'CÁLCULO'` desenha
  "CÁLCULO" no lugar de "SUGGESTION" no bloco destacado.
- **CA005** (regressão): item com `suggestion` e **sem** `suggestionLabel`
  continua desenhando "SUGGESTION" (comportamento atual preservado).
- **CA006**: `PdfItemRow.value` mais longo que a largura da coluna quebra
  linha corretamente, sem sobrepor o `label`.

## Dependências

- Nenhuma dependência externa nova (usa apenas `pdfkit`, já em uso).
- Nenhuma dependência de outra spec — esta é a base para a demanda 3 do
  `kbr-domain-dealers-commissions` (cards de comissão), mas não depende dela.

## Premissas

- O nome de campo `rows` não colide com nenhum uso existente de
  `PdfSectionItem` (confirmado por grep no repo).
- `kbr-domain-billing` não usa `suggestion`/`suggestionLabel` hoje (confirmar
  na implementação; se usar, `suggestionLabel` ausente preserva o texto atual
  de qualquer forma, por RN001).

## Riscos e mitigação

- **Risco**: alguém (billing ou dealers-commissions) já ter algum teste
  próprio que faz snapshot binário do PDF gerado e que quebre por qualquer
  motivo não relacionado a esta mudança (flakiness pré-existente). Mitigação:
  rodar a suíte de ambos os consumidores após o merge, antes do próximo
  release deles (fora do controle direto desta spec, mas registrado como
  checagem recomendada).
- **Risco**: `main` sem proteção de branch — merge direto sem PR revisado.
  Mitigação: mesmo com merge/push direto disponível, recomenda-se abrir uma
  branch de feature e revisão própria antes do merge, dado o impacto em dois
  domínios consumidores.

## Dúvidas abertas

Nenhuma pendente — decisões confirmadas pelo usuário:

1. **Branch de trabalho**: criar branch de feature (ex.:
   `feature/pdf-item-rows-suggestion-label`) a partir de `main` antes de
   implementar.
2. **Nomes dos campos**: `rows`/`PdfItemRow` e `suggestionLabel` aprovados
   exatamente como propostos nesta spec.
