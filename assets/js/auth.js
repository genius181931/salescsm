// ================================================
// PERTAMINA SALES SYSTEM - Auth Module
// ================================================

const Auth = {

  // ── Get current session ──────────────────────
  getSession() {
    try {
      const raw = localStorage.getItem(CONFIG.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // ── Save session ─────────────────────────────
  setSession(userData) {
    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(userData));
  },

  // ── Clear session and redirect ───────────────
  logout() {
    localStorage.removeItem(CONFIG.SESSION_KEY);
    window.location.href = 'index.html';
  },

  // ── Check auth & role; redirect if invalid ───
  // requiredRoles: string or array of strings, e.g. 'Owner' or ['Admin','Owner']
  checkAuth(requiredRoles = null) {
    const session = this.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }

    if (requiredRoles) {
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      if (!roles.includes(session.role)) {
        // Redirect to the appropriate page for the user's actual role
        const targetPage = CONFIG.ROLE_PAGES[session.role] || 'index.html';
        window.location.href = targetPage;
        return null;
      }
    }

    return session;
  },

  // ── Login via GAS ────────────────────────────
  async login(username, password) {
    const response = await API.post({ action: 'login', username, password });
    if (response.success) {
      this.setSession(response.user);
    }
    return response;
  },
};

// ================================================
// API Helper
// ================================================
const API = {

  async post(data) {
    const res = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      credentials: 'omit', // Mencegah Google redirect multiple accounts
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(data),
    });

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch(e) {
      console.error('GAS returned non-JSON:', text);
      throw new Error('Invalid JSON from server. See Console.');
    }
  },

  async get(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${CONFIG.GAS_URL}?${qs}`, {
      method: 'GET',
      credentials: 'omit',
    });

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch(e) {
      console.error('GAS returned non-JSON:', text);
      throw new Error('Invalid JSON from server. See Console.');
    }
  },
};

// ================================================
// UI Helpers
// ================================================
const UI = {

  // Toast notifications
  showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
    const toast = document.createElement('div');
    toast.className = `app-toast ${type}`;
    toast.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Loading overlay
  showLoading(message = 'Memuat...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'spinner-overlay';
      overlay.innerHTML = `
        <div class="spinner-box">
          <div class="spinner-border" role="status"></div>
          <p id="loading-message">${message}</p>
        </div>`;
      document.body.appendChild(overlay);
    } else {
      document.getElementById('loading-message').textContent = message;
      overlay.style.display = 'flex';
    }
  },

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  // Format currency IDR
  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  },

  // Format number
  formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num || 0);
  },

  // Format date for display
  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  },

  // Format datetime
  formatDateTime(dateStr) {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  },

  // Status badge HTML
  statusBadge(status) {
    const map = {
      'Menunggu':       'badge-menunggu',
      'Terkonfirmasi':  'badge-confirmed',
      'Terkirim':       'badge-delivered',
      'Dibatalkan':     'badge-cancelled',
    };
    const cls = map[status] || 'badge-menunggu';
    return `<span class="badge-status ${cls}">${status || 'Menunggu'}</span>`;
  },

  // Role badge HTML
  roleBadge(role) {
    const map = { Owner: 'badge-owner', Admin: 'badge-admin', Sales: 'badge-sales' };
    return `<span class="badge-role ${map[role] || ''}">${role}</span>`;
  },

  // Set user info in sidebar
  renderSidebarUser(session) {
    const nameEl   = document.getElementById('sidebar-user-name');
    const roleEl   = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    if (nameEl)   nameEl.textContent   = session.name || session.username;
    if (roleEl)   roleEl.textContent   = session.role;
    if (avatarEl) avatarEl.textContent = (session.name || session.username).charAt(0).toUpperCase();
  },

  // Current date for topbar
  renderTopbarDate() {
    const el = document.getElementById('topbar-date');
    if (el) {
      el.textContent = new Date().toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    }
  },

  // Confirm dialog
  confirm(message) {
    return window.confirm(message);
  },
};

// ================================================
// Mobile Sidebar Toggle
// ================================================
function initMobileSidebar() {
  const btn = document.getElementById('btn-mobile-menu');
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (btn && sidebar) {
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      if (sidebar) sidebar.classList.remove('open');
      overlay.style.display = 'none';
    });
  }
}

// ================================================
// Init on load
// ================================================
document.addEventListener('DOMContentLoaded', () => {
  initMobileSidebar();
  UI.renderTopbarDate();
});
