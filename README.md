# kbr-pdf-service

Biblioteca TypeScript (`@kbr/pdf-service`) de geração e processamento de PDF
com branding KINTO, consumida como dependência por Lambdas de outros
domínios KBR — não é uma aplicação implantada com conta/stack própria.

---

## Funcionamento geral

Vários domínios KBR precisam entregar um relatório em PDF (ex.: fechamento
de comissão, checklist de entrega, auditoria de código) com a mesma
identidade visual da KINTO (cores, logo, capa, rodapé com paginação) sem que
cada equipe reimplemente layout de PDF do zero. Este repositório concentra
essa geração num único lugar, com duas capacidades:

- **Geração de relatórios estruturados**: a partir de um objeto de entrada
  (metadata, resumo, seções com itens ou tabelas, cards de visão geral), a
  biblioteca monta um PDF completo (capa, cabeçalho, seções, rodapé),
  suportando severidade por item (`high`/`medium`/`low`), abertura protegida
  por senha (AES-256) e um card por item quando o domínio consumidor precisa
  detalhar cada operação que compôs um cálculo (ex.: cada depósito/desconto
  de uma comissão).
- **Processamento de imagem/PDF**: compressão de imagem, junção de PDFs e
  rasterização de PDF em JPEG, para consumidores que precisam anexar ou
  reduzir o tamanho de arquivos antes de enviar por e-mail ou guardar em S3.

Texto em português (com acentos e travessão) é sempre legível mesmo que a
fonte de marca (Toyota Type) não tenha o glifo — o serviço troca
automaticamente para uma fonte de fallback (Inter) só no trecho necessário,
checando os glifos reais da fonte em vez de depender de uma lista fixa de
caracteres conhecidos.

---

## Repositórios

Não há repositório de frontend/backend separado — esta é a implementação
completa da biblioteca. Consumidores conhecidos (dependência de
desenvolvimento via GitHub, não publicada em registry):

| Repositório | Papel |
| --- | --- |
| [`kbr-domain-dealers-commissions`](https://github.com/kinto-mobility-br/kbr-domain-dealers-commissions) | Consome via `github:kinto-mobility-br/kbr-pdf-service#main` para gerar o relatório de comissão em PDF enviado por e-mail |

---

## Arquitetura e stack

Biblioteca TypeScript pura (sem infraestrutura AWS própria — nenhum
`template.yaml`/stack). É publicada apenas como dependência de código
(`github:kinto-mobility-br/kbr-pdf-service#main`), compilada (`tsc`) e
consumida via `dist/` dentro da Lambda de quem a importa.

| Camada | Tecnologia |
| --- | --- |
| Linguagem | TypeScript (`strict`, ESM) |
| Build | `tsc` (`npm run build`, roda no `prepare`/`prepublishOnly`) |
| Geração de PDF | `pdfkit` + `svg-to-pdfkit` (logos SVG) + `fontkit` (checagem de glifos para fallback de fonte) |
| Processamento de imagem/PDF | `sharp` (compressão), `mupdf` (rasterização PDF→JPEG), `pdf-lib` (dev, testes de merge) |
| Testes | Vitest |

### Eventos

Esta biblioteca não publica nem consome evento no EventBridge — é código
importado em tempo de build/execução por outras Lambdas, sem integração
própria com o bus compartilhado.

### Estrutura de diretórios

```
.
├── index.ts                  # entry point público (geração de relatório)
├── pdf-builder.ts            # montagem do PDF (capa, header, seções, footer)
├── theme.ts                  # cores, fontes, spacing, overrides de tema
├── types.ts                  # tipos públicos (PdfReportInput, PdfSection, ...)
├── assets-loader.ts          # resolução de assets (fonts/svg) em runtime
├── components/                # blocos reutilizáveis (card, badge, layout, section-title)
├── sections/                  # renderização de seção/tabela/capa/cabeçalho
├── processing/                 # entry point separado: compressão de imagem, merge/rasterização de PDF
├── assets/
│   ├── fonts/                 # Toyota Type + Inter (fallback de glifo)
│   └── svg/                    # logos KINTO
├── scripts/                    # demo.ts, json-fields-pdf.ts, kinto-api-auth-pdf.ts
└── __tests__/
```

---

## Pré-requisitos

- Node.js 22.x e npm
- `gs` (Ghostscript) no `PATH` — opcional, usado para lidar com PDFs
  criptografados no processamento

## Configuração

Não há variáveis de ambiente nem segredo gerenciado por este repositório.
A pasta `assets/` (fonts + svg) precisa estar disponível em runtime junto
com o código compilado — já incluída em `files` do `package.json` e copiada
para quem instala a dependência.

## Executando localmente

```bash
npm install
npm run build       # tsc
npm run demo        # gera um PDF de exemplo (scripts/demo.ts)
npm run json-to-pdf -- dados.json --titulo "Exemplo"  # PDF a partir de JSON chave/valor
```

Uso como biblioteca (ver [USAGE.md](USAGE.md) para a referência completa da API):

```typescript
import { generatePdf } from '@kbr/pdf-service';

const buffer = await generatePdf({
  config: { coverTitle: 'Relatório' },
  summary: 'Conteúdo do relatório.',
});
```

## Testes

```bash
npm test          # vitest run
npm run typecheck # tsc --noEmit
```

## Deploy

Não há stack/conta AWS própria — este repositório não é implantado. É
consumido como dependência de código-fonte fixada em um branch/commit do
GitHub (`github:kinto-mobility-br/kbr-pdf-service#main` no `package.json` do
consumidor); atualizar a versão usada por um domínio significa atualizar
esse pin e rodar `npm install` naquele repositório.

## Monitoramento

Não aplicável — não há execução própria (Lambda/stack) para monitorar;
falhas de geração de PDF aparecem nos logs do domínio consumidor.

## Responsáveis

| Papel | Squad/Time |
| --- | --- |
| Owner técnico | *(a definir)* |
