// User Dashboard & Library Logic

document.addEventListener('DOMContentLoaded', async () => {
  const token = getAuthToken();
  if (!token) {
    showToast('Please login to access your library.', 'warning');
    setTimeout(() => {
      window.location.href = '/login.html?redirect=/dashboard.html';
    }, 800);
    return;
  }

  await updateNavAuthUI();
  await loadUserLibrary();
  await loadSentGifts();
  await loadReferralData();
});

async function loadUserLibrary() {
  const container = document.getElementById('purchased-books-container');
  const userNameElem = document.getElementById('user-display-name');
  const userEmailElem = document.getElementById('user-display-email');
  const bookCountElem = document.getElementById('user-books-count');
  const ordersListElem = document.getElementById('user-orders-list');

  try {
    const token = getAuthToken();

    // 1. Fetch user profile with populated purchasedBooks
    const userRes = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userData = await userRes.json();

    if (!userData.success || !userData.user) {
      clearAuth();
      window.location.href = '/login.html';
      return;
    }

    const user = userData.user;
    if (userNameElem) userNameElem.textContent = user.name;
    if (userEmailElem) userEmailElem.textContent = user.email;
    if (bookCountElem) bookCountElem.textContent = (user.purchasedBooks || []).length;

    // Fetch Reading Progress Stats
    let progressMap = {};
    try {
      const progRes = await fetch('/api/progress/stats/my-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const progData = await progRes.json();
      if (progData.success) {
        const stats = progData.stats;
        const statOwned = document.getElementById('stat-books-owned');
        const statInProg = document.getElementById('stat-in-progress');
        const statComp = document.getElementById('stat-completed');
        const statStreak = document.getElementById('stat-reading-streak');

        if (statOwned) statOwned.textContent = stats.totalOwned || (user.purchasedBooks || []).length;
        if (statInProg) statInProg.textContent = stats.inProgressCount || 0;
        if (statComp) statComp.textContent = stats.completedCount || 0;
        if (statStreak) statStreak.textContent = `${stats.streakDays || 1} 🔥`;

        (progData.progressRecords || []).forEach((p) => {
          if (p.book && p.book._id) {
            progressMap[p.book._id.toString()] = p;
          }
        });
      }
    } catch (e) {
      console.warn('Progress stats fetch error:', e);
    }

    // 2. Render Purchased eBooks
    const purchasedBooks = user.purchasedBooks || [];

    if (purchasedBooks.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-icon">📚</div>
          <h3 class="empty-title">Your Library is Empty</h3>
          <p class="empty-desc">You haven't purchased or redeemed any eBooks yet. Browse our curated store and unlock instant downloads with Razorpay.</p>
          <a href="/index.html" class="btn btn-primary">Browse eBook Store</a>
        </div>
      `;
    } else {
      container.innerHTML = purchasedBooks
        .map((book) => {
          const downloadUrl = `/api/download/${book._id}?token=${encodeURIComponent(token)}`;
          const prog = progressMap[book._id.toString()];
          const percent = prog ? prog.percentComplete : 0;
          const chapterText = prog
            ? `Chapter ${prog.currentChapter + 1} of ${prog.totalChapters}`
            : 'Not started';

          return `
            <div class="book-card">
              <div class="book-cover-wrap">
                <img src="${book.coverImage}" alt="${book.title}" class="book-cover-img" />
                <span class="book-badge">${book.category}</span>
                <span class="purchased-tag">✓ Unlocked</span>
              </div>
              <div class="book-details">
                <div class="book-category">Full License Access</div>
                <h3 class="book-title">${book.title}</h3>
                <div class="book-author">By <strong>${book.author}</strong></div>
                <div class="book-meta">
                  <span>📄 ${book.pages} Pages</span>
                  <span>⭐ ${book.rating}</span>
                </div>

                <!-- Reading Progress Bar -->
                <div style="margin: 0.6rem 0;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted);">
                    <span>${chapterText}</span>
                    <span>${percent}%</span>
                  </div>
                  <div class="progress-bar-track">
                    <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                  </div>
                </div>

                <div class="book-footer">
                  <div class="price-wrap">
                    <span style="font-size: 0.85rem; color: #10b981; font-weight: 700;">✓ Purchased</span>
                  </div>
                  <div style="display: flex; gap: 0.4rem;">
                    <a href="/reader.html?bookId=${book._id}" class="btn btn-outline btn-sm" title="Read eBook directly in browser">
                      📖 Read Online
                    </a>
                    <a href="${downloadUrl}" class="btn btn-success btn-sm" download title="Download eBook PDF">
                      ⬇ PDF
                    </a>
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    }

    // 3. Fetch user orders
    if (ordersListElem) {
      const ordersRes = await fetch('/api/payment/my-orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ordersData = await ordersRes.json();

      if (ordersData.success && ordersData.orders && ordersData.orders.length > 0) {
        ordersListElem.innerHTML = `
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 1.5rem;">
            <div style="padding: 1rem 1.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #334155;">
              Recent Invoices & Transactions
            </div>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                  <tr style="border-bottom: 1px solid #e2e8f0; text-align: left; color: #64748b;">
                    <th style="padding: 0.85rem 1.25rem;">Date</th>
                    <th style="padding: 0.85rem 1.25rem;">Book Title</th>
                    <th style="padding: 0.85rem 1.25rem;">Payment ID</th>
                    <th style="padding: 0.85rem 1.25rem;">Amount</th>
                    <th style="padding: 0.85rem 1.25rem;">Status</th>
                    <th style="padding: 0.85rem 1.25rem;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${ordersData.orders
                    .map((order) => {
                      const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      });
                      const bookTitle = order.book ? order.book.title : 'eBook';
                      const bookId = order.book ? order.book._id : '';
                      const dlUrl = `/api/download/${bookId}?token=${encodeURIComponent(token)}`;

                      return `
                      <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.85rem 1.25rem; color: #64748b;">${dateStr}</td>
                        <td style="padding: 0.85rem 1.25rem; font-weight: 600; color: #0f172a;">${bookTitle}</td>
                        <td style="padding: 0.85rem 1.25rem; font-family: monospace; font-size: 0.85rem; color: #475569;">${order.razorpayPaymentId || order.razorpayOrderId}</td>
                        <td style="padding: 0.85rem 1.25rem; font-weight: 700;">₹${order.amount}</td>
                        <td style="padding: 0.85rem 1.25rem;">
                          <span style="background: #ecfdf5; color: #10b981; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 700; font-size: 0.75rem;">
                            PAID
                          </span>
                        </td>
                        <td style="padding: 0.85rem 1.25rem;">
                          <div style="display: flex; gap: 0.4rem;">
                            ${bookId ? `<a href="${dlUrl}" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.6rem;" title="Download eBook">⬇ PDF</a>` : '-'}
                            <a href="/api/payment/invoice/${order._id}?token=${encodeURIComponent(token)}" target="_blank" class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.6rem;" title="Official Tax Invoice">🧾 Receipt</a>
                          </div>
                        </td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else {
        ordersListElem.innerHTML = '';
      }
    }
  } catch (error) {
    console.error('Error loading library:', error);
    showToast('Failed to load your purchased books.', 'error');
  }
}

// Update profile name
async function handleUpdateProfileName(e) {
  e.preventDefault();
  const token = getAuthToken();
  const nameInput = document.getElementById('profile-edit-name');
  const name = nameInput ? nameInput.value.trim() : '';

  if (!name) return;

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();
    if (data.success) {
      showToast('Profile name updated!', 'success');
      const user = getStoredUser() || {};
      user.name = name;
      saveAuth(user);
      await updateNavAuthUI();
      await loadUserLibrary();
    } else {
      showToast(data.message || 'Update failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to update profile.', 'error');
  }
}

// Change password
async function handleChangePassword(e) {
  e.preventDefault();
  const token = getAuthToken();
  const currentPassword = document.getElementById('pass-current').value;
  const newPassword = document.getElementById('pass-new').value;

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();
    if (data.success) {
      showToast('Password changed successfully!', 'success');
      document.getElementById('form-change-password').reset();
    } else {
      showToast(data.message || 'Password update failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to update password.', 'error');
  }
}

// Redeem Gift Voucher
async function redeemGiftVoucher() {
  const token = getAuthToken();
  const input = document.getElementById('input-redeem-code');
  const code = input ? input.value.trim() : '';
  const btn = document.getElementById('btn-redeem-code');

  if (!code) {
    showToast('Please enter your gift voucher code (e.g. GIFT-XXXX-YYYY)', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Redeeming...';

  try {
    const res = await fetch('/api/gifts/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      if (input) input.value = '';
      await loadUserLibrary();
    } else {
      showToast(data.message || 'Failed to redeem gift code.', 'error');
    }
  } catch (err) {
    console.error('Redeem error:', err);
    showToast('Network error redeeming gift code.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Claim eBook';
  }
}

// Load gifts sent by current user
async function loadSentGifts() {
  const container = document.getElementById('sent-gifts-list-container');
  if (!container) return;

  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch('/api/gifts/my-sent-gifts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data.success || !data.gifts || data.gifts.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #64748b; font-size: 0.9rem; padding: 2rem;">
          You haven't sent any gift eBooks yet. Surprise a friend from our store! 🎁
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="overflow-x: auto; margin-top: 1rem;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border); text-align: left; color: var(--text-muted);">
              <th style="padding: 0.75rem 1rem;">Recipient</th>
              <th style="padding: 0.75rem 1rem;">eBook Gifted</th>
              <th style="padding: 0.75rem 1rem;">Gift Code</th>
              <th style="padding: 0.75rem 1rem;">Status</th>
              <th style="padding: 0.75rem 1rem;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${data.gifts
              .map((g) => {
                const isRedeemed = g.isRedeemed;
                const bookTitle = g.book ? g.book.title : 'eBook';
                return `
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 0.85rem 1rem;">
                      <strong>${g.recipientName}</strong>
                      <div style="font-size: 0.78rem; color: var(--text-muted);">${g.recipientEmail}</div>
                    </td>
                    <td style="padding: 0.85rem 1rem; font-weight: 600;">${bookTitle}</td>
                    <td style="padding: 0.85rem 1rem; font-family: monospace; font-weight: 700; color: var(--primary);">${g.code}</td>
                    <td style="padding: 0.85rem 1rem;">
                      ${
                        isRedeemed
                          ? `<span style="background: #ecfdf5; color: #059669; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 700; font-size: 0.75rem;">✓ Claimed</span>`
                          : `<span style="background: #fef3c7; color: #d97706; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 700; font-size: 0.75rem;">⏳ Pending</span>`
                      }
                    </td>
                    <td style="padding: 0.85rem 1rem;">
                      <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${g.code}'); showToast('Code copied! 📋', 'success');" title="Copy Code">
                        📋 Copy
                      </button>
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('Fetch sent gifts error:', err);
  }
}

// ==========================================
// REFERRAL & AFFILIATE PROGRAM LOGIC
// ==========================================
let currentReferralLink = '';

async function loadReferralData() {
  const token = getAuthToken();
  const inputLink = document.getElementById('input-referral-link');
  const statWallet = document.getElementById('ref-stat-wallet');
  const statFriends = document.getElementById('ref-stat-friends');
  if (!token || !inputLink) return;

  try {
    const res = await fetch('/api/referrals/my-referrals', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.success) {
      currentReferralLink = data.referralLink || '';
      inputLink.value = currentReferralLink;
      if (statWallet) statWallet.textContent = `₹${data.walletCredits || 0}`;
      if (statFriends) statFriends.textContent = data.totalReferrals || 0;
    }
  } catch (err) {
    console.error('Referral load error:', err);
  }
}

function copyReferralLink() {
  if (!currentReferralLink) return;
  navigator.clipboard.writeText(currentReferralLink);
  showToast('Referral link copied to clipboard! 📋', 'success');
}

function shareReferralWhatsApp() {
  if (!currentReferralLink) return;
  const msg = encodeURIComponent(
    `📚 Hey! Check out BookVault for amazing technical & engineering eBooks. Use my link to get a ₹50 signup discount: ${currentReferralLink}`
  );
  window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
}

window.handleUpdateProfileName = handleUpdateProfileName;
window.handleChangePassword = handleChangePassword;
window.redeemGiftVoucher = redeemGiftVoucher;
window.loadSentGifts = loadSentGifts;
window.loadReferralData = loadReferralData;
window.copyReferralLink = copyReferralLink;
window.shareReferralWhatsApp = shareReferralWhatsApp;
