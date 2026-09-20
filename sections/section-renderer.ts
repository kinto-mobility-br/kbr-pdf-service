import SVGtoPDF from 'svg-to-pdfkit';
import { drawCard } from '../components/card.js';
import { drawFilePathBadge, drawSeverityBadge, measureSeverityBadgeBox } from '../components/badge.js';
import { drawSectionTitle } from '../components/section-title.js';
import { drawTextWithFallback, drawTextInFallbackFont } from '../components/text-fallback.js';
import { loadSvg } from '../assets-loader.js';
import { getContentArea } from './page-chrome.js';
import type { PdfItemRow, PdfSectionItem } from '../types.js';
import type { Theme } from '../theme.js';

const TITLE_ICON_SIZE = 16;
const TITLE_ICON_GAP = 8;
const TITLE_BADGE_GAP = 8;

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
    const badgeBox = hasSeverity ? measureSeverityBadgeBox(doc, item.severity, theme) : undefined;
    const badgePrefixWidth = badgeBox ? badgeBox.width + TITLE_BADGE_GAP : 0;
    const titleReservedWidth =
      textWidth - badgePrefixWidth - (item.titleIcon ? TITLE_ICON_SIZE + TITLE_ICON_GAP : 0);
    const titleHeight = measureTextHeight(doc, item.title, fonts.semibold, fontSizes.itemTitle, titleReservedWidth);
    const titleRowHeight = badgeBox ? Math.max(titleHeight, badgeBox.height) : titleHeight;
    const titleDividerHeight = DIVIDER_HEIGHT + DIVIDER_GAP * 2;
    const filePathHeight = fileLine ? 22 : 0;
    const descriptionHeight = description
      ? measureTextHeight(doc, description, fonts.regular, fontSizes.body, textWidth, 2) + 8
      : 0;

    const rowsHeight = item.rows?.length
      ? item.rows.reduce((sum, row) => {
          const rowLayout = computeRowLayout(textWidth, Boolean(row.description));
          return sum + measureRowHeight(doc, row, fonts, fontSizes, rowLayout) + spacing.itemRowGap;
        }, 0) + 4
      : 0;

    let suggestionBlockHeight = 0;
    if (suggestion) {
      const suggestionTextWidth = textWidth - 12;
      suggestionBlockHeight =
        14 + measureTextHeight(doc, suggestion, fonts.regular, fontSizes.body, suggestionTextWidth, 2) + 12;
    }

    const cardHeight =
      padding + titleRowHeight + titleDividerHeight + filePathHeight + descriptionHeight + rowsHeight + suggestionBlockHeight + padding;

    cursorY = ensureSpaceOrNewPage(doc, theme, cursorY, cardHeight);

    drawCard({ doc, x: area.x, y: cursorY, width: area.width, height: cardHeight, theme });

    const titleTopY = cursorY + padding;
    let titleX = area.x + padding;

    // Icone (ex.: KINTO_SQ_BLUE) fica a esquerda, como prefixo do titulo; o selo de severidade
    // fica a direita, alinhado ao fim da linha.
    if (item.titleIcon) {
      const iconSvg = loadSvg(item.titleIcon);
      SVGtoPDF(doc, iconSvg, titleX, titleTopY, {
        width: TITLE_ICON_SIZE,
        height: TITLE_ICON_SIZE,
      });
      titleX += TITLE_ICON_SIZE + TITLE_ICON_GAP;
    }

    doc
      .save()
      .font(fonts.semibold)
      .fillColor(colors.n900Gunmetal);
    drawTextWithFallback(doc, item.title, titleX, titleTopY, fonts.semibold, theme.fallbackFonts.semibold, fontSizes.itemTitle, {
      width: titleReservedWidth,
    });
    doc.restore();

    if (badgeBox) {
      drawSeverityBadge({
        doc,
        severity: item.severity,
        x: area.x + padding + textWidth - badgeBox.width,
        y: titleTopY + Math.max(0, (titleHeight - badgeBox.height) / 2),
        theme,
      });
    }

    let innerY = Math.max(doc.y, titleTopY + titleRowHeight) + DIVIDER_GAP;
    doc
      .save()
      .moveTo(area.x + padding, innerY)
      .lineTo(area.x + padding + textWidth, innerY)
      .lineWidth(DIVIDER_HEIGHT)
      .strokeColor(colors.n100LightGray)
      .stroke()
      .restore();
    innerY += DIVIDER_GAP + DIVIDER_HEIGHT;

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
        const rowLayout = computeRowLayout(textWidth, Boolean(row.description));
        const rowHeight = measureRowHeight(doc, row, fonts, fontSizes, rowLayout);

        let rowY = innerY;
        if (row.dividerBefore) {
          doc
            .save()
            .moveTo(area.x + padding, rowY + DIVIDER_GAP)
            .lineTo(area.x + padding + textWidth, rowY + DIVIDER_GAP)
            .lineWidth(DIVIDER_HEIGHT)
            .strokeColor(colors.n100LightGray)
            .stroke()
            .restore();
          rowY += DIVIDER_GAP * 2 + DIVIDER_HEIGHT;
        }

        doc.save().fillColor(colors.n800Charcoal);
        drawTextWithFallback(doc, row.label, area.x + padding, rowY, row.bold ? fonts.bold : fonts.regular, row.bold ? theme.fallbackFonts.bold : theme.fallbackFonts.regular, fontSizes.body, {
          width: rowLayout.labelWidth,
          lineGap: 2,
        });
        doc.restore();

        if (row.description) {
          doc.save().fillColor(colors.n600DarkElectricBlue);
          // Fonte de fallback sempre forcada: descricoes de linha nao devem alternar entre
          // Toyota Type/Inter dependendo so de ter ou nao diacritico no texto (ex.: "Locacao
          // acima de X dias" vs "PROMOCODE - X% Desconto Concessionario").
          drawTextInFallbackFont(
            doc,
            row.description,
            area.x + padding + rowLayout.descriptionX!,
            rowY,
            theme.fallbackFonts.regular,
            fontSizes.body,
            { width: rowLayout.descriptionWidth, lineGap: 2 },
          );
          doc.restore();
        }

        doc.save().fillColor(colors.n800Charcoal);
        drawTextWithFallback(doc, row.value, area.x + padding + rowLayout.valueX, rowY, row.bold ? fonts.bold : fonts.regular, row.bold ? theme.fallbackFonts.bold : theme.fallbackFonts.regular, fontSizes.body, {
          width: rowLayout.valueWidth,
          align: 'right',
          lineGap: 2,
        });
        doc.restore();

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
  descriptionX?: number;
  descriptionWidth?: number;
  valueX: number;
  valueWidth: number;
}

const DIVIDER_HEIGHT = 1;
const DIVIDER_GAP = 6;

/** 2 colunas (label/value) quando a linha nao tem description; 3 quando tem (decidido por linha,
 * nao por card — permite misturar linhas 2 e 3 colunas no mesmo card). */
function computeRowLayout(textWidth: number, hasDescription: boolean): RowLayout {
  const gap = 12;
  if (!hasDescription) {
    const labelWidth = Math.floor(textWidth * 0.55);
    const valueX = labelWidth + gap;
    return { labelWidth, valueX, valueWidth: textWidth - valueX };
  }
  const labelWidth = Math.floor(textWidth * 0.3);
  const descriptionX = labelWidth + gap;
  const descriptionWidth = Math.floor(textWidth * 0.4);
  const valueX = descriptionX + descriptionWidth + gap;
  return { labelWidth, descriptionX, descriptionWidth, valueX, valueWidth: textWidth - valueX };
}

function measureRowHeight(
  doc: PDFKit.PDFDocument,
  row: PdfItemRow,
  fonts: Theme['fonts'],
  fontSizes: Theme['fontSizes'],
  layout: RowLayout,
): number {
  const font = row.bold ? fonts.bold : fonts.regular;
  const labelHeight = measureTextHeight(doc, row.label, font, fontSizes.body, layout.labelWidth, 2);
  const descriptionHeight = row.description
    ? measureTextHeight(doc, row.description, fonts.regular, fontSizes.body, layout.descriptionWidth!, 2)
    : 0;
  const valueHeight = measureTextHeight(doc, row.value, font, fontSizes.body, layout.valueWidth, 2);
  const contentHeight = Math.max(labelHeight, descriptionHeight, valueHeight);
  return row.dividerBefore ? contentHeight + DIVIDER_HEIGHT + DIVIDER_GAP * 2 : contentHeight;
}
