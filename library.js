/**
 * Book Library & In-Browser Upload Module (TXT, Multi-TXT, EPUB, JSON)
 * Stores user-uploaded books in IndexedDB for persistent reading on GitHub Pages & iOS PWA.
 */

(function (global) {
  'use strict';

  const DB_NAME = 'ReaderLibraryDB';
  const DB_VERSION = 1;
  const STORE_BOOKS = 'books';
  const STORE_CHAPTERS = 'chapters';

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        return reject(new Error('Trình duyệt không hỗ trợ IndexedDB để lưu truyện.'));
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_BOOKS)) {
          db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
          const chStore = db.createObjectStore(STORE_CHAPTERS, { keyPath: 'key' });
          chStore.createIndex('bookId', 'bookId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Không thể mở cơ sở dữ liệu IndexedDB.'));
    });
  }

  async function getAllUploadedBooks() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readonly');
      const req = tx.objectStore(STORE_BOOKS).getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function getUploadedBook(bookId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readonly');
      const req = tx.objectStore(STORE_BOOKS).get(bookId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function getUploadedChapter(bookId, chapterId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHAPTERS, 'readonly');
      const req = tx.objectStore(STORE_CHAPTERS).get(`${bookId}::${chapterId}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveUploadedBook(bookMeta, chaptersArray, onProgress) {
    const db = await openDB();
    const BATCH_SIZE = 200;

    // Save chapters in batches to keep UI responsive
    for (let start = 0; start < chaptersArray.length; start += BATCH_SIZE) {
      const batch = chaptersArray.slice(start, start + BATCH_SIZE);
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CHAPTERS, 'readwrite');
        const store = tx.objectStore(STORE_CHAPTERS);
        batch.forEach((ch) => {
          store.put({
            key: `${bookMeta.id}::${ch.id}`,
            bookId: bookMeta.id,
            id: ch.id,
            title: ch.title,
            wordCount: ch.wordCount,
            content: ch.content
          });
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      if (onProgress) {
        onProgress(Math.min(100, Math.round(((start + batch.length) / chaptersArray.length) * 100)));
      }
    }

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      tx.objectStore(STORE_BOOKS).put(bookMeta);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deleteUploadedBook(bookId) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_BOOKS, STORE_CHAPTERS], 'readwrite');
      tx.objectStore(STORE_BOOKS).delete(bookId);
      const chStore = tx.objectStore(STORE_CHAPTERS);
      const index = chStore.index('bookId');
      const cursorReq = index.openKeyCursor(IDBKeyRange.only(bookId));
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          chStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function exportUploadedBook(bookId) {
    const book = await getUploadedBook(bookId);
    if (!book) throw new Error('Không tìm thấy truyện trong bộ nhớ.');
    const db = await openDB();
    const chapters = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHAPTERS, 'readonly');
      const index = tx.objectStore(STORE_CHAPTERS).index('bookId');
      const req = index.getAll(IDBKeyRange.only(bookId));
      req.onsuccess = () => {
        const list = (req.result || []).sort((a, b) => a.id - b.id);
        resolve(list.map(({ id, title, wordCount, content }) => ({ id, title, wordCount, content })));
      };
      req.onerror = () => reject(req.error);
    });
    return { book, chapters };
  }

  // =========================================================================
  // Text Decoding & Language Detection
  // =========================================================================

  function decodeBufferSmart(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(bytes.slice(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return new TextDecoder('utf-16be').decode(bytes.slice(2));
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (_) {
      try {
        return new TextDecoder('gb18030').decode(bytes);
      } catch (__) {
        return new TextDecoder('utf-8').decode(bytes);
      }
    }
  }

  function detectLanguage(textSample) {
    const sample = textSample.slice(0, 8000);
    const hanMatches = sample.match(/[\u4e00-\u9fff]/g);
    const hanCount = hanMatches ? hanMatches.length : 0;
    const latinMatches = sample.match(/[a-zA-ZÀ-ỹ]/g);
    const latinCount = latinMatches ? latinMatches.length : 0;
    return hanCount > latinCount * 0.25 ? 'zh' : 'vi';
  }

  function countWords(paras, lang) {
    if (lang === 'zh') {
      return paras.reduce((sum, p) => sum + p.length, 0);
    }
    return paras.reduce((sum, p) => sum + (p.trim() ? p.trim().split(/\s+/).length : 0), 0);
  }

  function buildChapterObject(id, titleStr, paras, lang) {
    const wc = countWords(paras, lang);
    if (lang === 'zh') {
      return {
        id,
        title: { zh: titleStr, vi: '' },
        wordCount: { zh: wc, vi: 0 },
        content: { zh: paras, vi: [] }
      };
    }
    return {
      id,
      title: { vi: titleStr, zh: '' },
      wordCount: { vi: wc, zh: 0 },
      content: { vi: paras, zh: [] }
    };
  }

  function splitSingleTextIntoChapters(rawText, langPref) {
    const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lang = langPref === 'auto' ? detectLanguage(text) : langPref;
    const lines = text.split('\n');

    const zhHeadingRe = /^\s*(第\s*[0-9零一二三四五六七八九十百千万两]+\s*[章回节卷集][^\n]{0,60})$/;
    const viHeadingRe = /^\s*((?:Chương|CHƯƠNG|Hồi|HỒI|Quyển|Chapter|CHAPTER)\s+\d+[^\n]{0,80})$/;

    const chapters = [];
    let currentTitle = null;
    let currentParas = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/^[\u3000\s]+|[\u3000\s]+$/g, '');
      if (!line) continue;

      const isHeading = zhHeadingRe.test(line) || viHeadingRe.test(line);
      if (isHeading && line.length <= 85) {
        if (currentTitle !== null || currentParas.length > 0) {
          chapters.push(buildChapterObject(
            chapters.length + 1,
            currentTitle || (lang === 'zh' ? `第${chapters.length + 1}章` : `Chương ${chapters.length + 1}`),
            currentParas,
            lang
          ));
        }
        currentTitle = line.replace(/^#+\s*/, '').trim();
        currentParas = [];
      } else {
        currentParas.push(line);
      }
    }

    if (currentTitle !== null || currentParas.length > 0) {
      chapters.push(buildChapterObject(
        chapters.length + 1,
        currentTitle || (lang === 'zh' ? `第${chapters.length + 1}章` : `Phần ${chapters.length + 1}`),
        currentParas,
        lang
      ));
    }

    // Fallback: if no chapter headings were found and text is very long, split into ~3500-char chunks
    if (chapters.length === 1 && chapters[0].content[lang].length > 80) {
      const allParas = chapters[0].content[lang];
      const chunked = [];
      let buf = [];
      let bufLen = 0;
      for (const p of allParas) {
        buf.push(p);
        bufLen += p.length;
        if (bufLen >= 3500) {
          const idx = chunked.length + 1;
          chunked.push(buildChapterObject(idx, lang === 'zh' ? `第${idx}节` : `Phần ${idx}`, buf, lang));
          buf = [];
          bufLen = 0;
        }
      }
      if (buf.length > 0) {
        const idx = chunked.length + 1;
        chunked.push(buildChapterObject(idx, lang === 'zh' ? `第${idx}节` : `Phần ${idx}`, buf, lang));
      }
      return { lang, chapters: chunked };
    }

    return { lang, chapters };
  }

  function extractNumberFromName(name) {
    const m = name.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  }

  async function parseTxtFiles(fileList, options) {
    const files = Array.from(fileList);
    if (files.length === 0) throw new Error('Chưa chọn file nào.');

    if (files.length === 1) {
      const buf = await files[0].arrayBuffer();
      const text = decodeBufferSmart(buf);
      const { lang, chapters } = splitSingleTextIntoChapters(text, options.langPref || 'auto');
      if (chapters.length === 0) throw new Error('File không có nội dung văn bản.');
      const defaultName = files[0].name.replace(/\.(txt|md)$/i, '');
      return {
        title: options.bookTitle || defaultName,
        lang,
        chapters
      };
    }

    // Multiple files -> sort naturally by chapter number in filename
    files.sort((a, b) => {
      const na = extractNumberFromName(a.name);
      const nb = extractNumberFromName(b.name);
      if (na !== nb) return na - nb;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    const firstText = decodeBufferSmart(await files[0].arrayBuffer());
    const lang = (options.langPref && options.langPref !== 'auto') ? options.langPref : detectLanguage(firstText);
    const chapters = [];

    for (let i = 0; i < files.length; i++) {
      const raw = decodeBufferSmart(await files[i].arrayBuffer());
      const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        .split('\n')
        .map(l => l.replace(/^[\u3000\s]+|[\u3000\s]+$/g, ''))
        .filter(Boolean);

      if (lines.length === 0) continue;
      let chTitle = lines[0].replace(/^#+\s*/, '').trim();
      let paras = lines.slice(1);
      if (chTitle.length > 90) {
        chTitle = files[i].name.replace(/\.(txt|md)$/i, '');
        paras = lines;
      }
      chapters.push(buildChapterObject(chapters.length + 1, chTitle, paras, lang));
    }

    if (chapters.length === 0) throw new Error('Các file đã chọn đều trống.');
    return {
      title: options.bookTitle || 'Truyện mới tải lên',
      lang,
      chapters
    };
  }

  // =========================================================================
  // Lightweight Pure-JS EPUB (ZIP + DecompressionStream) Parser
  // =========================================================================

  async function inflateRaw(compressedBytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Trình duyệt của bạn quá cũ, không hỗ trợ giải nén EPUB trực tiếp (hãy dùng file .txt hoặc cập nhật trình duyệt).');
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compressedBytes);
    writer.close();
    const outBuf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(outBuf);
  }

  function parseZipEntries(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Find End of Central Directory (EOCD: 0x06054b50)
    let eocdOffset = -1;
    const minSearch = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= minSearch; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) throw new Error('File EPUB không hợp lệ (không tìm thấy cấu trúc ZIP).');

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    const decoder = new TextDecoder('utf-8');
    const entries = new Map();

    let ptr = cdOffset;
    for (let i = 0; i < totalEntries; i++) {
      if (view.getUint32(ptr, true) !== 0x02014b50) break;
      const compressionMethod = view.getUint16(ptr + 10, true);
      const compressedSize = view.getUint32(ptr + 20, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHeaderOffset = view.getUint32(ptr + 42, true);

      const name = decoder.decode(bytes.slice(ptr + 46, ptr + 46 + nameLen));
      entries.set(name, { name, compressionMethod, compressedSize, localHeaderOffset });
      ptr += 46 + nameLen + extraLen + commentLen;
    }

    return { bytes, view, entries };
  }

  async function readZipEntryText(zip, entry) {
    const lho = entry.localHeaderOffset;
    const nameLen = zip.view.getUint16(lho + 26, true);
    const extraLen = zip.view.getUint16(lho + 28, true);
    const dataStart = lho + 30 + nameLen + extraLen;
    const compressedSlice = zip.bytes.slice(dataStart, dataStart + entry.compressedSize);

    let outBytes;
    if (entry.compressionMethod === 0) {
      outBytes = compressedSlice;
    } else if (entry.compressionMethod === 8) {
      outBytes = await inflateRaw(compressedSlice);
    } else {
      throw new Error(`Phương thức nén EPUB không hỗ trợ (${entry.compressionMethod}).`);
    }
    return new TextDecoder('utf-8').decode(outBytes);
  }

  function resolveRelativePath(baseDir, relPath) {
    const clean = relPath.split('#')[0];
    if (!baseDir) return clean;
    const parts = (baseDir + '/' + clean).split('/');
    const stack = [];
    for (const p of parts) {
      if (!p || p === '.') continue;
      if (p === '..') stack.pop();
      else stack.push(p);
    }
    return stack.join('/');
  }

  async function parseEpubFile(file, options) {
    const buffer = await file.arrayBuffer();
    const zip = parseZipEntries(buffer);
    const parser = new DOMParser();

    let bookTitle = options.bookTitle || file.name.replace(/\.epub$/i, '');
    let author = '';
    let orderedHtmlPaths = [];

    // 1. Try reading META-INF/container.xml -> OPF spine
    const containerEntry = zip.entries.get('META-INF/container.xml');
    if (containerEntry) {
      const containerXml = await readZipEntryText(zip, containerEntry);
      const containerDoc = parser.parseFromString(containerXml, 'application/xml');
      const rootfile = containerDoc.querySelector('rootfile');
      const opfPath = rootfile ? rootfile.getAttribute('full-path') : null;

      if (opfPath && zip.entries.has(opfPath)) {
        const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
        const opfXml = await readZipEntryText(zip, zip.entries.get(opfPath));
        const opfDoc = parser.parseFromString(opfXml, 'application/xml');

        if (!options.bookTitle) {
          const titleEl = opfDoc.querySelector('title, dc\\:title');
          if (titleEl && titleEl.textContent.trim()) {
            bookTitle = titleEl.textContent.trim();
          }
        }
        const creatorEl = opfDoc.querySelector('creator, dc\\:creator');
        if (creatorEl && creatorEl.textContent.trim()) {
          author = creatorEl.textContent.trim();
        }

        const manifestMap = new Map();
        opfDoc.querySelectorAll('manifest > item').forEach((item) => {
          const id = item.getAttribute('id');
          const href = item.getAttribute('href');
          const mediaType = item.getAttribute('media-type') || '';
          if (id && href && (mediaType.includes('html') || /\.(x?html?|htm)$/i.test(href))) {
            manifestMap.set(id, resolveRelativePath(opfDir, decodeURIComponent(href)));
          }
        });

        opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
          const idref = ref.getAttribute('idref');
          const path = manifestMap.get(idref);
          if (path && zip.entries.has(path)) {
            orderedHtmlPaths.push(path);
          }
        });
      }
    }

    // Fallback if OPF spine was empty
    if (orderedHtmlPaths.length === 0) {
      orderedHtmlPaths = Array.from(zip.entries.keys())
        .filter((k) => /\.(x?html?|htm)$/i.test(k) && !/nav|toc|cover/i.test(k))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }

    if (orderedHtmlPaths.length === 0) {
      throw new Error('Không tìm thấy nội dung chương nào trong file EPUB.');
    }

    // Extract text from each XHTML document
    const rawChapters = [];
    let sampleText = '';

    for (const htmlPath of orderedHtmlPaths) {
      const entry = zip.entries.get(htmlPath);
      if (!entry) continue;
      const htmlText = await readZipEntryText(zip, entry);
      const doc = parser.parseFromString(htmlText, 'text/html');
      if (!doc || !doc.body) continue;

      const hEl = doc.body.querySelector('h1, h2, h3');
      let chTitle = hEl ? hEl.textContent.trim() : '';
      if (!chTitle) {
        const tEl = doc.querySelector('title');
        chTitle = tEl ? tEl.textContent.trim() : '';
      }

      const paras = [];
      doc.body.querySelectorAll('p, div.para').forEach((p) => {
        const txt = p.textContent.replace(/^[\u3000\s]+|[\u3000\s]+$/g, '');
        if (txt && txt !== chTitle) {
          paras.push(txt);
        }
      });

      if (paras.length === 0) {
        const bodyLines = doc.body.textContent
          .split('\n')
          .map(l => l.replace(/^[\u3000\s]+|[\u3000\s]+$/g, ''))
          .filter(l => l && l !== chTitle);
        paras.push(...bodyLines);
      }

      if (paras.length === 0) continue;
      if (sampleText.length < 4000) sampleText += paras.slice(0, 10).join(' ');
      rawChapters.push({ chTitle, paras });
    }

    if (rawChapters.length === 0) {
      throw new Error('File EPUB không chứa văn bản đọc được.');
    }

    const lang = (options.langPref && options.langPref !== 'auto') ? options.langPref : detectLanguage(sampleText);
    const chapters = rawChapters.map((item, idx) =>
      buildChapterObject(
        idx + 1,
        item.chTitle || (lang === 'zh' ? `第${idx + 1}章` : `Chương ${idx + 1}`),
        item.paras,
        lang
      )
    );

    return { title: bookTitle, author, lang, chapters };
  }

  async function parseJsonBookFile(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !parsed.book || !Array.isArray(parsed.chapters)) {
      throw new Error('File JSON không đúng định dạng gói truyện.');
    }
    return parsed;
  }

  global.BookLibrary = {
    getAllUploadedBooks,
    getUploadedBook,
    getUploadedChapter,
    saveUploadedBook,
    deleteUploadedBook,
    exportUploadedBook,
    parseTxtFiles,
    parseEpubFile,
    parseJsonBookFile
  };
})(window);
