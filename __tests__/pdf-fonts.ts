import * as mupdf from 'mupdf';

export interface TextRun {
  pageIndex: number;
  text: string;
  /** Nome da fonte sem o prefixo de subset (ex.: `ToyotaType-Semibold`). */
  fontName: string;
  /** Família (parte antes do `-`): `ToyotaType` ou `Inter`. */
  family: string;
  /** Tamanho exato (pt) informado pelo content stream, sem arredondamento. */
  size: number;
  /** Topo/base (pt, origem no topo da página) da caixa do trecho. */
  top: number;
  bottom: number;
}

/**
 * Extrai os trechos de texto de um PDF com fonte e tamanho reais (mupdf `walk`), agrupando
 * caracteres consecutivos da mesma linha com a mesma fonte/tamanho. Usado para provar
 * consistência tipográfica — `extractPagesText` só devolve o texto.
 */
export function extractTextRuns(buffer: Buffer): TextRun[] {
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const runs: TextRun[] = [];
  const pageCount = doc.countPages();

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    let current: TextRun | undefined;
    const flush = () => {
      if (current) runs.push(current);
      current = undefined;
    };

    doc
      .loadPage(pageIndex)
      .toStructuredText()
      .walk({
        beginLine: flush,
        endLine: flush,
        onChar(char, _origin, font, size, quad) {
          const fontName = font.getName().replace(/^[A-Z]{6}\+/, '');
          const top = Math.min(quad[1], quad[3], quad[5], quad[7]);
          const bottom = Math.max(quad[1], quad[3], quad[5], quad[7]);
          if (current && current.fontName === fontName && current.size === size) {
            current.text += char;
            current.top = Math.min(current.top, top);
            current.bottom = Math.max(current.bottom, bottom);
            return;
          }
          flush();
          current = { pageIndex, text: char, fontName, family: fontName.split('-')[0] ?? fontName, size, top, bottom };
        },
      });
    flush();
  }

  return runs;
}

/** Primeiro trecho cujo texto (sem espaços) é exatamente `needle` (sem espaços). */
export function findRun(runs: TextRun[], needle: string): TextRun {
  const squash = (value: string) => value.replace(/\s+/g, '');
  const run = runs.find((candidate) => squash(candidate.text) === squash(needle));
  if (!run) throw new Error(`Trecho "${needle}" não encontrado no PDF`);
  return run;
}
