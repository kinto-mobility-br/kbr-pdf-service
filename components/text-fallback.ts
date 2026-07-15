/**
 * KBR PDF Service — Fallback de fonte por trecho de texto.
 *
 * A fonte Toyota Type (assets/fonts/Toyota-Type-*.ttf) não possui glifos para
 * alguns caracteres usados em português (confirmado via fontkit: ã, ç, õ, â,
 * ê, ô, à — maiúsculas e minúsculas — e também o travessão —). Como grande
 * parte do conteúdo dos relatórios é em português, este módulo permite
 * desenhar texto trocando automaticamente para uma fonte de fallback (Inter)
 * apenas nos trechos que a Toyota Type não suporta, mantendo o restante do
 * texto na fonte de marca.
 *
 * IMPORTANTE: a troca é feita por TRECHO inteiro (cada `text`/`FallbackTextPart`
 * passado pelo chamador), não por caractere isolado. Toyota Type e Inter têm
 * métricas muito diferentes (unitsPerEm 1000 vs 2048, ascent/x-height em
 * proporções distintas) — trocar de fonte no meio de uma palavra causa
 * desalinhamento vertical visível (ex.: "informações" com o "çõ" flutuando
 * acima da linha de base). Ao trocar o trecho inteiro (a palavra/frase
 * completa), cada chamada a `doc.text()` usa uma única fonte, evitando esse
 * salto — o "custo" é que uma palavra inteira comuta para Inter mesmo que só
 * uma letra dela precise, o que é visualmente muito mais coeso do que uma
 * mistura de fontes dentro da mesma palavra.
 *
 * A checagem de suporte é feita dinamicamente com `fontkit` (consultando os
 * glifos reais da fonte registrada), em vez de uma lista fixa — assim
 * qualquer caractere ausente (não só os já conhecidos) é coberto
 * automaticamente. Não modifica nenhum arquivo de fonte.
 */
import { create as createFontkitFont, type Font } from 'fontkit';
import { loadFont, loadFallbackFont } from '../assets-loader.js';

let toyotaFont: Font | undefined;
let interFont: Font | undefined;

function getToyotaFont(): Font {
  if (!toyotaFont) {
    // Todos os pesos da família compartilham o mesmo charset (confirmado via
    // teste); usar o peso "regular" como referência é suficiente. O arquivo
    // é um único font file (não uma coleção .ttc), por isso o cast é seguro.
    toyotaFont = createFontkitFont(loadFont('regular')) as Font;
  }
  return toyotaFont;
}

function getInterFont(): Font {
  if (!interFont) {
    interFont = createFontkitFont(loadFallbackFont('regular')) as Font;
  }
  return interFont;
}

const glyphSupportCache = new Map<number, boolean>();

/** Verifica (com cache) se a Toyota Type possui glifo para o caractere. */
function toyotaSupportsChar(char: string): boolean {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return true;

  const cached = glyphSupportCache.get(codePoint);
  if (cached !== undefined) return cached;

  const supported = getToyotaFont().hasGlyphForCodePoint(codePoint);
  glyphSupportCache.set(codePoint, supported);
  return supported;
}

/** Indica se algum caractere do texto não é suportado pela Toyota Type. */
function textNeedsFallback(text: string): boolean {
  for (const char of text) {
    if (!toyotaSupportsChar(char)) return true;
  }
  return false;
}

let fallbackSizeScale: number | undefined;

/**
 * A Toyota Type (unitsPerEm 1000) e a Inter (unitsPerEm 2048) têm proporções
 * de x-height diferentes (~0.50 vs ~0.55 do em size). Sem correção, o texto
 * renderizado na fonte de fallback (Inter) aparece um pouco maior do que o
 * texto ao redor na Toyota Type. Este fator (calculado dinamicamente via
 * fontkit, a partir das métricas reais das fontes registradas) é aplicado ao
 * `fontSize` apenas nos trechos de fallback, para equalizar o tamanho
 * aparente das letras minúsculas.
 */
function getFallbackSizeScale(): number {
  if (fallbackSizeScale === undefined) {
    const toyota = getToyotaFont();
    const inter = getInterFont();
    const toyotaXHeightRatio = toyota.xHeight / toyota.unitsPerEm;
    const interXHeightRatio = inter.xHeight / inter.unitsPerEm;
    fallbackSizeScale = toyotaXHeightRatio / interXHeightRatio;
  }
  return fallbackSizeScale;
}

/**
 * Desenha texto usando `primaryFont`, trocando para `fallbackFont` (com
 * tamanho equalizado) quando o texto inteiro contém algum caractere não
 * suportado pela fonte principal. Aceita as mesmas `options` de
 * `PDFKit.Mixins.TextOptions` (width, lineGap, characterSpacing, etc.).
 * Retorna `doc.y` ao final (posição após o texto desenhado).
 */
export function drawTextWithFallback(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  primaryFont: string,
  fallbackFont: string,
  fontSize: number,
  options?: PDFKit.Mixins.TextOptions,
): number {
  return drawSegmentedText(doc, [{ text, font: primaryFont, fallbackFont }], x, y, fontSize, options);
}

export interface FallbackTextPart {
  /** Texto do trecho. */
  text: string;
  /** Fonte principal (marca) para este trecho. */
  font: string;
  /** Fonte de fallback usada quando o trecho contém caractere não suportado por `font`. */
  fallbackFont: string;
  /** Cor opcional aplicada a este trecho (mantida ao trocar de fonte). */
  color?: string;
}

/**
 * Como `drawTextWithFallback`, mas permite múltiplos trechos encadeados na
 * mesma linha (ex.: "Label: " em uma cor/fonte + "Valor" em outra),
 * preservando o fallback de glifo em cada trecho — cada `part` troca para
 * `fallbackFont` inteiramente caso contenha algum caractere não suportado
 * (ver nota do módulo sobre por que a troca é por trecho, não por
 * caractere). Útil para campos "label: value" e blocos com estilos mistos.
 * `fontSize` é o tamanho nominal do texto (aplicado aos trechos na fonte
 * principal; os trechos de fallback recebem `fontSize *
 * getFallbackSizeScale()` para compensar a diferença de métricas entre as
 * fontes).
 */
export function drawSegmentedText(
  doc: PDFKit.PDFDocument,
  parts: FallbackTextPart[],
  x: number,
  y: number,
  fontSize: number,
  options?: PDFKit.Mixins.TextOptions,
): number {
  const fallbackFontSize = fontSize * getFallbackSizeScale();

  parts.forEach((part, i) => {
    const isLast = i === parts.length - 1;
    const needsFallback = textNeedsFallback(part.text);

    doc.font(needsFallback ? part.fallbackFont : part.font);
    doc.fontSize(needsFallback ? fallbackFontSize : fontSize);
    if (part.color) doc.fillColor(part.color);
    if (i === 0) {
      doc.text(part.text, x, y, { ...options, continued: !isLast });
    } else {
      doc.text(part.text, { continued: !isLast });
    }
  });

  // Restaura a fonte e o fontSize nominais (o último trecho pode ter ficado
  // com a fonte/tamanho de fallback) para não afetar chamadas subsequentes
  // de quem já espera o `font`/`fontSize` originais ainda ativos no doc.
  const lastPart = parts[parts.length - 1];
  if (lastPart) doc.font(lastPart.font);
  doc.fontSize(fontSize);

  return doc.y;
}
