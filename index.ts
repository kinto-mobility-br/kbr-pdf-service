/**
 * KBR PDF Service — Serviço genérico de geração de PDF com branding KINTO.
 *
 * Mantém fiel ao template: cores KINTO, header com logo KINTO_SQ_BLUE,
 * cover com logo KINTO_BLUE, footer com paginação, fontes Inter.
 *
 * Uso:
 *   import { generatePdf } from './services/kbr-pdf-service/index.js';
 *   const buffer = await generatePdf({ ... });
 */
import { buildPdf } from './pdf-builder.js';
import type { PdfReportInput } from './types.js';

export type {
  PdfReportInput,
  PdfReportConfig,
  PdfSection,
  PdfSectionItem,
  PdfMetadataField,
  PdfOverviewCard,
} from './types.js';

export { theme, colors, fonts, fontSizes, spacing } from './theme.js';
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
export { loadFont, loadSvg } from './assets-loader.js';

// Processing — image compression, PDF rasterization
export {
  ImageCompressionService,
  imageCompressionService,
  PdfAttachmentService,
  pdfAttachmentService,
  rasterizePdfToJpegs,
} from './processing/index.js';
export type {
  CompressionOptions,
  CompressionResult,
} from './processing/index.js';

/**
 * Gera um PDF com branding KINTO a partir de um input genérico.
 * Retorna o Buffer do PDF pronto para gravação em disco ou envio por e-mail.
 */
export async function generatePdf(input: PdfReportInput): Promise<Buffer> {
  if (input === null || input === undefined) {
    throw new Error('PdfReportInput é obrigatório');
  }

  const hasSummary = typeof input.summary === 'string' && input.summary.trim().length > 0;
  const hasSections = (input.sections ?? []).some((s) => s.items.length > 0);

  if (!hasSummary && !hasSections) {
    throw new Error('PdfReportInput não contém conteúdo para renderizar (summary ou sections)');
  }

  return buildPdf(input);
}
