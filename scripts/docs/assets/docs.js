(() => {
  const root = document.documentElement;
  const themeButton = document.getElementById('theme-toggle');

  // Diagrama novo nasce com o tema da página; a troca feita dentro de um diagrama fica só nele.
  function seedDiagramTheme() {
    try {
      localStorage.setItem('archify-theme', root.dataset.theme);
    } catch {}
  }

  function setPageTheme(theme) {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('docs-theme', theme);
    } catch {}
    document.querySelectorAll('iframe').forEach((frame) => frame.contentWindow?.postMessage({ docsTheme: theme }, '*'));
    seedDiagramTheme();
  }

  if (!root.dataset.theme) root.dataset.theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  seedDiagramTheme();
  themeButton.hidden = false;
  themeButton.addEventListener('click', () => setPageTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

  const sidebar = document.getElementById('sidebar');
  const sidebarOpen = document.getElementById('sidebar-open');
  const sidebarClose = document.getElementById('sidebar-close');
  let releaseMain = 0;
  function setSidebar(collapsed) {
    // Fixa a largura do conteúdo durante a animação: só um relayout (texto + viewers do Archify), não um por frame.
    const main = document.getElementById('content');
    const width = main.getBoundingClientRect().width;
    const delta = 320 - 52;
    if (matchMedia('(min-width: 901px)').matches) {
      main.style.width = `${collapsed ? width : Math.max(0, width - delta)}px`;
      clearTimeout(releaseMain);
      releaseMain = setTimeout(() => (main.style.width = ''), 320);
    }
    if (collapsed) root.dataset.sidebar = 'collapsed';
    else delete root.dataset.sidebar;
    sidebarOpen.setAttribute('aria-expanded', String(!collapsed));
    sidebarClose.setAttribute('aria-expanded', String(!collapsed));
    try {
      localStorage.setItem('docs-sidebar', collapsed ? 'collapsed' : 'open');
    } catch {}
  }
  sidebarOpen.hidden = false;
  sidebarClose.hidden = false;
  sidebarClose.addEventListener('click', (e) => {
    e.stopPropagation();
    setSidebar(true);
  });
  // A barra recolhida inteira abre o menu, não só o hambúrguer.
  sidebar.addEventListener('click', () => root.dataset.sidebar === 'collapsed' && setSidebar(false));

  const htmlCache = new Map();

  // Injeta Live + tema da página no próprio HTML do diagrama.
  async function diagramHtml(id) {
    if (!htmlCache.has(id)) {
      const payload = document.getElementById(id).textContent.trim();
      const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      htmlCache.set(id, await new Response(stream).text());
    }
    const html = htmlCache.get(id);
    const boot =
      `<script>(function(){function theme(t){try{if(document.documentElement.getAttribute('data-theme')!==t)Archify.theme.toggle()}catch(e){}}` +
      `try{Archify.motionGovernor&&Archify.motionGovernor.resume()}catch(e){}theme(${JSON.stringify(root.dataset.theme)});` +
      `addEventListener('message',function(e){if(e.source===parent&&e.data&&(e.data.docsTheme==='light'||e.data.docsTheme==='dark'))theme(e.data.docsTheme)})})()<\/script>`;
    const at = html.lastIndexOf('</body>');
    return at >= 0 ? html.slice(0, at) + boot + html.slice(at) : html + boot;
  }

  async function loadFigure(figure) {
    if (figure.dataset.loaded) return;
    figure.dataset.loaded = '1';
    const iframe = document.createElement('iframe');
    iframe.title = figure.querySelector('figcaption span').textContent;
    seedDiagramTheme();
    iframe.srcdoc = await diagramHtml(figure.dataset.diagram);
    const frame = figure.querySelector('.diagram-frame');
    frame.replaceChildren(iframe);
    frame.classList.add('interactive');
    // O viewer do Archify já mostra os cards; os da versão estática ficariam repetidos.
    const cards = figure.querySelector('.diagram-cards');
    if (cards) cards.hidden = true;
  }

  // Sem JavaScript fica só a imagem estática com os cards.
  if ('DecompressionStream' in window) {
    const figures = document.querySelectorAll('figure.diagram');
    figures.forEach((f) => (f.querySelector('.actions').hidden = false));
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => entries.filter((e) => e.isIntersecting).forEach((e) => {
          observer.unobserve(e.target);
          loadFigure(e.target);
        }),
        { rootMargin: '400px' },
      );
      figures.forEach((f) => observer.observe(f));
    } else {
      figures.forEach(loadFigure);
    }
  }

  const dialog = document.getElementById('diagram-dialog');
  const dialogFrame = dialog.querySelector('iframe');
  dialog.addEventListener('close', () => dialogFrame.removeAttribute('srcdoc'));
  const closeOnEscape = (e) => e.key === 'Escape' && dialog.open && dialog.close();
  document.addEventListener('keydown', closeOnEscape);
  // Esc dentro do viewer do diagrama (iframe) não chega ao documento pai; repassa quando o iframe permitir.
  dialogFrame.addEventListener('load', () => {
    try {
      dialogFrame.contentWindow.addEventListener('keydown', closeOnEscape);
    } catch {}
  });

  async function openFullscreen(id) {
    if (typeof dialog.showModal !== 'function') return;
    dialog.querySelector('header span').textContent = document.getElementById(id).dataset.title;
    seedDiagramTheme();
    dialogFrame.srcdoc = await diagramHtml(id);
    dialog.showModal();
    dialog.querySelector('.close-dialog').focus();
  }

  document.addEventListener('click', async (event) => {
    if (event.target.closest('.close-dialog')) return dialog.close();
    const open = event.target.closest('.open-diagram');
    if (open) {
      event.preventDefault();
      try {
        await openFullscreen(open.dataset.diagram);
      } catch {
        open.hidden = true;
      }
    }
  });

  const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sections = [];
  document.querySelectorAll('#content article').forEach((article) => {
    const docTitle = article.querySelector('h1')?.textContent.replace(/^#/, '') ?? article.id;
    let current = { id: article.id, title: docTitle, doc: docTitle, text: '' };
    sections.push(current);
    for (const node of article.children) {
      if (/^H[2-4]$/.test(node.tagName)) {
        current = { id: node.id, title: node.textContent.replace(/^#/, ''), doc: docTitle, text: '' };
        sections.push(current);
      }
      current.text += ` ${node.textContent}`;
    }
  });
  sections.forEach((s) => (s.haystack = normalize(`${s.title} ${s.text}`)));

  const search = document.getElementById('search');
  const nav = document.getElementById('nav');
  const results = document.getElementById('results');
  const escape = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

  // Normaliza sem acento guardando, para cada caractere normalizado, o índice no texto original.
  function normalizeWithMap(text) {
    let normalized = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const n = normalize(text[i]);
      normalized += n;
      for (let j = 0; j < n.length; j++) map.push(i);
    }
    return { normalized, map };
  }

  function findMatches(text, query) {
    const { normalized, map } = normalizeWithMap(text);
    const found = [];
    for (let at = normalized.indexOf(query); at >= 0; at = normalized.indexOf(query, at + query.length)) {
      found.push([map[at], map[at + query.length - 1] + 1]);
    }
    return found;
  }

  function markText(text, query) {
    let html = '';
    let last = 0;
    for (const [start, end] of findMatches(text, query)) {
      html += `${escape(text.slice(last, start))}<mark>${escape(text.slice(start, end))}</mark>`;
      last = end;
    }
    return html + escape(text.slice(last));
  }

  const MAX_CONTENT_HIGHLIGHTS = 3000;
  function highlightContent(query) {
    if (!('highlights' in CSS)) return;
    CSS.highlights.delete('search');
    if (!query) return;
    const ranges = [];
    const walker = document.createTreeWalker(document.getElementById('content'), NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node && ranges.length < MAX_CONTENT_HIGHLIGHTS; node = walker.nextNode()) {
      for (const [start, end] of findMatches(node.data, query)) {
        const range = new Range();
        range.setStart(node, start);
        range.setEnd(node, end);
        ranges.push(range);
      }
    }
    CSS.highlights.set('search', new Highlight(...ranges));
  }

  let pending = 0;
  search.addEventListener('input', () => {
    const query = normalize(search.value.trim());
    clearTimeout(pending);
    if (query.length < 2) {
      results.hidden = true;
      nav.hidden = false;
      highlightContent('');
      return;
    }
    const hits = sections.filter((s) => s.haystack.includes(query)).slice(0, 80);
    results.innerHTML = hits.length
      ? hits.map((s) => {
          const [match] = findMatches(s.text, query);
          const snippet = match ? s.text.slice(Math.max(0, match[0] - 40), match[1] + 80).trim() : '';
          return `<li><a href="#${s.id}"><strong>${markText(s.title, query)}</strong><small>${escape(s.doc)}</small>${snippet ? `<span>…${markText(snippet, query)}…</span>` : ''}</a></li>`;
        }).join('')
      : '<li class="empty">Nada encontrado.</li>';
    results.hidden = false;
    nav.hidden = true;
    // O conteúdo é grande: destaca depois que a digitação pausa.
    pending = setTimeout(() => highlightContent(query), 200);
  });
})();
