import * as mupdf from 'mupdf';

export interface TextBox {
  pageIndex: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Bounding box de cada ocorrencia de `needle` no PDF (usa a busca nativa da mupdf, que ja
 * lida com quebra de espacos/fontes) — usado para checar posicao relativa de colunas. */
export function searchTextBoxes(buffer: Buffer, needle: string): TextBox[] {
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const results: TextBox[] = [];
  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const hits = page.toStructuredText().search(needle);
    for (const quads of hits) {
      const xs = quads.flatMap((q) => [q[0], q[2], q[4], q[6]]);
      const ys = quads.flatMap((q) => [q[1], q[3], q[5], q[7]]);
      results.push({ pageIndex: i, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    }
  }
  return results;
}


/** Quantos pixels de uma pagina rasterizada (2x, DeviceRGB) batem com a cor `hex` (tolerancia
 * pequena p/ anti-aliasing) — usado para detectar um traço fino desenhado (ex.: divisor), que
 * nao aparece de forma confiavel via extração de "vetores" da structured text da mupdf. */
export function countPixelsOfColor(buffer: Buffer, hex: string, pageIndex = 0, tolerance = 6): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const page = doc.loadPage(pageIndex);
  const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false);
  const pixels = pixmap.getPixels();
  const n = pixmap.getNumberOfComponents();
  let count = 0;
  for (let i = 0; i < pixels.length; i += n) {
    if (
      Math.abs(pixels[i] - r) <= tolerance &&
      Math.abs(pixels[i + 1] - g) <= tolerance &&
      Math.abs(pixels[i + 2] - b) <= tolerance
    ) {
      count++;
    }
  }
  return count;
}

export function extractPageSizes(buffer: Buffer): { width: number; height: number }[] {
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const sizes: { width: number; height: number }[] = [];
  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const bounds = page.getBounds();
    sizes.push({ width: bounds[2] - bounds[0], height: bounds[3] - bounds[1] });
  }
  return sizes;
}
