// ================================================
// PERTAMINA SALES SYSTEM - Admin Module
// ================================================

let allOrders    = [];
let allDrivers   = [];
let fuelPrices   = [];
let currentUser  = null;
let pendingConfirmOrderId = null;
let pendingWaOrder        = null;

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = Auth.checkAuth('Admin');
  if (!currentUser) return;

  UI.renderSidebarUser(currentUser);
  await loadAllOrders();
  await loadDrivers();
  await loadFuelPricesAdmin();
  await loadSettingsAdmin();
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
  const sections = ['dashboard', 'semua-order', 'harga-bbm'];
  sections.forEach(s => {
    document.getElementById(`section-${s}`).style.display = (s === name) ? 'block' : 'none';
  });

  document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
  if (clickedEl) clickedEl.classList.add('active');

  const titles = {
    'dashboard':   ['Dashboard Admin', 'Overview'],
    'semua-order': ['Semua Pemesanan', 'Manajemen Order'],
    'harga-bbm':   ['Update Harga BBM', 'Harga Terkini'],
  };
  document.getElementById('topbar-section-title').textContent = titles[name]?.[0] || '';
  document.getElementById('topbar-section-name').textContent  = titles[name]?.[1] || '';

  const section = document.getElementById(`section-${name}`);
  section.classList.remove('anim-fade-in-up');
  void section.offsetWidth;
  section.classList.add('anim-fade-in-up');
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
async function loadFuelPricesAdmin(btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  }
  try {
    const result = await API.post({ action: 'getFuelPrices' });
    if (result.success) {
      fuelPrices = result.data || [];
      renderFuelPricesList();
      if (btn) UI.showToast('Data harga BBM diperbarui', 'success');
    }
  } catch (err) {
    console.error('Gagal memuat harga BBM:', err);
    if (btn) UI.showToast('Gagal memuat harga BBM.', 'error');
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
  }
}

function renderFuelPricesList() {
  const container = document.getElementById('fuel-prices-list');
  if (!fuelPrices.length) {
    container.innerHTML = '<p class="text-muted text-center">Belum ada data harga.</p>';
    return;
  }

  container.innerHTML = fuelPrices.map(fp => `
    <div class="d-flex align-items-center gap-3 mb-3 p-3" style="background:var(--clr-bg);border-radius:var(--radius-md);border:1px solid var(--clr-border);">
      <div style="flex:1;">
        <div class="fw-600 mb-1">${fp.fuel_type}</div>
        <div class="text-muted" style="font-size:12px;">
          Terakhir diperbarui: ${UI.formatDateTime(fp.updated_at)}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <input type="number"
          id="price-${fp.fuel_type.replace(/\s/g,'_')}"
          value="${fp.price}"
          min="0"
          class="form-control-app"
          style="width:140px;"
          placeholder="Harga/liter"
        />
        <button class="btn-primary-app" onclick="updateFuelPrice('${fp.fuel_type}', this)">
          <i class="bi bi-check-lg"></i> Simpan
        </button>
      </div>
    </div>
  `).join('');
}

async function updateFuelPrice(fuelType, btn) {
  const inputId = 'price-' + fuelType.replace(/\s/g, '_');
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
      action:    'updateFuelPrice',
      fuel_type: fuelType,
      price:     price,
    });

    if (result.success) {
      UI.showToast(`Harga ${fuelType} berhasil diperbarui!`, 'success');
      await loadFuelPricesAdmin();
    } else {
      UI.showToast(result.message || 'Gagal memperbarui harga.', 'error');
    }
  } catch (err) {
    UI.showToast('Koneksi gagal.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-check-lg"></i> Simpan';
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

// ── Print Order Receipt ──────────────────────────
function printOrder(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  // Fill print template
  document.getElementById('print-order-id').textContent     = order.id;
  document.getElementById('print-order-date').textContent   = UI.formatDate(order.order_date);
  document.getElementById('print-delivery-date').textContent = UI.formatDate(order.delivery_date);
  document.getElementById('print-company').textContent      = order.company;
  document.getElementById('print-created-by').textContent   = order.created_by;
  document.getElementById('print-fuel-type').textContent    = order.fuel_type;
  document.getElementById('print-price-per-liter').textContent = UI.formatCurrency(order.price_per_liter) + '/L';
  document.getElementById('print-volume').textContent       = UI.formatNumber(order.volume) + ' L';
  document.getElementById('print-total').textContent        = UI.formatCurrency(order.total);
  document.getElementById('print-status').textContent       = order.status;
  document.getElementById('print-confirmed-by').textContent = order.confirmed_by || '-';
  document.getElementById('print-confirmed-at').textContent = UI.formatDateTime(order.confirmed_at) || '-';
  document.getElementById('print-created-by-sign').textContent  = order.created_by;
  document.getElementById('print-confirmed-by-sign').textContent = order.confirmed_by || '_____________';

  window.print();
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

  // Fill print template
  document.getElementById('delivery-order-id').textContent       = order.id;
  document.getElementById('delivery-order-id-2').textContent     = order.id;
  document.getElementById('delivery-order-date').textContent     = UI.formatDate(order.order_date);
  document.getElementById('delivery-date-val').textContent       = UI.formatDate(order.delivery_date);
  document.getElementById('delivery-company').textContent        = order.company;
  document.getElementById('delivery-fuel-type').textContent      = order.fuel_type;
  document.getElementById('delivery-volume').textContent         = UI.formatNumber(order.volume) + ' L';
  document.getElementById('delivery-total').textContent          = UI.formatCurrency(order.total);
  document.getElementById('delivery-driver-name').textContent    = order.driver_name  || '_____________';
  document.getElementById('delivery-driver-phone').textContent   = order.driver_phone || '_____________';
  document.getElementById('delivery-confirmed-by').textContent   = order.confirmed_by || '-';
  document.getElementById('delivery-confirmed-at').textContent   = UI.formatDateTime(order.confirmed_at) || '-';
  document.getElementById('delivery-driver-sign').textContent    = order.driver_name  || '_____________';

  // Hide normal receipt, show delivery slip
  document.getElementById('print-receipt').style.display  = 'none';
  document.getElementById('delivery-slip').style.display  = 'block';
  window.print();
  document.getElementById('print-receipt').style.display  = '';
  document.getElementById('delivery-slip').style.display  = 'none';
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
