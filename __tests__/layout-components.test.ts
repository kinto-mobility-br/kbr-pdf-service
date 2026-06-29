import { describe, it, expect } from 'vitest';
import PDFDocument from 'pdfkit';
import { loadFont } from '../assets-loader.js';
import { theme } from '../theme.js';
import {
  LAYOUT,
  addField,
  addSimpleSectionTitle,
  addImage,
  addImagePage,
  addImageList,
  addPageChromeSimple,
  ensureSpaceOrNewPage,
  addTermBlock,
} from '../components/layout.js';

const PDF_PREFIX = '%PDF-1.';

/** Helper: cria um PDFDocument configurado e retorna o buffer final. */
function createTestDoc(): { doc: PDFKit.PDFDocument; getBuffer: () => Promise<Buffer> } {
  const doc = new PDFDocument({ size: 'A4', margin: 30 });

  doc.registerFont(theme.fonts.regular, loadFont('regular'));
  doc.registerFont(theme.fonts.light, loadFont('light'));
  doc.registerFont(theme.fonts.book, loadFont('book'));
  doc.registerFont(theme.fonts.semibold, loadFont('semibold'));
  doc.registerFont(theme.fonts.bold, loadFont('bold'));
  doc.font(theme.fonts.regular);

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const getBuffer = (): Promise<Buffer> =>
    new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.end();
    });

  return { doc, getBuffer };
}

/** Gera um PNG 1x1 pixel mínimo para testes de imagem. */
function createMinimalPng(): Buffer {
  // PNG 1x1 pixel transparente (67 bytes)
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
}

describe('components/layout', () => {
  describe('LAYOUT constants', () => {
    it('define margens e dimensões padrão', () => {
      expect(LAYOUT.MARGIN_LEFT).toBe(56);
      expect(LAYOUT.MARGIN_RIGHT).toBe(56);
      expect(LAYOUT.CONTENT_WIDTH).toBe(483);
      expect(LAYOUT.IMAGE_FIT_WIDTH).toBe(483);
      expect(LAYOUT.IMAGE_FIT_HEIGHT).toBe(340);
    });
  });

  describe('addField', () => {
    it('renderiza campo e retorna Y incrementado', async () => {
      const { doc, getBuffer } = createTestDoc();
      const y = addField({
        doc, label: 'Placa', value: 'ABC-1234',
        x: LAYOUT.MARGIN_LEFT, y: 100, theme,
      });
      expect(y).toBe(100 + LAYOUT.FIELD_GAP);
      const buffer = await getBuffer();
      expect(buffer.subarray(0, PDF_PREFIX.length).toString()).toBe(PDF_PREFIX);
    });

    it('aceita valueColor customizada', async () => {
      const { doc, getBuffer } = createTestDoc();
      const y = addField({
        doc, label: 'Status', value: 'Ativo',
        x: LAYOUT.MARGIN_LEFT, y: 100, theme,
        valueColor: '#00A65E',
      });
      expect(y).toBe(108);
      const buffer = await getBuffer();
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('addSimpleSectionTitle', () => {
    it('renderiza título e retorna Y incrementado', async () => {
      const { doc, getBuffer } = createTestDoc();
      const y = addSimpleSectionTitle({
        doc, title: 'Dados do Cliente',
        x: LAYOUT.MARGIN_LEFT, y: 50, theme,
      });
      expect(y).toBe(50 + 14 + 6); // fontSize(14) + 6
      const buffer = await getBuffer();
      expect(buffer.subarray(0, PDF_PREFIX.length).toString()).toBe(PDF_PREFIX);
    });

    it('aceita fontSize customizado', async () => {
      const { doc, getBuffer } = createTestDoc();
      const y = addSimpleSectionTitle({
        doc, title: 'Título Grande',
        x: LAYOUT.MARGIN_LEFT, y: 50, theme,
        fontSize: 20,
      });
      expect(y).toBe(50 + 20 + 6);
      await getBuffer();
    });
  });

  describe('addImage', () => {
    it('insere imagem e retorna Y deslocado pelo fitHeight', async () => {
      const { doc, getBuffer } = createTestDoc();
      const png = createMinimalPng();
      const y = addImage({
        doc, image: png,
        x: LAYOUT.MARGIN_LEFT, y: 100,
        fitWidth: 200, fitHeight: 150,
      });
      expect(y).toBe(100 + 150);
      const buffer = await getBuffer();
      expect(buffer.subarray(0, PDF_PREFIX.length).toString()).toBe(PDF_PREFIX);
    });

    it('usa defaults de LAYOUT quando não especificado', async () => {
      const { doc, getBuffer } = createTestDoc();
      const png = createMinimalPng();
      const y = addImage({ doc, image: png, x: 56, y: 50 });
      expect(y).toBe(50 + LAYOUT.IMAGE_FIT_HEIGHT);
      await getBuffer();
    });
  });

  describe('addImagePage', () => {
    it('adiciona página com título e imagens', async () => {
      const { doc, getBuffer } = createTestDoc();
      const png = createMinimalPng();
      addImagePage({
        doc, images: [png, png], title: 'Fotos do Veículo', theme,
      });
      const buffer = await getBuffer();
      expect(buffer.subarray(0, PDF_PREFIX.length).toString()).toBe(PDF_PREFIX);
    });

    it('pode ser chamado sem nova página (newPage=false)', async () => {
      const { doc, getBuffer } = createTestDoc();
      const png = createMinimalPng();
      addImagePage({
        doc, images: [png], title: 'Foto', theme,
        newPage: false, startY: 200,
      });
      const buffer = await getBuffer();
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('addImageList', () => {
    it('distribui imagens em múltiplas páginas', async () => {
      const { doc, getBuffer } = createTestDoc();
      const png = createMinimalPng();
      addImageList({
        doc, images: [png, png, png, png, png], title: 'Galeria', theme,
        imagesPerPage: 2,
      });
      const buffer = await getBuffer();
      expect(buffer.subarray(0, PDF_PREFIX.length).toString()).toBe(PDF_PREFIX);
    });
  });

  describe('addPageChromeSimple', () => {
    it('renderiza header e footer sem erro', async () => {
      const { doc, getBuffer } = createTestDoc();
      addPageChromeSimple(doc, theme);
      const buffer = await getBuffer();
      expect(buffer.subarray(0, PDF_PREFIX.length).toString()).toBe(PDF_PREFIX);
    });
  });

  describe('ensureSpaceOrNewPage', () => {
    it('retorna mesmo Y quando há espaço', () => {
      const { doc } = createTestDoc();
      const y = ensureSpaceOrNewPage({
        doc, cursorY: 100, requiredHeight: 50, theme,
      });
      expect(y).toBe(100);
    });

    it('adiciona nova página quando não há espaço', async () => {
      const { doc, getBuffer } = createTestDoc();
      const y = ensureSpaceOrNewPage({
        doc, cursorY: 800, requiredHeight: 100, theme,
      });
      expect(y).toBe(LAYOUT.CONTENT_START_Y);
      await getBuffer();
    });
  });

  describe('addTermBlock', () => {
    it('renderiza bloco de termos e retorna Y final', async () => {
      const { doc, getBuffer } = createTestDoc();
      const clauses = [
        'Cláusula 1: O responsável assume total responsabilidade.',
        'Cláusula 2: O veículo deve ser devolvido no mesmo estado.',
      ];
      const y = addTermBlock({
        doc, title: 'Termo de Responsabilidade',
        status: 'accepted', clauses,
        x: LAYOUT.MARGIN_LEFT, y: 100, theme,
      });
      expect(y).toBeGreaterThan(100 + 32); // title + status + clauses
      const buffer = await getBuffer();
      expect(buffer.subarray(0, PDF_PREFIX.length).toString()).toBe(PDF_PREFIX);
    });

    it('renderiza status rejected com cor de erro', async () => {
      const { doc, getBuffer } = createTestDoc();
      const y = addTermBlock({
        doc, title: 'Termo', status: 'rejected',
        clauses: ['Recusado pelo representante.'],
        x: LAYOUT.MARGIN_LEFT, y: 50, theme,
      });
      expect(y).toBeGreaterThan(50);
      await getBuffer();
    });
  });
});
