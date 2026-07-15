/**
 * KBR PDF Service — Script CLI: gera um PDF a partir de um JSON chave/valor.
 *
 * Cada entrada do JSON vira um campo "LABEL" (linha própria, pequena, em
 * caixa alta) seguido do VALOR em uma linha separada, como texto real do
 * PDF — sem cards, badges ou rasterização. Isso torna trivial selecionar
 * e copiar apenas o valor (ex.: com um triplo-clique / seleção de linha),
 * sem arrastar o rótulo junto.
 *
 * Objetos aninhados são achatados em "chave.subchave"; arrays são
 * serializados como um único valor JSON.
 *
 * Uso:
 *   npm run json-to-pdf -- dados.json [opções]
 *   tsx scripts/json-fields-pdf.ts dados.json [opções]
 *   cat dados.json | tsx scripts/json-fields-pdf.ts [opções]
 *
 * Opções:
 *   --titulo, -t <texto>   Título exibido no topo do documento (default: "Dados")
 *   --saida,  -o <path>    Caminho do PDF de saída (default: tmp/campos-<timestamp>.pdf)
 *   --senha,  -s <texto>   Senha de abertura do PDF (protege com AES-256)
 *   --help,   -h           Mostra esta ajuda
 *
 * Segurança: prefira a variável de ambiente PDF_PASSWORD a "--senha" quando
 * possível — argumentos de linha de comando podem ficar visíveis no
 * histórico do shell e em listagens de processos (ex.: `ps aux`). A env var
 * tem prioridade menor que "--senha" (ou seja, "--senha" sobrescreve a env).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import {
  LAYOUT,
  addSimpleSectionTitle,
  addPageChromeSimple,
  ensureSpaceOrNewPage,
  loadFont,
  loadFallbackFont,
  drawSegmentedText,
  drawTextWithFallback,
  theme,
  SENSITIVE_DOCUMENT_NOTICE,
} from '../index.js';

interface CliOptions {
  inputPath?: string;
  title: string;
  outputPath?: string;
  password?: string;
}

interface FieldEntry {
  label: string;
  value: string;
}

const FIELD_WIDTH = LAYOUT.CONTENT_WIDTH;
const LABEL_FONT_SIZE = 8;
const VALUE_FONT_SIZE = 10.5;
const FIELD_BLOCK_GAP = 14;

function printHelpAndExit(): never {
  console.log(`
Uso:
  npm run json-to-pdf -- <arquivo.json> [opções]
  tsx scripts/json-fields-pdf.ts <arquivo.json> [opções]
  cat dados.json | tsx scripts/json-fields-pdf.ts [opções]

Opções:
  --titulo, -t <texto>   Título do documento (default: "Dados")
  --saida,  -o <path>    Caminho do PDF de saída (default: tmp/campos-<timestamp>.pdf)
  --senha,  -s <texto>   Senha de abertura do PDF (AES-256). Também pode vir da env PDF_PASSWORD
  --help,   -h           Mostra esta ajuda
`);
  process.exit(0);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { title: 'Dados' };
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        printHelpAndExit();
        break;
      case '--titulo':
      case '-t':
        options.title = argv[++i] ?? options.title;
        break;
      case '--saida':
      case '-o':
        options.outputPath = argv[++i];
        break;
      case '--senha':
      case '-s':
      case '--password':
        options.password = argv[++i];
        break;
      default:
        positionals.push(arg);
    }
  }

  options.inputPath = positionals[0];
  return options;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/** Achata um objeto aninhado em pares "chave.subchave" → valor. Arrays viram um único valor JSON. */
function flattenEntries(value: unknown, prefix = ''): FieldEntry[] {
  if (value === null || value === undefined) {
    return [{ label: prefix || '(vazio)', value: '' }];
  }

  if (Array.isArray(value)) {
    return [{ label: prefix, value: JSON.stringify(value) }];
  }

  if (typeof value === 'object') {
    const entries: FieldEntry[] = [];
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const label = prefix ? `${prefix}.${key}` : key;
      entries.push(...flattenEntries(nested, label));
    }
    return entries;
  }

  return [{ label: prefix, value: String(value) }];
}

/** Mede a altura total que o campo (label + valor) vai ocupar, sem desenhar nada. */
function measureFieldHeight(doc: PDFKit.PDFDocument, field: FieldEntry): number {
  doc.font(theme.fonts.bold).fontSize(LABEL_FONT_SIZE);
  const labelHeight = doc.heightOfString(field.label.toUpperCase(), {
    width: FIELD_WIDTH,
    characterSpacing: 0.4,
  });

  doc.font(theme.fonts.regular).fontSize(VALUE_FONT_SIZE);
  const valueHeight = doc.heightOfString(field.value || '—', { width: FIELD_WIDTH });

  return labelHeight + 3 + valueHeight + FIELD_BLOCK_GAP;
}

/** Desenha o campo (label em caixa alta + valor em linha própria) e retorna o Y final. */
function renderField(doc: PDFKit.PDFDocument, x: number, y: number, field: FieldEntry): number {
  drawSegmentedText(
    doc,
    [{
      text: field.label.toUpperCase(),
      font: theme.fonts.bold,
      fallbackFont: theme.fallbackFonts.bold,
      color: theme.colors.n500SlateGray,
    }],
    x,
    y,
    LABEL_FONT_SIZE,
    { width: FIELD_WIDTH, characterSpacing: 0.4 },
  );

  const valueY = doc.y + 3;

  drawSegmentedText(
    doc,
    [{
      text: field.value || '—',
      font: theme.fonts.regular,
      fallbackFont: theme.fallbackFonts.regular,
      color: theme.colors.n900Gunmetal,
    }],
    x,
    valueY,
    VALUE_FONT_SIZE,
    { width: FIELD_WIDTH },
  );

  return doc.y + FIELD_BLOCK_GAP;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const raw = options.inputPath
    ? readFileSync(resolve(process.cwd(), options.inputPath), 'utf-8')
    : await readStdin();

  if (!raw.trim()) {
    console.error('Nenhum JSON informado. Passe um arquivo como argumento ou via stdin.');
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`JSON inválido: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.error('O JSON informado deve ser um objeto chave/valor (ex.: { "campo": "valor" }).');
    process.exit(1);
  }

  const fields = flattenEntries(parsed);
  if (fields.length === 0) {
    console.error('O JSON informado não contém campos.');
    process.exit(1);
  }

  const password = options.password ?? process.env.PDF_PASSWORD;

  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: theme.spacing.pageMarginTop,
      bottom: theme.spacing.pageMarginBottom,
      left: theme.spacing.pageMarginLeft,
      right: theme.spacing.pageMarginRight,
    },
    bufferPages: true,
    autoFirstPage: false,
    ...(password
      ? {
          userPassword: password,
          pdfVersion: '1.7ext3' as const, // AES-256
          info: { Subject: SENSITIVE_DOCUMENT_NOTICE },
        }
      : {}),
  });

  doc.registerFont(theme.fonts.regular, loadFont('regular'));
  doc.registerFont(theme.fonts.light, loadFont('light'));
  doc.registerFont(theme.fonts.book, loadFont('book'));
  doc.registerFont(theme.fonts.semibold, loadFont('semibold'));
  doc.registerFont(theme.fonts.bold, loadFont('bold'));

  // Fallback (Inter) — usado nos caracteres que a Toyota Type não suporta.
  doc.registerFont(theme.fallbackFonts.regular, loadFallbackFont('regular'));
  doc.registerFont(theme.fallbackFonts.light, loadFallbackFont('light'));
  doc.registerFont(theme.fallbackFonts.book, loadFallbackFont('book'));
  doc.registerFont(theme.fallbackFonts.semibold, loadFallbackFont('semibold'));
  doc.registerFont(theme.fallbackFonts.bold, loadFallbackFont('bold'));
  doc.font(theme.fonts.regular);

  const chunks: Buffer[] = [];
  const completion = new Promise<Buffer>((resolvePromise, rejectPromise) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => rejectPromise(err));
  });

  doc.addPage();
  addPageChromeSimple(doc, theme);

  let y = addSimpleSectionTitle({
    doc,
    title: options.title,
    x: LAYOUT.MARGIN_LEFT,
    y: LAYOUT.CONTENT_START_Y,
    theme,
  });
  y += 10;

  if (password) {
    doc.fillColor(theme.colors.error);
    drawTextWithFallback(
      doc,
      SENSITIVE_DOCUMENT_NOTICE,
      LAYOUT.MARGIN_LEFT,
      y,
      theme.fonts.bold,
      theme.fallbackFonts.bold,
      9,
      { width: FIELD_WIDTH, characterSpacing: 0.2 },
    );
    y = doc.y + 12;
  }

  for (const field of fields) {
    const requiredHeight = measureFieldHeight(doc, field);
    y = ensureSpaceOrNewPage({ doc, cursorY: y, requiredHeight, theme });
    y = renderField(doc, LAYOUT.MARGIN_LEFT, y, field);
  }

  doc.end();
  const buffer = await completion;

  const tmpDir = resolve(process.cwd(), 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = options.outputPath
    ? resolve(process.cwd(), options.outputPath)
    : resolve(tmpDir, `campos-${timestamp}.pdf`);

  writeFileSync(outputPath, buffer);

  console.log(
    `PDF gerado: ${outputPath} (${buffer.length} bytes)${password ? ' [protegido por senha]' : ''}`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
