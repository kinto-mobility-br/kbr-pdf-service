import * as mupdf from 'mupdf';

/** Extrai o texto de cada página de um PDF gerado, para asserções de conteúdo (não só buffer.length). */
export function extractPagesText(buffer: Buffer): string[] {
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const pages: string[] = [];
  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    pages.push(page.toStructuredText().asText());
  }
  return pages;
}
