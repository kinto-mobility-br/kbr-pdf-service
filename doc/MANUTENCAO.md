# Manutenção da documentação — instruções para agentes e desenvolvedores

`documentacao/` é a fonte de verdade da **arquitetura e integrações** deste repositório.
**Mantenha-a atualizada sempre que o código mudar de forma que afete o desenho.**

## Quando atualizar (obrigatório)
No **mesmo PR/commit** da mudança, quando você:
- adicionar/remover **integração** ou endpoint (API Gateway, fila, banco, serviço de terceiro);
- mudar o **deploy** (EB, Lambda, container, pipeline) ou a **região** AWS;
- mudar o **fluxo de autenticação** (Cognito, ALB, JWT, tokens);
- adicionar/remover um **componente** relevante (serviço, worker, store de dados).

## Como regenerar os diagramas (archify)
Edite o(s) `.json`-fonte em `documentacao/diagramas/` e rode (ajuste `<tipo>`: architecture, workflow, sequence, dataflow, ...):
```bash
node ~/.claude/skills/archify/bin/archify.mjs finalize <tipo> \
  documentacao/diagramas/<nome>.json documentacao/diagramas/<nome>.html \
  --quality showcase --json
```
Depois **remova os recibos** gerados ao lado (`*.finalize*.json`, `*.delivery.json`, `*.browser-check.json`); versione só o `.json` (fonte) e o `.html` (render). Mantenha o diagrama **compacto** (viewBox ≤ 1240px) e os nós externos **fora** do frame das boundaries, senão a validação falha.

## Regras
- Versione o `.json` junto do `.html` (reprodutibilidade).
- **Sem segredos/PII/credenciais** nos diagramas e textos — o repo pode ser lido por outros times.
- Documentação oficial KINTO: use `documentacao/assets/kinto-logo.svg` no topo do README.
