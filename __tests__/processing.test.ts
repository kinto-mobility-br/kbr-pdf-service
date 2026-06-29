import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  ImageCompressionService,
  imageCompressionService,
  PdfAttachmentService,
  pdfAttachmentService,
  rasterizePdfToJpegs,
} from '../processing/index.js';

const PDF_PREFIX = '%PDF-1.';

/**
 * Cria um PDF simples de uma página com texto para usar nos testes.
 */
async function createSimplePdf(text: string = 'Test page'): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  page.drawText(text, { x: 50, y: 750, size: 14 });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/**
 * Cria uma imagem JPEG simples (1x1 pixel vermelho) para testes.
 */
function createMinimalJpeg(): Buffer {
  // Minimal JPEG: 1x1 red pixel
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
    0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
    0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
    0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
    0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3f, 0x00, 0x7b, 0x94, 0x11, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

// ─── ImageCompressionService ───────────────────────────────────────────────────

describe('ImageCompressionService', () => {
  it('exporta instância singleton', () => {
    expect(imageCompressionService).toBeInstanceOf(ImageCompressionService);
  });

  it('comprime uma imagem JPEG sem erro', async () => {
    const jpeg = createMinimalJpeg();
    const result = await imageCompressionService.compressImage(jpeg, 'image/jpeg');

    expect(result.originalSize).toBe(jpeg.length);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.format).toBe('image/jpeg');
    expect(result.compressionRatio).toBeTypeOf('number');
  });

  it('retorna imagem original se compressão falhar (buffer inválido)', async () => {
    const garbage = Buffer.from('not an image at all');
    const result = await imageCompressionService.compressImage(garbage, 'image/jpeg');

    expect(result.buffer).toEqual(garbage);
    expect(result.compressionRatio).toBe(0);
    expect(result.format).toBe('image/jpeg');
  });

  it('compressBatch processa múltiplas imagens em paralelo', async () => {
    const jpeg = createMinimalJpeg();
    const results = await imageCompressionService.compressBatch([
      { buffer: jpeg, contentType: 'image/jpeg', nome: 'foto1.jpg' },
      { buffer: jpeg, contentType: 'image/jpeg', nome: 'foto2.jpg' },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].nome).toBe('foto1.jpg');
    expect(results[1].nome).toBe('foto2.jpg');
    expect(results[0].compressionInfo.buffer).toBeInstanceOf(Buffer);
  });

  it('shouldCompress retorna true para buffer > targetSize', () => {
    const big = Buffer.alloc(600 * 1024); // 600 KB
    expect(imageCompressionService.shouldCompress(big)).toBe(true);
  });

  it('shouldCompress retorna false para buffer < targetSize', () => {
    const small = Buffer.alloc(100 * 1024); // 100 KB
    expect(imageCompressionService.shouldCompress(small)).toBe(false);
  });

  it('estimatePdfSize calcula overhead corretamente', () => {
    const images = [
      { buffer: Buffer.alloc(200 * 1024) },
      { buffer: Buffer.alloc(300 * 1024) },
    ];
    const estimate = imageCompressionService.estimatePdfSize(images);
    // 500 KB images + 15% overhead + 100 KB metadata
    expect(estimate).toBeGreaterThan(500 * 1024);
    expect(estimate).toBeLessThan(700 * 1024);
  });
});

// ─── PdfAttachmentService ──────────────────────────────────────────────────────

describe('PdfAttachmentService', () => {
  it('exporta instância singleton', () => {
    expect(pdfAttachmentService).toBeInstanceOf(PdfAttachmentService);
  });

  it('analyzeBasicPdfInfo detecta PDF válido', async () => {
    const pdf = await createSimplePdf('test');
    const info = pdfAttachmentService.analyzeBasicPdfInfo(pdf);

    expect(info.isPdf).toBe(true);
    expect(info.hasValidHeader).toBe(true);
    expect(info.sizeKB).toBeGreaterThan(0);
  });

  it('analyzeBasicPdfInfo detecta buffer não-PDF', () => {
    const notPdf = Buffer.from('Hello World');
    const info = pdfAttachmentService.analyzeBasicPdfInfo(notPdf);

    expect(info.isPdf).toBe(false);
    expect(info.hasValidHeader).toBe(false);
  });

  it('rasterizePdfToJpegs converte PDF em array de JPEGs', async () => {
    const pdf = await createSimplePdf('Rasterize me');
    const jpegs = await rasterizePdfToJpegs(pdf);

    expect(jpegs).toHaveLength(1);
    expect(jpegs[0]).toBeInstanceOf(Buffer);
    // JPEG magic bytes: FF D8 FF
    expect(jpegs[0][0]).toBe(0xff);
    expect(jpegs[0][1]).toBe(0xd8);
    expect(jpegs[0][2]).toBe(0xff);
  });

  it('rasterizePdfToJpegs gera um JPEG por página', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.addPage([595, 842]);
    doc.addPage([595, 842]);
    const multiPagePdf = Buffer.from(await doc.save());

    const jpegs = await rasterizePdfToJpegs(multiPagePdf);
    expect(jpegs).toHaveLength(3);
  });

  it('lança erro claro quando PDF não pode ser aberto', async () => {
    const garbage = Buffer.from('not a pdf at all');

    await expect(rasterizePdfToJpegs(garbage)).rejects.toThrow();
  });
});
