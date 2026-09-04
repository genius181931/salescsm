// ================================================
// PERTAMINA SALES SYSTEM - Admin Module
// ================================================

let allOrders    = [];
let allDrivers   = [];
let allCustomers = [];
let fuelPrices   = [];
let currentUser  = null;
let pendingConfirmOrderId = null;
let pendingWaOrder        = null;
let editingCustomerId     = null;

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = Auth.checkAuth('Admin');
  if (!currentUser) return;

  UI.renderSidebarUser(currentUser);
  await loadAllOrders();
  await loadDrivers();
  await loadFuelPricesAdmin();
  await loadSettingsAdmin();
  await loadCustomers();
});

// ── Load & Save Settings ─────────────────────────
async function loadSettingsAdmin() {
  try {
    const result = await API.post({ action: 'getSettings' });
    if (result.success && result.data) {
      document.getElementById('setting-truck-fee-admin').value = result.data.truck_fee || '';
    }
  } catch (err) {
    console.error('Gagal memuat pengaturan:', err);
  }
}

async function saveTruckFeeAdmin() {
  const truck_fee = document.getElementById('setting-truck-fee-admin').value.trim();

  const btn = document.getElementById('btn-save-truck-fee-admin');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';

  try {
    const result = await API.post({ 
      action: 'updateSettings', 
      truck_fee
    });
    if (result.success) {
      UI.showToast('Harga sewa truck berhasil disimpan!', 'success');
    } else {
      UI.showToast(result.message || 'Gagal menyimpan.', 'error');
    }
  } catch (err) {
    UI.showToast('Koneksi gagal.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-check-lg"></i> Simpan Harga Sewa';
}

// ── Section Navigation ───────────────────────────
function showSection(name, clickedEl) {
  const sections = ['dashboard', 'semua-order', 'harga-bbm', 'customer'];
  sections.forEach(s => {
    document.getElementById(`section-${s}`).style.display = (s === name) ? 'block' : 'none';
  });

  document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
  if (clickedEl) clickedEl.classList.add('active');

  const titles = {
    'dashboard':   ['Dashboard Admin', 'Overview'],
    'semua-order': ['Semua Pemesanan', 'Manajemen Order'],
    'harga-bbm':   ['Update Harga BBM', 'Harga per Customer'],
    'customer':    ['Data Customer', 'Manajemen Customer'],
  };
  document.getElementById('topbar-section-title').textContent = titles[name]?.[0] || '';
  document.getElementById('topbar-section-name').textContent  = titles[name]?.[1] || '';

  const section = document.getElementById(`section-${name}`);
  section.classList.remove('anim-fade-in-up');
  void section.offsetWidth;
  section.classList.add('anim-fade-in-up');

  // Populate customer dropdown when entering price section
  if (name === 'harga-bbm') populatePriceCustomerDropdown();
}

// ── Load All Orders ──────────────────────────────
async function loadAllOrders(btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  }
  try {
    const result = await API.post({
      action: 'getOrders',
      role:   'Admin',
    });

    if (result.success) {
      allOrders = result.data || [];
      renderAdminStats();
      renderPendingOrders();
      renderAllOrdersTable();
      if (btn) UI.showToast('Data pesanan diperbarui', 'success');
    }
  } catch (err) {
    console.error('Gagal memuat orders:', err);
    if (btn) UI.showToast('Gagal memuat data pemesanan.', 'error');
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
  }
}

// ── Load Drivers ─────────────────────────────────
async function loadDrivers() {
  try {
    const result = await API.post({ action: 'getDrivers' });
    if (result.success) {
      allDrivers = result.data || [];
      populateDriverSelects();
    }
  } catch (err) {
    console.error('Gagal memuat supir:', err);
  }
}

function populateDriverSelects() {
  const selects = ['confirm-driver', 'wa-driver-select'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Pilih Supir --</option>';
    allDrivers.forEach(d => {
      const opt = document.createElement('option');
      opt.value        = d.phone;
      opt.textContent  = `${d.name} — ${d.phone}`;
      opt.dataset.name = d.name;
      sel.appendChild(opt);
    });
  });
}

// ── Load Fuel Prices (Admin) ─────────────────────
async function loadFuelPricesAdmin(customerId = 'DEFAULT') {
  const result = await API.post({ action: 'getFuelPrices', customer_id: customerId });
  if (result.success) {
    fuelPrices = result.data || [];
    renderFuelPricesList(customerId);
  }
}

function populatePriceCustomerDropdown() {
  const sel = document.getElementById('admin-price-customer-select');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="DEFAULT">⭐ Harga Default (Berlaku Umum)</option>' +
    allCustomers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.value = cur || 'DEFAULT';
  loadFuelPricesAdmin(sel.value);
}

function reloadPricesForSelectedCustomer() {
  const sel = document.getElementById('admin-price-customer-select');
  loadFuelPricesAdmin(sel ? sel.value : 'DEFAULT');
}

function renderFuelPricesList(customerId = 'DEFAULT') {
  const container = document.getElementById('fuel-prices-list');
  if (!fuelPrices.length) {
    container.innerHTML = '<p class="text-muted text-center">Belum ada data harga.</p>';
    return;
  }
  const isCustom = customerId !== 'DEFAULT';
  const custName = isCustom ? allCustomers.find(c => c.id === customerId)?.name : 'Default';

  container.innerHTML = fuelPrices.map(fp => `
    <div class="d-flex align-items-center gap-3 mb-3 p-3" style="background:var(--clr-bg);border-radius:var(--radius-md);border:1px solid var(--clr-border);">
      <div style="flex:1;">
        <div class="fw-600 mb-1">${fp.fuel_type}
          ${fp.is_custom ? '<span style="font-size:10px;background:#CC000015;color:#CC0000;border-radius:4px;padding:1px 6px;margin-left:4px;">Khusus</span>' : ''}
        </div>
        <div class="text-muted" style="font-size:12px;">
          ${isCustom ? `Customer: <strong>${custName}</strong> &bull; ` : ''}Diperbarui: ${UI.formatDateTime(fp.updated_at)}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <input type="number"
          id="price-${fp.fuel_type.replace(/[\s()]/g,'_')}"
          value="${fp.price}"
          min="0"
          class="form-control-app"
          style="width:140px;"
          placeholder="Harga/liter"
        />
        <button class="btn-primary-app" onclick="updateFuelPrice('${fp.fuel_type}', '${customerId}', this)">
          <i class="bi bi-check-lg"></i> Simpan
        </button>
      </div>
    </div>
  `).join('');
}

async function updateFuelPrice(fuelType, customerId, btn) {
  const inputId = 'price-' + fuelType.replace(/[\s()]/g, '_');
  const input   = document.getElementById(inputId);
  const price   = parseFloat(input.value);

  if (!price || price <= 0) {
    UI.showToast('Harga harus lebih dari 0.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

  try {
    const result = await API.post({
      action:      'updateFuelPrice',
      fuel_type:   fuelType,
      price:       price,
      customer_id: customerId || 'DEFAULT',
    });

    if (result.success) {
      UI.showToast(`Harga ${fuelType} berhasil diperbarui!`, 'success');
      await loadFuelPricesAdmin(customerId);
    } else {
      UI.showToast(result.message || 'Gagal memperbarui harga.', 'error');
    }
  } catch (err) {
    UI.showToast('Koneksi gagal.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-check-lg"></i> Simpan';
}

// ── Customer Management ──────────────────────────
async function loadCustomers(btn = null) {
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'; }
  try {
    const result = await API.post({ action: 'getCustomers' });
    if (result.success) {
      allCustomers = result.data || [];
      renderCustomersTable();
      populatePriceCustomerDropdown();
    }
  } catch (err) { console.error(err); }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh'; }
}

function renderCustomersTable() {
  const tbody = document.getElementById('customers-body');
  if (!tbody) return;
  if (!allCustomers.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty"><i class="bi bi-inbox"></i><p>Belum ada data customer.</p></td></tr>';
    return;
  }
  tbody.innerHTML = allCustomers.map(c => `
    <tr>
      <td><span class="fw-600">${c.name}</span></td>
      <td>${c.phone || '-'}</td>
      <td>${c.address || '-'}</td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn-sm-action btn-sm-edit" onclick="openCustomerModal('${c.id}')">
            <i class="bi bi-pencil"></i> Edit
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openCustomerModal(customerId = null) {
  editingCustomerId = customerId;
  document.getElementById('customer-id').value    = customerId || '';
  document.getElementById('customer-name').value  = '';
  document.getElementById('customer-phone').value = '';
  document.getElementById('customer-address').value = '';

  const titleEl = document.getElementById('customer-modal-title');
  // Admin: no delete button
  const delBtn = document.getElementById('btn-delete-customer');
  if (delBtn) delBtn.style.display = 'none';

  if (customerId) {
    const c = allCustomers.find(x => x.id === customerId);
    if (c) {
      document.getElementById('customer-name').value    = c.name;
      document.getElementById('customer-phone').value   = c.phone || '';
      document.getElementById('customer-address').value = c.address || '';
    }
    titleEl.innerHTML = '<i class="bi bi-pencil"></i> Edit Customer';
  } else {
    titleEl.innerHTML = '<i class="bi bi-building-add"></i> Tambah Customer';
  }

  new bootstrap.Modal(document.getElementById('customerModal')).show();
}

async function saveCustomer() {
  const id      = document.getElementById('customer-id').value;
  const name    = document.getElementById('customer-name').value.trim();
  const phone   = document.getElementById('customer-phone').value.trim();
  const address = document.getElementById('customer-address').value.trim();

  if (!name) { UI.showToast('Nama perusahaan wajib diisi.', 'error'); return; }

  try {
    const action = id ? 'updateCustomer' : 'addCustomer';
    const result = await API.post({ action, id, name, phone, address });
    if (result.success) {
      UI.showToast(result.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
      await loadCustomers();
    } else {
      UI.showToast(result.message || 'Gagal menyimpan.', 'error');
    }
  } catch (err) {
    UI.showToast('Koneksi gagal.', 'error');
  }
}

// ── Render Stats ─────────────────────────────────
function renderAdminStats() {
  const total     = allOrders.length;
  const pending   = allOrders.filter(o => o.status === 'Menunggu').length;
  const confirmed = allOrders.filter(o => o.status === 'Terkonfirmasi').length;
  const revenue   = allOrders
    .filter(o => o.status !== 'Dibatalkan')
    .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

  document.getElementById('stat-total').textContent     = total;
  document.getElementById('stat-pending').textContent   = pending;
  document.getElementById('stat-confirmed').textContent = confirmed;
  document.getElementById('stat-revenue').textContent   = UI.formatCurrency(revenue);
}

// ── Render Pending Orders (dashboard) ───────────
function renderPendingOrders() {
  const tbody   = document.getElementById('pending-orders-body');
  const pending = allOrders.filter(o => o.status === 'Menunggu');

  if (!pending.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty" style="padding:30px;">
      <i class="bi bi-check-circle text-success" style="font-size:36px;margin-bottom:8px;display:block;color:var(--clr-confirmed)!important;"></i>
      <p style="color:var(--clr-confirmed);">Tidak ada order yang menunggu konfirmasi</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = pending.map(o => `
    <tr>
      <td><span class="fw-600" style="color:var(--clr-primary);font-size:12px;">${o.id}</span></td>
      <td>${UI.formatDate(o.order_date)}</td>
      <td><span class="fw-500">${o.company}</span></td>
      <td>${o.fuel_type}</td>
      <td>${UI.formatNumber(o.volume)} L</td>
      <td class="currency">${UI.formatCurrency(o.total)}</td>
      <td>
        ${o.payment_proof_url
          ? `<a href="${o.payment_proof_url}" target="_blank" class="btn-sm-action btn-sm-print"><i class="bi bi-eye"></i> Lihat</a>`
          : '<span class="text-muted" style="font-size:12px;">Tidak ada</span>'}
      </td>
      <td>
        <button class="btn-sm-action btn-sm-confirm" onclick="openConfirmModal('${o.id}')">
          <i class="bi bi-check-lg"></i> Konfirmasi
        </button>
      </td>
    </tr>
  `).join('');
}

// ── Render All Orders Table ──────────────────────
function renderAllOrdersTable(data = null) {
  const orders = data || allOrders;
  const tbody  = document.getElementById('all-orders-body');

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-empty">
      <i class="bi bi-inbox"></i><p>Belum ada data pemesanan</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><span class="fw-600" style="color:var(--clr-primary);font-size:12px;">${o.id}</span></td>
      <td>${UI.formatDate(o.order_date)}</td>
      <td>${UI.formatDate(o.delivery_date)}</td>
      <td><span class="fw-500">${o.company}</span></td>
      <td>${o.fuel_type}</td>
      <td class="currency">${UI.formatNumber(o.volume)}</td>
      <td class="currency">${UI.formatCurrency(o.total)}</td>
      <td><span style="font-size:12px;color:var(--clr-text-muted);">${o.created_by}</span></td>
      <td>
        ${o.payment_proof_url
          ? `<a href="${o.payment_proof_url}" target="_blank" class="btn-sm-action btn-sm-print"><i class="bi bi-eye"></i></a>`
          : '<span class="text-muted" style="font-size:12px;">-</span>'}
      </td>
      <td>${UI.statusBadge(o.status)}</td>
      <td>
        <div class="d-flex gap-1 flex-wrap">
          ${o.status === 'Menunggu' ? `
            <button class="btn-sm-action btn-sm-confirm" onclick="openConfirmModal('${o.id}')">
              <i class="bi bi-check-lg"></i> Konfirmasi
            </button>` : ''}
          ${o.status === 'Terkonfirmasi' ? `
            <button class="btn-sm-action" style="background:rgba(59,130,246,0.1);color:#3B82F6;border:1px solid rgba(59,130,246,0.3);" onclick="printDelivery('${o.id}')">
              <i class="bi bi-file-earmark-text"></i> Surat Jalan
            </button>` : ''}
          <button class="btn-sm-action btn-sm-print" onclick="printOrder('${o.id}')">
            <i class="bi bi-printer"></i> Cetak
          </button>
          <button class="btn-sm-action btn-sm-wa" onclick="openWaModal('${o.id}')">
            <i class="bi bi-whatsapp"></i> WA
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── Filter All Orders Table ──────────────────────
function filterAllOrders() {
  const search    = document.getElementById('search-all').value.toLowerCase();
  const status    = document.getElementById('filter-all-status').value;
  const dateFrom  = document.getElementById('filter-date-from').value;
  const dateTo    = document.getElementById('filter-date-to').value;

  const filtered = allOrders.filter(o => {
    const matchSearch = !search
      || o.id.toLowerCase().includes(search)
      || o.company.toLowerCase().includes(search)
      || (o.created_by || '').toLowerCase().includes(search);
    const matchStatus = !status || o.status === status;
    const matchFrom   = !dateFrom || o.order_date >= dateFrom;
    const matchTo     = !dateTo   || o.order_date <= dateTo;
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  renderAllOrdersTable(filtered);
}

// ── Confirm Payment Modal ────────────────────────
function openConfirmModal(orderId) {
  pendingConfirmOrderId = orderId;
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  document.getElementById('confirm-order-details').innerHTML = `
    <div style="background:var(--clr-bg);border-radius:var(--radius-md);padding:14px 16px;border:1px solid var(--clr-border);">
      <div class="d-flex justify-content-between mb-2">
        <span class="text-muted" style="font-size:12px;">No. Order</span>
        <span class="fw-600" style="color:var(--clr-primary);font-size:12px;">${order.id}</span>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span class="text-muted" style="font-size:12px;">Perusahaan</span>
        <span class="fw-600">${order.company}</span>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span class="text-muted" style="font-size:12px;">Jenis BBM</span>
        <span>${order.fuel_type}</span>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span class="text-muted" style="font-size:12px;">Volume</span>
        <span>${UI.formatNumber(order.volume)} L</span>
      </div>
      <div class="d-flex justify-content-between">
        <span class="text-muted" style="font-size:12px;">Total Bayar</span>
        <span class="fw-700 currency" style="color:var(--clr-primary)">${UI.formatCurrency(order.total)}</span>
      </div>
    </div>
  `;

  const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
  modal.show();
}

async function doConfirmPayment() {
  if (!pendingConfirmOrderId) return;

  const driverSelect = document.getElementById('confirm-driver');
  const driverPhone  = driverSelect.value;
  const driverOption = driverSelect.options[driverSelect.selectedIndex];
  const driverName   = driverOption?.dataset?.name || '';

  if (!driverPhone) {
    UI.showToast('Pilih supir pengantar terlebih dahulu.', 'error');
    return;
  }

  const btn = document.getElementById('btn-do-confirm');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Memproses...';

  try {
    const result = await API.post({
      action:       'confirmPayment',
      order_id:     pendingConfirmOrderId,
      confirmed_by: currentUser.name || currentUser.username,
      driver_name:  driverName,
      driver_phone: driverPhone,
    });

    if (result.success) {
      bootstrap.Modal.getInstance(document.getElementById('confirmModal')).hide();
      UI.showToast('Pembayaran berhasil dikonfirmasi!', 'success');
      pendingConfirmOrderId = null;
      await loadAllOrders();

      // Auto open WA if driver selected
      if (driverPhone) {
        const order = allOrders.find(o => o.status === 'Terkonfirmasi');
        setTimeout(() => openWaWithOrder(result.orderId || pendingConfirmOrderId, driverPhone, driverName), 500);
      }
    } else {
      UI.showToast(result.message || 'Gagal mengkonfirmasi.', 'error');
    }
  } catch (err) {
    UI.showToast('Koneksi gagal.', 'error');
    console.error(err);
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-check-lg"></i> Konfirmasi';
}

// ── Print helpers ────────────────────────────────
function openPrintWindow(html) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('Popup diblokir browser. Izinkan popup untuk halaman ini.'); return; }
  const printCSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; color: #111; padding: 28px 36px; font-size: 13px; }
    .print-header { display:flex; align-items:flex-start; justify-content:space-between; padding-bottom:14px; border-bottom:3px solid #CC0000; margin-bottom:20px; }
    .print-company-name { font-size:22px; font-weight:800; color:#CC0000; }
    .print-sub { font-size:11px; color:#666; margin-top:2px; }
    .print-doc-title { font-size:17px; font-weight:800; text-align:right; }
    .print-doc-number { font-size:12px; color:#666; text-align:right; margin-top:3px; }
    .print-section { margin-bottom:18px; }
    .print-section-title { font-size:11px; font-weight:700; text-transform:uppercase; color:#888; letter-spacing:.6px; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:8px; }
    .print-table { width:100%; border-collapse:collapse; font-size:12px; }
    .print-table th { background:#f7f7f7; padding:7px 10px; text-align:left; font-weight:700; border:1px solid #ddd; }
    .print-table td { padding:7px 10px; border:1px solid #ddd; }
    .print-total { font-size:14px; font-weight:800; color:#CC0000; }
    .print-note { font-size:11px; color:#999; line-height:1.6; }
    .print-signature { display:flex; justify-content:space-between; margin-top:40px; }
    .print-signature-box { text-align:center; width:160px; }
    .print-signature-line { border-bottom:1px solid #333; margin-bottom:6px; height:50px; }
    .print-signature-name { font-size:12px; font-weight:700; }
    .print-signature-title { font-size:11px; color:#666; }
    .status-banner { background:#CC0000; color:white; text-align:center; padding:6px; font-size:11px; font-weight:700; letter-spacing:2px; margin-bottom:16px; }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px; }
    @media print { @page { margin: 15mm; } body { padding: 0; } }
  `;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cetak</title><style>${printCSS}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  // Fallback for browsers where onload may not fire after document.close
  setTimeout(() => { try { w.focus(); w.print(); } catch(e){} }, 800);
}

// ── Print Order Receipt ──────────────────────────
function printOrder(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  const html = `
    <div class="print-header">
      <div>
        <div class="print-company-name">PERTAMINA</div>
        <div class="print-sub">Sistem Manajemen Pemesanan BBM</div>
      </div>
      <div>
        <div class="print-doc-title">BUKTI PEMESANAN BBM</div>
        <div class="print-doc-number">${order.id}</div>
      </div>
    </div>

    <div class="print-section">
      <div class="print-section-title">Informasi Pemesanan</div>
      <table class="print-table">
        <tr><th style="width:35%">Tanggal Pesan</th><td>${UI.formatDate(order.order_date)}</td></tr>
        <tr><th>Tanggal Kirim</th><td>${UI.formatDate(order.delivery_date)}</td></tr>
        <tr><th>Perusahaan</th><td>${order.company}</td></tr>
        <tr><th>Dibuat Oleh</th><td>${order.created_by}</td></tr>
      </table>
    </div>

    <div class="print-section">
      <div class="print-section-title">Detail Bahan Bakar</div>
      <table class="print-table">
        <thead><tr><th>Jenis BBM</th><th>Harga/Liter</th><th>Volume (L)</th><th>Total</th></tr></thead>
        <tbody><tr>
          <td>${order.fuel_type}</td>
          <td>${UI.formatCurrency(order.price_per_liter)}/L</td>
          <td>${UI.formatNumber(order.volume)} L</td>
          <td class="print-total">${UI.formatCurrency(order.total)}</td>
        </tr></tbody>
      </table>
    </div>

    <div class="print-section">
      <div class="print-section-title">Status Pembayaran</div>
      <table class="print-table">
        <tr><th style="width:35%">Status</th><td>${order.status}</td></tr>
        <tr><th>Dikonfirmasi Oleh</th><td>${order.confirmed_by || '-'}</td></tr>
        <tr><th>Tanggal Konfirmasi</th><td>${UI.formatDateTime(order.confirmed_at) || '-'}</td></tr>
      </table>
    </div>

    <div class="print-section">
      <div class="print-note">
        * Dokumen ini merupakan bukti pemesanan bahan bakar yang sah dari sistem Pertamina Sales.<br>
        * Harap simpan dokumen ini sebagai referensi pengantaran.
      </div>
    </div>

    <div class="print-signature">
      <div class="print-signature-box">
        <div class="print-signature-line"></div>
        <div class="print-signature-name">${order.created_by}</div>
        <div class="print-signature-title">Sales</div>
      </div>
      <div class="print-signature-box">
        <div class="print-signature-line"></div>
        <div class="print-signature-name">${order.confirmed_by || '_____________'}</div>
        <div class="print-signature-title">Admin</div>
      </div>
      <div class="print-signature-box">
        <div class="print-signature-line"></div>
        <div class="print-signature-name"></div>
        <div class="print-signature-title">Supir</div>
      </div>
    </div>
  `;
  openPrintWindow(html);
}

// ── Print Delivery (Surat Jalan) ─────────────────
function printDelivery(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  // Fill the delivery preview modal
  document.getElementById('dm-order-id').textContent       = order.id;
  document.getElementById('dm-order-date').textContent     = UI.formatDate(order.order_date);
  document.getElementById('dm-delivery-date').textContent  = UI.formatDate(order.delivery_date);
  document.getElementById('dm-company').textContent        = order.company;
  document.getElementById('dm-fuel-type').textContent      = order.fuel_type;
  document.getElementById('dm-volume').textContent         = UI.formatNumber(order.volume) + ' L';
  document.getElementById('dm-total').textContent          = UI.formatCurrency(order.total);
  document.getElementById('dm-driver-name').textContent    = order.driver_name  || '-';
  document.getElementById('dm-driver-phone').textContent   = order.driver_phone || '-';
  document.getElementById('dm-confirmed-by').textContent   = order.confirmed_by || '-';
  document.getElementById('dm-confirmed-at').textContent   = UI.formatDateTime(order.confirmed_at) || '-';

  // Store order id for print action
  document.getElementById('btn-print-delivery').dataset.orderId = orderId;

  const modal = new bootstrap.Modal(document.getElementById('deliveryModal'));
  modal.show();
}

function doPrintDelivery() {
  const orderId = document.getElementById('btn-print-delivery').dataset.orderId;
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  const html = `
    <div class="print-header" style="border-bottom:3px solid #cc0000;padding-bottom:12px;margin-bottom:0;">
      <div>
        <div class="print-company-name">PERTAMINA</div>
        <div class="print-sub">Sistem Manajemen Pemesanan BBM</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:800;letter-spacing:1px;color:#1a1a2e;">SURAT JALAN</div>
        <div style="font-size:11px;color:#cc0000;font-weight:700;">BUKTI PENGIRIMAN BAHAN BAKAR</div>
        <div style="font-size:12px;font-weight:700;margin-top:4px;">${order.id}</div>
      </div>
    </div>

    <div class="status-banner">✅ PEMBAYARAN TELAH DIKONFIRMASI</div>

    <div class="grid2">
      <div class="print-section" style="margin:0;">
        <div class="print-section-title">Informasi Pemesanan</div>
        <table class="print-table">
          <tr><th style="width:45%">No. Order</th><td style="color:#cc0000;font-weight:700;">${order.id}</td></tr>
          <tr><th>Tgl. Pesan</th><td>${UI.formatDate(order.order_date)}</td></tr>
          <tr><th>Tgl. Kirim</th><td style="font-weight:700;">${UI.formatDate(order.delivery_date)}</td></tr>
          <tr><th>Dikonfirmasi</th><td>${order.confirmed_by || '-'}</td></tr>
          <tr><th>Tgl. Konfirmasi</th><td>${UI.formatDateTime(order.confirmed_at) || '-'}</td></tr>
        </table>
      </div>
      <div class="print-section" style="margin:0;">
        <div class="print-section-title">Data Supir</div>
        <table class="print-table">
          <tr><th style="width:45%">Nama Supir</th><td style="font-weight:700;">${order.driver_name || '_____________'}</td></tr>
          <tr><th>No. WhatsApp</th><td>${order.driver_phone || '_____________'}</td></tr>
          <tr><th>Perusahaan</th><td>${order.company}</td></tr>
        </table>
      </div>
    </div>

    <div class="print-section">
      <div class="print-section-title">Detail Bahan Bakar</div>
      <table class="print-table">
        <thead><tr><th>Jenis BBM</th><th>Volume (L)</th><th>Total Pembayaran</th></tr></thead>
        <tbody><tr>
          <td style="font-weight:700;">${order.fuel_type}</td>
          <td>${UI.formatNumber(order.volume)} L</td>
          <td class="print-total">${UI.formatCurrency(order.total)}</td>
        </tr></tbody>
      </table>
    </div>

    <div class="print-section">
      <div class="print-note">
        * Surat jalan ini merupakan dokumen resmi pengiriman bahan bakar yang telah dikonfirmasi pembayarannya.<br>
        * Supir wajib membawa surat jalan ini saat pengantaran dan menyerahkan salinannya kepada penerima.<br>
        * Dokumen ini sah tanpa tanda tangan jika telah terverifikasi secara digital oleh sistem.
      </div>
    </div>

    <div class="print-signature">
      <div class="print-signature-box">
        <div style="font-size:10px;color:#666;margin-bottom:4px;">Tanggal: _______________</div>
        <div class="print-signature-line"></div>
        <div class="print-signature-name">Admin Pengirim</div>
        <div class="print-signature-title">Admin</div>
      </div>
      <div class="print-signature-box">
        <div style="font-size:10px;color:#666;margin-bottom:4px;">Tanggal: _______________</div>
        <div class="print-signature-line"></div>
        <div class="print-signature-name">${order.driver_name || '_____________'}</div>
        <div class="print-signature-title">Supir Pengiriman</div>
      </div>
      <div class="print-signature-box">
        <div style="font-size:10px;color:#666;margin-bottom:4px;">Tanggal: _______________</div>
        <div class="print-signature-line"></div>
        <div class="print-signature-name">Penerima</div>
        <div class="print-signature-title">Pihak Penerima</div>
      </div>
    </div>
  `;
  openPrintWindow(html);
}

// ── WA Modal ─────────────────────────────────────
function openWaModal(orderId) {
  pendingWaOrder = allOrders.find(o => o.id === orderId);
  if (!pendingWaOrder) return;

  document.getElementById('wa-message-preview').value = '';
  document.getElementById('wa-driver-select').value   = '';

  const modal = new bootstrap.Modal(document.getElementById('waModal'));
  modal.show();
}

function openWaWithOrder(orderId, driverPhone, driverName) {
  pendingWaOrder = allOrders.find(o => o.id === orderId);
  if (!pendingWaOrder) return;

  const msg = buildWaMessage(pendingWaOrder, driverName);
  const url = `https://wa.me/${formatPhone(driverPhone)}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

function updateWaPreview() {
  if (!pendingWaOrder) return;
  const select     = document.getElementById('wa-driver-select');
  const driverName = select.options[select.selectedIndex]?.dataset?.name || '';
  const msg        = buildWaMessage(pendingWaOrder, driverName);
  document.getElementById('wa-message-preview').value = msg;
}

function buildWaMessage(order, driverName) {
  return `🚚 *SURAT TUGAS PENGANTARAN BBM*
━━━━━━━━━━━━━━━━━━━━━━━
*No. Order    :* ${order.id}
*Supir        :* ${driverName || '...'}
━━━━━━━━━━━━━━━━━━━━━━━
📋 *Detail Pengantaran:*
• Perusahaan   : ${order.company}
• Jenis BBM    : ${order.fuel_type}
• Volume       : ${UI.formatNumber(order.volume)} Liter
• Tanggal Kirim: ${UI.formatDate(order.delivery_date)}
━━━━━━━━━━━━━━━━━━━━━━━
✅ Pembayaran telah *TERKONFIRMASI*

Mohon bawa dokumen ini sebagai bukti pengantaran.
Terima kasih dan hati-hati di jalan 🙏

_Pertamina Sales System_`;
}

function openWhatsApp() {
  const select      = document.getElementById('wa-driver-select');
  const driverPhone = select.value;
  const driverName  = select.options[select.selectedIndex]?.dataset?.name || '';

  if (!driverPhone) {
    UI.showToast('Pilih supir terlebih dahulu.', 'error');
    return;
  }
  if (!pendingWaOrder) return;

  const msg = buildWaMessage(pendingWaOrder, driverName);
  const url = `https://wa.me/${formatPhone(driverPhone)}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  bootstrap.Modal.getInstance(document.getElementById('waModal')).hide();
}

function formatPhone(phone) {
  if (!phone) return '';
  // Normalize to international format (62xxx)
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0'))  p = '62' + p.slice(1);
  if (!p.startsWith('62')) p = '62' + p;
  return p;
}
