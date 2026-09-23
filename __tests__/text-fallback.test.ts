import { describe, it, expect, vi } from 'vitest';
import PDFDocument from 'pdfkit';
import { loadFont, loadFallbackFont } from '../assets-loader.js';
import { drawTextWithFallback, drawTextInFallbackFont, drawSegmentedText } from '../components/text-fallback.js';

const PRIMARY_FONT = 'Primary';
const FALLBACK_FONT = 'Fallback';

function createTestDoc(): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 30 });
  doc.registerFont(PRIMARY_FONT, loadFont('regular'));
  doc.registerFont(FALLBACK_FONT, loadFallbackFont('regular'));
  doc.on('data', () => {});
  return doc;
}

describe('components/text-fallback — drawTextInFallbackFont', () => {
  it('VER001 - usa sempre a fonte de fallback, mesmo para texto sem diacritico (ao contrario de drawTextWithFallback)', () => {
    const doc = createTestDoc();
    const fontSpy = vi.spyOn(doc, 'font');

    // Texto 100% ASCII: drawTextWithFallback manteria a fonte primaria aqui.
    drawTextInFallbackFont(doc, 'PROMOCODE - 50% Desconto', 10, 10, FALLBACK_FONT, 10);

    expect(fontSpy).toHaveBeenCalledWith(FALLBACK_FONT);
    expect(fontSpy).not.toHaveBeenCalledWith(PRIMARY_FONT);
    doc.end();
  });

  it('VER002 (regressao) - drawTextWithFallback mantem a fonte primaria para texto sem diacritico', () => {
    const doc = createTestDoc();
    const fontSpy = vi.spyOn(doc, 'font');

    drawTextWithFallback(doc, 'PROMOCODE - 50% Desconto', 10, 10, PRIMARY_FONT, FALLBACK_FONT, 10);

    expect(fontSpy).toHaveBeenCalledWith(PRIMARY_FONT);
    expect(fontSpy).not.toHaveBeenCalledWith(FALLBACK_FONT);
    doc.end();
  });

  it('VER003 - equaliza o tamanho da fonte de fallback (mesmo fator usado por drawTextWithFallback)', () => {
    const doc = createTestDoc();
    const fontSizeSpy = vi.spyOn(doc, 'fontSize');

    drawTextWithFallback(doc, 'Locação acima de 15 dias', 10, 10, PRIMARY_FONT, FALLBACK_FONT, 10);
    const scaledSizeFromExistingFallback = fontSizeSpy.mock.calls.find((call) => call[0] !== 10)?.[0];
    fontSizeSpy.mockClear();

    drawTextInFallbackFont(doc, 'PROMOCODE - 50% Desconto', 10, 30, FALLBACK_FONT, 10);
    const scaledSizeFromForcedFallback = fontSizeSpy.mock.calls[0]?.[0];

    expect(scaledSizeFromForcedFallback).toBe(scaledSizeFromExistingFallback);
    doc.end();
  });
});

describe('components/text-fallback — drawSegmentedText com último trecho vazio', () => {
  it('BUG-l2x34jp - avança doc.y na mesma altura de um trecho preenchido, mesmo quando o valor (último part) é string vazia', () => {
    const doc = createTestDoc();
    const startY = 100;

    const afterWithValue = drawSegmentedText(
      doc,
      [
        { text: 'Endereço: ', font: PRIMARY_FONT, fallbackFont: FALLBACK_FONT },
        { text: 'Rua Teste, 123', font: PRIMARY_FONT, fallbackFont: FALLBACK_FONT },
      ],
      10,
      startY,
      9,
      { width: 200 },
    );

    const afterEmptyValue = drawSegmentedText(
      doc,
      [
        { text: 'Bairro: ', font: PRIMARY_FONT, fallbackFont: FALLBACK_FONT },
        { text: '', font: PRIMARY_FONT, fallbackFont: FALLBACK_FONT },
      ],
      10,
      startY,
      9,
      { width: 200 },
    );

    // Sintoma real: quando o valor é vazio, doc.y não avança (fica igual a
    // startY), então a linha seguinte é desenhada sobre esta (overlap visual).
    expect(afterEmptyValue).toBeGreaterThan(startY);
    expect(afterEmptyValue).toBe(afterWithValue);
    doc.end();
  });
});
