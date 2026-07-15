import type { Theme } from '../theme.js';
import { drawTextWithFallback } from './text-fallback.js';

interface DrawSectionTitleArgs {
  doc: PDFKit.PDFDocument;
  number: number;
  title: string;
  x: number;
  y: number;
  theme: Theme;
}

export function drawSectionTitle(args: DrawSectionTitleArgs): number {
  const { doc, number, title, x, y, theme } = args;
  const barWidth = 3;
  const gapAfterBar = 12;
  const fontSize = theme.fontSizes.sectionTitle;

  doc.save();
  doc.font(theme.fonts.bold).fontSize(fontSize);
  const lineHeight = doc.currentLineHeight();

  doc
    .rect(x, y, barWidth, lineHeight)
    .fillColor(theme.colors.kintoBrandBlue)
    .fill();

  const text = `${number}. ${title}`;
  doc.fillColor(theme.colors.n900Gunmetal);
  drawTextWithFallback(doc, text, x + barWidth + gapAfterBar, y, theme.fonts.bold, theme.fallbackFonts.bold, fontSize, {
    lineBreak: false,
  });
  doc.restore();

  return y + lineHeight;
}
