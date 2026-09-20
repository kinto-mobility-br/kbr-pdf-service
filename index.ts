/**
 * KBR PDF Service — Serviço genérico de geração de PDF com branding KINTO.
 *
 * Mantém fiel ao template: cores KINTO, header com logo KINTO_SQ_BLUE,
 * cover com logo KINTO_BLUE, footer com paginação, fontes Toyota Type.
 *
 * Uso:
 *   import { generatePdf } from './services/kbr-pdf-service/index.js';
 *   const buffer = await generatePdf({ ... });
 */
import { buildPdf } from './pdf-builder.js';
import { theme as defaultTheme } from './theme.js';
import type { Theme } from './theme.js';
import type { PdfReportInput } from './types.js';

export type {
  PdfReportInput,
  PdfReportConfig,
  PdfSection,
  PdfSectionItem,
  PdfTable,
  PdfTableColumn,
  PdfTableRow,
  PdfMetadataField,
  PdfOverviewCard,
} from './types.js';

export { theme, colors, fonts, fallbackFonts, fontSizes, spacing, SENSITIVE_DOCUMENT_NOTICE } from './theme.js';
export type { Theme } from './theme.js';

// Componentes de layout reutilizáveis (API de composição)
export {
  LAYOUT,
  addField,
  addSimpleSectionTitle,
  addImage,
  addImagePage,
  addImageList,
  addPageChromeSimple,
  ensureSpaceOrNewPage,
  addTermBlock,
} from './components/layout.js';
export type {
  AddFieldOptions,
  AddSimpleSectionTitleOptions,
  AddImageOptions,
  AddImagePageOptions,
  AddImageListOptions,
  EnsureSpaceOptions,
  AddTermBlockOptions,
} from './components/layout.js';

// Re-export lower-level components
export { drawCard } from './components/card.js';
export { drawSeverityBadge, drawFilePathBadge } from './components/badge.js';
export { drawSectionTitle } from './components/section-title.js';
export { drawTextWithFallback, drawSegmentedText } from './components/text-fallback.js';
export type { FallbackTextPart } from './components/text-fallback.js';
export { loadFont, loadFallbackFont, loadSvg } from './assets-loader.js';

// `ImageCompressionService`/`PdfAttachmentService`/`rasterizePdfToJpegs` vivem só em
// './processing/index.js' (import '@kbr/pdf-service/processing') — mantém `sharp`/`mupdf`
// fora do grafo de módulos de quem só precisa de `generatePdf`.

/**
 * Overrides pontuais de layout (espaçamento/tamanho de fonte) mesclados por
 * cima do theme padrão — nunca o theme inteiro, para não exigir que quem
 * chame reconstrua cores/fontes/etc. só para ajustar densidade do relatório.
 *
 * Restrito aos campos usados exclusivamente pelos cards de item/tabela
 * (nunca pela capa) — `cardPaddingLarge`/`cardPaddingSmall`/`fontSizes.metricBig`
 * etc. também controlam a capa (resumo/overview cards); reduzi-los encolhe o
 * espaço reservado ali e pode empurrar texto além da margem inferior,
 * disparando a paginação automática silenciosa do pdfkit (páginas extras em
 * branco/quebradas no meio da capa).
 */
export interface PdfThemeOverrides {
  spacing?: Pick<Theme['spacing'], 'itemCardGap' | 'itemRowGap' | 'cardPaddingDefault' | 'dividerGap'>;
  fontSizes?: Pick<Theme['fontSizes'], 'body' | 'itemTitle'>;
}

/**
 * Gera um PDF com branding KINTO a partir de um input genérico.
 * Retorna o Buffer do PDF pronto para gravação em disco ou envio por e-mail.
 */
export async function generatePdf(input: PdfReportInput, themeOverrides?: PdfThemeOverrides): Promise<Buffer> {
  if (input === null || input === undefined) {
    throw new Error('PdfReportInput é obrigatório');
  }

  const hasSummary = typeof input.summary === 'string' && input.summary.trim().length > 0;
  const hasSections = (input.sections ?? []).some((s) => (s.items?.length ?? 0) > 0 || (s.table?.rows.length ?? 0) > 0);

  if (!hasSummary && !hasSections) {
    throw new Error('PdfReportInput não contém conteúdo para renderizar (summary ou sections)');
  }

  if (!themeOverrides) return buildPdf(input);

  const theme: Theme = {
    ...defaultTheme,
    spacing: { ...defaultTheme.spacing, ...themeOverrides.spacing },
    fontSizes: { ...defaultTheme.fontSizes, ...themeOverrides.fontSizes },
  };
  return buildPdf(input, theme);
}
