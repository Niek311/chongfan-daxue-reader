/**
 * Web Reader Core Application
 * High performance, offline-ready, mobile-first reader.
 */

(function () {
  'use strict';

  const state = {
    bookMeta: null,
    totalChapters: 1101,
    currentChapter: 1,
    chapters: [],
    fontSize: parseInt(localStorage.getItem('reader_font_size')) || 19,
    theme: localStorage.getItem('reader_theme') || 'sepia',
    fontFamily: localStorage.getItem('reader_font_family') || 'sans',
    spacing: localStorage.getItem('reader_spacing') || 'normal',
    chapterCache: new Map(),
    isLoading: false,
    lastScrollY: 0
  };

  const DOM = {
    html: document.documentElement,
    body: document.body,
    topBar: document.getElementById('top-bar'),
    bottomBar: document.getElementById('bottom-bar'),
    chapterArticle: document.getElementById('chapter-article'),
    loadingSpinner: document.getElementById('loading-spinner'),
    progressText: document.getElementById('progress-text'),
    headerBookTitle: document.getElementById('header-book-title'),
    
    btnToc: document.getElementById('btn-toc'),
    btnTocBottom: document.getElementById('btn-toc-bottom'),
    btnCloseToc: document.getElementById('btn-close-toc'),
    tocDrawer: document.getElementById('toc-drawer'),
    tocBackdrop: document.getElementById('toc-backdrop'),
    tocList: document.getElementById('toc-list'),
    tocCount: document.getElementById('toc-count'),
    tocSearch: document.getElementById('toc-search'),
    btnJumpInput: document.getElementById('btn-jump-input'),
    
    btnSettings: document.getElementById('btn-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingsSheet: document.getElementById('settings-sheet'),
    settingsBackdrop: document.getElementById('settings-backdrop'),
    fontSizeLabel: document.getElementById('font-size-label'),
    btnFontInc: document.getElementById('btn-font-inc'),
    btnFontDec: document.getElementById('btn-font-dec'),
    
    btnPrevTop: document.getElementById('btn-prev-chapter'),
    btnNextTop: document.getElementById('btn-next-chapter'),
    btnPrevBottom: document.getElementById('btn-prev-bottom'),
    btnNextBottom: document.getElementById('btn-next-bottom'),
    
    toast: document.getElementById('toast')
  };

  function showToast(msg, duration = 2000) {
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    setTimeout(() => {
      DOM.toast.classList.remove('show');
    }, duration);
  }

  async function initBook() {
    try {
      const res = await fetch('data/book.json');
      state.bookMeta = await res.json();
      state.chapters = state.bookMeta.chapters || [];
      state.totalChapters = state.bookMeta.totalChapters || state.chapters.length;
      
      DOM.tocCount.textContent = state.totalChapters;
      renderTocList(state.chapters);

      const hashChapter = parseHashChapter();
      const savedChapter = parseInt(localStorage.getItem('reader_last_chapter'));
      const initialChapter = hashChapter || savedChapter || 1;
      
      loadChapter(initialChapter);
    } catch (err) {
      console.error('Failed to load book metadata:', err);
      showToast('加载目录失败，请检查网络');
    }
  }

  function parseHashChapter() {
    const hash = window.location.hash;
    const match = hash.match(/^#ch-(\d+)$/);
    if (match) {
      const ch = parseInt(match[1]);
      if (ch >= 1 && ch <= state.totalChapters) return ch;
    }
    return null;
  }

  function renderTocList(chapterArray) {
    DOM.tocList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    chapterArray.forEach(ch => {
      const btn = document.createElement('button');
      btn.className = `toc-item ${ch.id === state.currentChapter ? 'active' : ''}`;
      btn.dataset.id = ch.id;
      btn.textContent = ch.title;
      btn.addEventListener('click', () => {
        closeToc();
        loadChapter(ch.id);
      });
      fragment.appendChild(btn);
    });

    DOM.tocList.appendChild(fragment);
  }

  async function loadChapter(chapterId, shouldScrollTop = true) {
    if (chapterId < 1 || chapterId > state.totalChapters) return;
    if (state.isLoading) return;

    state.isLoading = true;
    state.currentChapter = chapterId;
    window.location.hash = `#ch-${chapterId}`;
    localStorage.setItem('reader_last_chapter', chapterId);

    DOM.loadingSpinner.classList.add('active');
    DOM.chapterArticle.innerHTML = '';
    updateUIProgress();

    try {
      let chapterData;
      if (state.chapterCache.has(chapterId)) {
        chapterData = state.chapterCache.get(chapterId);
      } else {
        const res = await fetch(`data/chapters/${chapterId}.json`);
        if (!res.ok) throw new Error('Network error');
        chapterData = await res.json();
        state.chapterCache.set(chapterId, chapterData);
      }

      renderChapter(chapterData);

      if (shouldScrollTop) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }

      if (chapterId + 1 <= state.totalChapters && !state.chapterCache.has(chapterId + 1)) {
        fetch(`data/chapters/${chapterId + 1}.json`)
          .then(r => r.json())
          .then(data => state.chapterCache.set(chapterId + 1, data))
          .catch(() => {});
      }
    } catch (err) {
      console.error('Error loading chapter:', err);
      DOM.chapterArticle.innerHTML = `
        <div style="text-align: center; padding: 50px 20px;">
          <p style="color: red; margin-bottom: 16px;">章节加载失败</p>
          <button class="nav-chapter-btn" onclick="location.reload()" style="display:inline-flex; width:auto; padding:8px 20px;">重新加载</button>
        </div>
      `;
    } finally {
      DOM.loadingSpinner.classList.remove('active');
      state.isLoading = false;
      highlightActiveTocItem();
    }
  }

  function renderChapter(data) {
    const article = DOM.chapterArticle;
    article.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'chapter-title-header';
    header.innerHTML = `
      <div>${data.title}</div>
      <div class="chapter-meta">第 ${data.id} / ${state.totalChapters} 章 · 约 ${data.wordCount || 0} 字</div>
    `;
    article.appendChild(header);

    if (data.paragraphs && data.paragraphs.length > 0) {
      data.paragraphs.forEach(p => {
        const pElem = document.createElement('p');
        pElem.className = 'chapter-paragraph';
        pElem.textContent = p;
        article.appendChild(pElem);
      });
    }

    DOM.headerBookTitle.textContent = data.title;
  }

  function updateUIProgress() {
    DOM.progressText.textContent = `${state.currentChapter} / ${state.totalChapters}`;
    
    const isFirst = state.currentChapter <= 1;
    const isLast = state.currentChapter >= state.totalChapters;
    
    [DOM.btnPrevTop, DOM.btnPrevBottom].forEach(b => {
      b.disabled = isFirst;
      b.style.opacity = isFirst ? '0.4' : '1';
      b.style.pointerEvents = isFirst ? 'none' : 'auto';
    });

    [DOM.btnNextTop, DOM.btnNextBottom].forEach(b => {
      b.disabled = isLast;
      b.style.opacity = isLast ? '0.4' : '1';
      b.style.pointerEvents = isLast ? 'none' : 'auto';
    });
  }

  function highlightActiveTocItem() {
    const items = DOM.tocList.querySelectorAll('.toc-item');
    items.forEach(item => {
      if (parseInt(item.dataset.id) === state.currentChapter) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  function handleTocSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      renderTocList(state.chapters);
      highlightActiveTocItem();
      return;
    }

    const num = parseInt(q);
    const filtered = state.chapters.filter(ch => {
      if (!isNaN(num) && ch.id === num) return true;
      return ch.title.toLowerCase().includes(q);
    });

    renderTocList(filtered);
  }

  function openToc() {
    DOM.tocDrawer.classList.add('open');
    highlightActiveTocItem();
  }

  function closeToc() {
    DOM.tocDrawer.classList.remove('open');
  }

  function openSettings() {
    DOM.settingsSheet.classList.add('open');
  }

  function closeSettings() {
    DOM.settingsSheet.classList.remove('open');
  }

  function applyTheme(theme) {
    state.theme = theme;
    DOM.html.setAttribute('data-theme', theme);
    localStorage.setItem('reader_theme', theme);

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    const themeColors = {
      sepia: '#f6f1e7',
      light: '#ffffff',
      dark: '#121212',
      green: '#dbe7db'
    };
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = themeColors[theme] || '#f6f1e7';
  }

  function applyFontSize(size) {
    state.fontSize = Math.min(Math.max(size, 14), 32);
    DOM.html.style.setProperty('--font-size', `${state.fontSize}px`);
    DOM.fontSizeLabel.textContent = `${state.fontSize} px`;
    localStorage.setItem('reader_font_size', state.fontSize);
  }

  function applySpacing(spacing) {
    state.spacing = spacing;
    DOM.body.classList.remove('spacing-compact', 'spacing-normal', 'spacing-loose');
    DOM.body.classList.add(`spacing-${spacing}`);
    localStorage.setItem('reader_spacing', spacing);

    document.querySelectorAll('[data-spacing]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.spacing === spacing);
    });
  }

  function applyFontFamily(font) {
    state.fontFamily = font;
    DOM.body.classList.remove('font-sans', 'font-serif');
    DOM.body.classList.add(`font-${font}`);
    localStorage.setItem('reader_font_family', font);

    document.querySelectorAll('[data-font]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.font === font);
    });
  }

  function setupEventListeners() {
    DOM.btnToc.addEventListener('click', openToc);
    DOM.btnTocBottom.addEventListener('click', openToc);
    DOM.btnCloseToc.addEventListener('click', closeToc);
    DOM.tocBackdrop.addEventListener('click', closeToc);

    DOM.btnSettings.addEventListener('click', openSettings);
    DOM.btnCloseSettings.addEventListener('click', closeSettings);
    DOM.settingsBackdrop.addEventListener('click', closeSettings);

    const prevAction = () => loadChapter(state.currentChapter - 1);
    const nextAction = () => loadChapter(state.currentChapter + 1);

    DOM.btnPrevTop.addEventListener('click', prevAction);
    DOM.btnPrevBottom.addEventListener('click', prevAction);
    DOM.btnNextTop.addEventListener('click', nextAction);
    DOM.btnNextBottom.addEventListener('click', nextAction);

    let searchTimer;
    DOM.tocSearch.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => handleTocSearch(e.target.value), 250);
    });

    DOM.btnJumpInput.addEventListener('click', () => {
      const val = parseInt(DOM.tocSearch.value.trim());
      if (!isNaN(val) && val >= 1 && val <= state.totalChapters) {
        closeToc();
        loadChapter(val);
      } else {
        showToast(`请输入有效章节 (1-${state.totalChapters})`);
      }
    });

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const jumpTarget = parseInt(chip.dataset.jump);
        closeToc();
        loadChapter(jumpTarget);
      });
    });

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
    });

    DOM.btnFontDec.addEventListener('click', () => applyFontSize(state.fontSize - 1));
    DOM.btnFontInc.addEventListener('click', () => applyFontSize(state.fontSize + 1));

    document.querySelectorAll('[data-spacing]').forEach(btn => {
      btn.addEventListener('click', () => applySpacing(btn.dataset.spacing));
    });

    document.querySelectorAll('[data-font]').forEach(btn => {
      btn.addEventListener('click', () => applyFontFamily(btn.dataset.font));
    });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') {
        prevAction();
      } else if (e.key === 'ArrowRight') {
        nextAction();
      }
    });

    window.addEventListener('hashchange', () => {
      const ch = parseHashChapter();
      if (ch && ch !== state.currentChapter) {
        loadChapter(ch);
      }
    });

    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - state.lastScrollY;

      if (Math.abs(diff) > 10) {
        if (diff > 0 && currentScrollY > 100) {
          DOM.topBar.classList.add('hide-bar');
          DOM.bottomBar.classList.add('hide-bar');
        } else {
          DOM.topBar.classList.remove('hide-bar');
          DOM.bottomBar.classList.remove('hide-bar');
        }
      }

      state.lastScrollY = currentScrollY;
    }, { passive: true });
  }

  function init() {
    applyTheme(state.theme);
    applyFontSize(state.fontSize);
    applySpacing(state.spacing);
    applyFontFamily(state.fontFamily);
    
    setupEventListeners();
    initBook();
  }

  init();
})();
