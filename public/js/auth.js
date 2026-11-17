// Authentication state management & UI helpers

const AUTH_TOKEN_KEY = 'ebook_auth_token';
const AUTH_USER_KEY = 'ebook_auth_user';

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getStoredUser() {
  const userStr = localStorage.getItem(AUTH_USER_KEY);
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

function saveAuth(user, token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }
}

function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

// Global Toast Notification Helper
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon =
    type === 'success'
      ? '✓'
      : type === 'error'
      ? '✕'
      : type === 'warning'
      ? '⚠'
      : 'ℹ';

  toast.innerHTML = `<span style="font-weight: bold; font-size: 1.1rem;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Fetch current user from server to verify token validity
async function fetchCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (data.success && data.user) {
      saveAuth(data.user, token);
      return data.user;
    } else {
      clearAuth();
      return null;
    }
  } catch (err) {
    console.error('Error fetching current user:', err);
    return getStoredUser();
  }
}

// Dark Mode / Theme Toggle
function initTheme() {
  const saved = localStorage.getItem('ebook_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ebook_theme', next);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

document.addEventListener('DOMContentLoaded', initTheme);

// Update Navbar UI based on user authentication state
async function updateNavAuthUI() {
  const user = await fetchCurrentUser();
  const authContainer = document.getElementById('nav-auth-section');
  if (!authContainer) return;

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const themeBtnHtml = `
    <button class="theme-toggle-btn" id="theme-toggle-btn" onclick="toggleTheme()" title="Toggle Dark/Light Mode">
      ${currentTheme === 'dark' ? '☀️' : '🌙'}
    </button>
  `;

  if (user) {
    const initials = user.name
      ? user.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : 'U';

    const isAdmin = user.role === 'admin';
    authContainer.innerHTML = `
      ${themeBtnHtml}
      <!-- Notifications Bell -->
      <div class="nav-notifications-wrap">
        <button class="nav-icon-btn" onclick="toggleNotificationDropdown()" title="Notifications">
          🔔 <span class="badge-count" id="nav-notif-badge" style="display: none;">0</span>
        </button>
        <div class="notification-dropdown" id="notification-dropdown">
          <div class="notification-header">
            <span>Notifications</span>
            <button onclick="markAllNotificationsRead()" style="background: none; border: none; color: var(--primary); font-size: 0.78rem; cursor: pointer; text-decoration: underline;">
              Mark all read
            </button>
          </div>
          <div class="notification-list" id="notification-items-list">
            <div style="padding: 1rem; text-align: center; color: #64748b; font-size: 0.82rem;">Loading notifications...</div>
          </div>
        </div>
      </div>
      ${
        isAdmin
          ? `<a href="/admin.html" class="nav-link" style="color: #4f46e5; font-weight: 700;" title="Manage Store & Add eBooks">
              🛡️ Admin Panel
            </a>`
          : ''
      }
      <a href="/dashboard.html" class="nav-link" title="My Purchased eBooks">
        📚 My Library
      </a>
      <div class="user-chip">
        <div class="user-avatar" ${isAdmin ? 'style="background: #0f172a;"' : ''}>${isAdmin ? '👑' : initials}</div>
        <span class="user-name" title="${user.email}">${user.name}${isAdmin ? ' (Admin)' : ''}</span>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-nav-logout" onclick="handleLogout()">
        Logout
      </button>
    `;
  } else {
    authContainer.innerHTML = `
      ${themeBtnHtml}
      <a href="/login.html" class="btn btn-outline btn-sm">Login</a>
      <a href="/login.html?tab=register" class="btn btn-primary btn-sm">Get Started</a>
    `;
  }
}

// Handle Logout
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // Ignore error
  }
  clearAuth();
  showToast('Logged out successfully.', 'info');
  setTimeout(() => {
    window.location.href = '/index.html';
  }, 500);
}

// ==========================================
// NOTIFICATIONS BELL & POPUP LOGIC
// ==========================================

async function loadUserNotifications() {
  const token = getAuthToken();
  const badge = document.getElementById('nav-notif-badge');
  const list = document.getElementById('notification-items-list');
  if (!token || !badge) return;

  try {
    const res = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.success && data.notifications) {
      if (data.unreadCount > 0) {
        badge.textContent = data.unreadCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }

      if (list) {
        if (data.notifications.length === 0) {
          list.innerHTML = `<div style="padding: 1rem; text-align: center; color: #64748b; font-size: 0.82rem;">No notifications yet.</div>`;
          return;
        }

        list.innerHTML = data.notifications
          .map((n) => {
            const timeStr = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
              <div class="notification-item ${n.isRead ? '' : 'unread'}">
                <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.2rem;">
                  <span>${n.title}</span>
                  <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 400;">${timeStr}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.35;">${n.message}</div>
              </div>
            `;
          })
          .join('');
      }
    }
  } catch (e) {
    // Silent fail
  }
}

function toggleNotificationDropdown() {
  const dropdown = document.getElementById('notification-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) {
      loadUserNotifications();
    }
  }
}

async function markAllNotificationsRead() {
  const token = getAuthToken();
  if (!token) return;

  try {
    await fetch('/api/notifications/mark-read', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    const badge = document.getElementById('nav-notif-badge');
    if (badge) badge.style.display = 'none';
    loadUserNotifications();
    showToast('All notifications marked as read.', 'info');
  } catch (e) {
    // Ignore error
  }
}

// Close notifications dropdown when clicking outside
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.nav-notifications-wrap');
  const dropdown = document.getElementById('notification-dropdown');
  if (wrap && dropdown && !wrap.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});

// Update auth UI and auto-load notifications if logged in
const origUpdateNavAuthUI = updateNavAuthUI;
updateNavAuthUI = async function () {
  await origUpdateNavAuthUI();
  if (getAuthToken()) {
    loadUserNotifications();
  }
};

// Export functions to window
window.getAuthToken = getAuthToken;
window.getStoredUser = getStoredUser;
window.saveAuth = saveAuth;
window.clearAuth = clearAuth;
window.showToast = showToast;
window.fetchCurrentUser = fetchCurrentUser;
window.updateNavAuthUI = updateNavAuthUI;
window.handleLogout = handleLogout;
window.toggleTheme = toggleTheme;
window.toggleNotificationDropdown = toggleNotificationDropdown;
window.markAllNotificationsRead = markAllNotificationsRead;
window.loadUserNotifications = loadUserNotifications;
