import type { Theme } from '../theme.js';
import { drawTextWithFallback } from './text-fallback.js';

interface DrawSeverityBadgeArgs {
  doc: PDFKit.PDFDocument;
  severity: string | undefined;
  x: number;
  y: number;
  theme: Theme;
}

export interface BadgeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function drawSeverityBadge(args: DrawSeverityBadgeArgs): BadgeBox {
  const { doc, severity, x, y, theme } = args;
  const style = theme.severityStyle(severity);
  const paddingX = 8;
  const paddingY = 4;

  doc.save();
  doc.font(theme.fonts.bold).fontSize(theme.fontSizes.badge);
  const textWidth = doc.widthOfString(style.label);
  const textHeight = doc.currentLineHeight();
  const width = textWidth + paddingX * 2;
  const height = textHeight + paddingY * 2;

  doc
    .roundedRect(x, y, width, height, theme.spacing.badgeRadius)
    .fillColor(style.backgroundColor)
    .fill();

  doc.fillColor(style.textColor);
  drawTextWithFallback(
    doc,
    style.label,
    x + paddingX,
    y + paddingY,
    theme.fonts.bold,
    theme.fallbackFonts.bold,
    theme.fontSizes.badge,
    { lineBreak: false },
  );
  doc.restore();

  return { x, y, width, height };
}

interface DrawFilePathBadgeArgs {
  doc: PDFKit.PDFDocument;
  text: string;
  x: number;
  y: number;
  theme: Theme;
}

export function drawFilePathBadge(args: DrawFilePathBadgeArgs): BadgeBox {
  const { doc, text, x, y, theme } = args;
  const paddingX = 6;
  const paddingY = 3;

  doc.save();
  doc.font(theme.fonts.mono).fontSize(theme.fontSizes.filePath);
  const textWidth = doc.widthOfString(text);
  const textHeight = doc.currentLineHeight();
  const width = textWidth + paddingX * 2;
  const height = textHeight + paddingY * 2;

  doc
    .roundedRect(x, y, width, height, theme.spacing.pillRadius)
    .fillColor(theme.colors.n50Cultured)
    .fill();

  doc
    .fillColor(theme.colors.n800Charcoal)
    .text(text, x + paddingX, y + paddingY, { lineBreak: false });
  doc.restore();

  return { x, y, width, height };
}
