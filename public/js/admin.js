// Admin Panel Management Logic

let adminBooksCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = getAuthToken();
  if (!token) {
    showToast('Please login as administrator to access this area.', 'warning');
    setTimeout(() => {
      window.location.href = '/login.html?redirect=/admin.html';
    }, 800);
    return;
  }

  // Fetch current user and verify admin role
  const user = await fetchCurrentUser();
  if (!user || user.role !== 'admin') {
    showToast('Access denied: Admin privileges required.', 'error');
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 1200);
    return;
  }

  await updateNavAuthUI();
  await loadAdminStats();
  await loadAdminCategories();
  await loadAdminBooks();
  await loadAdminUsers();
  await loadAdminOrders();
});

// File upload label updater helper
function handleFileSelected(input, labelId, prefix = '') {
  const label = document.getElementById(labelId);
  if (!label) return;
  if (input.files && input.files[0]) {
    label.textContent = `${prefix}${input.files[0].name} (${(input.files[0].size / (1024 * 1024)).toFixed(2)} MB)`;
    label.style.color = '#4f46e5';
  } else {
    label.textContent = 'Click to select file';
    label.style.color = '#1e293b';
  }
}

// Tab switcher
function switchAdminTab(tab) {
  const secAdd = document.getElementById('section-add-book');
  const secManage = document.getElementById('section-manage-books');
  const secUsers = document.getElementById('section-user-management');
  const secCoupons = document.getElementById('section-coupons');
  const secCategories = document.getElementById('section-categories');
  const secGifts = document.getElementById('section-gifts-log');
  const secRequests = document.getElementById('section-requests');
  const secSales = document.getElementById('section-sales-log');

  const btnAdd = document.getElementById('tab-btn-add');
  const btnManage = document.getElementById('tab-btn-manage');
  const btnUsers = document.getElementById('tab-btn-users');
  const btnCoupons = document.getElementById('tab-btn-coupons');
  const btnCategories = document.getElementById('tab-btn-categories');
  const btnGifts = document.getElementById('tab-btn-gifts');
  const btnRequests = document.getElementById('tab-btn-requests');
  const btnSales = document.getElementById('tab-btn-sales');

  [secAdd, secManage, secUsers, secCoupons, secCategories, secGifts, secRequests, secSales].forEach((s) => {
    if (s) s.style.display = 'none';
  });
  [btnAdd, btnManage, btnUsers, btnCoupons, btnCategories, btnGifts, btnRequests, btnSales].forEach((b) => {
    if (b) b.classList.remove('active');
  });

  if (tab === 'add-book') {
    secAdd.style.display = 'block';
    btnAdd.classList.add('active');
  } else if (tab === 'manage-books') {
    secManage.style.display = 'block';
    btnManage.classList.add('active');
    loadAdminBooks();
  } else if (tab === 'user-management') {
    secUsers.style.display = 'block';
    btnUsers.classList.add('active');
    loadAdminUsers();
  } else if (tab === 'coupons') {
    secCoupons.style.display = 'block';
    btnCoupons.classList.add('active');
    loadAdminCoupons();
  } else if (tab === 'categories') {
    secCategories.style.display = 'block';
    btnCategories.classList.add('active');
    loadAdminCategories();
  } else if (tab === 'gifts-log') {
    secGifts.style.display = 'block';
    btnGifts.classList.add('active');
    loadAdminGifts();
  } else if (tab === 'requests') {
    secRequests.style.display = 'block';
    btnRequests.classList.add('active');
    loadAdminRequests();
  } else if (tab === 'sales-log') {
    secSales.style.display = 'block';
    btnSales.classList.add('active');
    loadAdminOrders();
  }
}

// Load high level statistics
async function loadAdminStats() {
  const token = getAuthToken();
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success && data.stats) {
      document.getElementById('stat-total-books').textContent = data.stats.totalBooks;
      document.getElementById('stat-total-revenue').textContent = `₹${data.stats.totalRevenue.toLocaleString('en-IN')}`;
      document.getElementById('stat-total-orders').textContent = data.stats.totalOrders;
      document.getElementById('stat-total-users').textContent = data.stats.totalUsers;
      const giftsElem = document.getElementById('stat-total-gifts');
      if (giftsElem) giftsElem.textContent = data.stats.totalGifts || 0;
      const countBadge = document.getElementById('catalog-count-badge');
      if (countBadge) countBadge.textContent = data.stats.totalBooks || 0;
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// Load gifts vouchers platform-wide
async function loadAdminGifts() {
  const tbody = document.getElementById('admin-gifts-table-body');
  if (!tbody) return;

  const token = getAuthToken();
  try {
    const res = await fetch('/api/admin/gifts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data.success || !data.gifts || data.gifts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 2rem;">No gift vouchers issued yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.gifts
      .map((g) => {
        const dateStr = new Date(g.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const sender = g.sender ? `${g.sender.name} (${g.sender.email})` : g.senderName || 'Anonymous';
        const bookTitle = g.book ? g.book.title : 'eBook';
        const redeemedUser = g.redeemedBy ? `${g.redeemedBy.name} (${g.redeemedBy.email})` : '—';

        return `
          <tr>
            <td>${dateStr}</td>
            <td>${sender}</td>
            <td><strong>${g.recipientName}</strong><br><span style="font-size: 0.8rem; color: #64748b;">${g.recipientEmail}</span></td>
            <td><strong>${bookTitle}</strong></td>
            <td><code style="background: #eef2ff; color: #4338ca; padding: 0.2rem 0.4rem; border-radius: 4px; font-weight: 700;">${g.code}</code></td>
            <td>
              ${
                g.isRedeemed
                  ? `<span style="background: #ecfdf5; color: #059669; padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700;">✓ Redeemed</span>`
                  : `<span style="background: #fef3c7; color: #d97706; padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700;">⏳ Active</span>`
              }
            </td>
            <td>${redeemedUser}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Fetch admin gifts error:', err);
  }
}

const COVER_PRESETS = {
  Programming: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
  'Artificial Intelligence': 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=600&q=80',
  'Cloud & Architecture': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
  'Career & Self-Help': 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?auto=format&fit=crop&w=600&q=80',
  'Design & Frontend': 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
  'Business & Finance': 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
  'Fiction & Novels': 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
};

function updateLiveBookPreview() {
  const title = document.getElementById('book-title')?.value.trim() || 'eBook Title Preview';
  const author = document.getElementById('book-author')?.value.trim() || 'Author Name';
  const category = document.getElementById('book-category')?.value || 'Category';
  const price = document.getElementById('book-price')?.value || '499';
  const origPrice = document.getElementById('book-orig-price')?.value;
  const pages = document.getElementById('book-pages')?.value || '180';
  const desc = document.getElementById('book-desc')?.value.trim() || 'Book synopsis and chapter topics preview...';
  const coverUrlInput = document.getElementById('book-cover-url')?.value.trim();

  const elTitle = document.getElementById('live-preview-title');
  const elAuthor = document.getElementById('live-preview-author');
  const elCat = document.getElementById('live-preview-category');
  const elPrice = document.getElementById('live-preview-price');
  const elOrig = document.getElementById('live-preview-orig');
  const elPages = document.getElementById('live-preview-pages');
  const elDesc = document.getElementById('live-preview-desc');
  const elCover = document.getElementById('live-preview-cover');

  if (elTitle) elTitle.textContent = title;
  if (elAuthor) elAuthor.textContent = `By ${author}`;
  if (elCat) elCat.textContent = category;
  if (elPrice) elPrice.textContent = `₹${price}`;
  if (elOrig) {
    elOrig.textContent = origPrice ? `₹${origPrice}` : '';
    elOrig.style.display = origPrice ? 'inline' : 'none';
  }
  if (elPages) elPages.textContent = `${pages} pages`;
  if (elDesc) elDesc.textContent = desc;

  if (elCover && coverUrlInput) {
    elCover.src = coverUrlInput;
  }
}

function applyCoverPreset(category) {
  const url = COVER_PRESETS[category] || COVER_PRESETS['Programming'];
  const input = document.getElementById('book-cover-url');
  if (input) {
    input.value = url;
  }
  const coverLabel = document.getElementById('cover-file-label');
  if (coverLabel) {
    coverLabel.textContent = `Preset: ${category}`;
    coverLabel.style.color = '#4f46e5';
  }
  const elCover = document.getElementById('live-preview-cover');
  if (elCover) elCover.src = url;
  showToast(`Applied cover preset for "${category}"`, 'info');
}

function handleCategoryChange(catName) {
  const elCat = document.getElementById('live-preview-category');
  if (elCat) elCat.textContent = catName;
  const coverInput = document.getElementById('book-cover-url');
  if (coverInput && !coverInput.value.trim() && COVER_PRESETS[catName]) {
    const elCover = document.getElementById('live-preview-cover');
    if (elCover) elCover.src = COVER_PRESETS[catName];
  }
}

function handleCoverFileSelected(input) {
  const label = document.getElementById('cover-file-label');
  if (input.files && input.files[0]) {
    const file = input.files[0];
    if (label) {
      label.textContent = `🖼️ ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
      label.style.color = '#4f46e5';
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const elCover = document.getElementById('live-preview-cover');
      if (elCover) elCover.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function resetAddBookForm() {
  const form = document.getElementById('form-add-book');
  if (form) form.reset();
  const pdfLabel = document.getElementById('pdf-file-label');
  if (pdfLabel) {
    pdfLabel.textContent = 'Click to select eBook PDF (Optional)';
    pdfLabel.style.color = '#1e293b';
  }
  const coverLabel = document.getElementById('cover-file-label');
  if (coverLabel) {
    coverLabel.textContent = 'Click to upload cover image file';
    coverLabel.style.color = '#1e293b';
  }
  const elCover = document.getElementById('live-preview-cover');
  if (elCover) elCover.src = COVER_PRESETS['Programming'];
  updateLiveBookPreview();
}

// Handle Add New eBook Submission
async function handleCreateBook(e) {
  e.preventDefault();
  const token = getAuthToken();
  const btn = document.getElementById('btn-submit-book');

  const titleVal = document.getElementById('book-title').value.trim();
  const authorVal = document.getElementById('book-author').value.trim();
  const catVal = document.getElementById('book-category').value;
  const priceVal = document.getElementById('book-price').value;
  const descVal = document.getElementById('book-desc').value.trim();

  if (!titleVal || !authorVal || !priceVal || !descVal) {
    showToast('Please fill in title, author, price, and description.', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('title', titleVal);
  formData.append('author', authorVal);
  formData.append('category', catVal || 'Programming');
  formData.append('price', priceVal);
  formData.append('originalPrice', document.getElementById('book-orig-price').value || '');
  formData.append('pages', document.getElementById('book-pages').value || 180);
  formData.append('language', document.getElementById('book-language').value.trim() || 'English');
  formData.append('description', descVal);
  formData.append('featured', document.getElementById('book-featured').checked);

  // Optional custom preview sample
  const previewSampleInput = document.getElementById('book-preview-sample');
  if (previewSampleInput && previewSampleInput.value.trim()) {
    formData.append('previewSample', previewSampleInput.value.trim());
  }

  // PDF File (Optional - Backend auto-generates if not uploaded!)
  const pdfInput = document.getElementById('file-pdf');
  if (pdfInput.files && pdfInput.files[0]) {
    formData.append('pdfFile', pdfInput.files[0]);
  }

  // Cover image file OR URL
  const coverFileInput = document.getElementById('file-cover');
  if (coverFileInput.files && coverFileInput.files[0]) {
    formData.append('coverImage', coverFileInput.files[0]);
  } else {
    const coverUrl = document.getElementById('book-cover-url').value.trim();
    if (coverUrl) {
      formData.append('coverImageUrl', coverUrl);
    } else if (COVER_PRESETS[catVal]) {
      formData.append('coverImageUrl', COVER_PRESETS[catVal]);
    }
  }

  btn.disabled = true;
  btn.innerHTML = '⚡ Publishing eBook...';

  try {
    const res = await fetch('/api/admin/books', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      showToast(`🎉 Success! "${data.book.title}" added to store!`, 'success');
      resetAddBookForm();
      await loadAdminStats();
      await loadAdminBooks();
      await loadAdminCategories(); // Refresh book count badges
      switchAdminTab('manage-books');
    } else {
      showToast(data.message || 'Failed to add eBook.', 'error');
    }
  } catch (err) {
    console.error('Error adding eBook:', err);
    showToast('Network error while uploading eBook.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Publish eBook to Store';
  }
}

// Load books for the manage table
async function loadAdminBooks() {
  const tbody = document.getElementById('admin-books-table-body');
  const token = getAuthToken();

  try {
    const res = await fetch('/api/books', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.success && data.books) {
      adminBooksCache = data.books;
      document.getElementById('catalog-count-badge').textContent = adminBooksCache.length;

      if (adminBooksCache.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">
              No eBooks found. Click "Add New eBook" to add your first one!
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = adminBooksCache
        .map((b) => {
          return `
            <tr>
              <td>
                <img src="${b.coverImage}" alt="${b.title}" style="width: 48px; height: 64px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
              </td>
              <td>
                <div style="font-weight: 700; color: #0f172a;">${b.title}</div>
                <div style="font-size: 0.82rem; color: #64748b;">By ${b.author}</div>
              </td>
              <td>
                <span style="background: #eef2ff; color: #4338ca; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 600; font-size: 0.8rem;">
                  ${b.category}
                </span>
              </td>
              <td>
                <span style="font-weight: 800; color: #0f172a;">₹${b.price}</span>
                ${b.originalPrice > b.price ? `<span style="font-size: 0.8rem; color: #94a3b8; text-decoration: line-through; margin-left: 0.3rem;">₹${b.originalPrice}</span>` : ''}
              </td>
              <td style="color: #64748b; font-size: 0.85rem;">${b.pages || '-'} pages</td>
              <td>
                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn btn-secondary btn-sm" onclick="openEditModal('${b._id}')">✏️ Edit</button>
                  <button class="btn btn-outline btn-sm" style="border-color: #ef4444; color: #ef4444;" onclick="handleDeleteBook('${b._id}', '${b.title.replace(/'/g, "\\'")}')">🗑️ Delete</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.error('Error loading admin books:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 2rem;">Error loading books.</td></tr>`;
  }
}

// Delete eBook
async function handleDeleteBook(bookId, bookTitle) {
  if (!confirm(`Are you sure you want to permanently delete "${bookTitle}"? This will also remove the eBook PDF from the storage.`)) {
    return;
  }

  const token = getAuthToken();
  try {
    const res = await fetch(`/api/admin/books/${bookId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadAdminStats();
      await loadAdminBooks();
    } else {
      showToast(data.message || 'Failed to delete book.', 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to connect to server.', 'error');
  }
}

// Edit Modal
function openEditModal(bookId) {
  const book = adminBooksCache.find((b) => b._id === bookId);
  if (!book) return;

  document.getElementById('edit-book-id').value = book._id;
  document.getElementById('edit-title').value = book.title;
  document.getElementById('edit-author').value = book.author;

  const editCat = document.getElementById('edit-category');
  if (editCat) {
    if (!Array.from(editCat.options).some((o) => o.value === book.category)) {
      const opt = document.createElement('option');
      opt.value = book.category;
      opt.textContent = book.category;
      editCat.appendChild(opt);
    }
    editCat.value = book.category;
  }

  document.getElementById('edit-price').value = book.price;
  document.getElementById('edit-orig-price').value = book.originalPrice || '';
  document.getElementById('edit-desc').value = book.description;
  document.getElementById('edit-cover-url').value = book.coverImage || '';

  const modal = document.getElementById('edit-book-modal');
  modal.classList.add('open');
}

function closeEditModal() {
  const modal = document.getElementById('edit-book-modal');
  modal.classList.remove('open');
}

// Update eBook
async function handleUpdateBook(e) {
  e.preventDefault();
  const token = getAuthToken();
  const bookId = document.getElementById('edit-book-id').value;
  const btn = document.getElementById('btn-save-edit');

  const formData = new FormData();
  formData.append('title', document.getElementById('edit-title').value.trim());
  formData.append('author', document.getElementById('edit-author').value.trim());
  formData.append('category', document.getElementById('edit-category').value.trim());
  formData.append('price', document.getElementById('edit-price').value);
  formData.append('originalPrice', document.getElementById('edit-orig-price').value || '');
  formData.append('description', document.getElementById('edit-desc').value.trim());
  formData.append('coverImageUrl', document.getElementById('edit-cover-url').value.trim());

  const filePdf = document.getElementById('edit-file-pdf');
  if (filePdf.files && filePdf.files[0]) {
    formData.append('pdfFile', filePdf.files[0]);
  }

  btn.disabled = true;
  btn.innerHTML = 'Saving...';

  try {
    const res = await fetch(`/api/admin/books/${bookId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      showToast('eBook updated successfully!', 'success');
      closeEditModal();
      await loadAdminBooks();
    } else {
      showToast(data.message || 'Update failed.', 'error');
    }
  } catch (err) {
    console.error('Update error:', err);
    showToast('Failed to update eBook.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Save Changes';
  }
}

// Load sales orders
async function loadAdminOrders() {
  const tbody = document.getElementById('admin-orders-table-body');
  const token = getAuthToken();

  try {
    const res = await fetch('/api/admin/orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.success && data.orders) {
      if (data.orders.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">
              No sales orders recorded yet.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = data.orders
        .map((order) => {
          const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          const custName = order.user ? order.user.name : 'Unknown';
          const custEmail = order.user ? order.user.email : '';
          const bookTitle = order.book ? order.book.title : 'eBook';

          return `
            <tr>
              <td style="color: #64748b; font-size: 0.85rem;">${dateStr}</td>
              <td>
                <div style="font-weight: 600; color: #0f172a;">${custName}</div>
                <div style="font-size: 0.8rem; color: #64748b;">${custEmail}</div>
              </td>
              <td style="font-weight: 600; color: #1e1b4b;">${bookTitle}</td>
              <td style="font-family: monospace; font-size: 0.82rem; color: #475569;">${order.razorpayPaymentId || order.razorpayOrderId}</td>
              <td style="font-weight: 700; color: #0f172a;">₹${order.amount}</td>
              <td>
                <span style="background: #ecfdf5; color: #059669; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 700; font-size: 0.75rem;">
                  ${order.status.toUpperCase()}
                </span>
              </td>
              <td>
                <a href="/api/payment/invoice/${order._id}?token=${encodeURIComponent(token)}" target="_blank" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.6rem; font-size: 0.8rem;" title="View Official Tax Invoice">
                  🧾 Invoice
                </a>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.error('Error loading admin orders:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 2rem;">Error loading orders.</td></tr>`;
  }
}

// ==========================================
// USER & ROLE MANAGEMENT
// ==========================================

// Load users for the user management table
async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-table-body');
  const countBadge = document.getElementById('user-count-badge');
  const token = getAuthToken();
  const currentUser = getStoredUser();

  try {
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.success && data.users) {
      if (countBadge) countBadge.textContent = data.users.length;

      if (data.users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">No registered users found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.users
        .map((u) => {
          const isCurrentAdmin = currentUser && currentUser.id === u._id;
          const isAdmin = u.role === 'admin';
          const joinedDate = new Date(u.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          const booksCount = (u.purchasedBooks || []).length;
          const initials = u.name
            ? u.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
            : 'U';

          return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div class="user-avatar" style="${isAdmin ? 'background: #0f172a;' : 'background: #4f46e5;'}">
                    ${isAdmin ? '👑' : initials}
                  </div>
                  <div>
                    <div style="font-weight: 700; color: #0f172a;">
                      ${u.name} ${isCurrentAdmin ? '<span style="font-size: 0.75rem; color: #6366f1; font-weight: normal;">(You)</span>' : ''}
                    </div>
                  </div>
                </div>
              </td>
              <td style="color: #475569;">${u.email}</td>
              <td>
                ${
                  isAdmin
                    ? `<span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 0.25rem 0.65rem; border-radius: 99px; font-weight: 700; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                        👑 Admin
                      </span>`
                    : `<span style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 0.25rem 0.65rem; border-radius: 99px; font-weight: 600; font-size: 0.8rem;">
                        👤 Customer
                      </span>`
                }
              </td>
              <td style="font-weight: 600; color: #0f172a;">${booksCount} eBook${booksCount === 1 ? '' : 's'}</td>
              <td style="color: #64748b; font-size: 0.85rem;">${joinedDate}</td>
              <td>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  ${
                    isCurrentAdmin
                      ? `<span style="font-size: 0.82rem; color: #94a3b8; font-style: italic;">Current Session</span>`
                      : `
                      ${
                        isAdmin
                          ? `<button class="btn btn-secondary btn-sm" onclick="handleToggleAdminRole('${u._id}', 'user', '${u.name.replace(/'/g, "\\'")}')" title="Revoke admin privileges">
                              Revoke Admin
                            </button>`
                          : `<button class="btn btn-outline btn-sm" onclick="handleToggleAdminRole('${u._id}', 'admin', '${u.name.replace(/'/g, "\\'")}')" style="border-color: #f59e0b; color: #d97706;" title="Grant full admin privileges">
                              👑 Make Admin
                            </button>`
                      }
                      <button class="btn btn-outline btn-sm" style="border-color: #ef4444; color: #ef4444;" onclick="handleDeleteUser('${u._id}', '${u.name.replace(/'/g, "\\'")}', '${u.email}')" title="Permanently delete user">
                        🗑️ Delete
                      </button>
                    `
                  }
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.error('Error loading users:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 2rem;">Error loading users list.</td></tr>`;
  }
}

// Toggle admin role (Grant or Revoke)
async function handleToggleAdminRole(userId, newRole, userName) {
  const actionText = newRole === 'admin' ? 'grant ADMINISTRATOR access to' : 'revoke administrator privileges from';
  if (!confirm(`Are you sure you want to ${actionText} "${userName}"?`)) {
    return;
  }

  const token = getAuthToken();
  try {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role: newRole }),
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadAdminUsers();
      await loadAdminStats();
    } else {
      showToast(data.message || 'Failed to update user access level.', 'error');
    }
  } catch (err) {
    console.error('Role update error:', err);
    showToast('Failed to connect to server.', 'error');
  }
}

// Delete user account
async function handleDeleteUser(userId, userName, userEmail) {
  if (!confirm(`Are you sure you want to PERMANENTLY delete user "${userName}" (${userEmail})?\n\nThis action cannot be undone.`)) {
    return;
  }

  const token = getAuthToken();
  try {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadAdminUsers();
      await loadAdminStats();
    } else {
      showToast(data.message || 'Failed to delete user.', 'error');
    }
  } catch (err) {
    console.error('Delete user error:', err);
    showToast('Failed to connect to server.', 'error');
  }
}

// Create New Admin Modal controls
function openCreateAdminModal() {
  const modal = document.getElementById('create-user-modal');
  if (modal) modal.classList.add('open');
}

function closeCreateAdminModal() {
  const modal = document.getElementById('create-user-modal');
  if (modal) modal.classList.remove('open');
}

// Submit Create Admin Form
async function handleCreateAdminSubmit(e) {
  e.preventDefault();
  const token = getAuthToken();
  const btn = document.getElementById('btn-submit-new-user');

  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;

  btn.disabled = true;
  btn.innerHTML = 'Creating Account...';

  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, email, password, role }),
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('form-create-admin').reset();
      closeCreateAdminModal();
      await loadAdminUsers();
      await loadAdminStats();
    } else {
      showToast(data.message || 'Failed to create user.', 'error');
    }
  } catch (err) {
    console.error('Create user error:', err);
    showToast('Failed to connect to server.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Create Account';
  }
}

// ==========================================
// PROMO COUPONS MANAGEMENT
// ==========================================

// Load coupons for the promo coupon table
async function loadAdminCoupons() {
  const tbody = document.getElementById('admin-coupons-table-body');
  const countBadge = document.getElementById('coupons-count-badge');
  const token = getAuthToken();

  try {
    const res = await fetch('/api/coupons', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.success && data.coupons) {
      if (countBadge) countBadge.textContent = data.coupons.length;

      if (data.coupons.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 2rem;">No coupons found. Create your first coupon above!</td></tr>`;
        return;
      }

      tbody.innerHTML = data.coupons
        .map((c) => {
          const discountDisplay =
            c.discountType === 'percentage'
              ? `${c.discountValue}% OFF`
              : `₹${c.discountValue} FLAT OFF`;

          return `
            <tr>
              <td>
                <span class="promo-tag" style="margin-top: 0; font-family: monospace; font-size: 0.9rem;">
                  🏷️ ${c.code}
                </span>
              </td>
              <td style="text-transform: capitalize; color: #64748b;">${c.discountType}</td>
              <td style="font-weight: 700; color: #059669;">${discountDisplay}</td>
              <td>₹${c.minPurchase || 0}</td>
              <td>${c.usedCount} / ${c.usageLimit}</td>
              <td>
                <span style="background: #ecfdf5; color: #059669; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 700; font-size: 0.75rem;">
                  ${c.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </td>
              <td>
                <button class="btn btn-outline btn-sm" style="border-color: #ef4444; color: #ef4444; padding: 0.25rem 0.6rem;" onclick="handleDeleteCoupon('${c._id}', '${c.code}')">
                  🗑️ Delete
                </button>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.error('Error loading coupons:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 2rem;">Error loading coupons.</td></tr>`;
  }
}

// Create new coupon
async function handleCreateCoupon(e) {
  e.preventDefault();
  const token = getAuthToken();
  const btn = document.getElementById('btn-save-coupon');

  const code = document.getElementById('coupon-code').value.trim();
  const discountType = document.getElementById('coupon-type').value;
  const discountValue = document.getElementById('coupon-value').value;
  const minPurchase = document.getElementById('coupon-min-purchase').value || 0;

  btn.disabled = true;
  btn.innerHTML = 'Creating...';

  try {
    const res = await fetch('/api/coupons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, discountType, discountValue, minPurchase }),
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('form-add-coupon').reset();
      await loadAdminCoupons();
    } else {
      showToast(data.message || 'Failed to create coupon.', 'error');
    }
  } catch (err) {
    console.error('Coupon creation error:', err);
    showToast('Failed to create coupon.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Create Promo Coupon';
  }
}

// Delete coupon
async function handleDeleteCoupon(couponId, code) {
  if (!confirm(`Are you sure you want to delete promo coupon "${code}"?`)) {
    return;
  }

  const token = getAuthToken();
  try {
    const res = await fetch(`/api/coupons/${couponId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadAdminCoupons();
    } else {
      showToast(data.message || 'Failed to delete coupon.', 'error');
    }
  } catch (err) {
    console.error('Delete coupon error:', err);
    showToast('Failed to delete coupon.', 'error');
  }
}

// Export Orders to CSV for Accounting
async function exportOrdersToCSV() {
  const token = getAuthToken();
  try {
    const res = await fetch('/api/admin/orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data.success || !data.orders || data.orders.length === 0) {
      showToast('No orders available to export.', 'warning');
      return;
    }

    const headers = ['Order ID', 'Date', 'Customer Name', 'Customer Email', 'eBook Title', 'Amount (INR)', 'Payment ID', 'Status'];
    const rows = data.orders.map((o) => [
      o._id,
      new Date(o.createdAt).toISOString(),
      o.user ? `"${o.user.name.replace(/"/g, '""')}"` : 'Unknown',
      o.user ? o.user.email : '',
      o.book ? `"${o.book.title.replace(/"/g, '""')}"` : 'eBook',
      o.amount,
      o.razorpayPaymentId || o.razorpayOrderId,
      o.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BookVault_Sales_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Sales records exported as CSV successfully!', 'success');
  } catch (err) {
    console.error('CSV Export error:', err);
    showToast('Failed to export sales data.', 'error');
  }
}

// ==========================================
// CATEGORIES MANAGEMENT
// ==========================================

let adminCategoriesCache = [];

async function loadAdminCategories() {
  const tbody = document.getElementById('admin-categories-table-body');
  const countBadge = document.getElementById('categories-count-badge');
  const bookCatSelect = document.getElementById('book-category');
  const editCatSelect = document.getElementById('edit-category');
  const token = getAuthToken();

  try {
    const res = await fetch('/api/categories');
    const data = await res.json();

    if (data.success && data.categories) {
      adminCategoriesCache = data.categories;

      if (countBadge) countBadge.textContent = adminCategoriesCache.length;

      // Populate Book Add / Edit select dropdowns
      const selectHtml = adminCategoriesCache
        .map((c) => `<option value="${c.name}">${c.icon ? c.icon + ' ' : ''}${c.name}</option>`)
        .join('');

      if (bookCatSelect) {
        const currentVal = bookCatSelect.value;
        bookCatSelect.innerHTML = selectHtml;
        if (currentVal && adminCategoriesCache.some((c) => c.name === currentVal)) {
          bookCatSelect.value = currentVal;
        }
        if (typeof updateLiveBookPreview === 'function') {
          updateLiveBookPreview();
        }
      }

      if (editCatSelect) {
        const currentVal = editCatSelect.value;
        editCatSelect.innerHTML = selectHtml;
        if (currentVal && adminCategoriesCache.some((c) => c.name === currentVal)) {
          editCatSelect.value = currentVal;
        }
      }

      // Populate Admin Categories table
      if (tbody) {
        if (adminCategoriesCache.length === 0) {
          tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 2rem;">No categories yet. Add your first category!</td></tr>`;
          return;
        }

        tbody.innerHTML = adminCategoriesCache
          .map((c) => {
            const hasBooks = (c.bookCount || 0) > 0;
            return `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <span style="font-size: 1.3rem;">${c.icon || '📚'}</span>
                    <div>
                      <div style="font-weight: 700; color: #0f172a;">${c.name}</div>
                      ${c.description ? `<div style="font-size: 0.78rem; color: #64748b;">${c.description}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td>
                  <span style="font-size: 0.85rem; font-weight: 700; color: ${hasBooks ? '#4f46e5' : '#94a3b8'};">
                    ${c.bookCount || 0} eBook(s)
                  </span>
                </td>
                <td>
                  <button class="btn btn-outline btn-sm" style="border-color: #ef4444; color: #ef4444;" onclick="handleDeleteCategory('${c._id}', '${c.name.replace(/'/g, "\\'")}', ${c.bookCount || 0})">
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            `;
          })
          .join('');
      }
    }
  } catch (err) {
    console.error('Fetch categories error:', err);
  }
}

async function handleCreateCategory(e) {
  e.preventDefault();
  const token = getAuthToken();
  const btn = document.getElementById('btn-create-category');

  const nameInput = document.getElementById('new-category-name');
  const iconInput = document.getElementById('new-category-icon');
  const descInput = document.getElementById('new-category-desc');

  const name = nameInput ? nameInput.value.trim() : '';
  const icon = iconInput ? iconInput.value.trim() : '📚';
  const description = descInput ? descInput.value.trim() : '';

  if (!name) {
    showToast('Please provide a category name.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Creating...';

  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, icon, description }),
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('form-create-category').reset();
      if (iconInput) iconInput.value = '📚';
      await loadAdminCategories();
    } else {
      showToast(data.message || 'Failed to create category.', 'error');
    }
  } catch (err) {
    console.error('Create category error:', err);
    showToast('Failed to create category.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '➕ Create Category';
  }
}

async function handleDeleteCategory(categoryId, categoryName, bookCount) {
  if (bookCount > 0) {
    showToast(`Cannot delete category "${categoryName}" because ${bookCount} eBook(s) currently belong to it. Reassign or delete those eBooks first.`, 'warning');
    return;
  }

  if (!confirm(`Are you sure you want to delete category "${categoryName}"?`)) {
    return;
  }

  const token = getAuthToken();
  try {
    const res = await fetch(`/api/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadAdminCategories();
    } else {
      showToast(data.message || 'Failed to delete category.', 'error');
    }
  } catch (err) {
    console.error('Delete category error:', err);
    showToast('Failed to delete category.', 'error');
  }
}

async function handleRestoreDefaultCategories() {
  const token = getAuthToken();
  try {
    const res = await fetch('/api/categories/reset-defaults', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadAdminCategories();
    } else {
      showToast(data.message || 'Failed to restore predefined categories.', 'error');
    }
  } catch (err) {
    console.error('Restore predefined categories error:', err);
    showToast('Failed to connect to server.', 'error');
  }
}

// ==========================================
// CUSTOMER EBOOK REQUESTS LOGIC
// ==========================================

async function loadAdminRequests() {
  const tbody = document.getElementById('admin-requests-table-body');
  if (!tbody) return;

  const token = getAuthToken();
  try {
    const res = await fetch('/api/requests', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data.success || !data.requests || data.requests.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">No customer book requests yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.requests
      .map((r) => {
        const dateStr = new Date(r.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

        const statusColors = {
          Pending: '#d97706',
          'Under Review': '#0284c7',
          Planned: '#4f46e5',
          Published: '#059669',
        };

        return `
          <tr>
            <td>${dateStr}</td>
            <td>
              <strong>${r.userName}</strong>
              <div style="font-size: 0.78rem; color: #64748b;">${r.userEmail}</div>
            </td>
            <td><strong style="color: #0f172a;">${r.bookTitle}</strong></td>
            <td><span style="background: #eef2ff; color: #4338ca; padding: 0.2rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700;">${r.category}</span></td>
            <td style="max-width: 250px; font-size: 0.82rem; color: #475569;">${r.notes || '—'}</td>
            <td>
              <select onchange="handleUpdateRequestStatus('${r._id}', this.value)" style="padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid var(--border); font-size: 0.8rem; font-weight: 700; color: ${statusColors[r.status] || '#334155'};">
                <option value="Pending" ${r.status === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="Under Review" ${r.status === 'Under Review' ? 'selected' : ''}>🔍 Under Review</option>
                <option value="Planned" ${r.status === 'Planned' ? 'selected' : ''}>📝 Planned</option>
                <option value="Published" ${r.status === 'Published' ? 'selected' : ''}>✓ Published</option>
              </select>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Fetch requests error:', err);
  }
}

async function handleUpdateRequestStatus(requestId, status) {
  const token = getAuthToken();
  try {
    const res = await fetch(`/api/requests/${requestId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
    } else {
      showToast(data.message || 'Failed to update status.', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server.', 'error');
  }
}

window.handleFileSelected = handleFileSelected;
window.switchAdminTab = switchAdminTab;
window.handleCreateBook = handleCreateBook;
window.handleDeleteBook = handleDeleteBook;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.handleUpdateBook = handleUpdateBook;
window.loadAdminUsers = loadAdminUsers;
window.handleToggleAdminRole = handleToggleAdminRole;
window.handleDeleteUser = handleDeleteUser;
window.openCreateAdminModal = openCreateAdminModal;
window.closeCreateAdminModal = closeCreateAdminModal;
window.handleCreateAdminSubmit = handleCreateAdminSubmit;
window.loadAdminCoupons = loadAdminCoupons;
window.handleCreateCoupon = handleCreateCoupon;
window.handleDeleteCoupon = handleDeleteCoupon;
window.exportOrdersToCSV = exportOrdersToCSV;
window.loadAdminGifts = loadAdminGifts;
window.loadAdminCategories = loadAdminCategories;
window.handleCreateCategory = handleCreateCategory;
window.handleDeleteCategory = handleDeleteCategory;
window.handleRestoreDefaultCategories = handleRestoreDefaultCategories;
window.loadAdminRequests = loadAdminRequests;
window.handleUpdateRequestStatus = handleUpdateRequestStatus;
window.updateLiveBookPreview = updateLiveBookPreview;
window.applyCoverPreset = applyCoverPreset;
window.handleCategoryChange = handleCategoryChange;
window.handleCoverFileSelected = handleCoverFileSelected;
window.resetAddBookForm = resetAddBookForm;

