import sharp from 'sharp';

/**
 * Configurações padrão para compressão de imagens otimizadas para PDF.
 */
const DEFAULT_CONFIG = {
  maxWidth: 1200,
  maxHeight: 1600,
  jpegQuality: 80,
  pngCompressionLevel: 8,
  targetMaxSizeKb: 500,
};

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'auto';
}

export interface CompressionResult {
  buffer: Buffer;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: string;
}

export class ImageCompressionService {
  /**
   * Comprime uma única imagem mantendo proporção e otimizando para PDF.
   * Em caso de erro, retorna a imagem original sem compressão.
   */
  async compressImage(
    imageBuffer: Buffer,
    contentType: string,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const originalSize = imageBuffer.length;

    try {
      const maxWidth = options.maxWidth || DEFAULT_CONFIG.maxWidth;
      const maxHeight = options.maxHeight || DEFAULT_CONFIG.maxHeight;
      const quality = options.quality || DEFAULT_CONFIG.jpegQuality;

      let outputFormat = options.format || 'auto';
      if (outputFormat === 'auto') {
        outputFormat = contentType.includes('png') ? 'png' : 'jpeg';
      }

      let sharpInstance = sharp(imageBuffer);

      const metadata = await sharpInstance.metadata();
      const needsResize =
        (metadata.width && metadata.width > maxWidth) ||
        (metadata.height && metadata.height > maxHeight);

      if (needsResize) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      let compressedBuffer: Buffer;
      let finalFormat: string;

      if (outputFormat === 'jpeg') {
        compressedBuffer = await sharpInstance
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        finalFormat = 'image/jpeg';
      } else if (outputFormat === 'png') {
        compressedBuffer = await sharpInstance
          .png({ compressionLevel: DEFAULT_CONFIG.pngCompressionLevel })
          .toBuffer();
        finalFormat = 'image/png';
      } else if (outputFormat === 'webp') {
        compressedBuffer = await sharpInstance.webp({ quality }).toBuffer();
        finalFormat = 'image/webp';
      } else {
        compressedBuffer = await sharpInstance
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        finalFormat = 'image/jpeg';
      }

      const compressedSize = compressedBuffer.length;
      const compressionRatio =
        ((originalSize - compressedSize) / originalSize) * 100;

      return {
        buffer: compressedBuffer,
        originalSize,
        compressedSize,
        compressionRatio,
        format: finalFormat,
      };
    } catch {
      return {
        buffer: imageBuffer,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
        format: contentType,
      };
    }
  }

  /**
   * Comprime múltiplas imagens em paralelo.
   */
  async compressBatch(
    images: Array<{ buffer: Buffer; contentType: string; nome: string }>,
    options: CompressionOptions = {}
  ): Promise<
    Array<{
      buffer: Buffer;
      contentType: string;
      nome: string;
      compressionInfo: CompressionResult;
    }>
  > {
    const results = await Promise.all(
      images.map(async (img) => {
        const compressionInfo = await this.compressImage(
          img.buffer,
          img.contentType,
          options
        );
        return {
          buffer: compressionInfo.buffer,
          contentType: compressionInfo.format,
          nome: img.nome,
          compressionInfo,
        };
      })
    );

    return results;
  }

  /**
   * Verifica se uma imagem excede o tamanho alvo e precisa de compressão.
   */
  shouldCompress(
    imageBuffer: Buffer,
    targetSizeKb: number = DEFAULT_CONFIG.targetMaxSizeKb
  ): boolean {
    const sizeKb = imageBuffer.length / 1024;
    return sizeKb > targetSizeKb;
  }

  /**
   * Estima o tamanho do PDF com as imagens (incluindo overhead de metadados).
   */
  estimatePdfSize(images: Array<{ buffer: Buffer }>): number {
    const totalImageSize = images.reduce(
      (sum, img) => sum + img.buffer.length,
      0
    );
    const overhead = totalImageSize * 0.15 + 100 * 1024;
    return totalImageSize + overhead;
  }
}

export const imageCompressionService = new ImageCompressionService();
