#!/usr/bin/env node
// Renderiza (finalize) todos os diagramas doc/**/*.archify.json com o Archify fixado em ARCHIFY_VERSION.
// Uso: node render-diagrams.mjs [--install] [caminho/arquivo.archify.json ...]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARCHIFY_VERSION = 'v3.2.0';
const ARCHIFY_REPO = 'https://github.com/tt-a1i/archify.git';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const archifyHome = process.env.ARCHIFY_HOME ?? join(homedir(), '.cache', 'archify', ARCHIFY_VERSION);
const archifyBin = join(archifyHome, 'archify', 'bin', 'archify.mjs');
const args = process.argv.slice(2);

if (args.includes('--install') || !existsSync(archifyBin)) {
  if (!existsSync(archifyBin)) {
    console.log(`Instalando Archify ${ARCHIFY_VERSION} em ${archifyHome}`);
    execFileSync('git', ['clone', '--quiet', '--depth', '1', '--branch', ARCHIFY_VERSION, ARCHIFY_REPO, archifyHome], { stdio: 'inherit' });
  }
  execFileSync('node', [archifyBin, 'doctor'], { stdio: 'inherit' });
  if (args.includes('--install')) process.exit(0);
}

function findSpecs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : findSpecs(full);
    return entry.name.endsWith('.archify.json') ? [full] : [];
  });
}

const specs = args.filter((a) => !a.startsWith('--')).map((p) => resolve(p));
const targets = specs.length ? specs : findSpecs(join(repoRoot, 'doc'));
let failed = 0;

for (const spec of targets) {
  const { diagram_type: type, meta } = JSON.parse(readFileSync(spec, 'utf8'));
  const output = spec.replace(/\.archify\.json$/, '.html');
  const quality = meta?.quality_profile ?? 'showcase';
  const outDir = join(tmpdir(), 'archify-review', relative(repoRoot, spec).replace(/[/.]/g, '_'), String(Date.now()));
  const label = relative(repoRoot, spec);
  try {
    execFileSync(
      'node',
      [archifyBin, 'finalize', type, relative(repoRoot, spec), relative(repoRoot, output), '--quality', quality, '--out-dir', outDir],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    console.log(`ok    ${label}`);
  } catch (error) {
    failed++;
    console.error(`falha ${label}\n${error.stdout?.toString() ?? ''}${error.stderr?.toString() ?? ''}`);
  }
}

if (failed) process.exit(1);
