import SVGtoPDF from 'svg-to-pdfkit';
import { loadSvg } from '../assets-loader.js';
import type { Theme } from '../theme.js';

interface RenderPageHeaderArgs {
  doc: PDFKit.PDFDocument;
  headerTitle: string;
  reference: string;
  theme: Theme;
}

export function renderPageHeader(args: RenderPageHeaderArgs): void {
  const { doc, headerTitle, reference, theme } = args;
  const { spacing, fontSizes, fonts, colors } = theme;

  const left = spacing.pageMarginLeft;
  const right = doc.page.width - spacing.pageMarginRight;
  const top = spacing.pageMarginTop;

  doc.save();

  // Logo quadrado KINTO_SQ_BLUE no header
  const logoSize = 14;
  const logoSvg = loadSvg('KINTO_SQ_BLUE');
  SVGtoPDF(doc, logoSvg, left, top + 1, { width: logoSize, height: logoSize });

  doc
    .font(fonts.semibold)
    .fontSize(fontSizes.chromeStrong)
    .fillColor(colors.kintoBrandBlue)
    .text(headerTitle, left + logoSize + 6, top, { lineBreak: false });

  doc.font(fonts.regular).fontSize(fontSizes.chrome).fillColor(colors.n600DarkElectricBlue);
  const refWidth = doc.widthOfString(reference);
  doc.text(reference, right - refWidth, top + 2, { lineBreak: false });

  // Faixa fina abaixo
  const lineY = top + 18;
  doc
    .moveTo(left, lineY)
    .lineTo(right, lineY)
    .lineWidth(1)
    .strokeColor(colors.kintoBrandBlue)
    .stroke();

  doc.restore();
}

interface RenderPageFooterArgs {
  doc: PDFKit.PDFDocument;
  pageNumber: number;
  totalPages: number;
  footerText: string;
  theme: Theme;
}

export function renderPageFooter(args: RenderPageFooterArgs): void {
  const { doc, pageNumber, totalPages, footerText, theme } = args;
  const { spacing, fontSizes, fonts, colors } = theme;

  const left = spacing.pageMarginLeft;
  const right = doc.page.width - spacing.pageMarginRight;
  const bottom = doc.page.height - spacing.pageMarginBottom;

  doc.save();
  doc
    .moveTo(left, bottom)
    .lineTo(right, bottom)
    .lineWidth(0.5)
    .strokeColor(colors.n100LightGray)
    .stroke();

  const textY = bottom + 8;
  doc
    .font(fonts.bold)
    .fontSize(fontSizes.labelCaps)
    .fillColor(colors.n400LightSlateGray)
    .text(footerText, left, textY, { lineBreak: false });

  const pageText = `PÁGINA ${pageNumber} DE ${totalPages}`;
  const pageWidth = doc.widthOfString(pageText);
  doc.text(pageText, right - pageWidth, textY, { lineBreak: false });
  doc.restore();
}

export function getContentArea(doc: PDFKit.PDFDocument, theme: Theme): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const { spacing } = theme;
  const x = spacing.pageMarginLeft;
  const y = spacing.pageMarginTop + spacing.headerHeight;
  const width = doc.page.width - spacing.pageMarginLeft - spacing.pageMarginRight;
  const height =
    doc.page.height -
    spacing.pageMarginTop -
    spacing.headerHeight -
    spacing.pageMarginBottom -
    spacing.footerHeight;
  return { x, y, width, height };
}
