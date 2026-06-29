import PDFDocument from 'pdfkit';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** DPI para rasterização de PDFs embutidos */
const RASTER_DPI = 120;
/** Qualidade JPEG na rasterização */
const RASTER_JPEG_QUALITY = 75;

/**
 * Normaliza um PDF criptografado via Ghostscript, removendo a criptografia.
 * Retorna o buffer normalizado ou null se falhar.
 *
 * Requer `gs` (Ghostscript) no PATH.
 */
async function normalizePdfWithGhostscript(buffer: Buffer): Promise<Buffer | null> {
  const randomSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inputPath = `/tmp/kbr-pdf-gs-input-${randomSuffix}.pdf`;
  const outputPath = `/tmp/kbr-pdf-gs-output-${randomSuffix}.pdf`;

  try {
    await fs.promises.writeFile(inputPath, buffer);

    await execFileAsync('gs', [
      '-q',
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-sDEVICE=pdfwrite',
      '-dPDFSETTINGS=/prepress',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ]);

    const normalizedBuffer = await fs.promises.readFile(outputPath);
    if (!normalizedBuffer || normalizedBuffer.length === 0) return null;

    return normalizedBuffer;
  } catch {
    return null;
  } finally {
    try { if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath); } catch { /* best-effort */ }
    try { if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath); } catch { /* best-effort */ }
  }
}

/**
 * Rasteriza cada página de um PDF Buffer em imagens JPEG usando mupdf (WASM).
 * Retorna um array de Buffers JPEG, um por página.
 *
 * Lida com PDFs criptografados:
 * 1. Tenta abrir com mupdf diretamente
 * 2. Se falhar (criptografia) → normaliza via Ghostscript → tenta novamente
 *
 * Requer `mupdf` instalado. Ghostscript (`gs`) é necessário apenas para PDFs criptografados.
 */
export async function rasterizePdfToJpegs(pdfBuffer: Buffer): Promise<Buffer[]> {
  const mupdf = await import('mupdf');
  const scale = RASTER_DPI / 72;

  let doc: InstanceType<typeof mupdf.Document>;

  try {
    doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
  } catch {
    // Possivelmente criptografado — tenta normalizar via Ghostscript
    const normalized = await normalizePdfWithGhostscript(pdfBuffer);
    if (!normalized) {
      throw new Error('PDF não pôde ser aberto (possivelmente criptografado e Ghostscript indisponível)');
    }
    doc = mupdf.Document.openDocument(normalized, 'application/pdf');
  }

  const pageCount = doc.countPages();
  const results: Buffer[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const matrix = mupdf.Matrix.scale(scale, scale);
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
    const jpegData = pixmap.asJPEG(RASTER_JPEG_QUALITY, false);
    results.push(Buffer.from(jpegData));
  }

  return results;
}

/**
 * Serviço para incluir PDFs em documentos PDFKit via rasterização.
 * Cada página do PDF é convertida em JPEG (120 DPI, Q75) e embutida como imagem.
 */
export class PdfAttachmentService {
  /**
   * Rasteriza cada página do PDF em JPEG e embute no documento PDFKit.
   * Estratégia mais leve que concatenar o PDF original via pdf-lib.
   */
  async includePdfAsImages(
    targetPdf: PDFKit.PDFDocument,
    pdfBuffer: Buffer,
    title: string = 'Páginas do Documento'
  ): Promise<void> {
    const pages = await rasterizePdfToJpegs(pdfBuffer);

    if (pages.length === 0) return;

    for (let i = 0; i < pages.length; i++) {
      targetPdf.addPage();
      targetPdf
        .fontSize(9)
        .text(`${title} — pág. ${i + 1}/${pages.length}`, 30, 20, {
          align: 'center',
        });

      targetPdf.image(pages[i], 30, 35, {
        fit: [535, 770],
        align: 'center',
      });
    }
  }

  /**
   * Detecta informações básicas de um Buffer de PDF (magic bytes, tamanho).
   */
  analyzeBasicPdfInfo(pdfBuffer: Buffer): {
    sizeKB: number;
    isPdf: boolean;
    hasValidHeader: boolean;
  } {
    const sizeKB = Math.round(pdfBuffer.length / 1024);
    const header = pdfBuffer.toString('ascii', 0, 8);
    const isPdf = header.startsWith('%PDF-');

    return { sizeKB, isPdf, hasValidHeader: isPdf };
  }
}

export const pdfAttachmentService = new PdfAttachmentService();
