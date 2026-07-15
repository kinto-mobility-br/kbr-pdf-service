# Changelog

Histórico de mudanças deste repositório. Entradas são organizadas por data
(mais recente no topo).

## 2026-07-15 — Script de PDF a partir de JSON, senha de abertura e fonte Toyota Type

- Novo script `scripts/json-fields-pdf.ts` (`npm run json-to-pdf`): gera um PDF a
  partir de um JSON chave/valor, renderizando cada campo como texto simples
  (rótulo + valor em linha própria) para facilitar a seleção e cópia dos
  valores. Suporta achatamento de objetos aninhados e arrays.
- Suporte a senha de abertura (`PdfReportConfig.openPassword`), com
  criptografia AES-256 via PDFKit, disponível tanto em `generatePdf` quanto no
  novo script (`--senha`/`PDF_PASSWORD`).
- Aviso visível (`SENSITIVE_DOCUMENT_NOTICE`) exibido no documento e nos
  metadados (`Subject`) sempre que o PDF é protegido por senha.
- Troca da fonte do serviço de Inter para Toyota Type
  (`assets/fonts/Toyota-Type-*.ttf`).
- Fallback automático de fonte (`components/text-fallback.ts`, usando
  `fontkit`) para caracteres que a Toyota Type não suporta (`ã, ç, õ, â, ê, ô,
  à`, travessão `—`), trocando para Inter por trecho/palavra inteira (nunca no
  meio de uma palavra, para evitar desalinhamento de linha de base) e com
  escala de tamanho equalizada entre as fontes.
