#!/usr/bin/env node
// Consolida a documentação do repositório (doc/docs-site.json) em um único HTML autocontido.
// Uso: node build-docs.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { Marked } from 'marked';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(readFileSync(join(repoRoot, 'doc/docs-site.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');

const warnings = [];
const errors = [];

const docIdOf = (path) =>
  path.replace(/^doc\//, '').replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

const docs = config.groups.flatMap((group) =>
  group.docs.map((path) => ({ path, group: group.label, id: docIdOf(path) })),
);
const docsByPath = new Map(docs.map((doc) => [doc.path, doc]));

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const stripTags = (html) => html.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, ' ');

const slugify = (text) =>
  stripTags(text).toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

const isExternal = (href) => /^[a-z][a-z0-9+.-]*:/i.test(href);

const diagrams = new Map();

// SVG autônomo (tema claro, CSS do viewer embutido) para exibir o diagrama sem JavaScript.
function staticSvgDataUri(html, repoPath) {
  const start = html.indexOf('<svg');
  const end = html.lastIndexOf('</svg>');
  if (start < 0 || end < 0) {
    errors.push(`${repoPath}: SVG não encontrado no HTML do Archify`);
    return '';
  }
  const css = [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)]
    .filter(([, attrs]) => !attrs.includes('archify-fonts'))
    .map(([, , body]) => body.replaceAll(']]>', ''))
    .join('\n');
  let svg = html.slice(start, end + '</svg>'.length);
  svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" data-theme="light"');
  const open = svg.indexOf('>') + 1;
  svg = `${svg.slice(0, open)}<style><![CDATA[${css}]]></style>${svg.slice(open)}`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function registerDiagram(repoPath) {
  if (!diagrams.has(repoPath)) {
    const html = readFileSync(join(repoRoot, repoPath));
    const text = html.toString('utf8');
    const title = /<title>([^<]*)<\/title>/i.exec(text)?.[1] ?? basename(repoPath);
    const spec = JSON.parse(readFileSync(join(repoRoot, repoPath.replace(/\.html$/, '.archify.json')), 'utf8'));
    diagrams.set(repoPath, {
      id: `diagram-${docIdOf(repoPath.replace(/\.html$/, ''))}`,
      title,
      cards: Array.isArray(spec.cards) ? spec.cards : [],
      image: staticSvgDataUri(text, repoPath),
      payload: gzipSync(html, { level: 9 }).toString('base64'),
    });
  }
  return diagrams.get(repoPath);
}

const isDiagramPath = (repoPath) =>
  repoPath.endsWith('.html') && existsSync(join(repoRoot, repoPath.replace(/\.html$/, '.archify.json')));

// Resolve um href relativo ao .md atual para { repoPath, hash }.
function resolveHref(href, doc) {
  const [rawPath, hash = ''] = href.split('#');
  const decoded = decodeURIComponent(rawPath);
  const repoPath = posix.normalize(posix.join(posix.dirname(doc.path), decoded));
  return { repoPath, hash };
}

function rewriteHref(href, doc) {
  if (!href || isExternal(href)) return { href, external: true };
  if (href.startsWith('#')) return { href: `#${doc.id}--${href.slice(1)}` };
  const { repoPath, hash } = resolveHref(href, doc);
  const target = docsByPath.get(repoPath);
  if (target) return { href: hash ? `#${target.id}--${hash}` : `#${target.id}` };
  if (isDiagramPath(repoPath)) return { diagram: registerDiagram(repoPath) };
  if (repoPath !== config.output && !existsSync(join(repoRoot, repoPath))) warnings.push(`${doc.path}: link quebrado -> ${href}`);
  return { href: repoPath + (hash ? `#${hash}` : '') };
}

function imageDataUri(repoPath) {
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[extname(repoPath).toLowerCase()];
  if (!mime) return null;
  return `data:${mime};base64,${readFileSync(join(repoRoot, repoPath)).toString('base64')}`;
}

const CARD_DOTS = new Set(['cyan', 'emerald', 'violet', 'amber', 'rose', 'orange', 'slate']);

const diagramCards = (cards) =>
  cards.length
    ? `<div class="diagram-cards">${cards
        .map((card) => {
          const dot = CARD_DOTS.has(card.dot) ? card.dot : 'slate';
          const items = (card.items ?? [])
            .map((item) => `<li>${escapeHtml(typeof item === 'string' ? item : item.text ?? JSON.stringify(item))}</li>`)
            .join('');
          return `<div class="card ${dot}"><div class="card-header"><span class="card-dot"></span>` +
            `<strong>${escapeHtml(card.title ?? '')}</strong></div><ul>${items}</ul></div>`;
        })
        .join('')}</div>`
    : '';

const diagramFigure = (diagram, caption) =>
  `<figure class="diagram" data-diagram="${diagram.id}">` +
  `<figcaption><span>${escapeHtml(caption || diagram.title)}</span>` +
  `<span class="actions" hidden>` +
  `<button type="button" class="open-diagram" data-diagram="${diagram.id}">` +
  `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>` +
  `Tela cheia</button></span></figcaption>` +
  `<div class="diagram-frame"><img src="${diagram.image}" alt="${escapeHtml(caption || diagram.title)}"></div>` +
  diagramCards(diagram.cards) +
  `</figure>`;

// Referências do playbook escritas como código (`regras.md#rn-001`) viram links navegáveis.
function codespanLink(text, doc) {
  const match = /^([\w./-]+\.md)(?:#([\w-]+))?$/.exec(text);
  if (!match) return null;
  const candidates = [posix.normalize(posix.join(posix.dirname(doc.path), match[1])), match[1]];
  const target = candidates.map((p) => docsByPath.get(p)).find(Boolean);
  if (!target) return null;
  return `#${target.id}${match[2] ? `--${match[2]}` : ''}`;
}

function renderDoc(doc) {
  const source = readFileSync(join(repoRoot, doc.path), 'utf8');
  const slugCounts = new Map();
  const headings = [];
  const marked = new Marked({ gfm: true });

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const base = slugify(inner) || 'secao';
        const count = slugCounts.get(base) ?? 0;
        slugCounts.set(base, count + 1);
        const id = `${doc.id}--${count ? `${base}-${count}` : base}`;
        if (depth === 1 && !doc.title) doc.title = stripTags(inner).trim();
        if (depth === 2 || depth === 3) headings.push({ id, depth, text: stripTags(inner).trim() });
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}">#</a>${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const result = rewriteHref(href, doc);
        if (result.diagram)
          return `<a href="#" class="open-diagram" data-diagram="${result.diagram.id}">${inner}</a>`;
        const attrs = result.external ? ' target="_blank" rel="noopener noreferrer"' : '';
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(result.href)}"${titleAttr}${attrs}>${inner}</a>`;
      },
      image({ href, title, text }) {
        if (isExternal(href)) return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}">`;
        const { repoPath } = resolveHref(href, doc);
        if (isDiagramPath(repoPath)) return diagramFigure(registerDiagram(repoPath), text);
        if (!existsSync(join(repoRoot, repoPath))) {
          warnings.push(`${doc.path}: imagem ausente -> ${href}`);
          return `<span class="missing">[imagem ausente: ${escapeHtml(href)}]</span>`;
        }
        const uri = imageDataUri(repoPath);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return uri ? `<img src="${uri}" alt="${escapeHtml(text)}"${titleAttr}>` : `<a href="${escapeHtml(repoPath)}">${escapeHtml(text)}</a>`;
      },
      paragraph({ tokens }) {
        const meaningful = tokens.filter((t) => !(t.type === 'text' && !t.raw.trim()));
        if (meaningful.length === 1 && meaningful[0].type === 'link') {
          const link = meaningful[0];
          const result = !isExternal(link.href) && !link.href.startsWith('#') ? rewriteHref(link.href, doc) : {};
          if (result.diagram) return diagramFigure(result.diagram, stripTags(this.parser.parseInline(link.tokens)));
        }
        const inline = this.parser.parseInline(tokens);
        if (/^\s*<figure[\s\S]*<\/figure>\s*$/.test(inline)) return `${inline}\n`;
        return `<p>${inline}</p>\n`;
      },
      codespan({ text }) {
        const href = codespanLink(text.replace(/&amp;/g, '&').replace(/&#39;/g, "'"), doc);
        const code = `<code>${text}</code>`;
        return href ? `<a href="${href}">${code}</a>` : code;
      },
      code({ text, lang }) {
        if ((lang || '').trim().toLowerCase() === 'mermaid')
          errors.push(`${doc.path}: bloco mermaid não é suportado; use um diagrama Archify (*.archify.json)`);
        const cls = lang ? ` class="language-${escapeHtml(lang.split(/\s/)[0])}"` : '';
        return `<pre><code${cls}>${escapeHtml(text)}</code></pre>\n`;
      },
    },
  });

  doc.html = marked.parse(source);
  doc.title ||= basename(doc.path);
  doc.headings = headings;
}

for (const doc of docs) {
  if (!existsSync(join(repoRoot, doc.path))) {
    errors.push(`documento listado em doc/docs-site.json não existe: ${doc.path}`);
    continue;
  }
  renderDoc(doc);
}

if (errors.length) {
  console.error(errors.map((e) => `erro: ${e}`).join('\n'));
  process.exit(1);
}

const nav = config.groups
  .map((group) => {
    const items = docs
      .filter((doc) => doc.group === group.label && doc.html)
      .map((doc) => {
        const subs = doc.headings
          .filter((h) => h.depth === 2)
          .map((h) => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
          .join('');
        return `<li><details><summary><a href="#${doc.id}">${escapeHtml(doc.title)}</a></summary><ul>${subs}</ul></details></li>`;
      })
      .join('');
    return `<section><h2>${escapeHtml(group.label)}</h2><ul>${items}</ul></section>`;
  })
  .join('');

const articles = docs
  .filter((doc) => doc.html)
  .map(
    (doc) =>
      `<article id="${doc.id}" data-source="${escapeHtml(doc.path)}">` +
      `<p class="source">${escapeHtml(doc.group)} · <code>${escapeHtml(doc.path)}</code></p>${doc.html}</article>`,
  )
  .join('\n');

const diagramPayloads = [...diagrams.values()]
  .map((d) => `<script type="application/gzip+base64" id="${d.id}" data-title="${escapeHtml(d.title)}">${d.payload}</script>`)
  .join('\n');

const css = readFileSync(join(repoRoot, 'scripts/docs/assets/docs.css'), 'utf8');
// Logo de KBR-Repo-KintoDS-Flutter/assets/svg/KINTO_BLUE.svg, recortado ao desenho e com cor herdada do tema.
const logoSvg = readFileSync(join(repoRoot, 'scripts/docs/assets/kinto-logo.svg'), 'utf8')
  .replace(/<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="423 180 942 240" role="img" aria-hidden="true">')
  .replace(/fill="#[0-9a-f]{3,6}"/gi, 'fill="currentColor"');
const js = readFileSync(join(repoRoot, 'scripts/docs/assets/docs.js'), 'utf8');
if (/<\/script/i.test(js)) {
  console.error('erro: scripts/docs/assets/docs.js contém "</script" literal; use "<\\/script" (o JS é embutido inline).');
  process.exit(1);
}

const output = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="scripts/docs/build-docs.mjs">
<title>${escapeHtml(config.title)}</title>
<style>${css}</style>
<script>try{var t=localStorage.getItem('docs-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t;if(localStorage.getItem('docs-sidebar')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}</script>
</head>
<body>
<!-- Arquivo gerado por scripts/docs/build-docs.mjs a partir de doc/docs-site.json. Não editar à mão. -->
<button id="theme-toggle" class="floating" type="button" hidden aria-label="Alternar tema claro/escuro" title="Alternar tema claro/escuro">
<svg class="icon-sun" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor"/><path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1"/></svg>
<svg class="icon-moon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M13.5 10.5A6 6 0 0 1 5.5 2.5a6 6 0 1 0 8 8z"/></svg>
</button>
<aside id="sidebar">
<button id="sidebar-open" class="icon-button" type="button" hidden aria-controls="sidebar" aria-label="Mostrar menu" title="Mostrar menu">
<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M2 4h12M2 8h12M2 12h12"/></svg>
</button>
<div class="sidebar-content">
<header><div class="sidebar-top"><a href="#" class="logo" aria-label="KINTO">${logoSvg}</a>
<button id="sidebar-close" class="icon-button" type="button" hidden aria-controls="sidebar" aria-label="Esconder menu" title="Esconder menu">
<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M10 3 5 8l5 5"/></svg>
</button></div>
<a href="#" class="brand">${escapeHtml(config.title)}</a>
<input id="search" type="search" placeholder="Buscar (ex.: RN-030, CNH_EXPIRED)" autocomplete="off"></header>
<nav id="nav">${nav}</nav>
<ol id="results" hidden></ol>
</div>
</aside>
<main id="content">
${articles}
</main>
<dialog id="diagram-dialog"><header><span></span><button type="button" class="close-dialog">Fechar (Esc)</button></header><iframe title="Diagrama"></iframe></dialog>
${diagramPayloads}
<script>${js}</script>
</body>
</html>
`;

const outputPath = join(repoRoot, config.output);
for (const w of warnings) console.warn(`aviso: ${w}`);

if (checkOnly) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  if (current !== output) {
    console.error(`${config.output} desatualizado. Rode: npm --prefix scripts/docs run build`);
    process.exit(1);
  }
  console.log(`${config.output} atualizado.`);
} else {
  writeFileSync(outputPath, output);
  const kb = Math.round(Buffer.byteLength(output) / 1024);
  console.log(`${relative(repoRoot, outputPath)} gerado (${docs.length} documentos, ${diagrams.size} diagramas, ${kb} KB).`);
}
