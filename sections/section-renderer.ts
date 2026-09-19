import { drawCard } from '../components/card.js';
import { drawFilePathBadge, drawSeverityBadge } from '../components/badge.js';
import { drawSectionTitle } from '../components/section-title.js';
import { drawTextWithFallback } from '../components/text-fallback.js';
import { getContentArea } from './page-chrome.js';
import type { PdfItemRow, PdfSectionItem } from '../types.js';
import type { Theme } from '../theme.js';

interface RenderSectionArgs {
  doc: PDFKit.PDFDocument;
  number: number;
  title: string;
  descriptor?: string;
  items: PdfSectionItem[];
  theme: Theme;
}

export function renderSection(args: RenderSectionArgs): void {
  const { doc, number, title, descriptor, items, theme } = args;
  const { colors, fonts, fontSizes, spacing, limits } = theme;
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
    doc
      .save()
      .font(fonts.regular)
      .fillColor(colors.n600DarkElectricBlue);
    drawTextWithFallback(doc, descriptor, area.x, cursorY + 6, fonts.regular, theme.fallbackFonts.regular, fontSizes.body, {
      width: area.width,
    });
    cursorY = doc.y + 16;
    doc.restore();
  } else {
    cursorY += 16;
  }

  for (const item of items) {
    const description = theme.truncate(item.description ?? '', limits.maxFieldChars);
    const suggestion = item.suggestion
      ? theme.truncate(item.suggestion, limits.maxFieldChars)
      : undefined;
    const fileLine = formatFileLine(item);
    const hasSeverity = typeof item.severity === 'string' && item.severity.length > 0;

    const padding = spacing.cardPaddingDefault;
    const textWidth = area.width - padding * 2;
    const badgeRow = hasSeverity ? 22 : 0;
    const titleHeight = measureTextHeight(doc, item.title, fonts.semibold, fontSizes.itemTitle, textWidth);
    const filePathHeight = fileLine ? 22 : 0;
    const descriptionHeight = description
      ? measureTextHeight(doc, description, fonts.regular, fontSizes.body, textWidth, 2) + 8
      : 0;

    const rowLayout = computeRowLayout(textWidth);
    const rowsHeight = item.rows?.length
      ? item.rows.reduce((sum, row) => sum + measureRowHeight(doc, row, fonts, fontSizes, rowLayout) + spacing.itemRowGap, 0) + 4
      : 0;

    let suggestionBlockHeight = 0;
    if (suggestion) {
      const suggestionTextWidth = textWidth - 12;
      suggestionBlockHeight =
        14 + measureTextHeight(doc, suggestion, fonts.regular, fontSizes.body, suggestionTextWidth, 2) + 12;
    }

    const cardHeight =
      padding + badgeRow + titleHeight + filePathHeight + descriptionHeight + rowsHeight + suggestionBlockHeight + padding;

    cursorY = ensureSpaceOrNewPage(doc, theme, cursorY, cardHeight);

    drawCard({ doc, x: area.x, y: cursorY, width: area.width, height: cardHeight, theme });

    if (hasSeverity) {
      drawSeverityBadge({
        doc,
        severity: item.severity,
        x: area.x + padding,
        y: cursorY + padding,
        theme,
      });
    }

    let innerY = cursorY + padding + badgeRow;

    doc
      .save()
      .font(fonts.semibold)
      .fillColor(colors.n900Gunmetal);
    drawTextWithFallback(doc, item.title, area.x + padding, innerY, fonts.semibold, theme.fallbackFonts.semibold, fontSizes.itemTitle, {
      width: textWidth,
    });
    innerY = doc.y + 4;
    doc.restore();

    if (fileLine) {
      drawFilePathBadge({ doc, text: fileLine, x: area.x + padding, y: innerY, theme });
      innerY += 22;
    }

    if (description) {
      doc
        .save()
        .font(fonts.regular)
        .fillColor(colors.n800Charcoal);
      drawTextWithFallback(doc, description, area.x + padding, innerY, fonts.regular, theme.fallbackFonts.regular, fontSizes.body, {
        width: textWidth,
        lineGap: 2,
      });
      innerY = doc.y + 8;
      doc.restore();
    }

    if (item.rows?.length) {
      for (const row of item.rows) {
        const rowHeight = measureRowHeight(doc, row, fonts, fontSizes, rowLayout);

        doc
          .save()
          .font(fonts.regular)
          .fillColor(colors.n800Charcoal)
          .text(row.label, area.x + padding, innerY, { width: rowLayout.labelWidth, lineGap: 2 })
          .restore();

        doc
          .save()
          .font(fonts.regular)
          .fillColor(colors.n800Charcoal)
          .text(row.value, area.x + padding + rowLayout.valueX, innerY, {
            width: rowLayout.valueWidth,
            align: 'right',
            lineGap: 2,
          })
          .restore();

        innerY += rowHeight + spacing.itemRowGap;
      }
      innerY += 4;
    }

    if (suggestion) {
      const blockX = area.x + padding;
      const blockY = innerY;
      const barWidth = 2;
      const barColor = colors.lightBlue;
      const innerOffset = 12;
      const suggestionLabel = item.suggestionLabel ?? 'SUGGESTION';

      doc
        .save()
        .font(fonts.bold)
        .fontSize(fontSizes.labelCaps)
        .fillColor(colors.kintoBrandBlue)
        .text(suggestionLabel, blockX + innerOffset, blockY, {
          characterSpacing: 0.6,
          lineBreak: false,
        });
      const labelHeight = doc.currentLineHeight();
      doc.restore();

      doc
        .save()
        .font(fonts.regular)
        .fillColor(colors.n800Charcoal);
      drawTextWithFallback(
        doc,
        suggestion,
        blockX + innerOffset,
        blockY + labelHeight + 2,
        fonts.regular,
        theme.fallbackFonts.regular,
        fontSizes.body,
        { width: textWidth - innerOffset, lineGap: 2 },
      );
      const blockBottom = doc.y;
      doc.restore();

      doc
        .save()
        .rect(blockX, blockY, barWidth, blockBottom - blockY)
        .fillColor(barColor)
        .fill()
        .restore();
    }

    cursorY += cardHeight + spacing.itemCardGap;
  }
}

function formatFileLine(item: PdfSectionItem): string | undefined {
  if (!item.file) return undefined;
  if (typeof item.line === 'number') return `${item.file}:${item.line}`;
  return item.file;
}

function measureTextHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  size: number,
  width: number,
  lineGap = 0,
): number {
  doc.save();
  doc.font(font).fontSize(size);
  const height = doc.heightOfString(text, { width, lineGap });
  doc.restore();
  return height;
}

function ensureSpaceOrNewPage(
  doc: PDFKit.PDFDocument,
  theme: Theme,
  cursorY: number,
  requiredHeight: number,
): number {
  const area = getContentArea(doc, theme);
  const bottomLimit = area.y + area.height;
  if (cursorY + requiredHeight > bottomLimit) {
    doc.addPage();
    return getContentArea(doc, theme).y + 8;
  }
  return cursorY;
}

interface RowLayout {
  labelWidth: number;
  valueX: number;
  valueWidth: number;
}

/** Coluna esquerda (label) e direita (value) de um `PdfItemRow`, sem overlap mesmo com quebra de linha. */
function computeRowLayout(textWidth: number): RowLayout {
  const gap = 12;
  const labelWidth = Math.floor(textWidth * 0.55);
  const valueX = labelWidth + gap;
  const valueWidth = textWidth - valueX;
  return { labelWidth, valueX, valueWidth };
}

function measureRowHeight(
  doc: PDFKit.PDFDocument,
  row: PdfItemRow,
  fonts: Theme['fonts'],
  fontSizes: Theme['fontSizes'],
  layout: RowLayout,
): number {
  const labelHeight = measureTextHeight(doc, row.label, fonts.regular, fontSizes.body, layout.labelWidth, 2);
  const valueHeight = measureTextHeight(doc, row.value, fonts.regular, fontSizes.body, layout.valueWidth, 2);
  return Math.max(labelHeight, valueHeight);
}
