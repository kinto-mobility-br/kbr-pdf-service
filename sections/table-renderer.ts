import { drawSectionTitle } from '../components/section-title.js';
import { drawTextWithFallback } from '../components/text-fallback.js';
import { getContentArea } from './page-chrome.js';
import type { PdfTable, PdfTableColumn, PdfTableRow } from '../types.js';
import type { Theme } from '../theme.js';

interface RenderTableSectionArgs {
  doc: PDFKit.PDFDocument;
  number: number;
  title: string;
  descriptor?: string;
  table: PdfTable;
  theme: Theme;
}

const CELL_PADDING_X = 8;
const CELL_PADDING_Y = 6;
const HEADER_HEIGHT = 24;
const MIN_ROW_HEIGHT = 22;

/** Desenha uma seção como tabela (cabeçalho + linhas), bem mais compacta que os cards de `renderSection` para listas longas de registros simples. */
export function renderTableSection(args: RenderTableSectionArgs): void {
  const { doc, number, title, descriptor, table, theme } = args;
  const { colors, fonts, fontSizes } = theme;
  const area = getContentArea(doc, theme);

  let cursorY = drawSectionTitle({
    doc,
    number,
    title,
    x: area.x,
    y: area.y + 8,
    theme,
  });

  if (descriptor) {
    doc.save().font(fonts.regular).fillColor(colors.n600DarkElectricBlue);
    drawTextWithFallback(doc, descriptor, area.x, cursorY + 6, fonts.regular, theme.fallbackFonts.regular, fontSizes.body, {
      width: area.width,
    });
    cursorY = doc.y + 16;
    doc.restore();
  } else {
    cursorY += 16;
  }

  const columnWidths = resolveColumnWidths(table.columns, area.width);
  const bottomLimit = area.y + area.height;

  cursorY = drawTableHeader(doc, theme, area.x, cursorY, table.columns, columnWidths);

  for (const row of table.rows) {
    const rowHeight = measureRowHeight(doc, theme, row, table.columns, columnWidths);

    if (cursorY + rowHeight > bottomLimit) {
      doc.addPage();
      const newArea = getContentArea(doc, theme);
      cursorY = drawTableHeader(doc, theme, newArea.x, newArea.y, table.columns, columnWidths);
    }

    drawTableRow(doc, theme, area.x, cursorY, table.columns, columnWidths, row, rowHeight);
    cursorY += rowHeight;
  }
}

function resolveColumnWidths(columns: PdfTableColumn[], totalWidth: number): number[] {
  const definedWidth = columns.reduce((sum, col) => sum + (col.width ?? 0), 0);
  const undefinedCount = columns.filter((col) => col.width === undefined).length;
  const remainingFraction = Math.max(0, 1 - definedWidth);
  const fractionPerUndefined = undefinedCount > 0 ? remainingFraction / undefinedCount : 0;

  return columns.map((col) => (col.width ?? fractionPerUndefined) * totalWidth);
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  theme: Theme,
  x: number,
  y: number,
  columns: PdfTableColumn[],
  columnWidths: number[],
): number {
  const { colors, fonts, fontSizes } = theme;
  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

  doc.save();
  doc.rect(x, y, totalWidth, HEADER_HEIGHT).fillColor(colors.n50Cultured).fill();

  let cellX = x;
  doc.font(fonts.semibold).fillColor(colors.n800Charcoal);
  columns.forEach((col, i) => {
    const width = columnWidths[i] ?? 0;
    drawTextWithFallback(
      doc,
      col.label.toUpperCase(),
      cellX + CELL_PADDING_X,
      y + (HEADER_HEIGHT - fontSizes.labelCaps) / 2,
      fonts.semibold,
      theme.fallbackFonts.semibold,
      fontSizes.labelCaps,
      { width: width - CELL_PADDING_X * 2, lineBreak: false, characterSpacing: 0.4 },
    );
    cellX += width;
  });

  doc
    .moveTo(x, y + HEADER_HEIGHT)
    .lineTo(x + totalWidth, y + HEADER_HEIGHT)
    .lineWidth(1)
    .strokeColor(colors.kintoBrandBlue)
    .stroke();

  doc.restore();
  return y + HEADER_HEIGHT;
}

function measureRowHeight(
  doc: PDFKit.PDFDocument,
  theme: Theme,
  row: PdfTableRow,
  columns: PdfTableColumn[],
  columnWidths: number[],
): number {
  doc.save();
  doc.font(theme.fonts.regular).fontSize(theme.fontSizes.body);
  const tallestCell = columns.reduce((max, col, i) => {
    const width = (columnWidths[i] ?? 0) - CELL_PADDING_X * 2;
    const value = row.cells[col.key] ?? '';
    const height = doc.heightOfString(value, { width, lineGap: 2 });
    return Math.max(max, height);
  }, 0);
  doc.restore();

  return Math.max(MIN_ROW_HEIGHT, tallestCell + CELL_PADDING_Y * 2);
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  theme: Theme,
  x: number,
  y: number,
  columns: PdfTableColumn[],
  columnWidths: number[],
  row: PdfTableRow,
  rowHeight: number,
): void {
  const { colors, fonts, fontSizes } = theme;
  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
  const textColor = row.severity === 'high' ? colors.error : row.severity === 'medium' ? colors.warning : colors.n800Charcoal;

  doc.save();
  let cellX = x;
  doc.font(fonts.regular).fillColor(textColor);
  columns.forEach((col, i) => {
    const width = columnWidths[i] ?? 0;
    const value = row.cells[col.key] ?? '';
    drawTextWithFallback(doc, value, cellX + CELL_PADDING_X, y + CELL_PADDING_Y, fonts.regular, theme.fallbackFonts.regular, fontSizes.body, {
      width: width - CELL_PADDING_X * 2,
      lineGap: 2,
    });
    cellX += width;
  });
  doc.restore();

  doc
    .save()
    .moveTo(x, y + rowHeight)
    .lineTo(x + totalWidth, y + rowHeight)
    .lineWidth(0.5)
    .strokeColor(colors.n100LightGray)
    .stroke()
    .restore();
}
