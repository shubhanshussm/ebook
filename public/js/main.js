// Main Storefront Logic with Search, Filter, Sort, Wishlist & Free Preview

let currentCategory = 'All';
let searchQuery = '';
let currentSort = 'featured';
let booksCache = [];
let userWishlist = new Set();
let selectedStarRating = 5;

document.addEventListener('DOMContentLoaded', async () => {
  await updateNavAuthUI();
  await loadUserWishlist();
  await loadCategories();
  await loadBooks();
  await loadCuratedBundles();

  // Attach search listeners & autocomplete
  const searchInput = document.getElementById('search-input');
  const autocompleteDropdown = document.getElementById('search-autocomplete-dropdown');

  if (searchInput) {
    searchInput.addEventListener(
      'input',
      debounce(async (e) => {
        searchQuery = e.target.value.trim();
        loadBooks();
        await handleAutocomplete(searchQuery);
      }, 250)
    );

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (autocompleteDropdown && !searchInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
        autocompleteDropdown.classList.remove('open');
      }
    });

    // Reopen autocomplete on click if input has value
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length >= 2 && autocompleteDropdown && autocompleteDropdown.children.length > 0) {
        autocompleteDropdown.classList.add('open');
      }
    });
  }

  // Attach sort dropdown listener
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderBooks(getSortedAndFilteredBooks());
    });
  }
});

// Load category pills dynamically
async function loadCategories() {
  const container = document.getElementById('category-pills-container');
  if (!container) return;

  try {
    const res = await fetch('/api/categories');
    const data = await res.json();

    if (data.success && data.categories && data.categories.length > 0) {
      let pillsHtml = `<button class="category-pill ${currentCategory === 'All' ? 'active' : ''}" data-category="All">All Books</button>`;
      
      data.categories.forEach((c) => {
        const isActive = currentCategory === c.name ? 'active' : '';
        pillsHtml += `
          <button class="category-pill ${isActive}" data-category="${c.name}">
            ${c.icon ? c.icon + ' ' : ''}${c.name}
          </button>
        `;
      });

      pillsHtml += `<button class="category-pill ${currentCategory === 'Wishlist' ? 'active' : ''}" data-category="Wishlist">Wishlist ❤️</button>`;
      container.innerHTML = pillsHtml;

      container.querySelectorAll('.category-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          container.querySelectorAll('.category-pill').forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
          currentCategory = pill.dataset.category || 'All';
          loadBooks();
        });
      });
    }
  } catch (err) {
    console.error('Error loading category pills:', err);
  }
}

// Debounce helper
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Load current user's wishlist IDs
async function loadUserWishlist() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch('/api/wishlist', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success && data.wishlist) {
      userWishlist = new Set(data.wishlist.map((b) => (b._id ? b._id.toString() : b.toString())));
    }
  } catch (e) {
    // Ignore error
  }
}

// Toggle Wishlist
async function toggleWishlist(bookId, event) {
  if (event) event.stopPropagation();

  const token = getAuthToken();
  if (!token) {
    showToast('Please login to save eBooks to your wishlist.', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/wishlist/toggle/${bookId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.success) {
      if (data.inWishlist) {
        userWishlist.add(bookId.toString());
      } else {
        userWishlist.delete(bookId.toString());
      }
      showToast(data.message, 'info');

      // Update button visual
      const btn = document.getElementById(`btn-wishlist-${bookId}`);
      if (btn) {
        if (data.inWishlist) {
          btn.classList.add('active');
          btn.innerHTML = '❤️';
        } else {
          btn.classList.remove('active');
          btn.innerHTML = '🤍';
        }
      }

      if (currentCategory === 'Wishlist') {
        renderBooks(getSortedAndFilteredBooks());
      }
    }
  } catch (err) {
    console.error('Wishlist error:', err);
    showToast('Failed to update wishlist.', 'error');
  }
}

// Fetch and render books from API
async function loadBooks() {
  const grid = document.getElementById('books-grid');
  const countElem = document.getElementById('books-count');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">
      <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📖</div>
      <div>Loading eBooks collection...</div>
    </div>
  `;

  try {
    const token = getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let url = `/api/books?category=${encodeURIComponent(currentCategory)}`;
    if (searchQuery) {
      url += `&search=${encodeURIComponent(searchQuery)}`;
    }

    const res = await fetch(url, { headers });
    const data = await res.json();

    if (data.success) {
      booksCache = data.books || [];
      const filtered = getSortedAndFilteredBooks();
      if (countElem) {
        countElem.textContent = `${filtered.length} eBook${filtered.length === 1 ? '' : 's'} available`;
      }
      renderBooks(filtered);
    } else {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">${data.message || 'Failed to load eBooks.'}</div>`;
    }
  } catch (err) {
    console.error('Error loading books:', err);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Failed to connect to server.</div>`;
  }
}

// Sorting and category filtering helper
function getSortedAndFilteredBooks() {
  let list = [...booksCache];

  if (currentCategory === 'Wishlist') {
    list = list.filter((b) => userWishlist.has(b._id.toString()));
  }

  if (currentSort === 'price-low') {
    list.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-high') {
    list.sort((a, b) => b.price - a.price);
  } else if (currentSort === 'rating') {
    list.sort((a, b) => (b.rating || 5) - (a.rating || 5));
  } else if (currentSort === 'newest') {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return list;
}

// Render books into the grid
function renderBooks(books) {
  const grid = document.getElementById('books-grid');
  if (!grid) return;

  if (books.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-icon">${currentCategory === 'Wishlist' ? '❤️' : '🔍'}</div>
        <h3 class="empty-title">${currentCategory === 'Wishlist' ? 'Your Wishlist is Empty' : 'No eBooks Found'}</h3>
        <p class="empty-desc">${currentCategory === 'Wishlist' ? 'Save eBooks you want to read later by clicking the heart icon on any book.' : 'No books matched your search or filters.'}</p>
        <button class="btn btn-outline" onclick="resetFilters()">View All Books</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = books
    .map((book) => {
      const isPurchased = Boolean(book.isPurchased);
      const isWishlisted = userWishlist.has(book._id.toString());

      return `
        <div class="book-card" id="book-card-${book._id}">
          <div class="book-cover-wrap">
            <img src="${book.coverImage}" alt="${book.title}" class="book-cover-img" loading="lazy" />
            <span class="book-badge">${book.category}</span>
            <button class="btn-wishlist ${isWishlisted ? 'active' : ''}" id="btn-wishlist-${book._id}" onclick="toggleWishlist('${book._id}', event)" title="Save to Wishlist">
              ${isWishlisted ? '❤️' : '🤍'}
            </button>
            ${isPurchased ? `<span class="purchased-tag" style="top: 12px; left: 12px; right: auto;">✓ Purchased</span>` : ''}
          </div>
          <div class="book-details">
            <div class="book-category">${book.language || 'English'} Edition</div>
            <h3 class="book-title" title="${book.title}">${book.title}</h3>
            <div class="book-author">By <strong>${book.author}</strong></div>
            <div class="book-meta">
              <span>⭐ ${book.rating ? book.rating.toFixed(1) : '5.0'} (${book.numReviews || 0})</span>
              <span>📄 ${book.pages || 200} Pages</span>
            </div>
            <p class="book-desc">${book.description}</p>
            <div class="book-footer">
              <div class="price-wrap">
                <span class="price-current">₹${book.price}</span>
                ${book.originalPrice > book.price ? `<span class="price-original">₹${book.originalPrice}</span>` : ''}
              </div>
              <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                ${
                  isPurchased
                    ? `
                  <a href="/reader.html?bookId=${book._id}" class="btn btn-outline btn-sm" title="Read eBook Online in Browser">
                    📖 Read
                  </a>
                  <button class="btn btn-success btn-sm" onclick="triggerEbookDownload('${book._id}')" title="Download eBook PDF">
                    ⬇ PDF
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="openGiftModal('${book._id}')" title="Gift a copy to a friend">
                    🎁
                  </button>
                `
                    : `
                  <button class="btn btn-secondary btn-sm" onclick="openPreviewReader('${book._id}')" title="Read Free Sample Preview">
                    📖 Preview
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="addToCart('${book._id}')" title="Add to Cart">
                    🛒
                  </button>
                  <button class="btn btn-primary btn-sm" onclick="initiateBookPurchase('${book._id}')" title="Buy Now">
                    💳 Buy
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="openGiftModal('${book._id}')" title="Gift this eBook to a friend">
                    🎁
                  </button>
                `
                }
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

// Open Free Sample Preview Modal
async function openPreviewReader(bookId) {
  let modal = document.getElementById('preview-reader-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'preview-reader-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 680px;">
      <div class="modal-header" style="background: #0f172a; color: white;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span>📖</span>
          <h3 class="modal-title" style="color: white; font-size: 1.15rem;">Free Sample Preview</h3>
        </div>
        <button class="modal-close" style="color: white;" onclick="closePreviewReader()">&times;</button>
      </div>
      <div class="modal-body" style="padding: 2rem;">
        <div style="text-align: center; color: #64748b;">Loading sample chapter...</div>
      </div>
    </div>
  `;
  modal.classList.add('open');

  try {
    const res = await fetch(`/api/books/${bookId}/preview`);
    const data = await res.json();

    if (data.success) {
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 680px;">
          <div class="modal-header" style="background: linear-gradient(135deg, #0f172a, #1e293b); color: white;">
            <div>
              <div style="font-size: 0.75rem; color: #38bdf8; text-transform: uppercase; font-weight: 700;">Free Sample Excerpt</div>
              <h3 class="modal-title" style="color: white; font-size: 1.2rem; margin-top: 0.2rem;">${data.title}</h3>
            </div>
            <button class="modal-close" style="color: white;" onclick="closePreviewReader()">&times;</button>
          </div>
          <div class="modal-body" style="padding: 2rem; max-height: 65vh; overflow-y: auto; line-height: 1.8; color: var(--text-main); font-size: 0.95rem;">
            <div style="display: flex; gap: 1.25rem; align-items: center; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;">
              <img src="${data.coverImage}" alt="${data.title}" style="width: 70px; height: 95px; object-fit: cover; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
              <div>
                <h4 style="font-size: 1.1rem; margin-bottom: 0.2rem;">${data.title}</h4>
                <div style="color: var(--text-muted); font-size: 0.85rem;">Author: <strong>${data.author}</strong> • ${data.pages} Pages</div>
                <div style="color: #059669; font-weight: 700; font-size: 0.9rem; margin-top: 0.3rem;">Price: ₹${data.price} (Full Unlocked PDF)</div>
              </div>
            </div>

            <div style="white-space: pre-line; background: var(--bg-surface); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border); font-family: 'Segoe UI', serif;">
              ${data.preview}
            </div>

            <div style="margin-top: 1.5rem; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 1rem; text-align: center;">
              <h5 style="color: #312e81; font-size: 1rem; margin-bottom: 0.3rem;">Liked this preview sample?</h5>
              <p style="color: #4338ca; font-size: 0.88rem; margin-bottom: 0.75rem;">Unlock the full ${data.pages}-page authentic PDF guide immediately with Razorpay checkout.</p>
              <button class="btn btn-primary" onclick="closePreviewReader(); initiateBookPurchase('${bookId}')">
                💳 Buy Complete eBook for ₹${data.price}
              </button>
            </div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Preview error:', err);
  }
}

function closePreviewReader() {
  const modal = document.getElementById('preview-reader-modal');
  if (modal) modal.classList.remove('open');
}

// Reset search and categories
function resetFilters() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  searchQuery = '';
  currentCategory = 'All';

  const pills = document.querySelectorAll('.category-pill');
  pills.forEach((p) => {
    if (p.dataset.category === 'All') p.classList.add('active');
    else p.classList.remove('active');
  });

  loadBooks();
}

// Open modal with full book details and reviews
async function openBookModal(bookId) {
  const book = booksCache.find((b) => b._id === bookId);
  if (!book) return;

  let modal = document.getElementById('book-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'book-detail-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const isPurchased = Boolean(book.isPurchased);

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 650px;">
      <div class="modal-header">
        <h3 class="modal-title">${book.title}</h3>
        <button class="modal-close" onclick="closeBookModal()">&times;</button>
      </div>
      <div class="modal-body" style="max-height: 75vh; overflow-y: auto;">
        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
          <img src="${book.coverImage}" alt="${book.title}" style="width: 140px; height: 190px; object-fit: cover; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);" />
          <div style="flex: 1; min-width: 200px;">
            <div style="color: var(--secondary); font-size: 0.85rem; font-weight: 700; text-transform: uppercase;">${book.category}</div>
            <h4 style="font-size: 1.3rem; margin: 0.3rem 0;">${book.title}</h4>
            <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 0.8rem;">By <strong>${book.author}</strong></p>
            <div style="display: flex; gap: 1rem; font-size: 0.9rem; color: #475569; margin-bottom: 1rem;">
              <span>⭐ ${book.rating ? book.rating.toFixed(1) : '5.0'} / 5.0</span>
              <span>📄 ${book.pages} Pages</span>
              <span>🌐 ${book.language}</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 0.5rem;">
              <span style="font-size: 1.6rem; font-weight: 800; color: var(--text-main);">₹${book.price}</span>
              ${book.originalPrice > book.price ? `<span style="font-size: 1rem; color: #94a3b8; text-decoration: line-through;">₹${book.originalPrice}</span>` : ''}
              <span style="color: #10b981; font-weight: 600; font-size: 0.85rem;">(Instant PDF Download)</span>
            </div>
            <div style="margin-top: 1rem;">
              <button class="btn btn-outline btn-sm" onclick="closeBookModal(); openPreviewReader('${book._id}')">
                📖 Read Free Preview Sample
              </button>
            </div>
          </div>
        </div>

        <h5 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem;">About this eBook</h5>
        <p style="color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; margin-bottom: 1.5rem;">${book.description}</p>

        <!-- Customer Reviews Section -->
        <div class="reviews-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h5 style="font-size: 1.05rem; font-weight: 700;">Customer Reviews & Ratings</h5>
            <span style="font-size: 0.88rem; color: var(--text-muted);">Verified feedback</span>
          </div>

          <!-- Add Review Form -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
            <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem;">Rate & Review this eBook</div>
            <div class="star-rating-input" id="star-picker">
              <span onclick="setStarRating(1)">★</span>
              <span onclick="setStarRating(2)">★</span>
              <span onclick="setStarRating(3)">★</span>
              <span onclick="setStarRating(4)">★</span>
              <span class="selected" onclick="setStarRating(5)">★</span>
            </div>
            <textarea id="review-comment-input" class="form-input" rows="2" placeholder="Write your thoughts on this eBook..."></textarea>
            <div style="margin-top: 0.75rem; display: flex; justify-content: flex-end;">
              <button class="btn btn-primary btn-sm" onclick="submitReview('${book._id}')">
                Submit Review
              </button>
            </div>
          </div>

          <!-- Reviews List -->
          <div id="reviews-list-container">
            <div style="text-align: center; color: #64748b; font-size: 0.9rem; padding: 1rem;">Loading reviews...</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeBookModal()">Close</button>
        ${
          isPurchased
            ? `<button class="btn btn-success" onclick="closeBookModal(); triggerEbookDownload('${book._id}')">⬇ Download PDF</button>`
            : `<button class="btn btn-primary" onclick="closeBookModal(); initiateBookPurchase('${book._id}')">💳 Buy Now for ₹${book.price}</button>`
        }
      </div>
    </div>
  `;

  modal.classList.add('open');
  loadBookReviews(bookId);
}

function closeBookModal() {
  const modal = document.getElementById('book-detail-modal');
  if (modal) modal.classList.remove('open');
}

// Set Star Rating in Picker
function setStarRating(num) {
  selectedStarRating = num;
  const stars = document.querySelectorAll('#star-picker span');
  stars.forEach((s, idx) => {
    if (idx < num) s.classList.add('selected');
    else s.classList.remove('selected');
  });
}

// Load reviews for a book
async function loadBookReviews(bookId) {
  const container = document.getElementById('reviews-list-container');
  if (!container) return;

  try {
    const res = await fetch(`/api/reviews/${bookId}`);
    const data = await res.json();

    if (data.success && data.reviews) {
      if (data.reviews.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: #64748b; font-size: 0.9rem; padding: 1.5rem;">
            No reviews yet. Be the first to leave a review!
          </div>
        `;
        return;
      }

      container.innerHTML = data.reviews
        .map((r) => {
          const authorName = r.user ? r.user.name : 'Anonymous';
          const starsStr = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
          const dateStr = new Date(r.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          return `
            <div class="review-item">
              <div class="review-header">
                <div style="display: flex; align-items: center;">
                  <strong style="color: var(--text-main); font-size: 0.92rem;">${authorName}</strong>
                  ${r.verifiedPurchase ? '<span class="verified-badge">✓ Verified Buyer</span>' : ''}
                </div>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</span>
              </div>
              <div style="color: #f59e0b; font-size: 0.95rem; margin-bottom: 0.3rem;">${starsStr}</div>
              <div style="color: var(--text-main); font-size: 0.9rem; line-height: 1.5;">${r.comment}</div>
            </div>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.error('Reviews error:', err);
    container.innerHTML = '<div style="color: #ef4444; font-size: 0.9rem;">Failed to load reviews.</div>';
  }
}

// Submit a review
async function submitReview(bookId) {
  const token = getAuthToken();
  if (!token) {
    showToast('Please login to leave a review.', 'warning');
    return;
  }

  const commentInput = document.getElementById('review-comment-input');
  const comment = commentInput ? commentInput.value.trim() : '';

  if (!comment) {
    showToast('Please write a comment for your review.', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/reviews/${bookId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        rating: selectedStarRating,
        comment,
      }),
    });

    const data = await res.json();
    if (data.success) {
      showToast('Review submitted successfully!', 'success');
      if (commentInput) commentInput.value = '';
      await loadBookReviews(bookId);
      await loadBooks(); // Refresh book rating on grid
    } else {
      showToast(data.message || 'Failed to submit review.', 'error');
    }
  } catch (err) {
    console.error('Submit review error:', err);
    showToast('Network error while posting review.', 'error');
  }
}

// ===================================================
// LIVE SEARCH AUTOCOMPLETE
// ===================================================
async function handleAutocomplete(query) {
  const dropdown = document.getElementById('search-autocomplete-dropdown');
  if (!dropdown) return;

  if (!query || query.length < 2) {
    dropdown.innerHTML = '';
    dropdown.classList.remove('open');
    return;
  }

  try {
    const res = await fetch(`/api/books/autocomplete?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.success || !data.suggestions || data.suggestions.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 1rem; color: #64748b; font-size: 0.88rem; text-align: center;">
          No quick matches found for "${query}". Press Search for full catalog.
        </div>
      `;
      dropdown.classList.add('open');
      return;
    }

    dropdown.innerHTML = data.suggestions
      .map((b) => `
        <div class="autocomplete-item" onclick="selectAutocompleteItem('${b._id}')">
          <img src="${b.coverImage}" alt="${b.title}" class="autocomplete-thumb" />
          <div class="autocomplete-info">
            <div class="autocomplete-title">${b.title}</div>
            <div class="autocomplete-sub">By ${b.author} • <span style="color: var(--primary); font-weight: 600;">${b.category}</span></div>
          </div>
          <div class="autocomplete-price">₹${b.price}</div>
        </div>
      `)
      .join('');

    dropdown.classList.add('open');
  } catch (err) {
    console.error('Autocomplete error:', err);
  }
}

function selectAutocompleteItem(bookId) {
  const dropdown = document.getElementById('search-autocomplete-dropdown');
  if (dropdown) dropdown.classList.remove('open');
  openPreviewReader(bookId);
}

// ===================================================
// CURATED VALUE BUNDLES
// ===================================================
async function loadCuratedBundles() {
  const container = document.getElementById('bundles-grid');
  if (!container) return;

  try {
    const res = await fetch('/api/books/bundles');
    const data = await res.json();

    if (!data.success || !data.bundles || data.bundles.length === 0) {
      const section = document.getElementById('curated-bundles-section');
      if (section) section.style.display = 'none';
      return;
    }

    container.innerHTML = data.bundles
      .map((b) => {
        const bookIdsList = JSON.stringify(b.bookIds);
        return `
          <div class="bundle-card">
            <span class="bundle-badge">${b.badge}</span>
            <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.3rem;">${b.title}</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">${b.subtitle}</p>

            <div class="bundle-books-preview">
              ${b.books
                .map((bk) => `<img src="${bk.coverImage}" alt="${bk.title}" title="${bk.title} by ${bk.author}" class="bundle-book-cover" />`)
                .join('')}
            </div>

            <div style="font-size: 0.85rem; color: var(--text-main); margin-bottom: 1rem;">
              Includes <strong>${b.books.length} eBooks</strong>:
              <ul style="padding-left: 1.2rem; margin-top: 0.3rem; font-size: 0.82rem; color: var(--text-muted);">
                ${b.books.map((bk) => `<li>${bk.title}</li>`).join('')}
              </ul>
            </div>

            <div style="margin-top: auto; border-top: 1px solid var(--border); padding-top: 1rem; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-size: 1.3rem; font-weight: 800; color: var(--primary);">₹${b.bundlePrice}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">
                  <span style="text-decoration: line-through;">₹${b.originalPrice}</span>
                  <span style="color: #059669; font-weight: 700; margin-left: 0.3rem;">Save ₹${b.savings}</span>
                </div>
              </div>
              <button class="btn btn-primary btn-sm" onclick='addBundleToCart(${bookIdsList})' title="Add all bundle books to cart">
                🛒 Add Bundle
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Error loading bundles:', err);
  }
}

// Add entire bundle to shopping cart
function addBundleToCart(bookIds) {
  if (!bookIds || !Array.isArray(bookIds)) return;

  let addedCount = 0;
  bookIds.forEach((id) => {
    const book = (window.booksCache || []).find((b) => b._id.toString() === id.toString());
    if (book && !book.isPurchased) {
      const items = getCartItems();
      if (!items.some((i) => i.id === book._id)) {
        items.push({
          id: book._id,
          title: book.title,
          author: book.author,
          price: book.price,
          coverImage: book.coverImage,
          category: book.category,
        });
        saveCartItems(items);
        addedCount++;
      }
    }
  });

  if (addedCount > 0) {
    showToast(`Added ${addedCount} eBooks from bundle to your cart! 🛒`, 'success');
  } else {
    showToast('Bundle items already in cart or already owned.', 'info');
  }
  openCartDrawer();
}

// ===================================================
// GIFT AN EBOOK LOGIC
// ===================================================
let activeGiftData = null;

function openGiftModal(bookId) {
  const token = getAuthToken();
  if (!token) {
    showToast('Please login to gift eBooks.', 'warning');
    setTimeout(() => {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    }, 1000);
    return;
  }

  const book = (window.booksCache || []).find((b) => b._id.toString() === bookId.toString());
  if (!book) {
    showToast('Book not found.', 'error');
    return;
  }

  const modal = document.getElementById('gift-modal');
  if (!modal) return;

  document.getElementById('gift-book-id').value = book._id;
  document.getElementById('gift-book-title').textContent = book.title;
  document.getElementById('gift-book-price').textContent = `₹${book.price}`;

  modal.classList.add('open');
}

function closeGiftModal() {
  const modal = document.getElementById('gift-modal');
  if (modal) modal.classList.remove('open');
}

async function handleGiftCheckout(event) {
  event.preventDefault();
  const token = getAuthToken();
  if (!token) return;

  const bookId = document.getElementById('gift-book-id').value;
  const recipientName = document.getElementById('gift-recipient-name').value.trim();
  const recipientEmail = document.getElementById('gift-recipient-email').value.trim();
  const giftMessage = document.getElementById('gift-personal-message').value.trim();
  const btn = document.getElementById('btn-proceed-gift-pay');

  if (!recipientName || !recipientEmail) {
    showToast('Please provide recipient name and email.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Starting Gateway...';

  try {
    const res = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        bookId,
        isGift: true,
        recipientName,
        recipientEmail,
        giftMessage,
      }),
    });

    const data = await res.json();
    closeGiftModal();

    if (!data.success) {
      showToast(data.message || 'Failed to start gift payment.', 'error');
      btn.disabled = false;
      btn.innerHTML = '🎁 Proceed to Gift Payment';
      return;
    }

    // Attach gift metadata
    data.isGift = true;
    data.recipientName = recipientName;
    data.recipientEmail = recipientEmail;
    data.giftMessage = giftMessage;

    if (data.mode === 'simulator') {
      openSimulatorPaymentModal(data);
    } else {
      openRazorpayCheckout(data);
    }
  } catch (err) {
    console.error('Gift checkout error:', err);
    showToast('Network error during gift checkout.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🎁 Proceed to Gift Payment';
  }
}

// Celebration / Code reveal after successful gift payment
function openGiftCelebrationModal(giftData) {
  activeGiftData = giftData;
  const modal = document.getElementById('gift-celebration-modal');
  if (!modal) return;

  const recipientElem = document.getElementById('gift-success-recipient');
  const codeElem = document.getElementById('gift-success-code');

  if (recipientElem) recipientElem.textContent = giftData.recipientName || 'your friend';
  if (codeElem) codeElem.textContent = giftData.giftCode || 'GIFT-XXXX';

  modal.classList.add('open');
}

function closeGiftCelebrationModal() {
  const modal = document.getElementById('gift-celebration-modal');
  if (modal) modal.classList.remove('open');
}

function copyGiftCode() {
  if (!activeGiftData || !activeGiftData.giftCode) return;
  navigator.clipboard.writeText(activeGiftData.giftCode);
  showToast(`Copied ${activeGiftData.giftCode} to clipboard! 📋`, 'success');
}

function shareGiftViaWhatsApp() {
  if (!activeGiftData) return;
  const text = encodeURIComponent(
    `🎁 Hey ${activeGiftData.recipientName}! I bought you the "${activeGiftData.bookTitle || 'eBook'}" on BookVault! Redeem it using your unique gift code: ${activeGiftData.giftCode} at http://localhost:5000/dashboard.html`
  );
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

window.loadBooks = loadBooks;
window.resetFilters = resetFilters;
window.openBookModal = openBookModal;
window.closeBookModal = closeBookModal;
window.openPreviewReader = openPreviewReader;
window.closePreviewReader = closePreviewReader;
window.toggleWishlist = toggleWishlist;
window.setStarRating = setStarRating;
window.submitReview = submitReview;
window.handleAutocomplete = handleAutocomplete;
window.selectAutocompleteItem = selectAutocompleteItem;
window.loadCuratedBundles = loadCuratedBundles;
window.addBundleToCart = addBundleToCart;
window.openGiftModal = openGiftModal;
window.closeGiftModal = closeGiftModal;
window.handleGiftCheckout = handleGiftCheckout;
window.openGiftCelebrationModal = openGiftCelebrationModal;
window.closeGiftCelebrationModal = closeGiftCelebrationModal;
// ==========================================
// FLASH SALE COUNTDOWN TIMER
// ==========================================
function initSaleCountdown() {
  const elem = document.getElementById('sale-countdown');
  if (!elem) return;

  function update() {
    const now = new Date();
    // End of current day
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const diff = Math.max(0, end - now);
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    const pad = (n) => String(n).padStart(2, '0');
    elem.textContent = `Ends in: ${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;
  }

  update();
  setInterval(update, 1000);
}

// Call countdown on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSaleCountdown);
} else {
  initSaleCountdown();
}

// ==========================================
// CUSTOMER EBOOK REQUEST
// ==========================================
function openRequestBookModal() {
  const modal = document.getElementById('request-book-modal');
  if (modal) modal.classList.add('open');
}

function closeRequestBookModal() {
  const modal = document.getElementById('request-book-modal');
  if (modal) modal.classList.remove('open');
}

async function handleRequestBookSubmit(e) {
  e.preventDefault();
  const token = getAuthToken();
  const title = document.getElementById('req-book-title').value.trim();
  const category = document.getElementById('req-category').value.trim();
  const notes = document.getElementById('req-notes').value.trim();
  const btn = document.getElementById('btn-submit-book-req');

  if (!title) {
    showToast('Please enter an eBook topic or title.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Submitting...';

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/requests', {
      method: 'POST',
      headers,
      body: JSON.stringify({ bookTitle: title, category, notes }),
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('form-request-book').reset();
      closeRequestBookModal();
    } else {
      showToast(data.message || 'Failed to submit request.', 'error');
    }
  } catch (err) {
    console.error('Request error:', err);
    showToast('Network error submitting request.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Submit eBook Request';
  }
}

window.copyGiftCode = copyGiftCode;
window.shareGiftViaWhatsApp = shareGiftViaWhatsApp;
window.loadCategories = loadCategories;
window.openRequestBookModal = openRequestBookModal;
window.closeRequestBookModal = closeRequestBookModal;
window.handleRequestBookSubmit = handleRequestBookSubmit;
