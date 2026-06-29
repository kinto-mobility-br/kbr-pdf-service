import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export type FontWeight = 'regular' | 'light' | 'book' | 'semibold' | 'bold';

const FONT_FILES: Record<FontWeight, string> = {
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
