import SVGtoPDF from 'svg-to-pdfkit';
import { loadSvg } from '../assets-loader.js';
import { drawCard } from '../components/card.js';
import { drawTextWithFallback } from '../components/text-fallback.js';
import { getContentArea } from './page-chrome.js';
import type { PdfMetadataField, PdfOverviewCard, PdfReportConfig } from '../types.js';
import type { Theme } from '../theme.js';

interface RenderCoverArgs {
  doc: PDFKit.PDFDocument;
  config: Required<PdfReportConfig>;
  metadata: PdfMetadataField[];
  summary?: string;
  summaryTitle?: string;
  overviewCards?: PdfOverviewCard[];
  theme: Theme;
}

export function renderCover(args: RenderCoverArgs): void {
  const { doc, config, metadata, summary, summaryTitle, overviewCards, theme } = args;
  const { colors, fonts, fontSizes, spacing, limits } = theme;
  const area = getContentArea(doc, theme);
  let cursorY = area.y + 8;

  // 1. Logo Kinto (KINTO_BLUE) em destaque acima do título
  const logoSvg = loadSvg('KINTO_BLUE');
  const logoWidth = 160;
  const logoAspect = 1788.28 / 600;
  const logoHeight = logoWidth / logoAspect;
  SVGtoPDF(doc, logoSvg, area.x, cursorY, { width: logoWidth, height: logoHeight });
  cursorY += logoHeight + 20;

  // 1.1 Aviso de documento protegido por senha (quando aplicável)
  if (config.openPassword) {
    doc
      .save()
      .fillColor(colors.error);
    drawTextWithFallback(
      doc,
      theme.SENSITIVE_DOCUMENT_NOTICE,
      area.x,
      cursorY,
      fonts.bold,
      theme.fallbackFonts.bold,
      fontSizes.labelCaps,
      { width: area.width, characterSpacing: 0.2 },
    );
    cursorY = doc.y + 14;
    doc.restore();
  }

  // 2. Kicker
  doc
    .save()
    .font(fonts.semibold)
    .fillColor(colors.kintoBrandBlue);
  drawTextWithFallback(doc, config.coverKicker, area.x, cursorY, fonts.semibold, theme.fallbackFonts.semibold, fontSizes.kicker, {
    lineBreak: false,
    characterSpacing: 1.5,
  });
  cursorY += 16;
  doc.restore();

  // 3. Título grande
  doc
    .save()
    .font(fonts.bold)
    .fillColor(colors.n900Gunmetal);
  drawTextWithFallback(doc, config.coverTitle, area.x, cursorY, fonts.bold, theme.fallbackFonts.bold, fontSizes.coverTitle, {
    width: area.width,
    lineGap: 2,
  });
  cursorY = doc.y + 12;
  doc.restore();

  // 4. Linha divisória
  cursorY += 12;
  doc
    .save()
    .moveTo(area.x, cursorY)
    .lineTo(area.x + area.width, cursorY)
    .lineWidth(1)
    .strokeColor(colors.n100LightGray)
    .stroke()
    .restore();
  cursorY += 24;

  // 5. Metadata em linhas
  cursorY = renderMetadataRows(doc, metadata, theme, area.x, cursorY, area.width);
  cursorY += spacing.coverBlockGap;

  // Reserva do bloco overview na base da capa
  const bottomLimit = area.y + area.height;
  const overviewTitleStrip = 18;
  const overviewCardHeight = 80;
  const overviewBlockHeight = overviewTitleStrip + overviewCardHeight;
  const showOverview = overviewCards !== undefined && overviewCards.length > 0;
  const overviewReserved = showOverview ? overviewBlockHeight + spacing.coverBlockGap : 0;

  // 6. Card "Resumo" (summary)
  if (summary && summary.trim().length > 0) {
    const summaryText = theme.truncate(summary.trim(), limits.maxSummaryChars);
    const summaryCardHeight = bottomLimit - overviewReserved - cursorY;
    if (summaryCardHeight > 0) {
      renderSummaryCard(doc, summaryText, summaryTitle ?? 'Resumo', theme, area.x, cursorY, area.width, summaryCardHeight);
    }
  }

  // 7. Overview cards na base
  if (showOverview) {
    renderOverviewCards(doc, overviewCards, theme, area.x, bottomLimit, area.width, overviewBlockHeight);
  }
}

function renderMetadataRows(
  doc: PDFKit.PDFDocument,
  metadata: PdfMetadataField[],
  theme: Theme,
  x: number,
  y: number,
  width: number,
): number {
  const { colors, fonts, fontSizes } = theme;
  const rowHeight = 32;

  for (let i = 0; i < metadata.length; i++) {
    const field = metadata[i];
    if (!field) continue;
    const rowY = y + rowHeight * i;

    doc
      .save()
      .font(fonts.bold)
      .fillColor(colors.n500SlateGray);
    drawTextWithFallback(doc, field.label.toUpperCase(), x, rowY, fonts.bold, theme.fallbackFonts.bold, fontSizes.labelCaps, {
      width,
      characterSpacing: 0.6,
      lineBreak: false,
    });

    doc.font(fonts.semibold)
      .fillColor(field.link ? colors.kintoBrandBlue : colors.n900Gunmetal);
    drawTextWithFallback(doc, field.value, x, rowY + 12, fonts.semibold, theme.fallbackFonts.semibold, fontSizes.cardHeading, {
      width,
      lineBreak: false,
      ...(field.link ? { link: field.link, underline: true } : {}),
    });
    doc.restore();
  }

  return y + rowHeight * metadata.length + 4;
}

function renderSummaryCard(
  doc: PDFKit.PDFDocument,
  summary: string,
  title: string,
  theme: Theme,
  x: number,
  y: number,
  width: number,
  cardHeight: number,
): void {
  const { colors, fonts, fontSizes, spacing } = theme;
  const padding = spacing.cardPaddingLarge;
  const textWidth = width - padding * 2;
  const titleHeight = 22;
  const textAreaHeight = cardHeight - padding * 2 - titleHeight;

  const maxFontSize = fontSizes.bodyEmphasis;
  const minFontSize = 8;
  const lineGap = 3;
  let fontSize = maxFontSize;
  doc.save();
  doc.font(fonts.regular);
  while (fontSize > minFontSize) {
    doc.fontSize(fontSize);
    const measured = doc.heightOfString(summary, { width: textWidth, lineGap });
    if (measured <= textAreaHeight) break;
    fontSize -= 0.5;
  }
  doc.restore();

  drawCard({ doc, x, y, width, height: cardHeight, theme });

  doc
    .save()
    .font(fonts.semibold)
    .fillColor(colors.kintoBrandBlue);
  drawTextWithFallback(doc, title, x + padding, y + padding, fonts.semibold, theme.fallbackFonts.semibold, fontSizes.cardHeading, {
    lineBreak: false,
  });

  doc.font(fonts.regular)
    .fillColor(colors.n900Gunmetal);
  drawTextWithFallback(doc, summary, x + padding, y + padding + titleHeight, fonts.regular, theme.fallbackFonts.regular, fontSize, {
    width: textWidth,
    height: textAreaHeight,
    ellipsis: true,
    lineGap,
  });
  doc.restore();
}

function renderOverviewCards(
  doc: PDFKit.PDFDocument,
  cards: PdfOverviewCard[],
  theme: Theme,
  x: number,
  bottomLimit: number,
  width: number,
  availableHeight: number,
): void {
  const { colors, fonts, fontSizes, spacing } = theme;
  const count = Math.min(cards.length, 6);
  const gap = 12;
  const cardWidth = (width - gap * (count - 1)) / count;

  const titleStripHeight = 18;
  const idealCardHeight = 80;
  const minCardHeight = 48;
  const cardHeight = Math.max(
    minCardHeight,
    Math.min(idealCardHeight, availableHeight - titleStripHeight),
  );
  const metricFontSize = Math.max(
    14,
    Math.round(fontSizes.metricBig * (cardHeight / idealCardHeight)),
  );

  const cardsY = bottomLimit - cardHeight;
  const titleY = cardsY - titleStripHeight;

  doc
    .save()
    .font(fonts.bold)
    .fontSize(fontSizes.labelCaps)
    .fillColor(colors.n500SlateGray)
    .text('OVERVIEW', x, titleY, {
      characterSpacing: 0.6,
      lineBreak: false,
    });
  doc.restore();

  for (let i = 0; i < count; i++) {
    const card = cards[i];
    if (!card) continue;
    const value = String(card.value);
    const dimmed = value === '0';
    const cardX = x + (cardWidth + gap) * i;

    drawCard({ doc, x: cardX, y: cardsY, width: cardWidth, height: cardHeight, theme });

    const labelColor = dimmed ? colors.n300CadetGray : colors.n500SlateGray;
    const valueColor = dimmed ? colors.n300CadetGray : colors.kintoBrandBlue;
    const innerPadding = Math.min(spacing.cardPaddingSmall, Math.floor(cardHeight / 6));
    const labelY = cardsY + innerPadding;
    const metricY = cardsY + cardHeight - innerPadding - metricFontSize;

    doc
      .save()
      .font(fonts.bold)
      .fontSize(fontSizes.labelCaps)
      .fillColor(labelColor)
      .text(card.label.toUpperCase(), cardX + innerPadding, labelY, {
        width: cardWidth - innerPadding * 2,
        characterSpacing: 0.6,
        lineBreak: false,
      });

    doc
      .font(fonts.bold)
      .fontSize(metricFontSize)
      .fillColor(valueColor)
      .text(value, cardX + innerPadding, metricY, {
        width: cardWidth - innerPadding * 2,
        lineBreak: false,
      });
    doc.restore();
  }
}
