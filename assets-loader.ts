import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export type FontWeight = 'regular' | 'light' | 'book' | 'semibold' | 'bold';

/**
 * ATENÇÃO: a família Toyota Type não contém glifos para alguns acentos do
 * português (confirmado: ã, ç, õ são renderizados como espaço em branco/
 * caractere ausente). Isso é uma limitação conhecida e aceita da fonte —
 * caso o texto em PT-BR precise de acentuação 100% correta, considere usar
 * as fontes Inter (também disponíveis em assets/fonts/) para o corpo do texto.
 *
 * Por isso as fontes Inter abaixo são carregadas como FALLBACK automático
 * (ver components/text-fallback.ts): o texto continua na Toyota Type e só
 * troca de fonte, caractere a caractere, para os que ela não suporta.
 */
const FONT_FILES: Record<FontWeight, string> = {
  regular: 'Toyota-Type.ttf',
  light: 'Toyota-Type-Light.ttf',
  book: 'Toyota-Type-Book.ttf',
  semibold: 'Toyota-Type-Semibold.ttf',
  bold: 'Toyota-Type-Bold.ttf',
};

const FALLBACK_FONT_FILES: Record<FontWeight, string> = {
  regular: 'Inter-Regular.ttf',
  light: 'Inter-Light.ttf',
  book: 'Inter-Medium.ttf',
  semibold: 'Inter-SemiBold.ttf',
  bold: 'Inter-Bold.ttf',
};

const SVG_CACHE = new Map<string, string>();

function assetsRoot(): string {
  // Lambda runtime: assets copied to /var/task/assets by Makefile
  const cwdAssets = join(process.cwd(), 'assets');
  if (existsSync(cwdAssets)) return cwdAssets;

  // Dev/test: resolve relative to this source file (assets/ no root do projeto)
  const dir = typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
  return join(dir, 'assets');
}

export function loadFont(weight: FontWeight): Buffer {
  return readFileSync(join(assetsRoot(), 'fonts', FONT_FILES[weight]));
}

/** Carrega a fonte Inter correspondente, usada como fallback de glifos (ver components/text-fallback.ts). */
export function loadFallbackFont(weight: FontWeight): Buffer {
  return readFileSync(join(assetsRoot(), 'fonts', FALLBACK_FONT_FILES[weight]));
}

export function loadSvg(name: string): string {
  const cached = SVG_CACHE.get(name);
  if (cached !== undefined) return cached;

  const filePath = join(assetsRoot(), 'svg', `${name}.svg`);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    throw new Error(`SVG asset não encontrado: ${name}`);
  }
  SVG_CACHE.set(name, content);
  return content;
}
