/**
 * KBR PDF Service — Desenho de texto (API legada de fallback de fonte).
 *
 * O serviço usa a Inter em todo o texto (theme.fonts), que cobre o pt-BR; não há mais troca de
 * fonte por trecho nem fator de escala. As funções são mantidas com as mesmas assinaturas para
 * não quebrar consumidores: `fallbackFont` é ignorado em `drawTextWithFallback`/`drawSegmentedText`
 * (usa-se sempre `font`) e `drawTextInFallbackFont` desenha com a fonte informada em escala 1.
 */

/** Sempre `false`: a fonte única (Inter) cobre os caracteres usados. */
export function textsNeedFallback(_texts: readonly string[]): boolean {
  return false;
}

/** Sempre `1`: não há diferença de métricas entre fonte principal e fallback. */
export function getFallbackSizeScale(): number {
  return 1;
}

/**
 * Desenha texto com `primaryFont` (o `fallbackFont` é ignorado). Aceita as mesmas `options` de
 * `PDFKit.Mixins.TextOptions`. Retorna `doc.y` ao final.
 */
export function drawTextWithFallback(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  primaryFont: string,
  _fallbackFont: string,
  fontSize: number,
  options?: PDFKit.Mixins.TextOptions,
): number {
  return drawSegmentedText(doc, [{ text, font: primaryFont, fallbackFont: _fallbackFont }], x, y, fontSize, options);
}

/** Desenha texto com `fallbackFont` no tamanho nominal (mantido por compatibilidade de API). */
export function drawTextInFallbackFont(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  fallbackFont: string,
  fontSize: number,
  options?: PDFKit.Mixins.TextOptions,
): number {
  doc.font(fallbackFont).fontSize(fontSize);
  doc.text(text, x, y, options);
  return doc.y;
}

export interface FallbackTextPart {
  /** Texto do trecho. */
  text: string;
  /** Fonte usada para este trecho. */
  font: string;
  /** Ignorado (fonte única); mantido por compatibilidade de API. */
  fallbackFont: string;
  /** Cor opcional aplicada a este trecho. */
  color?: string;
}

/**
 * Desenha múltiplos trechos encadeados na mesma linha (ex.: "Label: " em uma cor/fonte + "Valor"
 * em outra), cada um com sua `font` e `color`. `fontSize` é aplicado a todos os trechos.
 */
export function drawSegmentedText(
  doc: PDFKit.PDFDocument,
  parts: FallbackTextPart[],
  x: number,
  y: number,
  fontSize: number,
  options?: PDFKit.Mixins.TextOptions,
): number {
  parts.forEach((part, i) => {
    const isLast = i === parts.length - 1;
    // Com `options.width`, um trecho vazio não emite linha no PDFKit e `doc.y` não avança (bug
    // l2x34jp: rótulo sem valor sobrepunha a linha seguinte); um espaço não desenha glifo.
    const text = options?.width && part.text === '' ? ' ' : part.text;

    doc.font(part.font);
    doc.fontSize(fontSize);
    if (part.color) doc.fillColor(part.color);
    if (i === 0) {
      doc.text(text, x, y, { ...options, continued: !isLast });
    } else {
      doc.text(text, { continued: !isLast });
    }
  });

  const lastPart = parts[parts.length - 1];
  if (lastPart) doc.font(lastPart.font);
  doc.fontSize(fontSize);

  return doc.y;
}
