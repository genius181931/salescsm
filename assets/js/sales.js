// ================================================
// PERTAMINA SALES SYSTEM - Sales Module
// ================================================

let fuelPrices  = []; // [{fuel_type, price, updated_at}]
let allOrders   = [];
let currentUser = null;

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = Auth.checkAuth('Sales');
  if (!currentUser) return;

  UI.renderSidebarUser(currentUser);
  document.getElementById('welcome-name').textContent = currentUser.name || currentUser.username;

  // Set today as default order date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('order-date').value    = today;
  document.getElementById('delivery-date').value = today;

  await Promise.all([loadFuelPrices(), loadMyOrders(), loadBankSettings()]);
  setupFileUpload();
  setupOrderForm();
});

// ── Sidebar Section Navigation ───────────────────
function showSection(name, clickedEl) {
  const sections = ['dashboard', 'buat-order', 'riwayat'];
  sections.forEach(s => {
    document.getElementById(`section-${s}`).style.display = (s === name) ? 'block' : 'none';
  });

  document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
  if (clickedEl) clickedEl.classList.add('active');

  const titles = {
    'dashboard':   ['Dashboard Sales', 'Overview'],
    'buat-order':  ['Buat Pemesanan', 'Form Order'],
    'riwayat':     ['Riwayat Pemesanan', 'Semua Order'],
  };
  document.getElementById('topbar-section-title').textContent = titles[name]?.[0] || '';
  document.getElementById('topbar-section-name').textContent  = titles[name]?.[1] || '';

  // Re-animate
  const section = document.getElementById(`section-${name}`);
  section.classList.remove('anim-fade-in-up');
  void section.offsetWidth;
  section.classList.add('anim-fade-in-up');
}

// ── Load Fuel Prices from GAS ────────────────────
async function loadFuelPrices() {
  try {
    const result = await API.post({ action: 'getFuelPrices' });
    if (result.success) {
      fuelPrices = result.data;
      populateFuelSelect();
    }
  } catch (err) {
    console.error('Gagal memuat harga BBM:', err);
  }
}

function populateFuelSelect() {
  const select = document.getElementById('fuel-type');
  select.innerHTML = '<option value="">-- Pilih Jenis BBM --</option>';
  fuelPrices.forEach(fp => {
    const opt = document.createElement('option');
    opt.value = fp.fuel_type;
    opt.textContent = fp.fuel_type;
    opt.dataset.price = fp.price;
    select.appendChild(opt);
  });
}

// ── On Fuel Type Selection ───────────────────────
let selectedPricePerLiter = 0;

function onFuelTypeChange() {
  const select   = document.getElementById('fuel-type');
  const selected = select.options[select.selectedIndex];

  if (selected.value && selected.dataset.price) {
    selectedPricePerLiter = parseFloat(selected.dataset.price) || 0;
    document.getElementById('price-per-liter-display').textContent = UI.formatCurrency(selectedPricePerLiter) + ' / L';
  } else {
    selectedPricePerLiter = 0;
    document.getElementById('price-per-liter-display').textContent = 'Pilih BBM dahulu';
  }
  calculateTotal();
}

// ── Calculate Total ──────────────────────────────
let truckFee = 0; // Set by loadBankSettings

function calculateTotal() {
  const volume = parseFloat(document.getElementById('volume').value) || 0;
  const subtotal = volume * selectedPricePerLiter;
  const total = subtotal > 0 ? subtotal + truckFee : 0;
  document.getElementById('total-display').textContent = UI.formatCurrency(total);
}

// ── File Upload Setup ────────────────────────────
function setupFileUpload() {
  const area  = document.getElementById('upload-area');
  const input = document.getElementById('payment-proof');

  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      input.files = e.dataTransfer.files;
      onFileSelected(e.dataTransfer.files[0]);
    }
  });

  input.addEventListener('change', () => {
    if (input.files.length) onFileSelected(input.files[0]);
  });
}

function onFileSelected(file) {
  if (file.size > CONFIG.MAX_FILE_SIZE) {
    UI.showToast('Ukuran file terlalu besar. Maksimum 5 MB.', 'error');
    clearFile();
    return;
  }
  if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
    UI.showToast('Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.', 'error');
    clearFile();
    return;
  }
  document.getElementById('file-preview-name').textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
  document.getElementById('file-preview').style.display    = 'flex';
  document.getElementById('upload-area').style.borderColor = 'var(--clr-confirmed)';
}

function clearFile() {
  document.getElementById('payment-proof').value          = '';
  document.getElementById('file-preview').style.display  = 'none';
  document.getElementById('upload-area').style.borderColor = '';
}

// ── Convert File to Base64 ───────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Order Form Submission ────────────────────────
function setupOrderForm() {
  document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitOrder();
  });
}

async function submitOrder() {
  const orderDate    = document.getElementById('order-date').value;
  const deliveryDate = document.getElementById('delivery-date').value;
  const company      = document.getElementById('company-name').value.trim();
  const fuelType     = document.getElementById('fuel-type').value;
  const volume       = parseFloat(document.getElementById('volume').value) || 0;
  const fileInput    = document.getElementById('payment-proof');

  // Validation
  if (!orderDate || !deliveryDate || !company || !fuelType || volume <= 0) {
    UI.showToast('Lengkapi semua field yang wajib diisi.', 'error');
    return;
  }
  if (!fileInput.files.length) {
    UI.showToast('Upload bukti pembayaran terlebih dahulu.', 'error');
    return;
  }
  if (new Date(deliveryDate) < new Date(orderDate)) {
    UI.showToast('Tanggal kirim tidak boleh sebelum tanggal pesan.', 'error');
    return;
  }

  const subtotal = volume * selectedPricePerLiter;
  const total = subtotal > 0 ? subtotal + truckFee : 0;
  const file  = fileInput.files[0];

  UI.showLoading('Mengupload bukti dan menyimpan order...');

  try {
    const base64 = await fileToBase64(file);

    const payload = {
      action:          'createOrder',
      order_date:      orderDate,
      delivery_date:   deliveryDate,
      company:         company,
      fuel_type:       fuelType,
      price_per_liter: selectedPricePerLiter,
      volume:          volume,
      total:           total,
      file_data:       base64,
      file_name:       file.name,
      file_type:       file.type,
      username:        currentUser.username,
    };

    const result = await API.post(payload);
    UI.hideLoading();

    if (result.success) {
      UI.showToast(`Pemesanan ${result.id} berhasil dikirim!`, 'success');
      resetForm();
      await loadMyOrders();
      showSection('riwayat', null);
    } else {
      UI.showToast(result.message || 'Gagal menyimpan order.', 'error');
    }
  } catch (err) {
    UI.hideLoading();
    UI.showToast('Terjadi kesalahan. Coba lagi.', 'error');
    console.error(err);
  }
}

function resetForm() {
  document.getElementById('order-form').reset();
  selectedPricePerLiter = 0;
  document.getElementById('price-per-liter-display').textContent = 'Pilih BBM dahulu';
  document.getElementById('total-display').textContent = 'Rp 0';
  clearFile();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('order-date').value    = today;
  document.getElementById('delivery-date').value = today;
}

// ── Load Bank Settings ─────────────────────────────
async function loadBankSettings() {
  try {
    const result = await API.post({ action: 'getSettings' });
    if (result.success && result.data) {
      if (result.data.bank_account) {
        document.getElementById('display-bank-name').textContent    = result.data.bank_name || '';
        document.getElementById('display-bank-account').textContent = result.data.bank_account || '';
        document.getElementById('display-bank-owner').textContent   = result.data.bank_owner || '';
        document.getElementById('bank-info-container').style.display = 'block';
      }
      
      // Update truck fee
      truckFee = parseFloat(result.data.truck_fee) || 0;
      document.getElementById('truck-fee-display').textContent = truckFee > 0 ? UI.formatCurrency(truckFee) : 'Rp 0';
      calculateTotal(); // Recalculate if there's already volume
    }
  } catch (err) {
    console.error('Gagal memuat pengaturan rekening:', err);
  }
}

// ── Load Orders ────────────────────────────────────
async function loadMyOrders(btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  }
  try {
    const result = await API.post({
      action:   'getOrders',
      username: currentUser.username,
      role:     'Sales',
    });

    if (result.success) {
      allOrders = result.data || [];
      renderStats();
      renderRecentOrders();
      renderAllOrdersTable();
      if (btn) UI.showToast('Data riwayat diperbarui', 'success');
    }
  } catch (err) {
    console.error('Gagal memuat orders:', err);
    if (btn) UI.showToast('Gagal memuat riwayat.', 'error');
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
  }
}

// ── Render Stats ─────────────────────────────────
function renderStats() {
  const total     = allOrders.length;
  const pending   = allOrders.filter(o => o.status === 'Menunggu').length;
  const confirmed = allOrders.filter(o => o.status === 'Terkonfirmasi' || o.status === 'Terkirim').length;
  const revenue   = allOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

  document.getElementById('stat-total-orders').textContent = total;
  document.getElementById('stat-pending').textContent      = pending;
  document.getElementById('stat-confirmed').textContent    = confirmed;
  document.getElementById('stat-revenue').textContent      = UI.formatCurrency(revenue);
}

// ── Render Recent Orders (dashboard) ────────────
function renderRecentOrders() {
  const tbody   = document.getElementById('recent-orders-body');
  const recents = allOrders.slice(0, 5);

  if (!recents.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">
      <i class="bi bi-inbox"></i><p>Belum ada pemesanan</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = recents.map(o => `
    <tr>
      <td><span class="fw-600" style="color:var(--clr-primary);font-size:12px;">${o.id}</span></td>
      <td>${UI.formatDate(o.order_date)}</td>
      <td><span class="fw-500">${o.company}</span></td>
      <td>${o.fuel_type}</td>
      <td>${UI.formatNumber(o.volume)} L</td>
      <td class="currency">${UI.formatCurrency(o.total)}</td>
      <td>${UI.statusBadge(o.status)}</td>
    </tr>
  `).join('');
}

// ── Render Full Orders Table ─────────────────────
function renderAllOrdersTable(data = null) {
  const orders = data || allOrders;
  const tbody  = document.getElementById('all-orders-body');

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty">
      <i class="bi bi-inbox"></i><p>Belum ada pemesanan</p>
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
      <td class="currency">${UI.formatNumber(o.volume)} L</td>
      <td class="currency">${UI.formatCurrency(o.total)}</td>
      <td>
        ${o.payment_proof_url
          ? `<a href="${o.payment_proof_url}" target="_blank" class="btn-sm-action btn-sm-print"><i class="bi bi-eye"></i> Lihat</a>`
          : '<span class="text-muted">-</span>'}
      </td>
      <td>${UI.statusBadge(o.status)}</td>
    </tr>
  `).join('');
}

// ── Filter Orders Table ──────────────────────────
function filterOrdersTable() {
  const searchTerm = document.getElementById('search-orders').value.toLowerCase();
  const statusFilter = document.getElementById('filter-status').value;

  const filtered = allOrders.filter(o => {
    const matchSearch = !searchTerm || o.company.toLowerCase().includes(searchTerm) || o.id.toLowerCase().includes(searchTerm);
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  renderAllOrdersTable(filtered);
}
