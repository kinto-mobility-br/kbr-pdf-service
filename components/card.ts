import type { Theme } from '../theme.js';

interface DrawCardArgs {
  doc: PDFKit.PDFDocument;
  x: number;
  y: number;
  width: number;
  height: number;
  theme: Theme;
  fillColor?: string;
  borderColor?: string;
}

export function drawCard(args: DrawCardArgs): void {
  const { doc, x, y, width, height, theme, fillColor, borderColor } = args;

  doc.save();
  doc
    .roundedRect(x, y, width, height, theme.spacing.cardRadius)
    .fillColor(fillColor ?? theme.colors.n0White)
    .fill();
  doc
    .roundedRect(x, y, width, height, theme.spacing.cardRadius)
    .lineWidth(1)
    .strokeColor(borderColor ?? theme.colors.n100LightGray)
    .stroke();
  doc.restore();
}
