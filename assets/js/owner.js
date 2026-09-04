// ================================================
// PERTAMINA SALES SYSTEM - Owner Module
// ================================================

let allOrders   = [];
let allUsers    = [];
let allDrivers  = [];
let allCustomers = [];
let fuelPrices  = [];
let statsData   = null;
let currentUser = null;
let pendingConfirmOrderId = null;
let pendingWaOrder = null;
let editingCustomerId = null;
let revenueChart = null;
let fuelChart    = null;

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = Auth.checkAuth('Owner');
  if (!currentUser) return;

  UI.renderSidebarUser(currentUser);
  await loadStats();
  await loadAllOrdersForReport();
  await loadUsers();
  await loadDrivers();
  await loadSettings();
  await loadFuelPricesOwner();
  await loadCustomers();
});

// ── Section Navigation ──────────────────────────────
function showSection(name, clickedEl) {
  const sections = ['dashboard', 'laporan', 'pengguna', 'supir', 'harga', 'pengaturan', 'customer'];
  sections.forEach(s => {
    document.getElementById(`section-${s}`).style.display = (s === name) ? 'block' : 'none';
  });

  document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
  if (clickedEl) clickedEl.classList.add('active');

  const titles = {
    'dashboard':   ['Dashboard Owner',       'Analytics'],
    'laporan':     ['Laporan Lengkap',        'Semua Data'],
    'pengguna':    ['Kelola Pengguna',        'User Management'],
    'supir':       ['Kelola Supir',           'Driver Management'],
    'harga':       ['Update Harga',           'Harga per Customer'],
    'pengaturan':  ['Pengaturan Sistem',      'System Settings'],
    'customer':    ['Data Customer',          'Manajemen Customer'],
  };
  document.getElementById('topbar-section-title').textContent = titles[name]?.[0] || '';
  document.getElementById('topbar-section-name').textContent  = titles[name]?.[1] || '';

  const section = document.getElementById(`section-${name}`);
  section.classList.remove('anim-fade-in-up');
  void section.offsetWidth;
  section.classList.add('anim-fade-in-up');

  if (name === 'harga') populatePriceCustomerDropdown();
}

// ── Load Stats (for charts) ──────────────────────
async function loadStats(btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  }
  try {
    const result = await API.post({ action: 'getStats' });
    if (result.success) {
      statsData = result.data;
      renderStatCards();
      renderCharts();
      if (btn) UI.showToast('Statistik diperbarui', 'success');
    }
  } catch (err) {
    console.error('Gagal memuat statistik:', err);
    if (btn) UI.showToast('Gagal memuat statistik.', 'error');
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
  }
}

function renderStatCards() {
  if (!statsData) return;
  document.getElementById('stat-total-orders').textContent  = statsData.totalOrders || 0;
  document.getElementById('stat-total-revenue').textContent = UI.formatCurrency(statsData.totalRevenue || 0);
  document.getElementById('stat-pending').textContent       = statsData.pendingOrders || 0;
  document.getElementById('stat-confirmed').textContent     = statsData.confirmedOrders || 0;
}

// ── Render Charts ────────────────────────────────
function renderCharts() {
  if (!statsData) return;
  renderRevenueChart();
  renderFuelChart();
}

function renderRevenueChart() {
  const ctx = document.getElementById('chart-revenue').getContext('2d');
  const monthly = statsData.monthlyRevenue || {};

  // Build 6-month rolling window
  const months = [];
  const values = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key   = d.toISOString().substring(0, 7);
    const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    months.push(label);
    values.push((monthly[key] || 0) / 1000000); // in millions
  }

  if (revenueChart) revenueChart.destroy();

  revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Pendapatan (Juta Rp)',
        data: values,
        backgroundColor: 'rgba(204, 0, 0, 0.15)',
        borderColor: '#CC0000',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Rp ${(ctx.raw * 1000000).toLocaleString('id-ID')}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 } } },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            font: { family: 'Inter', size: 11 },
            callback: (v) => `${v}M`,
          },
        },
      },
    },
  });
}

function renderFuelChart() {
  const ctx  = document.getElementById('chart-fuel').getContext('2d');
  const dist = statsData.fuelDistribution || {};
  const labels = Object.keys(dist);
  const values = Object.values(dist);

  const COLORS = ['#CC0000', '#FF6B35', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

  if (fuelChart) fuelChart.destroy();

  if (!labels.length) {
    ctx.fillStyle = '#CCC';
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada data', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  fuelChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: 'white',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Inter', size: 11 }, padding: 12, boxWidth: 12 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw} order`,
          },
        },
      },
    },
  });
}

// ── Load & Save Settings ─────────────────────────
async function loadSettings() {
  try {
    const result = await API.post({ action: 'getSettings' });
    if (result.success && result.data) {
      document.getElementById('setting-bank-name').value    = result.data.bank_name || '';
      document.getElementById('setting-bank-owner').value   = result.data.bank_owner || '';
      document.getElementById('setting-bank-account').value = result.data.bank_account || '';
      document.getElementById('setting-truck-fee').value    = result.data.truck_fee || '';
    }
  } catch (err) {
    console.error('Gagal memuat pengaturan:', err);
  }
}

async function saveSettings() {
  const bank_name    = document.getElementById('setting-bank-name').value.trim();
  const bank_owner   = document.getElementById('setting-bank-owner').value.trim();
  const bank_account = document.getElementById('setting-bank-account').value.trim();
  const truck_fee    = document.getElementById('setting-truck-fee').value.trim();

  const btn = document.getElementById('btn-save-settings');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';

  try {
    const result = await API.post({ 
      action: 'updateSettings', 
      bank_name, 
      bank_owner, 
      bank_account,
      truck_fee
    });
    if (result.success) {
      UI.showToast('Pengaturan sistem berhasil disimpan!', 'success');
    } else {
      UI.showToast(result.message || 'Gagal menyimpan pengaturan.', 'error');
    }
  } catch (err) {
    UI.showToast('Koneksi gagal.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-check-lg"></i> Simpan Pengaturan';
}

async function saveTruckFeeOwner() {
  const truck_fee = document.getElementById('setting-truck-fee').value.trim();
  const btn = document.getElementById('btn-save-truck-owner');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
  try {
    const result = await API.post({ action: 'updateSettings', truck_fee });
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

// ── Load Fuel Prices (Owner) ─────────────────────
async function loadFuelPricesOwner(customerId = 'DEFAULT') {
  const result = await API.post({ action: 'getFuelPrices', customer_id: customerId });
  if (result.success) {
    fuelPrices = result.data || [];
    renderFuelPricesListOwner(customerId);
  }
}

function populatePriceCustomerDropdown() {
  const sel = document.getElementById('owner-price-customer-select');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="DEFAULT">⭐ Harga Default (Berlaku Umum)</option>' +
    allCustomers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.value = cur || 'DEFAULT';
  loadFuelPricesOwner(sel.value);
}

function reloadPricesForSelectedCustomer() {
  const sel = document.getElementById('owner-price-customer-select');
  loadFuelPricesOwner(sel ? sel.value : 'DEFAULT');
}

function renderFuelPricesListOwner(customerId = 'DEFAULT') {
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
        <button class="btn-primary-app" onclick="updateFuelPriceOwner('${fp.fuel_type}', '${customerId}', this)">
          <i class="bi bi-check-lg"></i> Simpan
        </button>
      </div>
    </div>
  `).join('');
}

async function updateFuelPriceOwner(fuelType, customerId, btn) {
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
      await loadFuelPricesOwner(customerId);
    } else {
      UI.showToast(result.message || 'Gagal memperbarui harga.', 'error');
    }
  } catch (err) {
    UI.showToast('Koneksi gagal.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-check-lg"></i> Simpan';
}

// ── Customer Management (Owner - with Delete) ──────
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
  document.getElementById('customer-id').value      = customerId || '';
  document.getElementById('customer-name').value    = '';
  document.getElementById('customer-phone').value   = '';
  document.getElementById('customer-address').value = '';

  const titleEl = document.getElementById('customer-modal-title');
  const delBtn  = document.getElementById('btn-delete-customer');

  if (customerId) {
    const c = allCustomers.find(x => x.id === customerId);
    if (c) {
      document.getElementById('customer-name').value    = c.name;
      document.getElementById('customer-phone').value   = c.phone || '';
      document.getElementById('customer-address').value = c.address || '';
    }
    titleEl.innerHTML = '<i class="bi bi-pencil"></i> Edit Customer';
    if (delBtn) delBtn.style.display = 'inline-flex'; // Owner can delete
  } else {
    titleEl.innerHTML = '<i class="bi bi-building-add"></i> Tambah Customer';
    if (delBtn) delBtn.style.display = 'none';
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

async function deleteCustomer() {
  const id = document.getElementById('customer-id').value;
  if (!id) return;
  if (!confirm('Yakin ingin menghapus customer ini? Semua harga khusus customer ini juga akan terhapus.')) return;

  try {
    const result = await API.post({ action: 'deleteCustomer', id });
    if (result.success) {
      UI.showToast(result.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
      await loadCustomers();
    } else {
      UI.showToast(result.message || 'Gagal menghapus.', 'error');
    }
  } catch (err) {
    UI.showToast('Koneksi gagal.', 'error');
  }
}

// ── Load All Orders (for report) ─────────────────
async function loadAllOrdersForReport() {
  try {
    const result = await API.post({ action: 'getOrders', role: 'Owner' });
    if (result.success) {
      allOrders = result.data || [];
      renderReportTable();
    }
  } catch (err) {
    console.error('Gagal memuat laporan:', err);
  }
}

function renderReportTable(data = null) {
  const orders = data || allOrders;
  const tbody  = document.getElementById('report-orders-body');
  const count  = document.getElementById('report-count');
  const total  = document.getElementById('report-total-value');

  if (count) count.textContent = orders.length;
  if (total) {
    const sum = orders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    total.textContent = UI.formatCurrency(sum);
  }

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-empty">
      <i class="bi bi-inbox"></i><p>Tidak ada data</p>
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
      <td class="currency">${UI.formatCurrency(o.price_per_liter)}</td>
      <td class="currency">${UI.formatNumber(o.volume)} L</td>
      <td class="currency fw-600">${UI.formatCurrency(o.total)}</td>
      <td><span style="font-size:12px;">${o.created_by}</span></td>
      <td>${UI.statusBadge(o.status)}</td>
      <td><span style="font-size:12px;color:var(--clr-text-muted);">${o.confirmed_by || '-'}</span></td>
      <td>
        ${o.status === 'Terkonfirmasi' ? `
          <button class="btn-sm-action" style="background:rgba(59,130,246,0.1);color:#3B82F6;border:1px solid rgba(59,130,246,0.3);" onclick="printDelivery('${o.id}')">
            <i class="bi bi-file-earmark-text"></i> Surat Jalan
          </button>` : 
          (o.status === 'Menunggu' ? `
          <button class="btn-sm-action btn-sm-success" onclick="openConfirmModal('${o.id}')">
            <i class="bi bi-check-circle"></i> Konfirmasi
          </button>` : '<span class="text-muted" style="font-size:12px;">-</span>')}
      </td>
    </tr>
  `).join('');
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
      await loadAllOrdersForReport();

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

// ── Delivery Preview (Surat Jalan) ─────────────────
function printDelivery(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  document.getElementById('dm-order-id').textContent      = order.id;
  document.getElementById('dm-order-date').textContent    = UI.formatDate(order.order_date);
  document.getElementById('dm-delivery-date').textContent = UI.formatDate(order.delivery_date);
  document.getElementById('dm-company').textContent       = order.company;
  document.getElementById('dm-fuel-type').textContent     = order.fuel_type;
  document.getElementById('dm-volume').textContent        = UI.formatNumber(order.volume) + ' L';
  document.getElementById('dm-total').textContent         = UI.formatCurrency(order.total);
  document.getElementById('dm-driver-name').textContent   = order.driver_name  || '-';
  document.getElementById('dm-driver-phone').textContent  = order.driver_phone || '-';
  document.getElementById('dm-confirmed-by').textContent  = order.confirmed_by || '-';
  document.getElementById('dm-confirmed-at').textContent  = UI.formatDateTime(order.confirmed_at) || '-';

  document.getElementById('btn-print-delivery').dataset.orderId = orderId;
  const modal = new bootstrap.Modal(document.getElementById('deliveryModal'));
  modal.show();
}

function doPrintDelivery() {
  const orderId = document.getElementById('btn-print-delivery').dataset.orderId;
  const order   = allOrders.find(o => o.id === orderId);
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

// ── Print Window helper ───────────────────────────
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
  setTimeout(() => { try { w.focus(); w.print(); } catch(e){} }, 800);
}

function filterReport() {
  const search   = document.getElementById('report-search').value.toLowerCase();
  const status   = document.getElementById('report-status').value;
  const dateFrom = document.getElementById('report-date-from').value;
  const dateTo   = document.getElementById('report-date-to').value;

  const filtered = allOrders.filter(o => {
    const matchSearch = !search
      || o.id.toLowerCase().includes(search)
      || o.company.toLowerCase().includes(search)
      || (o.created_by || '').toLowerCase().includes(search);
    const matchStatus = !status   || o.status === status;
    const matchFrom   = !dateFrom || o.order_date >= dateFrom;
    const matchTo     = !dateTo   || o.order_date <= dateTo;
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  renderReportTable(filtered);
}

// ── Export CSV ───────────────────────────────────
function exportCSV() {
  const headers = [
    'No. Order','Tgl Pesan','Tgl Kirim','Perusahaan','Jenis BBM',
    'Harga/Liter','Volume (L)','Total','Sales','Status','Dikonfirmasi Oleh',
  ];

  const rows = allOrders.map(o => [
    o.id, o.order_date, o.delivery_date, `"${o.company}"`,
    o.fuel_type, o.price_per_liter, o.volume, o.total,
    o.created_by, o.status, o.confirmed_by || '',
  ]);

  const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob   = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link   = document.createElement('a');
  link.href    = URL.createObjectURL(blob);
  link.download = `Laporan_Pertamina_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  UI.showToast('Laporan CSV berhasil diunduh!', 'success');
}

// ── Load Users ───────────────────────────────────
async function loadUsers(btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  }
  try {
    const result = await API.post({ action: 'getUsers' });
    if (result.success) {
      allUsers = result.data || [];
      renderUsersTable();
      if (btn) UI.showToast('Data pengguna diperbarui', 'success');
    }
  } catch (err) {
    console.error('Gagal memuat users:', err);
    if (btn) UI.showToast('Gagal memuat pengguna.', 'error');
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('users-body');
  if (!allUsers.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">
      <i class="bi bi-people"></i><p>Belum ada pengguna</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = allUsers.map(u => `
    <tr>
      <td><span class="fw-600">${u.username}</span></td>
      <td>${u.name}</td>
      <td>${UI.roleBadge(u.role)}</td>
      <td>${u.phone || '-'}</td>
      <td>
        <span class="badge-status ${u.status === 'active' ? 'badge-confirmed' : 'badge-cancelled'}">
          ${u.status === 'active' ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td>
        <div class="d-flex gap-1">
          ${u.role !== 'Owner' ? `
            <button class="btn-sm-action btn-sm-edit" onclick="toggleUserStatus('${u.username}', '${u.status}')">
              <i class="bi bi-toggle-${u.status === 'active' ? 'on' : 'off'}"></i>
              ${u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
            <button class="btn-sm-action btn-sm-danger" onclick="deleteUser('${u.username}', '${u.name}')">
              <i class="bi bi-trash"></i>
            </button>` : '<span class="text-muted" style="font-size:12px;">Owner</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

async function createUser() {
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value.trim();
  const name     = document.getElementById('new-name').value.trim();
  const role     = document.getElementById('new-role').value;
  const phone    = document.getElementById('new-phone').value.trim();

  if (!username || !password || !name || !role) {
    UI.showToast('Lengkapi semua field yang wajib diisi.', 'error');
    return;
  }

  UI.showLoading('Menyimpan pengguna...');
  try {
    const result = await API.post({ action: 'createUser', username, password, role, name, phone });
    UI.hideLoading();
    if (result.success) {
      UI.showToast('Pengguna berhasil ditambahkan!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
      document.getElementById('addUserModal').querySelectorAll('input, select').forEach(el => el.value = el.type === 'select-one' ? 'Sales' : '');
      await loadUsers();
    } else {
      UI.showToast(result.message || 'Gagal menambah pengguna.', 'error');
    }
  } catch (err) {
    UI.hideLoading();
    UI.showToast('Koneksi gagal.', 'error');
  }
}

async function toggleUserStatus(username, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  const label     = newStatus === 'active' ? 'mengaktifkan' : 'menonaktifkan';
  if (!UI.confirm(`Apakah Anda yakin ingin ${label} akun ${username}?`)) return;

  UI.showLoading('Memperbarui status...');
  try {
    const result = await API.post({ action: 'updateUser', username, status: newStatus });
    UI.hideLoading();
    if (result.success) {
      UI.showToast(`Akun ${username} berhasil ${label}!`, 'success');
      await loadUsers();
    } else {
      UI.showToast(result.message || 'Gagal memperbarui.', 'error');
    }
  } catch (err) {
    UI.hideLoading();
    UI.showToast('Koneksi gagal.', 'error');
  }
}

async function deleteUser(username, name) {
  if (!UI.confirm(`Hapus akun "${name}" (${username})? Tindakan ini tidak dapat dibatalkan.`)) return;

  UI.showLoading('Menghapus pengguna...');
  try {
    const result = await API.post({ action: 'deleteUser', username });
    UI.hideLoading();
    if (result.success) {
      UI.showToast('Pengguna berhasil dihapus!', 'success');
      await loadUsers();
    } else {
      UI.showToast(result.message || 'Gagal menghapus.', 'error');
    }
  } catch (err) {
    UI.hideLoading();
    UI.showToast('Koneksi gagal.', 'error');
  }
}

// ── Load Drivers ─────────────────────────────────
async function loadDrivers(btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  }
  try {
    const result = await API.post({ action: 'getDrivers' });
    if (result.success) {
      allDrivers = result.data || [];
      populateDriverSelects();
      renderDriversTable();
      if (btn) UI.showToast('Data supir diperbarui', 'success');
    }
  } catch (err) {
    console.error('Gagal memuat supir:', err);
    if (btn) UI.showToast('Gagal memuat supir.', 'error');
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
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

function renderDriversTable() {
  const tbody = document.getElementById('drivers-body');
  if (!allDrivers.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">
      <i class="bi bi-truck"></i><p>Belum ada supir terdaftar</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = allDrivers.map(d => `
    <tr>
      <td><span class="fw-600">${d.name}</span></td>
      <td>
        <a href="https://wa.me/${formatPhone(d.phone)}" target="_blank" class="d-flex align-items-center gap-1" style="color:#128C7E;font-weight:500;">
          <i class="bi bi-whatsapp"></i> ${d.phone}
        </a>
      </td>
      <td>${d.vehicle || '-'}</td>
      <td>
        <span class="badge-status ${d.status === 'active' ? 'badge-confirmed' : 'badge-cancelled'}">
          ${d.status === 'active' ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td>
        <button class="btn-sm-action btn-sm-danger" onclick="deleteDriver('${d.id}', '${d.name}')">
          <i class="bi bi-trash"></i> Hapus
        </button>
      </td>
    </tr>
  `).join('');
}

async function createDriver() {
  const name    = document.getElementById('drv-name').value.trim();
  const phone   = document.getElementById('drv-phone').value.trim();
  const vehicle = document.getElementById('drv-vehicle').value.trim();

  if (!name || !phone) {
    UI.showToast('Nama dan nomor WA wajib diisi.', 'error');
    return;
  }

  UI.showLoading('Menyimpan data supir...');
  try {
    const result = await API.post({ action: 'createDriver', name, phone, vehicle });
    UI.hideLoading();
    if (result.success) {
      UI.showToast('Supir berhasil ditambahkan!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('addDriverModal')).hide();
      document.getElementById('addDriverModal').querySelectorAll('input').forEach(el => el.value = '');
      await loadDrivers();
    } else {
      UI.showToast(result.message || 'Gagal menambah supir.', 'error');
    }
  } catch (err) {
    UI.hideLoading();
    UI.showToast('Koneksi gagal.', 'error');
  }
}

async function deleteDriver(id, name) {
  if (!UI.confirm(`Hapus supir "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return;

  UI.showLoading('Menghapus supir...');
  try {
    const result = await API.post({ action: 'deleteDriver', id });
    UI.hideLoading();
    if (result.success) {
      UI.showToast('Supir berhasil dihapus!', 'success');
      await loadDrivers();
    } else {
      UI.showToast(result.message || 'Gagal menghapus.', 'error');
    }
  } catch (err) {
    UI.hideLoading();
    UI.showToast('Koneksi gagal.', 'error');
  }
}

// ── Utility ──────────────────────────────────────
function formatPhone(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0'))  p = '62' + p.slice(1);
  if (!p.startsWith('62') && p.length > 0) p = '62' + p;
  return p;
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

