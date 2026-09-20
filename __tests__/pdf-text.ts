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

interface StructuredLine {
  text: string;
  font: { name: string; weight: string };
}

/** Peso da fonte (`'bold'`/`'normal'`) da primeira linha de texto que contem `needle` —
 * usado para verificar se um label/valor foi desenhado em negrito. */
export function findLineFontWeight(buffer: Buffer, needle: string): string | undefined {
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const json = JSON.parse(page.toStructuredText().asJSON()) as { blocks: { lines?: StructuredLine[] }[] };
    for (const block of json.blocks) {
      for (const line of block.lines ?? []) {
        if (line.text.includes(needle)) return line.font.weight;
      }
    }
  }
  return undefined;
}

