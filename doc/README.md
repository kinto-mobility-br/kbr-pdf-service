<img src="assets/kinto-logo.svg" alt="KINTO" height="36">

# Documentação — kbr-pdf-service

> **Biblioteca TypeScript (`@kbr/pdf-service`)** de geração e processamento de PDF com branding KINTO, consumida como dependência por Lambdas de outros domínios KBR. **Não é uma aplicação implantada** (sem conta/stack própria).

## Diagramas
- **Estrutura/componentes (archify, tipo `tree`):** [`diagramas/arquitetura.html`](diagramas/arquitetura.html) (fonte: [`diagramas/arquitetura.json`](diagramas/arquitetura.json)).
- Como é uma biblioteca pura (sem infraestrutura AWS), o diagrama representa a **decomposição por módulo**, não um deploy.

## Conteúdo já existente nesta pasta
- [`archive/INDEX.md`](archive/INDEX.md) e `archive/*`: artefatos de demandas já entregues (spec/plan/review/verification por demanda). Preservados — esta documentação de arquitetura complementa esse histórico.
- Referência completa da API: [`../USAGE.md`](../USAGE.md).

## Stack
- **TypeScript** strict (ESM), build com `tsc`; testes com **Vitest**. Node.js 22.x.
- **Geração de PDF:** `pdfkit` + `svg-to-pdfkit` (logos SVG) + `fontkit`.
- **Processamento imagem/PDF:** `sharp` (compressão), `mupdf` (PDF→JPEG), `pdf-lib` (merge, dev).
- Fonte única **Inter** (cobre acentuação PT-BR); Toyota Type mantida apenas para reversão. Ghostscript opcional.

## Capacidades
1. **Geração de relatório estruturado** (`index.ts` → `generatePdf`): capa, cabeçalho, seções (itens ou tabelas), cards de visão geral, rodapé com paginação; severidade por item (`high`/`medium`/`low`) e abertura protegida por senha (AES-256).
2. **Processamento** (`processing/`, export separado): compressão de imagem, junção de PDFs e rasterização PDF→JPEG.

## Integrações / distribuição
| Aspecto | Detalhe |
|---|---|
| Publicação | Não vai a registry; pin por branch/commit (`github:kinto-mobility-br/kbr-pdf-service#main`) |
| Consumidor conhecido | [`kbr-domain-dealers-commissions`](https://github.com/kinto-mobility-br/kbr-domain-dealers-commissions) (relatório de comissão por e-mail) |
| Infra própria | Nenhuma — sem `template.yaml`/stack; roda dentro da Lambda de quem importa |
| EventBridge | Não publica nem consome eventos |

## Branches
Default `main`; existe também `develop`.

## Manutenção
Veja [`MANUTENCAO.md`](MANUTENCAO.md).
