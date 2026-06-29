/**
 * KBR PDF Service — Componentes de layout reutilizáveis.
 *
 * Componentes de nível baixo para montar PDFs customizados manualmente.
 * Usados internamente pelo service e exportados para uso direto.
 */
import SVGtoPDF from 'svg-to-pdfkit';
import { loadSvg } from '../assets-loader.js';
import type { Theme } from '../theme.js';

// ─── Layout Constants ────────────────────────────────────────────────────────
export const LAYOUT = {
  MARGIN_LEFT: 56,
  MARGIN_RIGHT: 56,
  CONTENT_WIDTH: 483, // A4 width (595) - 56 - 56
  HEADER_Y: 10,
  HEADER_HEIGHT: 20,
  CONTENT_START_Y: 50,
  FOOTER_Y_OFFSET: 30,
  SECTION_GAP: 12,
  FIELD_GAP: 8,
  TERM_CLAUSE_GAP: 7,
  IMAGE_FIT_WIDTH: 483,
  IMAGE_FIT_HEIGHT: 340,
  PAGE_WIDTH: 595,
  PAGE_HEIGHT: 842,
} as const;

// ─── Field (Label: Value) inline ─────────────────────────────────────────────
export interface AddFieldOptions {
  doc: PDFKit.PDFDocument;
  label: string;
  value: string;
  x: number;
  y: number;
  theme: Theme;
  valueColor?: string;
  width?: number;
}

/**
 * Renderiza um campo "Label: Value" inline.
 * Retorna o Y após o campo para encadear chamadas.
 */
export function addField(opts: AddFieldOptions): number {
  const { doc, label, value, x, y, theme, valueColor, width } = opts;

  doc.save();
  doc.font(theme.fonts.bold)
    .fontSize(10)
    .fillColor(theme.colors.n500SlateGray)
    .text(`${label}: `, x, y, { continued: true, width });
  doc.font(theme.fonts.semibold)
    .fontSize(10)
    .fillColor(valueColor ?? theme.colors.n900Gunmetal)
    .text(value);
  doc.restore();

  return y + LAYOUT.FIELD_GAP;
}

// ─── Simple Section Title (brandBlue, bold) ──────────────────────────────────
export interface AddSimpleSectionTitleOptions {
  doc: PDFKit.PDFDocument;
  title: string;
  x: number;
  y: number;
  theme: Theme;
  fontSize?: number;
}

/**
 * Renderiza um título de seção simples em azul KINTO (sem barra lateral, sem número).
 * Retorna o Y após o título.
 */
export function addSimpleSectionTitle(opts: AddSimpleSectionTitleOptions): number {
  const { doc, title, x, y, theme, fontSize = 14 } = opts;

  doc.save();
  doc.font(theme.fonts.bold)
    .fontSize(fontSize)
    .fillColor(theme.colors.kintoBrandBlue)
    .text(title, x, y);
  doc.restore();

  return y + fontSize + 6;
}

// ─── Image (single, centered, with fit) ──────────────────────────────────────
export interface AddImageOptions {
  doc: PDFKit.PDFDocument;
  image: Buffer;
  x: number;
  y: number;
  fitWidth?: number;
  fitHeight?: number;
  align?: 'center' | 'right';
  valign?: 'center' | 'bottom';
}

/**
 * Insere uma imagem no PDF com fit automático.
 * Retorna o Y após a imagem (y + fitHeight usada).
 */
export function addImage(opts: AddImageOptions): number {
  const { doc, image, x, y } = opts;
  const fitWidth = opts.fitWidth ?? LAYOUT.IMAGE_FIT_WIDTH;
  const fitHeight = opts.fitHeight ?? LAYOUT.IMAGE_FIT_HEIGHT;
  const align = opts.align ?? 'center';
  const valign = opts.valign ?? 'center';

  doc.image(image, x, y, {
    fit: [fitWidth, fitHeight],
    align,
    valign,
  });

  return y + fitHeight;
}

// ─── Image Page (nova página com título + até N imagens empilhadas) ──────────
export interface AddImagePageOptions {
  doc: PDFKit.PDFDocument;
  images: Buffer[];
  title: string;
  theme: Theme;
  /** Se deve adicionar nova página (default: true) */
  newPage?: boolean;
  /** Y inicial se newPage=false */
  startY?: number;
  fitWidth?: number;
  fitHeight?: number;
  /** Espaço vertical entre imagens */
  imageGap?: number;
}

/**
 * Renderiza uma página de imagens: título + imagens empilhadas com fit.
 * Adiciona nova página por padrão. Para 2+ imagens por página, ajuste fitHeight.
 */
export function addImagePage(opts: AddImagePageOptions): void {
  const { doc, images, title, theme } = opts;
  const fitWidth = opts.fitWidth ?? LAYOUT.IMAGE_FIT_WIDTH;
  const fitHeight = opts.fitHeight ?? LAYOUT.IMAGE_FIT_HEIGHT;
  const imageGap = opts.imageGap ?? 20;

  if (opts.newPage !== false) {
    doc.addPage();
    addPageChromeSimple(doc, theme);
  }

  let y = opts.startY ?? LAYOUT.CONTENT_START_Y;

  // Título
  y = addSimpleSectionTitle({ doc, title, x: LAYOUT.MARGIN_LEFT, y, theme });
  y += 4;

  for (const image of images) {
    doc.image(image, LAYOUT.MARGIN_LEFT, y, {
      fit: [fitWidth, fitHeight],
      align: 'center',
      valign: 'center',
    });
    y += fitHeight + imageGap;
  }
}

// ─── Image List (múltiplas imagens, 2 por página) ────────────────────────────
export interface AddImageListOptions {
  doc: PDFKit.PDFDocument;
  images: Buffer[];
  title: string;
  theme: Theme;
  imagesPerPage?: number;
  fitWidth?: number;
  fitHeight?: number;
}

/**
 * Distribui imagens em múltiplas páginas (default: 2 por página).
 * Cada página recebe header chrome + título + imagens empilhadas.
 */
export function addImageList(opts: AddImageListOptions): void {
  const { doc, images, title, theme } = opts;
  const perPage = opts.imagesPerPage ?? 2;

  for (let i = 0; i < images.length; i += perPage) {
    const chunk = images.slice(i, i + perPage);
    addImagePage({
      doc,
      images: chunk,
      title,
      theme,
      newPage: true,
      fitWidth: opts.fitWidth,
      fitHeight: opts.fitHeight,
    });
  }
}

// ─── Page Chrome Simple (header + footer simples sem bufferedPages) ──────────
/**
 * Header simples: logo KINTO_SQ_BLUE + "KINTO" + linha azul.
 * Footer: linha cinza + "© KINTO MOBILITY".
 * Usado para páginas intermediárias (imagens, etc.).
 */
export function addPageChromeSimple(doc: PDFKit.PDFDocument, theme: Theme): void {
  const left = LAYOUT.MARGIN_LEFT;
  const right = LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN_RIGHT;
  const top = LAYOUT.HEADER_Y;

  doc.save();

  // Header
  try {
    const logoSvg = loadSvg('KINTO_SQ_BLUE');
    SVGtoPDF(doc, logoSvg, left, top + 1, { width: 14, height: 14 });
  } catch { /* SVG não disponível */ }

  doc.font(theme.fonts.semibold)
    .fontSize(11)
    .fillColor(theme.colors.kintoBrandBlue)
    .text('KINTO', left + 20, top + 2, { lineBreak: false });

  doc.moveTo(left, top + LAYOUT.HEADER_HEIGHT)
    .lineTo(right, top + LAYOUT.HEADER_HEIGHT)
    .lineWidth(1)
    .strokeColor(theme.colors.kintoBrandBlue)
    .stroke();

  // Footer
  const footerY = LAYOUT.PAGE_HEIGHT - LAYOUT.FOOTER_Y_OFFSET;
  doc.moveTo(left, footerY)
    .lineTo(right, footerY)
    .lineWidth(0.5)
    .strokeColor(theme.colors.n100LightGray)
    .stroke();

  doc.font(theme.fonts.bold)
    .fontSize(7)
    .fillColor(theme.colors.n400LightSlateGray)
    .text('© KINTO MOBILITY', left, footerY + 6, { lineBreak: false });

  doc.restore();
  doc.fillColor(theme.colors.n900Gunmetal);
}

// ─── Ensure Space or New Page ────────────────────────────────────────────────
export interface EnsureSpaceOptions {
  doc: PDFKit.PDFDocument;
  cursorY: number;
  requiredHeight: number;
  theme: Theme;
  bottomMargin?: number;
}

/**
 * Verifica se há espaço suficiente na página atual.
 * Se não houver, adiciona nova página com chrome e retorna o novo Y.
 */
export function ensureSpaceOrNewPage(opts: EnsureSpaceOptions): number {
  const { doc, cursorY, requiredHeight, theme } = opts;
  const bottomMargin = opts.bottomMargin ?? (LAYOUT.PAGE_HEIGHT - LAYOUT.FOOTER_Y_OFFSET - 10);

  if (cursorY + requiredHeight > bottomMargin) {
    doc.addPage();
    addPageChromeSimple(doc, theme);
    return LAYOUT.CONTENT_START_Y;
  }
  return cursorY;
}

// ─── Term/Clause Block ───────────────────────────────────────────────────────
export interface AddTermBlockOptions {
  doc: PDFKit.PDFDocument;
  title: string;
  status: 'accepted' | 'rejected' | 'unknown';
  statusLabels?: { accepted: string; rejected: string; unknown: string };
  clauses: string[];
  x: number;
  y: number;
  theme: Theme;
  width?: number;
}

/**
 * Renderiza um bloco de termo/contrato com status + cláusulas.
 * Retorna o Y final após todas as cláusulas.
 */
export function addTermBlock(opts: AddTermBlockOptions): number {
  const { doc, title, status, clauses, x, y, theme, width } = opts;
  const contentWidth = width ?? LAYOUT.CONTENT_WIDTH;
  const statusLabels = opts.statusLabels ?? { accepted: 'Aceito', rejected: 'Recusado', unknown: 'Não respondido' };

  let cursorY = y;

  // Title
  doc.save();
  doc.font(theme.fonts.bold)
    .fontSize(8)
    .fillColor(theme.colors.n500SlateGray)
    .text(title.toUpperCase(), x, cursorY, { characterSpacing: 0.6 });
  cursorY += 12;

  // Status
  const statusColor = status === 'accepted' ? theme.colors.success : theme.colors.error;
  const statusText = statusLabels[status];
  doc.font(theme.fonts.semibold)
    .fontSize(12)
    .fillColor(statusColor)
    .text(statusText, x, cursorY);
  cursorY += 20;

  // Clauses
  doc.font(theme.fonts.regular)
    .fontSize(7)
    .fillColor(theme.colors.n500SlateGray);
  for (const clause of clauses) {
    doc.text(clause, x, cursorY, { width: contentWidth });
    cursorY += LAYOUT.TERM_CLAUSE_GAP;
  }
  doc.restore();

  return cursorY;
}
