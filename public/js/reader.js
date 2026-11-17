// In-Browser Online eBook Reader Logic with Native Audiobook Text-to-Speech

let bookData = null;
let currentChapterIndex = 0;
let currentFontSizeRem = 1.15;
let currentBookId = null;
let isAudioPlaying = false;
let currentSpeechRate = 1.0;
let activeUtterance = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = getAuthToken();
  if (!token) {
    showToast('Please login to read your eBooks.', 'warning');
    setTimeout(() => {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }, 800);
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  currentBookId = urlParams.get('bookId');

  if (!currentBookId) {
    showToast('No eBook specified.', 'error');
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 1000);
    return;
  }

  // Restore user reader theme
  const savedTheme = localStorage.getItem('ebook_reader_theme') || 'light';
  setReaderTheme(savedTheme, false);

  await loadReaderContent();
  await loadReaderNotes();
  await resumeLastReadingPosition();
});

// Resume last read chapter from server
async function resumeLastReadingPosition() {
  const token = getAuthToken();
  try {
    const res = await fetch(`/api/progress/${currentBookId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success && data.progress && typeof data.progress.currentChapter === 'number') {
      const savedCh = data.progress.currentChapter;
      if (savedCh > 0 && bookData && bookData.chapters && savedCh < bookData.chapters.length) {
        currentChapterIndex = savedCh;
        renderCurrentChapter();
        showToast(`Resumed from Chapter ${savedCh + 1}`, 'info');
      }
    }
  } catch (e) {
    // Ignore error
  }
}

// Save reading progress to server
async function recordReadingProgress() {
  const token = getAuthToken();
  if (!token || !bookData || !bookData.chapters) return;

  try {
    await fetch('/api/progress/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        bookId: currentBookId,
        currentChapter: currentChapterIndex,
        totalChapters: bookData.chapters.length,
      }),
    });
  } catch (e) {
    // Silent fail
  }
}

// Load protected book content
async function loadReaderContent() {
  const token = getAuthToken();

  try {
    const res = await fetch(`/api/download/reader-content/${currentBookId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data.success) {
      showToast(data.message || 'Access denied.', 'error');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1500);
      return;
    }

    bookData = data;
    document.title = `${bookData.book.title} - Online Reader`;
    document.getElementById('reader-book-title').textContent = bookData.book.title;
    document.getElementById('reader-book-author').textContent = `By ${bookData.book.author} • Licensed to ${bookData.userLicense.licensedTo}`;

    renderChapterList();
    renderCurrentChapter();
  } catch (err) {
    console.error('Reader load error:', err);
    showToast('Failed to load eBook content.', 'error');
  }
}

// Render Table of Contents
function renderChapterList() {
  const container = document.getElementById('reader-chapters-list');
  if (!container || !bookData || !bookData.chapters) return;

  container.innerHTML = bookData.chapters
    .map((ch, idx) => {
      return `
        <div class="chapter-nav-item ${idx === currentChapterIndex ? 'active' : ''}" onclick="selectChapter(${idx})">
          <div style="font-weight: 600;">${ch.title}</div>
          <div style="font-size: 0.75rem; opacity: 0.7; margin-top: 0.15rem;">${ch.subtitle || ''}</div>
        </div>
      `;
    })
    .join('');
}

// Render current chapter content
function renderCurrentChapter() {
  if (!bookData || !bookData.chapters || !bookData.chapters[currentChapterIndex]) return;

  const ch = bookData.chapters[currentChapterIndex];
  const total = bookData.chapters.length;

  document.getElementById('current-chapter-num').textContent = `Chapter ${currentChapterIndex + 1} of ${total}`;
  document.getElementById('current-chapter-title').textContent = ch.title;
  document.getElementById('current-chapter-subtitle').textContent = ch.subtitle || '';
  document.getElementById('current-chapter-content').textContent = ch.content;

  // Chapter Reading Time Estimator (based on ~180 wpm)
  const readTimeElem = document.getElementById('current-chapter-read-time');
  if (readTimeElem) {
    const wordCount = (ch.content || '').split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.round(wordCount / 180));
    readTimeElem.textContent = `⏱ ~${mins} min read`;
  }

  // Key Takeaways
  const takeawaysWrap = document.getElementById('current-chapter-takeaways-wrap');
  const takeawaysList = document.getElementById('current-chapter-takeaways');
  if (ch.keyTakeaways && ch.keyTakeaways.length > 0) {
    takeawaysWrap.style.display = 'block';
    takeawaysList.innerHTML = ch.keyTakeaways.map((item) => `<li>${item}</li>`).join('');
  } else {
    takeawaysWrap.style.display = 'none';
  }

  // Progress and buttons
  document.getElementById('reading-progress-indicator').textContent = `Chapter ${currentChapterIndex + 1} of ${total}`;
  document.getElementById('btn-prev-chapter').disabled = currentChapterIndex === 0;
  document.getElementById('btn-next-chapter').disabled = currentChapterIndex === total - 1;

  // Scroll to top of reading pane
  const pane = document.getElementById('reader-scroll-pane');
  if (pane) pane.scrollTop = 0;

  renderChapterList();
  stopAudioNarration(false);
  recordReadingProgress();
}

function selectChapter(idx) {
  currentChapterIndex = idx;
  renderCurrentChapter();
}

function navigateChapter(direction) {
  const newIndex = currentChapterIndex + direction;
  if (newIndex >= 0 && newIndex < bookData.chapters.length) {
    currentChapterIndex = newIndex;
    renderCurrentChapter();
  }
}

// Reading Themes (White, Sepia, Dark)
function setReaderTheme(theme, save = true) {
  document.body.setAttribute('data-reader-theme', theme);
  if (save) {
    localStorage.setItem('ebook_reader_theme', theme);
  }

  const pills = document.querySelectorAll('.theme-pill');
  pills.forEach((p) => {
    if (p.textContent.toLowerCase() === theme || (theme === 'light' && p.textContent.toLowerCase() === 'white')) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
}

// Font Size Scaling
function changeFontSize(delta) {
  currentFontSizeRem = Math.max(0.95, Math.min(1.6, currentFontSizeRem + delta * 0.1));
  const prose = document.getElementById('current-chapter-content');
  if (prose) {
    prose.style.fontSize = `${currentFontSizeRem}rem`;
  }
}

// Toggle Left Sidebar
function toggleSidebar() {
  const sidebar = document.getElementById('reader-sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
}

// Toggle Notes Drawer
function toggleNotesDrawer() {
  const drawer = document.getElementById('notes-drawer');
  if (drawer) drawer.classList.toggle('open');
}

// ==========================================
// PERSONAL READING NOTES
// ==========================================

async function loadReaderNotes() {
  const token = getAuthToken();
  const listElem = document.getElementById('reader-notes-list');
  const countBadge = document.getElementById('notes-badge-count');
  if (!listElem) return;

  try {
    const res = await fetch(`/api/notes/${currentBookId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.success && data.notes) {
      if (countBadge) countBadge.textContent = data.notes.length;

      if (data.notes.length === 0) {
        listElem.innerHTML = `<div style="font-size: 0.85rem; color: #64748b;">No notes yet for this book.</div>`;
        return;
      }

      listElem.innerHTML = data.notes
        .map((n) => {
          const dateStr = new Date(n.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          });

          return `
            <div style="background: rgba(0,0,0,0.03); border: 1px solid var(--reader-border); border-radius: 6px; padding: 0.75rem; font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="font-weight: 700; color: var(--primary); font-size: 0.75rem;">${n.chapterTitle}</span>
                <span style="opacity: 0.6; font-size: 0.75rem;">${dateStr}</span>
              </div>
              <p style="margin: 0; line-height: 1.4;">${n.content}</p>
              <div style="text-align: right; margin-top: 0.3rem;">
                <button onclick="deletePersonalNote('${n._id}')" style="background: none; border: none; color: #ef4444; font-size: 0.75rem; cursor: pointer;">
                  Delete
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.error('Notes load error:', err);
  }
}

async function savePersonalNote() {
  const token = getAuthToken();
  const textarea = document.getElementById('new-note-content');
  const content = textarea ? textarea.value.trim() : '';

  if (!content) {
    showToast('Please type a note first.', 'warning');
    return;
  }

  const currentCh = bookData && bookData.chapters ? bookData.chapters[currentChapterIndex] : null;

  try {
    const res = await fetch(`/api/notes/${currentBookId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content,
        chapterIndex: currentChapterIndex,
        chapterTitle: currentCh ? currentCh.title : `Chapter ${currentChapterIndex + 1}`,
      }),
    });

    const data = await res.json();
    if (data.success) {
      showToast('Note saved!', 'success');
      textarea.value = '';
      await loadReaderNotes();
    } else {
      showToast(data.message || 'Failed to save note.', 'error');
    }
  } catch (err) {
    console.error('Note save error:', err);
    showToast('Failed to save note.', 'error');
  }
}

async function deletePersonalNote(noteId) {
  const token = getAuthToken();
  try {
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      showToast('Note deleted.', 'info');
      await loadReaderNotes();
    }
  } catch (err) {
    console.error('Delete note error:', err);
  }
}

// ==========================================
// AUDIOBOOK TEXT-TO-SPEECH (TTS) NARRATOR
// ==========================================

function toggleAudioNarration() {
  if (!('speechSynthesis' in window)) {
    showToast('Your browser does not support Speech Synthesis audio.', 'warning');
    return;
  }

  if (window.speechSynthesis.speaking) {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      isAudioPlaying = true;
      updateAudioNarratorUI('Playing');
      showToast('Resumed audio narration 🎧', 'info');
    } else {
      window.speechSynthesis.pause();
      isAudioPlaying = false;
      updateAudioNarratorUI('Paused');
      showToast('Audio paused ⏸', 'info');
    }
    return;
  }

  // Start new narration from current chapter
  startCurrentChapterNarration();
}

function startCurrentChapterNarration() {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  if (!bookData || !bookData.chapters || !bookData.chapters[currentChapterIndex]) return;

  const ch = bookData.chapters[currentChapterIndex];
  const fullText = `${ch.title}. ${ch.subtitle || ''}. ${ch.content}`;

  activeUtterance = new SpeechSynthesisUtterance(fullText);
  activeUtterance.rate = currentSpeechRate;
  activeUtterance.pitch = 1.0;

  activeUtterance.onstart = () => {
    isAudioPlaying = true;
    updateAudioNarratorUI('Playing');
  };

  activeUtterance.onend = () => {
    isAudioPlaying = false;
    updateAudioNarratorUI('Finished');
    // If not last chapter, ask or auto-advance
    if (currentChapterIndex < bookData.chapters.length - 1) {
      showToast('Chapter finished! Playing next chapter...', 'info');
      navigateChapter(1);
      setTimeout(() => startCurrentChapterNarration(), 600);
    }
  };

  activeUtterance.onerror = (e) => {
    console.warn('Speech synthesis error:', e);
    isAudioPlaying = false;
    updateAudioNarratorUI('Stopped');
  };

  window.speechSynthesis.speak(activeUtterance);
  showToast(`Playing audio for Chapter ${currentChapterIndex + 1} 🎧`, 'info');
}

function stopAudioNarration(notify = true) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isAudioPlaying = false;
  updateAudioNarratorUI('Stopped');
  if (notify) {
    showToast('Audio narration stopped ⏹', 'info');
  }
}

function changeAudioSpeed(speedStr) {
  currentSpeechRate = parseFloat(speedStr) || 1.0;
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    // Restart with new rate
    startCurrentChapterNarration();
  }
}

function updateAudioNarratorUI(state) {
  const pill = document.getElementById('audio-status-pill');
  const btn = document.getElementById('btn-audio-play');

  if (pill) {
    if (state === 'Playing') {
      pill.textContent = `▶ Playing Chapter ${currentChapterIndex + 1}`;
      pill.style.color = '#10b981';
    } else if (state === 'Paused') {
      pill.textContent = '⏸ Paused';
      pill.style.color = '#f59e0b';
    } else if (state === 'Finished') {
      pill.textContent = '✓ Chapter Completed';
      pill.style.color = '#0284c7';
    } else {
      pill.textContent = 'Audiobook Narrator Ready';
      pill.style.color = 'var(--primary)';
    }
  }

  if (btn) {
    if (state === 'Playing') {
      btn.textContent = '⏸ Pause Audio';
    } else {
      btn.textContent = '▶ Play Narration';
    }
  }
}

// ==========================================
// IN-BOOK KEYWORD SEARCH ACROSS ALL CHAPTERS
// ==========================================

function openReaderSearchModal() {
  const modal = document.getElementById('reader-search-modal');
  if (modal) {
    modal.classList.add('open');
    const input = document.getElementById('input-reader-search');
    if (input) {
      input.focus();
      if (input.value) executeReaderSearch(input.value);
    }
  }
}

function closeReaderSearchModal() {
  const modal = document.getElementById('reader-search-modal');
  if (modal) modal.classList.remove('open');
}

function executeReaderSearch(query) {
  const container = document.getElementById('reader-search-results');
  if (!container || !bookData || !bookData.chapters) return;

  const q = (query || '').trim().toLowerCase();
  if (q.length < 2) {
    container.innerHTML = `
      <div style="text-align: center; color: #64748b; font-size: 0.88rem; padding: 1.5rem;">
        Type at least 2 characters to search across chapters.
      </div>
    `;
    return;
  }

  const matches = [];
  bookData.chapters.forEach((ch, idx) => {
    const text = ch.content || '';
    const lower = text.toLowerCase();
    let pos = lower.indexOf(q);

    while (pos !== -1 && matches.length < 20) {
      const start = Math.max(0, pos - 40);
      const end = Math.min(text.length, pos + q.length + 50);
      let snippet = text.substring(start, end);
      if (start > 0) snippet = '...' + snippet;
      if (end < text.length) snippet = snippet + '...';

      // Highlight term
      const regex = new RegExp(`(${q})`, 'gi');
      const highlightedSnippet = snippet.replace(regex, `<mark style="background: #fef08a; font-weight: 700;">$1</mark>`);

      matches.push({
        chapterIndex: idx,
        chapterTitle: ch.title,
        snippet: highlightedSnippet,
      });

      pos = lower.indexOf(q, pos + q.length + 1);
    }
  });

  if (matches.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: #ef4444; font-size: 0.88rem; padding: 1.5rem;">
        No occurrences found for "${query}".
      </div>
    `;
    return;
  }

  container.innerHTML = matches
    .map(
      (m) => `
      <div class="search-match-item" onclick="jumpToSearchResult(${m.chapterIndex})" title="Jump to Chapter ${m.chapterIndex + 1}">
        <div style="font-weight: 700; font-size: 0.85rem; color: var(--primary); margin-bottom: 0.2rem;">
          Chapter ${m.chapterIndex + 1}: ${m.chapterTitle}
        </div>
        <div style="font-size: 0.82rem; line-height: 1.4; color: var(--reader-text);">
          ${m.snippet}
        </div>
      </div>
    `
    )
    .join('');
}

function jumpToSearchResult(idx) {
  closeReaderSearchModal();
  selectChapter(idx);
  showToast(`Jumped to Chapter ${idx + 1}`, 'info');
}

window.selectChapter = selectChapter;
window.navigateChapter = navigateChapter;
window.setReaderTheme = setReaderTheme;
window.changeFontSize = changeFontSize;
window.toggleSidebar = toggleSidebar;
window.toggleNotesDrawer = toggleNotesDrawer;
window.savePersonalNote = savePersonalNote;
window.deletePersonalNote = deletePersonalNote;
window.toggleAudioNarration = toggleAudioNarration;
window.stopAudioNarration = stopAudioNarration;
window.changeAudioSpeed = changeAudioSpeed;
window.openReaderSearchModal = openReaderSearchModal;
window.closeReaderSearchModal = closeReaderSearchModal;
window.executeReaderSearch = executeReaderSearch;
window.jumpToSearchResult = jumpToSearchResult;
