/**
 * Web Reader Core Application - Dual Language + Pinyin Ruby
 * Supports offline file:/// and online GitHub Pages
 */

(function () {
  'use strict';

  const state = {
    currentBookId: localStorage.getItem('reader_current_book') || 'chongfan-daxue',
    currentBookType: localStorage.getItem('reader_current_book_type') || 'builtin',
    currentDataPath: 'data',
    libraryBooks: [],
    uploadedBooks: [],
    bookMeta: null,
    totalChapters: 1251,
    currentChapter: 1,
    currentChapterData: null,
    chapters: [],
    lang: localStorage.getItem('reader_lang') || 'vi',
    pinyin: localStorage.getItem('reader_pinyin') || 'off',
    fontSize: parseInt(localStorage.getItem('reader_font_size')) || 19,
    theme: localStorage.getItem('reader_theme') || 'sepia',
    fontFamily: localStorage.getItem('reader_font_family') || 'sans',
    spacing: localStorage.getItem('reader_spacing') || 'normal',
    chapterCache: new Map(),
    positionsPerLang: { vi: null, zh: null, dual: null },
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

    btnLibrary: document.getElementById('btn-library'),
    btnCloseLibrary: document.getElementById('btn-close-library'),
    libraryDrawer: document.getElementById('library-drawer'),
    libraryBackdrop: document.getElementById('library-backdrop'),
    libraryBuiltinList: document.getElementById('library-builtin-list'),
    libraryUploadedList: document.getElementById('library-uploaded-list'),
    btnToggleUpload: document.getElementById('btn-toggle-upload'),
    uploadPanel: document.getElementById('upload-panel'),
    uploadBookTitle: document.getElementById('upload-book-title'),
    uploadFileInput: document.getElementById('upload-file-input'),
    uploadFileLabel: document.getElementById('upload-file-label'),
    uploadProgressWrap: document.getElementById('upload-progress-wrap'),
    uploadProgressFill: document.getElementById('upload-progress-fill'),
    uploadProgressText: document.getElementById('upload-progress-text'),
    btnConfirmUpload: document.getElementById('btn-confirm-upload'),
    
    btnToc: document.getElementById('btn-toc'),
    btnCloseToc: document.getElementById('btn-close-toc'),
    tocDrawer: document.getElementById('toc-drawer'),
    tocBackdrop: document.getElementById('toc-backdrop'),
    tocList: document.getElementById('toc-list'),
    tocCount: document.getElementById('toc-count'),
    tocSearch: document.getElementById('toc-search'),
    tocJumpShortcuts: document.getElementById('toc-jump-shortcuts'),
    btnJumpInput: document.getElementById('btn-jump-input'),
    
        btnPinyinToggle: document.getElementById('btn-pinyin-toggle'),
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

  function fetchChapterData(chapterId) {
    return new Promise((resolve, reject) => {
      if (state.chapterCache.has(chapterId)) {
        return resolve(state.chapterCache.get(chapterId));
      }

      if (state.currentBookType === 'uploaded' && window.BookLibrary) {
        window.BookLibrary.getUploadedChapter(state.currentBookId, chapterId)
          .then(data => {
            if (!data) throw new Error('Chapter not found in IndexedDB');
            state.chapterCache.set(chapterId, data);
            resolve(data);
          })
          .catch(reject);
        return;
      }

      const basePath = state.currentDataPath || 'data';
      if (window.location.protocol.startsWith('http')) {
        fetch(`${basePath}/chapters/${chapterId}.json?v=14.0`)
          .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(data => {
            state.chapterCache.set(chapterId, data);
            resolve(data);
          })
          .catch(err => {
            loadViaScript(chapterId, resolve, reject, basePath);
          });
      } else {
        loadViaScript(chapterId, resolve, reject, basePath);
      }
    });
  }

  function loadViaScript(chapterId, resolve, reject, basePath = 'data') {
    const callbackFn = `loadChapterCallback_${chapterId}`;
    if (basePath === 'data' && window[callbackFn]) {
      const data = window[callbackFn]();
      state.chapterCache.set(chapterId, data);
      return resolve(data);
    }

    const script = document.createElement('script');
    script.src = `${basePath}/chapters/${chapterId}.js?v=14.0`;
    
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

  function getSavedChapterForBook(bookId) {
    const specific = parseInt(localStorage.getItem(`reader_last_chapter_${bookId}`));
    if (!isNaN(specific) && specific >= 1) return specific;
    if (bookId === 'chongfan-daxue') {
      const legacy = parseInt(localStorage.getItem('reader_last_chapter'));
      if (!isNaN(legacy) && legacy >= 1) return legacy;
    }
    return 1;
  }

  function saveChapterForBook(bookId, chapterId) {
    try {
      localStorage.setItem(`reader_last_chapter_${bookId}`, chapterId);
      if (bookId === 'chongfan-daxue') {
        localStorage.setItem('reader_last_chapter', chapterId);
      }
    } catch (e) {}
  }

  function renderTocShortcuts(total) {
    if (!DOM.tocJumpShortcuts) return;
    const points = [1];
    if (total > 10) {
      const step1 = Math.max(2, Math.round(total * 0.25));
      const step2 = Math.max(step1 + 1, Math.round(total * 0.5));
      const step3 = Math.max(step2 + 1, Math.round(total * 0.75));
      [step1, step2, step3].forEach(p => {
        if (p < total && !points.includes(p)) points.push(p);
      });
    }
    if (total > 1 && !points.includes(total)) points.push(total);

    DOM.tocJumpShortcuts.innerHTML = points.map((p, idx) => {
      const label = p === 1 ? 'Chương 1' : (idx === points.length - 1 ? `Mới nhất (${p})` : `${p}`);
      return `<button class="chip" data-jump="${p}">${label}</button>`;
    }).join('');

    DOM.tocJumpShortcuts.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const jumpTarget = parseInt(chip.dataset.jump);
        closeToc();
        loadChapter(jumpTarget);
      });
    });
  }

  async function loadLibraryData() {
    // 1. Load builtin GitHub books
    try {
      if (window.location.protocol.startsWith('http')) {
        const res = await fetch('data/library.json?v=14.0');
        if (res.ok) {
          const lib = await res.json();
          state.libraryBooks = lib.books || [];
        }
      }
    } catch (e) {}
    if (state.libraryBooks.length === 0 && window.LIBRARY_DATA) {
      state.libraryBooks = window.LIBRARY_DATA.books || [];
    }

    // 2. Load user-uploaded books from IndexedDB
    if (window.BookLibrary) {
      try {
        state.uploadedBooks = await window.BookLibrary.getAllUploadedBooks();
      } catch (e) {
        console.warn('IndexedDB unavailable:', e);
        state.uploadedBooks = [];
      }
    }
  }

  async function selectBook(bookId, bookType, targetChapter = null) {
    state.chapterCache.clear();
    state.currentBookId = bookId;
    state.currentBookType = bookType;

    try {
      localStorage.setItem('reader_current_book', bookId);
      localStorage.setItem('reader_current_book_type', bookType);
    } catch (e) {}

    if (bookType === 'uploaded' && window.BookLibrary) {
      const book = await window.BookLibrary.getUploadedBook(bookId);
      if (!book) {
        showToast('Không tìm thấy truyện đã upload, chuyển về truyện mặc định');
        return selectBook('chongfan-daxue', 'builtin', 1);
      }
      state.bookMeta = book;
      state.chapters = book.chapters || [];
      state.totalChapters = book.totalChapters || state.chapters.length;
      state.currentDataPath = '';

      // Auto-switch to the book's available language if current lang has no content
      if (book.langMode === 'zh' && state.lang === 'vi') {
        state.lang = 'zh';
      } else if (book.langMode === 'vi' && state.lang === 'zh') {
        state.lang = 'vi';
      }
      document.querySelectorAll('[data-lang]').forEach(el => {
        el.classList.toggle('active', el.dataset.lang === state.lang);
      });
    } else {
      const entry = state.libraryBooks.find(b => b.id === bookId) || { id: 'chongfan-daxue', dataPath: 'data' };
      state.currentDataPath = entry.dataPath || 'data';

      if (state.currentDataPath === 'data' && window.BOOK_DATA && !window.location.protocol.startsWith('http')) {
        state.bookMeta = window.BOOK_DATA;
      } else {
        try {
          const res = await fetch(`${state.currentDataPath}/book.json?v=14.0`);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          state.bookMeta = await res.json();
        } catch (err) {
          if (state.currentDataPath === 'data' && window.BOOK_DATA) {
            state.bookMeta = window.BOOK_DATA;
          } else {
            throw err;
          }
        }
      }
      state.chapters = state.bookMeta.chapters || [];
      state.totalChapters = state.bookMeta.totalChapters || state.chapters.length;
    }

    DOM.tocCount.textContent = state.totalChapters;
    renderTocShortcuts(state.totalChapters);
    renderTocList(state.chapters);
    renderLibraryLists();

    const chToLoad = targetChapter || getSavedChapterForBook(bookId);
    const validCh = Math.min(Math.max(1, chToLoad), Math.max(1, state.totalChapters));
    await loadChapter(validCh);
  }

  async function initBook() {
    try {
      await loadLibraryData();

      const hashInfo = parseHashState();
      let initialBookId = state.currentBookId;
      let initialBookType = state.currentBookType;

      if (hashInfo && hashInfo.bookId) {
        const isUploaded = state.uploadedBooks.some(b => b.id === hashInfo.bookId);
        initialBookId = hashInfo.bookId;
        initialBookType = isUploaded ? 'uploaded' : 'builtin';
      } else if (initialBookType === 'uploaded' && !state.uploadedBooks.some(b => b.id === initialBookId)) {
        initialBookId = 'chongfan-daxue';
        initialBookType = 'builtin';
      }

      await selectBook(initialBookId, initialBookType, hashInfo ? hashInfo.chapter : null);
    } catch (err) {
      console.error('Failed to load book metadata:', err);
      showToast('Tải danh mục thất bại, vui lòng thử lại');
    }
  }

  function parseHashState() {
    const hash = window.location.hash;
    const bookMatch = hash.match(/^#book=([^&]+)&ch=(\d+)$/);
    if (bookMatch) {
      return { bookId: decodeURIComponent(bookMatch[1]), chapter: parseInt(bookMatch[2], 10) };
    }
    const chMatch = hash.match(/^#ch-(\d+)$/);
    if (chMatch) {
      return { bookId: null, chapter: parseInt(chMatch[1], 10) };
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

      let titlePrimary, titleSecondary;
      const hasVi = ch.title && ch.title.vi;

      if (state.lang === 'zh') {
        titlePrimary = ch.title.zh || ch.title;
        titleSecondary = hasVi ? ch.title.vi : '<span style="opacity:0.6;">(Chưa dịch)</span>';
      } else {
        titlePrimary = hasVi ? ch.title.vi : (ch.title.zh || `Chương ${ch.id}`);
        titleSecondary = hasVi ? (ch.title.zh || '') : '<span style="opacity:0.6;">(Đang chờ dịch)</span>';
      }

      btn.innerHTML = `
        <span class="toc-item-title-primary">${titlePrimary}</span>
        <span class="toc-item-title-secondary">${titleSecondary}</span>
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
    state.positionsPerLang = { vi: null, zh: null, dual: null };
    window.location.hash = state.currentBookId === 'chongfan-daxue'
      ? `#ch-${chapterId}`
      : `#book=${encodeURIComponent(state.currentBookId)}&ch=${chapterId}`;
    saveChapterForBook(state.currentBookId, chapterId);

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

      function captureCurrentLangPosition() {
    const article = DOM.chapterArticle;
    if (!article || article.children.length === 0) return;

    const topOffset = 70;
    const paras = Array.from(article.children);
    let currentParaIndex = 0;
    let currentParaOffset = 0;

    for (let i = 0; i < paras.length; i++) {
      const rect = paras[i].getBoundingClientRect();
      if (rect.bottom > topOffset) {
        currentParaIndex = i;
        currentParaOffset = rect.top - topOffset;
        break;
      }
    }

    state.positionsPerLang[state.lang] = {
      paraIndex: currentParaIndex,
      paraOffset: currentParaOffset,
      scrollY: window.scrollY
    };
  }

  function renderCurrentChapter() {
    if (!state.currentChapterData) return;
    const data = state.currentChapterData;
    const article = DOM.chapterArticle;

    article.style.minHeight = article.offsetHeight + 'px';

    const titleZh = typeof data.title === 'object' ? (data.title.zh_ruby || data.title.zh) : data.title;
    const titleZhPlain = typeof data.title === 'object' ? data.title.zh : data.title;
    const titleVi = typeof data.title === 'object' ? data.title.vi : data.title;
    const wcZh = typeof data.wordCount === 'object' ? data.wordCount.zh : (data.wordCount || 0);
    const wcVi = typeof data.wordCount === 'object' ? data.wordCount.vi : (data.wordCount || 0);

    const contentZh = (data.content && data.content.zh_ruby) ? data.content.zh_ruby : ((data.content && data.content.zh) ? data.content.zh : []);
    const contentVi = (data.content && data.content.vi) ? data.content.vi : [];

    article.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'chapter-title-header';

    const bookTitleObj = (state.bookMeta && state.bookMeta.title) || {};
    const bookNameVi = (typeof bookTitleObj === 'object' ? (bookTitleObj.vi || bookTitleObj.zh) : bookTitleObj) || 'Web Reader';
    const bookNameZh = (typeof bookTitleObj === 'object' ? (bookTitleObj.zh || bookTitleObj.vi) : bookTitleObj) || 'Web Reader';

    if (state.lang === 'vi') {
      header.innerHTML = `
        <div>${titleVi || titleZhPlain}</div>
        ${titleZhPlain && titleZhPlain !== titleVi ? `<div class="chapter-title-sub">${titleZh}</div>` : ''}
        <div class="chapter-meta">Chương ${data.id} / ${state.totalChapters} · Bản Tiếng Việt · ${wcVi} từ</div>
      `;
      document.title = `${titleVi || titleZhPlain} - ${bookNameVi}`;
    } else if (state.lang === 'zh') {
      header.innerHTML = `
        <div>${titleZh || titleVi}</div>
        ${titleVi && titleVi !== titleZhPlain ? `<div class="chapter-title-sub">${titleVi}</div>` : ''}
        <div class="chapter-meta">第 ${data.id} / ${state.totalChapters} 章 · 中文原版 · 约 ${wcZh} 字</div>
      `;
      document.title = `${titleZhPlain || titleVi} - ${bookNameZh}`;
    } else {
      header.innerHTML = `
        <div>${titleVi || titleZhPlain}</div>
        ${titleZh ? `<div class="chapter-title-sub">${titleZh}</div>` : ''}
        <div class="chapter-meta">Chương ${data.id} / ${state.totalChapters} · Chế độ Song Ngữ (Việt - Trung)</div>
      `;
      document.title = `Chương ${data.id} (Song ngữ) - ${bookNameVi}`;
    }

    article.appendChild(header);

    if (state.lang === 'vi') {
      if (contentVi.length === 0) {
        const notice = document.createElement('div');
        notice.className = 'untranslated-box';
        notice.innerHTML = `
          <div style="font-size: 38px; margin-bottom: 12px;">⏳</div>
          <h3 style="margin-bottom: 8px; font-size: 1.1em;">Chương này chưa có bản Tiếng Việt</h3>
          <p style="color: var(--text-muted); font-size: 0.9em; margin-bottom: 20px; line-height: 1.6;">
            Hiện tại chương này mới có bản Tiếng Trung.<br>
            Bạn có thể chuyển sang bản <strong>Tiếng Trung</strong> để đọc ngay.
          </p>
          <button id="btn-fallback-zh" class="nav-chapter-btn lang-swap-btn" style="display:inline-flex; width:auto; padding:10px 24px;">
            🇨🇳 Đọc bản Tiếng Trung
          </button>
        `;
        article.appendChild(notice);
        const fbBtn = notice.querySelector('#btn-fallback-zh');
        if (fbBtn) {
          fbBtn.addEventListener('click', () => setLanguage('zh'));
        }
      } else {
        contentVi.forEach(p => {
          const pElem = document.createElement('p');
          pElem.className = 'chapter-paragraph';
          pElem.textContent = p;
          article.appendChild(pElem);
        });
      }
    } else if (state.lang === 'zh') {
      if (contentZh.length === 0) {
        const notice = document.createElement('div');
        notice.className = 'untranslated-box';
        notice.innerHTML = `
          <div style="font-size: 38px; margin-bottom: 12px;">📖</div>
          <h3 style="margin-bottom: 8px; font-size: 1.1em;">Chương này chưa có bản Tiếng Trung</h3>
          <p style="color: var(--text-muted); font-size: 0.9em; margin-bottom: 20px; line-height: 1.6;">
            Truyện này chỉ có bản Tiếng Việt. Bạn có thể chuyển ngay sang Tiếng Việt để đọc.
          </p>
          <button id="btn-fallback-vi" class="nav-chapter-btn lang-swap-btn" style="display:inline-flex; width:auto; padding:10px 24px;">
            🇻🇳 Đọc bản Tiếng Việt
          </button>
        `;
        article.appendChild(notice);
        const fbBtn = notice.querySelector('#btn-fallback-vi');
        if (fbBtn) {
          fbBtn.addEventListener('click', () => setLanguage('vi'));
        }
      } else {
        contentZh.forEach(p => {
          const pElem = document.createElement('p');
          pElem.className = 'chapter-paragraph';
          pElem.innerHTML = p;
          article.appendChild(pElem);
        });
      }
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
          pZh.innerHTML = contentZh[i];
          block.appendChild(pZh);
        }

        article.appendChild(block);
      }
    }

    article.style.minHeight = '';
  }

  function setLanguage(newLang) {
    if (state.lang === newLang) return;

    // 1. Capture current reading position for current language
    captureCurrentLangPosition();

    // 2. Switch language
    state.lang = newLang;
    try { localStorage.setItem('reader_lang', newLang); } catch(e){}

    document.querySelectorAll('[data-lang]').forEach(el => {
      el.classList.toggle('active', el.dataset.lang === newLang);
    });

    // 3. Render content
    renderCurrentChapter();

    // 4. Restore the independent position of the target language
    const savedPos = state.positionsPerLang[newLang];
    if (savedPos && DOM.chapterArticle.children.length > 0) {
      const targetElem = DOM.chapterArticle.children[Math.min(savedPos.paraIndex, DOM.chapterArticle.children.length - 1)];
      if (targetElem) {
        const targetRect = targetElem.getBoundingClientRect();
        const currentScroll = window.scrollY;
        const targetY = currentScroll + targetRect.top - 70 - savedPos.paraOffset;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'instant' });
      }
    } else {
      // If target language has no saved position yet in this chapter, start at top (0)
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    renderTocList(state.chapters);
    highlightActiveTocItem();

    const langNames = { vi: 'Tiếng Việt', zh: 'Tiếng Trung (中文)', dual: 'Song ngữ' };
    showToast(`Đã chuyển sang ${langNames[newLang]}`);
  }

    function setPinyin(pinyinMode) {
    // Capture the exact visible paragraph anchor before height expansion
    const article = DOM.chapterArticle;
    let anchorPara = null;
    let anchorOffset = 0;
    const topOffset = 70;

    if (article && article.children.length > 0) {
      const paras = Array.from(article.children);
      for (let i = 0; i < paras.length; i++) {
        const rect = paras[i].getBoundingClientRect();
        if (rect.bottom > topOffset) {
          anchorPara = paras[i];
          anchorOffset = rect.top - topOffset;
          break;
        }
      }
    }

    state.pinyin = pinyinMode;
    try { localStorage.setItem('reader_pinyin', pinyinMode); } catch(e){}

    DOM.body.classList.toggle('show-pinyin', pinyinMode === 'on');

    if (DOM.btnPinyinToggle) {
      DOM.btnPinyinToggle.classList.toggle('active', pinyinMode === 'on');
    }

    document.querySelectorAll('[data-pinyin]').forEach(el => {
      el.classList.toggle('active', el.dataset.pinyin === pinyinMode);
    });

    // Re-anchor scroll position instantly so the current paragraph does not jump!
    if (anchorPara) {
      const newRect = anchorPara.getBoundingClientRect();
      const delta = newRect.top - topOffset - anchorOffset;
      if (Math.abs(delta) > 0.5) {
        window.scrollBy({ top: delta, behavior: 'instant' });
      }
    }

    showToast(pinyinMode === 'on' ? 'Đã bật hiển thị Pinyin' : 'Đã tắt Pinyin');
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

  function openLibrary() {
    renderLibraryLists();
    if (DOM.libraryDrawer) DOM.libraryDrawer.classList.add('open');
  }

  function closeLibrary() {
    if (DOM.libraryDrawer) DOM.libraryDrawer.classList.remove('open');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  function createBookCard(book, isUploaded) {
    const isActive = state.currentBookId === book.id && state.currentBookType === (isUploaded ? 'uploaded' : 'builtin');
    const titleObj = book.title || {};
    const primaryTitle = typeof titleObj === 'object' ? (titleObj.vi || titleObj.zh || 'Không tên') : titleObj;
    const subTitle = typeof titleObj === 'object' && titleObj.zh && titleObj.vi && titleObj.zh !== titleObj.vi ? titleObj.zh : '';
    const savedCh = getSavedChapterForBook(book.id);
    const total = book.totalChapters || (book.chapters ? book.chapters.length : 0);

    const card = document.createElement('div');
    card.className = `book-card ${isActive ? 'active' : ''}`;
    card.innerHTML = `
      <div class="book-card-header">
        <div>
          <div class="book-card-title">${escapeHtml(primaryTitle)}</div>
          ${subTitle ? `<div class="book-card-sub">${escapeHtml(subTitle)}</div>` : ''}
        </div>
        ${isActive ? '<span class="book-badge">Đang đọc</span>' : ''}
      </div>
      <div class="book-card-meta">
        <span>📖 ${total} chương</span>
        <span>🔖 Đọc đến: Ch.${Math.min(savedCh, Math.max(1, total))}</span>
        ${book.author ? `<span>✍️ ${escapeHtml(book.author)}</span>` : ''}
      </div>
      <div class="book-card-actions">
        <button class="book-btn primary btn-read-book">${isActive ? 'Đọc tiếp' : 'Chọn đọc'}</button>
        ${isUploaded ? '<button class="book-btn btn-export-book" title="Tải về file JSON">Xuất JSON</button>' : ''}
        ${isUploaded ? '<button class="book-btn danger btn-delete-book">Xóa</button>' : ''}
      </div>
    `;

    card.querySelector('.btn-read-book').addEventListener('click', async () => {
      closeLibrary();
      if (!isActive) {
        await selectBook(book.id, isUploaded ? 'uploaded' : 'builtin');
        showToast(`Đã chuyển sang: ${primaryTitle}`);
      }
    });

    if (isUploaded) {
      const exportBtn = card.querySelector('.btn-export-book');
      if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
          try {
            showToast('Đang đóng gói JSON...');
            const payload = await window.BookLibrary.exportUploadedBook(book.id);
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${primaryTitle}.json`;
            a.click();
            URL.revokeObjectURL(url);
          } catch (err) {
            showToast('Xuất file thất bại: ' + err.message);
          }
        });
      }

      const delBtn = card.querySelector('.btn-delete-book');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (!confirm(`Xóa truyện "${primaryTitle}" khỏi bộ nhớ trình duyệt?`)) return;
          try {
            await window.BookLibrary.deleteUploadedBook(book.id);
            state.uploadedBooks = await window.BookLibrary.getAllUploadedBooks();
            if (isActive) {
              await selectBook('chongfan-daxue', 'builtin', 1);
            } else {
              renderLibraryLists();
            }
            showToast('Đã xóa truyện');
          } catch (err) {
            showToast('Xóa thất bại: ' + err.message);
          }
        });
      }
    }

    return card;
  }

  function renderLibraryLists() {
    if (DOM.libraryBuiltinList) {
      DOM.libraryBuiltinList.innerHTML = '';
      state.libraryBooks.forEach(b => {
        DOM.libraryBuiltinList.appendChild(createBookCard(b, false));
      });
    }

    if (DOM.libraryUploadedList) {
      DOM.libraryUploadedList.innerHTML = '';
      if (state.uploadedBooks.length === 0) {
        DOM.libraryUploadedList.innerHTML = '<div class="library-empty">Chưa có truyện nào được upload. Nhấn "+ Upload truyện mới" ở trên để nạp file .txt, .epub hoặc .json.</div>';
      } else {
        state.uploadedBooks.forEach(b => {
          DOM.libraryUploadedList.appendChild(createBookCard(b, true));
        });
      }
    }
  }

  function setupUploadUI() {
    if (!DOM.btnToggleUpload || !DOM.uploadPanel) return;

    let selectedFiles = [];
    let uploadLangPref = 'auto';

    DOM.btnToggleUpload.addEventListener('click', () => {
      DOM.uploadPanel.classList.toggle('hidden');
    });

    document.querySelectorAll('[data-upload-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        uploadLangPref = btn.dataset.uploadLang;
        document.querySelectorAll('[data-upload-lang]').forEach(b => {
          b.classList.toggle('active', b.dataset.uploadLang === uploadLangPref);
        });
      });
    });

    function handleChosenFiles(fileList) {
      selectedFiles = Array.from(fileList || []);
      if (selectedFiles.length === 0) {
        DOM.uploadFileLabel.innerHTML = 'Chạm để chọn file <strong>.txt</strong>, <strong>.epub</strong>, <strong>.json</strong> hoặc chọn nhiều file chương cùng lúc';
        DOM.btnConfirmUpload.disabled = true;
        return;
      }
      if (selectedFiles.length === 1) {
        const mb = (selectedFiles[0].size / (1024 * 1024)).toFixed(2);
        DOM.uploadFileLabel.innerHTML = `✅ Đã chọn: <strong>${escapeHtml(selectedFiles[0].name)}</strong> (${mb} MB)`;
        if (!DOM.uploadBookTitle.value.trim()) {
          DOM.uploadBookTitle.value = selectedFiles[0].name.replace(/\.(txt|md|epub|json)$/i, '');
        }
      } else {
        DOM.uploadFileLabel.innerHTML = `✅ Đã chọn <strong>${selectedFiles.length} file</strong> chương truyện`;
      }
      DOM.btnConfirmUpload.disabled = false;
    }

    DOM.uploadFileInput.addEventListener('change', (e) => {
      handleChosenFiles(e.target.files);
    });

    const dropzone = DOM.uploadFileInput.closest('.upload-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files) {
          handleChosenFiles(e.dataTransfer.files);
        }
      });
    }

    DOM.btnConfirmUpload.addEventListener('click', async () => {
      if (selectedFiles.length === 0 || !window.BookLibrary) return;

      DOM.btnConfirmUpload.disabled = true;
      DOM.uploadProgressWrap.classList.remove('hidden');
      DOM.uploadProgressFill.style.width = '10%';
      DOM.uploadProgressText.textContent = 'Đang đọc và tách chương...';

      try {
        const customTitle = DOM.uploadBookTitle.value.trim();
        const firstName = selectedFiles[0].name.toLowerCase();
        let bookMeta, chapters;

        if (selectedFiles.length === 1 && firstName.endsWith('.json')) {
          const parsed = await window.BookLibrary.parseJsonBookFile(selectedFiles[0]);
          bookMeta = parsed.book;
          bookMeta.id = 'up-' + Date.now();
          bookMeta.updatedAt = Date.now();
          if (customTitle) {
            bookMeta.title = { vi: customTitle, zh: customTitle };
          }
          chapters = parsed.chapters;
        } else {
          let parsed;
          if (selectedFiles.length === 1 && firstName.endsWith('.epub')) {
            parsed = await window.BookLibrary.parseEpubFile(selectedFiles[0], {
              bookTitle: customTitle,
              langPref: uploadLangPref
            });
          } else {
            parsed = await window.BookLibrary.parseTxtFiles(selectedFiles, {
              bookTitle: customTitle,
              langPref: uploadLangPref
            });
          }

          const bookId = 'up-' + Date.now();
          const titleObj = parsed.lang === 'zh'
            ? { zh: parsed.title, vi: '' }
            : { vi: parsed.title, zh: '' };

          chapters = parsed.chapters;
          bookMeta = {
            id: bookId,
            title: titleObj,
            author: parsed.author || 'Người dùng tải lên',
            langMode: parsed.lang,
            totalChapters: chapters.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            chapters: chapters.map(c => ({
              id: c.id,
              title: c.title,
              wordCount: c.wordCount
            }))
          };
        }

        DOM.uploadProgressText.textContent = `Đang lưu ${chapters.length} chương vào trình duyệt...`;
        await window.BookLibrary.saveUploadedBook(bookMeta, chapters, (pct) => {
          DOM.uploadProgressFill.style.width = `${pct}%`;
          DOM.uploadProgressText.textContent = `Đang lưu ${chapters.length} chương (${pct}%)...`;
        });

        state.uploadedBooks = await window.BookLibrary.getAllUploadedBooks();

        // Reset upload form
        selectedFiles = [];
        DOM.uploadFileInput.value = '';
        DOM.uploadBookTitle.value = '';
        DOM.uploadFileLabel.innerHTML = 'Chạm để chọn file <strong>.txt</strong>, <strong>.epub</strong>, <strong>.json</strong> hoặc chọn nhiều file chương cùng lúc';
        DOM.uploadProgressWrap.classList.add('hidden');
        DOM.uploadProgressFill.style.width = '0%';
        DOM.uploadPanel.classList.add('hidden');

        closeLibrary();
        await selectBook(bookMeta.id, 'uploaded', 1);
        showToast(`Đã nạp thành công ${chapters.length} chương!`);
      } catch (err) {
        console.error('Upload failed:', err);
        showToast('Lỗi nạp truyện: ' + err.message, 3200);
        DOM.uploadProgressWrap.classList.add('hidden');
        DOM.btnConfirmUpload.disabled = false;
      }
    });
  }

  function setupEventListeners() {
    if (DOM.btnLibrary) DOM.btnLibrary.addEventListener('click', openLibrary);
    if (DOM.btnCloseLibrary) DOM.btnCloseLibrary.addEventListener('click', closeLibrary);
    if (DOM.libraryBackdrop) DOM.libraryBackdrop.addEventListener('click', closeLibrary);
    setupUploadUI();

    DOM.btnToc.addEventListener('click', openToc);
    DOM.btnCloseToc.addEventListener('click', closeToc);
    DOM.tocBackdrop.addEventListener('click', closeToc);

        if (DOM.btnPinyinToggle) {
      DOM.btnPinyinToggle.addEventListener('click', (e) => {
        e.preventDefault();
        setPinyin(state.pinyin === 'on' ? 'off' : 'on');
      });
    }
    DOM.btnSettings.addEventListener('click', openSettings);
    DOM.btnCloseSettings.addEventListener('click', closeSettings);
    DOM.settingsBackdrop.addEventListener('click', closeSettings);

    document.querySelectorAll('[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });

    document.querySelectorAll('[data-pinyin]').forEach(btn => {
      btn.addEventListener('click', () => setPinyin(btn.dataset.pinyin));
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
      } else if (e.key === 'p' || e.key === 'P') {
        setPinyin(state.pinyin === 'on' ? 'off' : 'on');
      }
    });

    window.addEventListener('hashchange', () => {
      const info = parseHashState();
      if (!info) return;
      if (info.bookId && info.bookId !== state.currentBookId) {
        const isUp = state.uploadedBooks.some(b => b.id === info.bookId);
        selectBook(info.bookId, isUp ? 'uploaded' : 'builtin', info.chapter);
      } else if (info.chapter && info.chapter !== state.currentChapter) {
        loadChapter(info.chapter);
      }
    });

    // Tap reading area to toggle header & bottom bar
    let touchStartX = 0;
    let touchStartY = 0;
    let isTouchMove = false;

    const readingContainer = document.getElementById('reader-main');

    if (readingContainer) {
      readingContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          isTouchMove = false;
        }
      }, { passive: true });

      readingContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
          const dx = Math.abs(e.touches[0].clientX - touchStartX);
          const dy = Math.abs(e.touches[0].clientY - touchStartY);
          if (dx > 8 || dy > 8) {
            isTouchMove = true;
          }
        }
      }, { passive: true });

      readingContainer.addEventListener('click', (e) => {
        // Do not toggle if user is selecting/highlighting text for Gemini/dictionary
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) return;
        if (isTouchMove) return;

        // Do not toggle if clicking on navigation buttons or interactive controls
        if (e.target.closest('button, a, input, select, textarea, .page-chapter-nav, .app-bar')) return;

        // Toggle top and bottom bar
        const isCurrentlyHidden = DOM.topBar.classList.contains('hide-bar');
        DOM.topBar.classList.toggle('hide-bar', !isCurrentlyHidden);
        DOM.bottomBar.classList.toggle('hide-bar', !isCurrentlyHidden);
      });
    }
  }

  function init() {
    applyTheme(state.theme);
    applyFontSize(state.fontSize);
    applySpacing(state.spacing);
    applyFontFamily(state.fontFamily);
    
    // Apply Pinyin
    DOM.body.classList.toggle('show-pinyin', state.pinyin === 'on');
    document.querySelectorAll('[data-pinyin]').forEach(el => {
      el.classList.toggle('active', el.dataset.pinyin === state.pinyin);
    });

    document.querySelectorAll('[data-lang]').forEach(el => {
      el.classList.toggle('active', el.dataset.lang === state.lang);
    });

    setupEventListeners();
    initBook();
  }

  init();
})();
