import { drawSectionTitle } from '../components/section-title.js';
import { drawTextWithFallback } from '../components/text-fallback.js';
import { getContentArea, renderPageHeader } from './page-chrome.js';
import type { PdfTable, PdfTableColumn, PdfTableRow } from '../types.js';
import type { Theme } from '../theme.js';

interface RenderTableSectionArgs {
  doc: PDFKit.PDFDocument;
  number: number;
  title: string;
  descriptor?: string;
  table: PdfTable;
  theme: Theme;
  headerTitle: string;
  reference: string;
}

const CELL_PADDING_X = 8;
const CELL_PADDING_Y = 6;
const HEADER_HEIGHT = 24;
const MIN_ROW_HEIGHT = 22;
const TABLE_TITLE_GAP = 6;
const TABLE_GROUP_GAP = 20;

/** Métricas de densidade de uma tabela (fonte, padding, alturas). O modo denso (`PdfTable.dense`)
 * encolhe tudo para um resumo compacto, sem afetar as demais tabelas do serviço. */
interface TableMetrics {
  cellPadX: number;
  cellPadY: number;
  headerHeight: number;
  minRowHeight: number;
  bodyFontSize: number;
  labelFontSize: number;
  titleFontSize: number;
  titleGap: number;
  groupGap: number;
  lineGap: number;
}

function resolveMetrics(theme: Theme, dense?: boolean): TableMetrics {
  if (dense) {
    return {
      cellPadX: 5,
      cellPadY: 2.5,
      headerHeight: 14,
      minRowHeight: 12,
      bodyFontSize: 7.5,
      labelFontSize: 6,
      titleFontSize: 9,
      titleGap: 3,
      groupGap: 12,
      lineGap: 1,
    };
  }
  return {
    cellPadX: CELL_PADDING_X,
    cellPadY: CELL_PADDING_Y,
    headerHeight: HEADER_HEIGHT,
    minRowHeight: MIN_ROW_HEIGHT,
    bodyFontSize: theme.fontSizes.body,
    labelFontSize: theme.fontSizes.labelCaps,
    titleFontSize: theme.fontSizes.cardHeading,
    titleGap: TABLE_TITLE_GAP,
    groupGap: TABLE_GROUP_GAP,
    lineGap: 2,
  };
}

/** Desenha uma seção como tabela (cabeçalho + linhas), bem mais compacta que os cards de `renderSection` para listas longas de registros simples. */
export function renderTableSection(args: RenderTableSectionArgs): void {
  const { doc, number, title, descriptor, table, theme, headerTitle, reference } = args;
  const area = getContentArea(doc, theme);

  let cursorY = drawSectionTitle({ doc, number, title, x: area.x, y: area.y + 8, theme });
  cursorY = applyDescriptor(doc, theme, descriptor, area.x, area.width, cursorY);

  drawTable(doc, theme, area.x, cursorY, area.width, table, headerTitle, reference);
}

interface RenderTableGroupSectionArgs {
  doc: PDFKit.PDFDocument;
  number: number;
  title: string;
  descriptor?: string;
  tables: PdfTable[];
  theme: Theme;
  headerTitle: string;
  reference: string;
}

/** Empilha várias tabelas (cada uma com seu `title`) numa mesma seção/página, com quebra de
 * página quando o conteúdo excede a altura útil (cada tabela repete seu próprio cabeçalho). */
export function renderTableGroupSection(args: RenderTableGroupSectionArgs): void {
  const { doc, number, title, descriptor, tables, theme, headerTitle, reference } = args;
  const area = getContentArea(doc, theme);
  const bottomLimit = area.y + area.height;

  let cursorY = drawSectionTitle({ doc, number, title, x: area.x, y: area.y + 8, theme });
  cursorY = applyDescriptor(doc, theme, descriptor, area.x, area.width, cursorY);

  let first = true;
  for (const table of tables) {
    if (table.rows.length === 0) continue;

    const metrics = resolveMetrics(theme, table.dense);
    const titleHeight = table.title ? metrics.titleFontSize + metrics.titleGap : 0;
    const columnWidths = resolveColumnWidths(table.columns, area.width);
    const headerHeight = measureHeaderHeight(doc, theme, table.columns, columnWidths, metrics);
    const minBlock = titleHeight + headerHeight + metrics.minRowHeight;
    const gap = first ? 0 : metrics.groupGap;

    if (cursorY + gap + minBlock > bottomLimit) {
      doc.addPage();
      renderPageHeader({ doc, headerTitle, reference, theme });
      cursorY = getContentArea(doc, theme).y;
    } else {
      cursorY += gap;
    }

    cursorY = drawTable(doc, theme, area.x, cursorY, area.width, table, headerTitle, reference);
    first = false;
  }
}

/** Aplica o descriptor opcional (texto abaixo do título da seção) e devolve o cursorY seguinte. */
function applyDescriptor(
  doc: PDFKit.PDFDocument,
  theme: Theme,
  descriptor: string | undefined,
  x: number,
  width: number,
  cursorY: number,
): number {
  const { colors, fonts, fontSizes } = theme;
  if (!descriptor) return cursorY + 16;

  doc.save().font(fonts.regular).fillColor(colors.n600DarkElectricBlue);
  drawTextWithFallback(doc, descriptor, x, cursorY + 6, fonts.regular, theme.fallbackFonts.regular, fontSizes.body, {
    width,
  });
  const nextY = doc.y + 16;
  doc.restore();
  return nextY;
}

/** Desenha o sub-título de uma tabela (usado ao empilhar várias numa seção). */
function drawTableTitle(
  doc: PDFKit.PDFDocument,
  theme: Theme,
  x: number,
  y: number,
  title: string,
  width: number,
  metrics: TableMetrics,
): number {
  const { colors, fonts } = theme;
  doc.save().font(fonts.semibold).fillColor(colors.n800Charcoal);
  drawTextWithFallback(doc, title, x, y, fonts.semibold, theme.fallbackFonts.semibold, metrics.titleFontSize, {
    width,
    lineBreak: false,
  });
  doc.restore();
  return y + metrics.titleFontSize + metrics.titleGap;
}

/** Desenha uma tabela a partir de `startY` (título opcional + cabeçalho de colunas + linhas),
 * quebrando de página quando necessário e repetindo o cabeçalho de colunas. Retorna o cursorY final. */
function drawTable(
  doc: PDFKit.PDFDocument,
  theme: Theme,
  x: number,
  startY: number,
  width: number,
  table: PdfTable,
  headerTitle: string,
  reference: string,
): number {
  const metrics = resolveMetrics(theme, table.dense);
  const columnWidths = resolveColumnWidths(table.columns, width);
  const bottomLimit = getContentArea(doc, theme).y + getContentArea(doc, theme).height;

  let cursorY = startY;
  if (table.title) cursorY = drawTableTitle(doc, theme, x, cursorY, table.title, width, metrics);
  cursorY = drawTableHeader(doc, theme, x, cursorY, table.columns, columnWidths, metrics);

  for (const row of table.rows) {
    const rowHeight = measureRowHeight(doc, theme, row, table.columns, columnWidths, metrics);

    if (cursorY + rowHeight > bottomLimit) {
      doc.addPage();
      renderPageHeader({ doc, headerTitle, reference, theme });
      const newArea = getContentArea(doc, theme);
      cursorY = drawTableHeader(doc, theme, newArea.x, newArea.y, table.columns, columnWidths, metrics);
    }

    drawTableRow(doc, theme, x, cursorY, table.columns, columnWidths, row, rowHeight, metrics);
    cursorY += rowHeight;
  }

  return cursorY;
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
  metrics: TableMetrics,
): number {
  const { colors, fonts } = theme;
  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
  const headerHeight = measureHeaderHeight(doc, theme, columns, columnWidths, metrics);

  doc.save();
  doc.rect(x, y, totalWidth, headerHeight).fillColor(colors.n50Cultured).fill();

  let cellX = x;
  doc.font(fonts.semibold).fillColor(colors.n800Charcoal);
  columns.forEach((col, i) => {
    const width = columnWidths[i] ?? 0;
    const innerWidth = width - metrics.cellPadX * 2;
    const label = col.label.toUpperCase();
    const labelHeight = doc.heightOfString(label, { width: innerWidth, characterSpacing: 0.4 });
    drawTextWithFallback(
      doc,
      label,
      cellX + metrics.cellPadX,
      y + (headerHeight - labelHeight) / 2,
      fonts.semibold,
      theme.fallbackFonts.semibold,
      metrics.labelFontSize,
      { width: innerWidth, characterSpacing: 0.4, align: col.align },
    );
    cellX += width;
  });

  doc
    .moveTo(x, y + headerHeight)
    .lineTo(x + totalWidth, y + headerHeight)
    .lineWidth(1)
    .strokeColor(colors.kintoBrandBlue)
    .stroke();

  doc.restore();
  return y + headerHeight;
}

/** Altura do cabeçalho: acomoda o rótulo de coluna mais alto (rótulos longos quebram em
 * múltiplas linhas), nunca menor que `metrics.headerHeight`. */
function measureHeaderHeight(
  doc: PDFKit.PDFDocument,
  theme: Theme,
  columns: PdfTableColumn[],
  columnWidths: number[],
  metrics: TableMetrics,
): number {
  doc.save();
  doc.font(theme.fonts.semibold).fontSize(metrics.labelFontSize);
  const tallest = columns.reduce((max, col, i) => {
    const innerWidth = (columnWidths[i] ?? 0) - metrics.cellPadX * 2;
    const height = doc.heightOfString(col.label.toUpperCase(), { width: innerWidth, characterSpacing: 0.4 });
    return Math.max(max, height);
  }, 0);
  doc.restore();
  return Math.max(metrics.headerHeight, tallest + metrics.cellPadY * 2);
}

function measureRowHeight(
  doc: PDFKit.PDFDocument,
  theme: Theme,
  row: PdfTableRow,
  columns: PdfTableColumn[],
  columnWidths: number[],
  metrics: TableMetrics,
): number {
  doc.save();
  doc.font(theme.fonts.regular).fontSize(metrics.bodyFontSize);
  const tallestCell = columns.reduce((max, col, i) => {
    const width = (columnWidths[i] ?? 0) - metrics.cellPadX * 2;
    const value = row.cells[col.key] ?? '';
    const height = doc.heightOfString(value, { width, lineGap: metrics.lineGap });
    return Math.max(max, height);
  }, 0);
  doc.restore();

  return Math.max(metrics.minRowHeight, tallestCell + metrics.cellPadY * 2);
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
  metrics: TableMetrics,
): void {
  const { colors, fonts } = theme;
  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
  const textColor = row.severity === 'high' ? colors.error : row.severity === 'medium' ? colors.warning : colors.n800Charcoal;
  const rowFont = row.bold ? fonts.semibold : fonts.regular;
  const rowFallbackFont = row.bold ? theme.fallbackFonts.semibold : theme.fallbackFonts.regular;

  doc.save();
  let cellX = x;
  doc.font(rowFont).fillColor(textColor);
  columns.forEach((col, i) => {
    const width = columnWidths[i] ?? 0;
    const value = row.cells[col.key] ?? '';
    drawTextWithFallback(doc, value, cellX + metrics.cellPadX, y + metrics.cellPadY, rowFont, rowFallbackFont, metrics.bodyFontSize, {
      width: width - metrics.cellPadX * 2,
      lineGap: metrics.lineGap,
      align: col.align,
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
