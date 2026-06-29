import PDFDocument from 'pdfkit';
import { loadFont } from './assets-loader.js';
import { renderCover } from './sections/cover.js';
import { renderSection } from './sections/section-renderer.js';
import { renderPageHeader, renderPageFooter } from './sections/page-chrome.js';
import { theme as defaultTheme } from './theme.js';
import type { Theme } from './theme.js';
import type { PdfReportConfig, PdfReportInput } from './types.js';

const PDF_SIGNATURE = '%PDF-1.';

const DEFAULT_CONFIG: Required<PdfReportConfig> = {
  headerTitle: 'KINTO Report',
  reference: '',
  coverKicker: 'TECHNICAL REPORT',
  coverTitle: 'Report',
  footerText: '© KINTO MOBILITY · DOCUMENTO CONFIDENCIAL',
};

export async function buildPdf(
  input: PdfReportInput,
  theme: Theme = defaultTheme,
): Promise<Buffer> {
  const { spacing } = theme;

  const config: Required<PdfReportConfig> = {
    ...DEFAULT_CONFIG,
    ...input.config,
  };

  if (!config.reference) {
    config.reference = theme.formatReference(input.metadata);
  }

  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: spacing.pageMarginTop,
      bottom: spacing.pageMarginBottom,
      left: spacing.pageMarginLeft,
      right: spacing.pageMarginRight,
    },
    bufferPages: true,
    autoFirstPage: false,
  });

  registerFonts(doc, theme);
  doc.font(theme.fonts.regular);
  doc.addPage();

  const chunks: Buffer[] = [];
  const completion = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));
  });

  // Capa
  renderPageHeader({ doc, headerTitle: config.headerTitle, reference: config.reference, theme });
  renderCover({
    doc,
    config,
    metadata: input.metadata ?? [],
    summary: input.summary,
    summaryTitle: input.summaryTitle,
    overviewCards: input.overviewCards,
    theme,
  });

  // Seções
  const sections = input.sections ?? [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section || section.items.length === 0) continue;
    doc.addPage();
    renderPageHeader({ doc, headerTitle: config.headerTitle, reference: config.reference, theme });
    renderSection({
      doc,
      number: i + 1,
      title: section.title,
      descriptor: section.descriptor,
      items: section.items,
      theme,
    });
  }

  // Footer com paginação
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(range.start + i);
    renderPageFooter({ doc, pageNumber: i + 1, totalPages, footerText: config.footerText, theme });
  }

  doc.end();
  const buffer = await completion;

  validatePdfSignature(buffer);
  return buffer;
}

function registerFonts(doc: PDFKit.PDFDocument, theme: Theme): void {
  doc.registerFont(theme.fonts.regular, loadFont('regular'));
  doc.registerFont(theme.fonts.light, loadFont('light'));
  doc.registerFont(theme.fonts.book, loadFont('book'));
  doc.registerFont(theme.fonts.semibold, loadFont('semibold'));
  doc.registerFont(theme.fonts.bold, loadFont('bold'));
}

function validatePdfSignature(buffer: Buffer): void {
  if (buffer.length < PDF_SIGNATURE.length) {
    throw new Error('Buffer gerado é menor que a assinatura PDF esperada');
  }
  const prefix = buffer.subarray(0, PDF_SIGNATURE.length).toString('utf-8');
  if (prefix !== PDF_SIGNATURE) {
    throw new Error(`Buffer não começa com assinatura PDF válida. Encontrado: "${prefix}"`);
  }
}
