import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as rootEntry from '../index.js';
import * as processingEntry from '../processing/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(__dirname, '../index.ts'), 'utf-8');

describe('separação de entry points (DA001)', () => {
  it('entry point raiz não exporta ImageCompressionService/PdfAttachmentService/rasterizePdfToJpegs', () => {
    expect((rootEntry as Record<string, unknown>).ImageCompressionService).toBeUndefined();
    expect((rootEntry as Record<string, unknown>).imageCompressionService).toBeUndefined();
    expect((rootEntry as Record<string, unknown>).PdfAttachmentService).toBeUndefined();
    expect((rootEntry as Record<string, unknown>).pdfAttachmentService).toBeUndefined();
    expect((rootEntry as Record<string, unknown>).rasterizePdfToJpegs).toBeUndefined();
  });

  it('entry point raiz continua exportando generatePdf', () => {
    expect(typeof rootEntry.generatePdf).toBe('function');
  });

  it('subpath ./processing continua exportando ImageCompressionService/PdfAttachmentService/rasterizePdfToJpegs', () => {
    expect(processingEntry.ImageCompressionService).toBeDefined();
    expect(processingEntry.imageCompressionService).toBeInstanceOf(processingEntry.ImageCompressionService);
    expect(processingEntry.PdfAttachmentService).toBeDefined();
    expect(typeof processingEntry.rasterizePdfToJpegs).toBe('function');
  });

  it('index.ts não importa sharp/mupdf estaticamente (guard textual)', () => {
    expect(indexSource).not.toMatch(/from ['"]sharp['"]/);
    expect(indexSource).not.toMatch(/from ['"]mupdf['"]/);
    expect(indexSource).not.toMatch(/from ['"]\.\/processing/);
  });
});
