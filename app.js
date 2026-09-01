/**
 * Web Reader Core Application - Dual Language (VI / ZH / DUAL)
 * Supports both HTTP (GitHub Pages / Localhost) and Local File (file:///) protocol!
 */

(function () {
  'use strict';

  const state = {
    bookMeta: null,
    totalChapters: 1101,
    currentChapter: 1,
    currentChapterData: null,
    chapters: [],
    lang: localStorage.getItem('reader_lang') || 'vi',
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
    
    btnToc: document.getElementById('btn-toc'),
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
    btnSwapBottom: document.getElementById('btn-swap-bottom'),
    
    toast: document.getElementById('toast')
  };

  function showToast(msg, duration = 1800) {
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    setTimeout(() => {
      DOM.toast.classList.remove('show');
    }, duration);
  }

  // Load chapter data supporting both fetch and script loading (file://)
  function fetchChapterData(chapterId) {
    return new Promise((resolve, reject) => {
      if (state.chapterCache.has(chapterId)) {
        return resolve(state.chapterCache.get(chapterId));
      }

      // If running over HTTP/HTTPS, use fetch()
      if (window.location.protocol.startsWith('http')) {
        fetch(`data/chapters/${chapterId}.json`)
          .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(data => {
            state.chapterCache.set(chapterId, data);
            resolve(data);
          })
          .catch(err => {
            // Fallback to script tag
            loadViaScript(chapterId, resolve, reject);
          });
      } else {
        // file:/// protocol -> use script tag injection
        loadViaScript(chapterId, resolve, reject);
      }
    });
  }

  function loadViaScript(chapterId, resolve, reject) {
    const callbackFn = `loadChapterCallback_${chapterId}`;
    if (window[callbackFn]) {
      const data = window[callbackFn]();
      state.chapterCache.set(chapterId, data);
      return resolve(data);
    }

    const script = document.createElement('script');
    script.src = `data/chapters/${chapterId}.js`;
    
    window.onChapterLoaded = function(data) {
      state.chapterCache.set(chapterId, data);
      resolve(data);
      script.remove();
    };

    script.onerror = function() {
      reject(new Error('Script load failed for chapter ' + chapterId));
      script.remove();
    };

    document.head.appendChild(script);
  }

  async function initBook() {
    try {
      // 1. Try global BOOK_DATA first (if loaded via data/book.js)
      if (window.BOOK_DATA) {
        state.bookMeta = window.BOOK_DATA;
      } else {
        const res = await fetch('data/book.json');
        state.bookMeta = await res.json();
      }

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
      showToast('Tải danh mục thất bại, vui lòng thử lại');
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

      const titlePrimary = state.lang === 'zh' ? (ch.title.zh || ch.title) : (ch.title.vi || ch.title);
      const titleSecondary = state.lang === 'zh' ? (ch.title.vi || '') : (ch.title.zh || '');

      btn.innerHTML = `
        <span class="toc-item-title-primary">${titlePrimary}</span>
        ${titleSecondary ? `<span class="toc-item-title-secondary">${titleSecondary}</span>` : ''}
      `;

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
    try { localStorage.setItem('reader_last_chapter', chapterId); } catch(e){}

    DOM.loadingSpinner.classList.add('active');
    DOM.chapterArticle.innerHTML = '';
    updateUIProgress();

    try {
      const chapterData = await fetchChapterData(chapterId);
      state.currentChapterData = chapterData;
      renderCurrentChapter();

      if (shouldScrollTop) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }

      // Preload next chapter
      if (chapterId + 1 <= state.totalChapters && !state.chapterCache.has(chapterId + 1)) {
        fetchChapterData(chapterId + 1).catch(() => {});
      }
    } catch (err) {
      console.error('Error loading chapter:', err);
      DOM.chapterArticle.innerHTML = `
        <div style="text-align: center; padding: 50px 20px;">
          <p style="color: #e53935; margin-bottom: 16px;">Tải chương thất bại</p>
          <button class="nav-chapter-btn" onclick="location.reload()" style="display:inline-flex; width:auto; padding:8px 20px;">Tải lại trang</button>
        </div>
      `;
    } finally {
      DOM.loadingSpinner.classList.remove('active');
      state.isLoading = false;
      highlightActiveTocItem();
    }
  }

  function renderCurrentChapter() {
    if (!state.currentChapterData) return;
    const data = state.currentChapterData;
    const article = DOM.chapterArticle;
    
    article.classList.add('fade-out');
    
    setTimeout(() => {
      article.innerHTML = '';
      
      const titleZh = typeof data.title === 'object' ? data.title.zh : data.title;
      const titleVi = typeof data.title === 'object' ? data.title.vi : data.title;
      const wcZh = typeof data.wordCount === 'object' ? data.wordCount.zh : (data.wordCount || 0);
      const wcVi = typeof data.wordCount === 'object' ? data.wordCount.vi : (data.wordCount || 0);

      const contentZh = (data.content && data.content.zh) ? data.content.zh : (data.paragraphs || []);
      const contentVi = (data.content && data.content.vi) ? data.content.vi : [];

      const header = document.createElement('div');
      header.className = 'chapter-title-header';

      if (state.lang === 'vi') {
        header.innerHTML = `
          <div>${titleVi || titleZh}</div>
          ${titleZh ? `<div class="chapter-title-sub">${titleZh}</div>` : ''}
          <div class="chapter-meta">Chương ${data.id} / ${state.totalChapters} · Bản Tiếng Việt · ${wcVi} từ</div>
        `;
        document.title = `${titleVi || titleZh} - Trọng Phản Đại Học`;
      } else if (state.lang === 'zh') {
        header.innerHTML = `
          <div>${titleZh}</div>
          ${titleVi ? `<div class="chapter-title-sub">${titleVi}</div>` : ''}
          <div class="chapter-meta">第 ${data.id} / ${state.totalChapters} 章 · 中文原版 · 约 ${wcZh} 字</div>
        `;
        document.title = `${titleZh} - 重返大学`;
      } else {
        header.innerHTML = `
          <div>${titleVi || titleZh}</div>
          <div class="chapter-title-sub">${titleZh}</div>
          <div class="chapter-meta">Chương ${data.id} / ${state.totalChapters} · Chế độ Song Ngữ (Việt - Trung)</div>
        `;
        document.title = `Chương ${data.id} (Song ngữ) - Trọng Phản Đại Học`;
      }

      article.appendChild(header);

      if (state.lang === 'vi') {
        const list = (contentVi.length > 0) ? contentVi : contentZh;
        list.forEach(p => {
          const pElem = document.createElement('p');
          pElem.className = 'chapter-paragraph';
          pElem.textContent = p;
          article.appendChild(pElem);
        });
      } else if (state.lang === 'zh') {
        const list = (contentZh.length > 0) ? contentZh : contentVi;
        list.forEach(p => {
          const pElem = document.createElement('p');
          pElem.className = 'chapter-paragraph';
          pElem.textContent = p;
          article.appendChild(pElem);
        });
      } else {
        const maxLen = Math.max(contentVi.length, contentZh.length);
        for (let i = 0; i < maxLen; i++) {
          const block = document.createElement('div');
          block.className = 'dual-paragraph-block';

          if (i < contentVi.length) {
            const pVi = document.createElement('div');
            pVi.className = 'dual-para-vi';
            pVi.textContent = contentVi[i];
            block.appendChild(pVi);
          }

          if (i < contentZh.length) {
            const pZh = document.createElement('div');
            pZh.className = 'dual-para-zh';
            pZh.textContent = contentZh[i];
            block.appendChild(pZh);
          }

          article.appendChild(block);
        }
      }

      article.classList.remove('fade-out');
    }, 40);
  }

  function setLanguage(newLang) {
    if (state.lang === newLang) return;
    state.lang = newLang;
    try { localStorage.setItem('reader_lang', newLang); } catch(e){}

    document.querySelectorAll('[data-lang]').forEach(el => {
      el.classList.toggle('active', el.dataset.lang === newLang);
    });

    renderCurrentChapter();
    renderTocList(state.chapters);
    highlightActiveTocItem();

    const langNames = { vi: 'Tiếng Việt', zh: 'Tiếng Trung (中文)', dual: 'Song ngữ' };
    showToast(`Đã chuyển sang ${langNames[newLang]}`);
  }

  function cycleLanguage() {
    const cycle = { vi: 'zh', zh: 'dual', dual: 'vi' };
    setLanguage(cycle[state.lang] || 'vi');
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
      const zh = (typeof ch.title === 'object' ? ch.title.zh : ch.title) || '';
      const vi = (typeof ch.title === 'object' ? ch.title.vi : '') || '';
      return zh.toLowerCase().includes(q) || vi.toLowerCase().includes(q);
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
    try { localStorage.setItem('reader_theme', theme); } catch(e){}

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
    try { localStorage.setItem('reader_font_size', state.fontSize); } catch(e){}
  }

  function applySpacing(spacing) {
    state.spacing = spacing;
    DOM.body.classList.remove('spacing-compact', 'spacing-normal', 'spacing-loose');
    DOM.body.classList.add(`spacing-${spacing}`);
    try { localStorage.setItem('reader_spacing', spacing); } catch(e){}

    document.querySelectorAll('[data-spacing]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.spacing === spacing);
    });
  }

  function applyFontFamily(font) {
    state.fontFamily = font;
    DOM.body.classList.remove('font-sans', 'font-serif');
    DOM.body.classList.add(`font-${font}`);
    try { localStorage.setItem('reader_font_family', font); } catch(e){}

    document.querySelectorAll('[data-font]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.font === font);
    });
  }

  function setupEventListeners() {
    DOM.btnToc.addEventListener('click', openToc);
    DOM.btnCloseToc.addEventListener('click', closeToc);
    DOM.tocBackdrop.addEventListener('click', closeToc);

    DOM.btnSettings.addEventListener('click', openSettings);
    DOM.btnCloseSettings.addEventListener('click', closeSettings);
    DOM.settingsBackdrop.addEventListener('click', closeSettings);

    document.querySelectorAll('[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });

    DOM.btnSwapBottom.addEventListener('click', cycleLanguage);

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
        showToast(`Vui lòng nhập số chương (1-${state.totalChapters})`);
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
      } else if (e.key === 's' || e.key === 'S') {
        cycleLanguage();
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
    
    document.querySelectorAll('[data-lang]').forEach(el => {
      el.classList.toggle('active', el.dataset.lang === state.lang);
    });

    setupEventListeners();
    initBook();
  }

  init();
})();
