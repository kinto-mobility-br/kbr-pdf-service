/**
 * KBR PDF Service — Theme Kinto (cores, fontes, espaçamentos).
 * Fiel à identidade visual KINTO utilizada nos relatórios internos.
 */
import type { PdfMetadataField } from './types.js';

export const colors = {
  // Primária
  kintoBrandBlue: '#00708D',
  pacificBlue: '#59A2B5',
  silverSand: '#B5C0C7',
  lightBlue: '#A6CDD7',
  white: '#FFFFFF',

  // Neutras Dark
  n900Gunmetal: '#2C353B',
  n800Charcoal: '#3E4A52',
  n700BlackCoral: '#4C5D68',
  n600DarkElectricBlue: '#5C717E',

  // Neutras Mid
  n500SlateGray: '#69808F',
  n400LightSlateGray: '#8093A0',
  n300CadetGray: '#97A7B1',
  n200SilverSand: '#B5C0C7',

  // Neutras Light
  n100LightGray: '#D3D9DD',
  n50Cultured: '#EEEFF0',
  n25BgGray: '#F4F5F6',
  n0White: '#FFFFFF',

  // Semânticas
  primary: '#00708D',
  success: '#00A65E',
  warning: '#F7AD25',
  error: '#EF5A40',
  info: '#4A8FA3',
} as const;

export const fonts = {
  regular: 'toyota-regular',
  light: 'toyota-light',
  book: 'toyota-book',
  semibold: 'toyota-semibold',
  bold: 'toyota-bold',
  mono: 'Courier',
} as const;

/**
 * Fontes de fallback (Inter) registradas ao lado das Toyota Type, usadas
 * automaticamente por `drawTextWithFallback` (components/text-fallback.ts)
 * para os caracteres que a Toyota Type não suporta (ã, ç, õ, â, ê, ô, à).
 */
export const fallbackFonts = {
  regular: 'inter-regular',
  light: 'inter-light',
  book: 'inter-book',
  semibold: 'inter-semibold',
  bold: 'inter-bold',
} as const;

export const fontSizes = {
  coverTitle: 32,
  sectionTitle: 20,
  itemTitle: 13,
  cardHeading: 13,
  body: 10.5,
  bodyEmphasis: 11,
  labelCaps: 8,
  chrome: 9,
  chromeStrong: 11,
  metricBig: 24,
  filePath: 9,
  badge: 8,
  kicker: 9,
} as const;

export const spacing = {
  pageMarginTop: 48,
  pageMarginBottom: 48,
  pageMarginLeft: 56,
  pageMarginRight: 56,
  headerHeight: 32,
  footerHeight: 28,
  coverBlockGap: 28,
  itemCardGap: 12,
  cardPaddingDefault: 16,
  cardPaddingLarge: 20,
  cardPaddingSmall: 14,
  cardRadius: 4,
  badgeRadius: 999,
  pillRadius: 4,
} as const;

export const limits = {
  maxFieldChars: 5000,
  maxSummaryChars: 1500,
} as const;

/**
 * Aviso exibido de forma visível no documento (e nos metadados) sempre que
 * o PDF é gerado com senha de abertura (`config.openPassword`). Reforça que
 * o conteúdo é sensível e só deve ser compartilhado com quem tem permissão
 * de visualização.
 */
export const SENSITIVE_DOCUMENT_NOTICE =
  'Documento protegido por senha — contém informações sensíveis. Compartilhar apenas com pessoas autorizadas a visualizá-lo.';

export interface SeverityStyle {
  label: string;
  textColor: string;
  backgroundColor: string;
}

const SEVERITY_STYLES: Record<'high' | 'medium' | 'low', SeverityStyle> = {
  high: { label: 'HIGH', textColor: '#EF5A40', backgroundColor: '#FDE3DD' },
  medium: { label: 'MEDIUM', textColor: '#B97A0E', backgroundColor: '#FEF1D6' },
  low: { label: 'LOW', textColor: '#3A6F80', backgroundColor: '#E2EDF1' },
};

export function severityStyle(severity?: string): SeverityStyle {
  if (severity === 'high' || severity === 'medium' || severity === 'low') {
    return SEVERITY_STYLES[severity];
  }
  const literal = (severity ?? 'N/D').toString().toUpperCase();
  return {
    label: literal,
    textColor: colors.n600DarkElectricBlue,
    backgroundColor: colors.n50Cultured,
  };
}

export function severityColor(severity?: string): string {
  if (severity === 'high') return colors.error;
  if (severity === 'medium') return colors.warning;
  if (severity === 'low') return colors.info;
  return colors.n500SlateGray;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatReference(metadata: PdfMetadataField[] | undefined): string {
  if (!metadata || metadata.length === 0) {
    return new Date().toISOString().slice(0, 10);
  }
  const pr = metadata.find((m) => m.label.toUpperCase() === 'PR')?.value;
  const commit = metadata.find((m) => m.label.toUpperCase() === 'COMMIT')?.value;
  const shortCommit = commit ? commit.slice(0, 7) : undefined;

  if (pr && shortCommit) return `${pr} · ${shortCommit}`;
  if (pr) return pr;
  if (shortCommit) return shortCommit;

  return new Date().toISOString().slice(0, 10);
}

export const theme = {
  colors,
  fonts,
  fallbackFonts,
  fontSizes,
  spacing,
  limits,
  severityStyle,
  severityColor,
  truncate,
  formatReference,
  formatDate,
  SENSITIVE_DOCUMENT_NOTICE,
} as const;

export type Theme = typeof theme;
