# Bug Assessment — layout da fatura sobrepõe rótulos quando um campo "Label: value" tem valor vazio (reserva l2x34jp)

## Sintoma
- Relato: em alguns cenários, a fatura (PDF, `kbr-domain-billing`) é emitida com
  um erro de layout na seção "Destinatário/Remetente" — reserva `l2x34jp`
  mostra "Endereço:" e "Bairro:" sobrepostos/colados, em vez de em linhas
  separadas com espaçamento normal.
- Observado vs esperado: observado — a linha "Endereço:" (sem valor) e a linha
  seguinte ("Bairro:"/"Município:"/"CEP:") são desenhadas quase na mesma
  posição vertical (só 3pt de diferença), causando sobreposição visual.
  Esperado — cada linha de campo deveria ocupar a altura normal de uma linha
  de texto (~11-12pt), como acontece quando o valor não está vazio.

## Reprodução (RED)
- Teste/cenário: `drawSegmentedText` (componente compartilhado
  `@kbr/pdf-service`, usado por `kbr-domain-billing` para montar cada campo
  "Label: value" da fatura) chamado com `options.width` setado e o último
  trecho (`value`) sendo string vazia `''` — cenário real: campo "Endereço"
  do destinatário quando `t.address.street`/`t.address.number` estão ambos
  ausentes (`recipientAddress = ''`, ver
  `kbr-domain-billing/lambdas/fatura-batch/src/application/build-fatura-pdf-regions.ts`).
- Comando: `cd kbr-pdf-service && npx vitest run __tests__/text-fallback.test.ts`
- Falha observada (pelo sintoma real): novo teste
  `BUG-l2x34jp - avança doc.y na mesma altura de um trecho preenchido, mesmo
  quando o valor (último part) é string vazia` falhou com
  `expected 100 to be greater than 100` — ou seja, `doc.y` **não avançou** após
  desenhar o campo com valor vazio (ficou exatamente igual ao Y de entrada),
  provando que a próxima linha seria desenhada sobre a mesma posição.

## Causa raiz
- Confirmada por (evidência): leitura do código-fonte do PDFKit instalado
  (`node_modules/pdfkit/js/pdfkit.js`, `LineWrapper.wrap`/`eachWord`). Quando
  `options.width` está setado, o PDFKit usa `LineWrapper` para quebra de
  linha; `eachWord('')` (texto vazio) não produz nenhuma "palavra"
  (`LineBreaker` não emite break para string vazia), então o contador `wc`
  fica em 0 e o bloco `if (wc > 0) { emitLine(); }` no fim de `wrap()` nunca
  roda — nenhum evento `'line'` é emitido, e `doc.y` não avança.
  `drawSegmentedText` encadeia `label` (`continued: true`) + `value`
  (`continued: false`) numa única chamada; quando `value === ''`, o trecho
  final vazio dispara exatamente esse caso, zerando a altura da linha
  inteira (label incluído).
- Em `kbr-domain-billing`, `drawFieldRow`/`drawFieldInline`
  (`lambdas/fatura-batch/src/infrastructure/kbr-pdf-fatura-generator.ts`)
  usam o Y retornado por `drawSegmentedText` para posicionar a próxima linha
  (`+ 3` de espaçamento fixo) — como o Y não avançou, a linha seguinte cai a
  só 3pt da anterior, sobrepondo os textos.
- Gatilho de negócio: RF008 (`doc/20260831_elegibilidade-fatura-paridade-legado`,
  `kbr-domain-billing`) mudou o comportamento para permitir emissão de fatura
  com endereço do tomador ausente/incompleto (antes bloqueava). Isso tornou o
  cenário "campo Endereço vazio no PDF" comum em produção, quando antes
  praticamente não ocorria (a fatura era suspensa antes de chegar ao PDF).

## Blast radius e risco
- Consumidores/contratos/dados afetados: só renderização visual do PDF da
  fatura (`kbr-domain-billing`, via `@kbr/pdf-service`). Nenhuma mudança de
  contrato de dados, evento, schema ou valor financeiro — layout puro.
  Qualquer outro consumidor de `drawSegmentedText`/`drawTextWithFallback`
  com `width` setado e valor potencialmente vazio (ex.: `kbr-domain-gts`,
  `kbr-domain-dealers-commissions`, se usarem o mesmo padrão "Label: value")
  se beneficia da mesma correção.
- Risco: **baixo** — bug visual, sem risco de dado incorreto/perda/PII;
  causa raiz confirmada por evidência de código-fonte + teste reproduzido.
- Cabe no fluxo bug? **Sim** — causa raiz localizada e confirmada, sem
  mudança de contrato/arquitetura/dados/IAM/financeiro.

## Correção
- Menor mudança proposta: em `drawSegmentedText`, quando `options.width`
  está setado e o texto de um trecho é string vazia, substituir por um único
  espaço (`' '`) antes de decidir fonte/desenhar — um espaço não desenha
  glifo visível (mesmo efeito visual de string vazia), mas garante que o
  PDFKit processe pelo menos uma "palavra" e emita a linha (`emitLine`),
  preservando a altura normal e avançando `doc.y` corretamente.
- Arquivos-alvo: `kbr-pdf-service/components/text-fallback.ts`
  (`drawSegmentedText`).

## Verificação
- Sintoma sumiu (RED → GREEN): sim — após a correção, o teste
  `BUG-l2x34jp` passa: `afterEmptyValue > startY` e
  `afterEmptyValue === afterWithValue` (mesma altura de linha entre campo
  vazio e campo preenchido).
- Regressão: suíte completa do `kbr-pdf-service`
  (`npx vitest run`) — 6 arquivos, 69 testes, todos passando (nenhuma
  regressão). `npx tsc --noEmit` sem erros.
- Guard anti-reincidência: o teste `BUG-l2x34jp` em
  `__tests__/text-fallback.test.ts` fica permanente e falharia se a
  regressão voltar (ex.: reintrodução do bug ou remoção do guard de
  string vazia).
