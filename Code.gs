// =====================================================
// PERTAMINA SALES SYSTEM - Google Apps Script (Code.gs)
// Versi: 1.0.0
//
// CARA DEPLOY:
// 1. Buka Google Sheets baru → Extensions → Apps Script
// 2. Paste seluruh kode ini ke editor
// 3. Jalankan fungsi setupSheets() SEKALI SAJA untuk init data
// 4. Deploy → New deployment → Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy URL deployment → paste ke assets/js/config.js
// =====================================================

const SS = SpreadsheetApp.getActiveSpreadsheet();

// ── CORS Headers Helper ──────────────────────────
function makeResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Main Handlers ────────────────────────────────
function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    let data   = {};
    let action = '';

    if (method === 'GET') {
      action = e.parameter.action || '';
      data   = e.parameter;
    } else {
      const body = JSON.parse(e.postData.contents);
      action = body.action || '';
      data   = body;
    }

    Logger.log('Action: ' + action);

    let result;
    switch (action) {
      // Auth
      case 'login':           result = login(data);           break;

      // Fuel
      case 'getFuelPrices':   result = getFuelPrices();        break;
      case 'updateFuelPrice': result = updateFuelPrice(data);  break;

      // Orders
      case 'createOrder':     result = createOrder(data);      break;
      case 'getOrders':       result = getOrders(data);        break;
      case 'confirmPayment':  result = confirmPayment(data);   break;

      // Stats
      case 'getStats':        result = getStats();             break;

      // Settings
      case 'getSettings':     result = getSettings();          break;
      case 'updateSettings':  result = updateSettings(data);   break;

      // Users
      case 'getUsers':        result = getUsers();             break;
      case 'createUser':      result = createUser(data);       break;
      case 'updateUser':      result = updateUser(data);       break;
      case 'deleteUser':      result = deleteUser(data);       break;

      // Drivers
      case 'getDrivers':      result = getDrivers();           break;
      case 'createDriver':    result = createDriver(data);     break;
      case 'deleteDriver':    result = deleteDriver(data);     break;

      // Setup
      case 'setup':           result = setupSheets();          break;

      default:
        result = { success: false, message: 'Action tidak dikenali: ' + action };
    }

    return makeResponse(result);

  } catch (err) {
    Logger.log('Error: ' + err.message + '\n' + err.stack);
    return makeResponse({ success: false, message: 'Server error: ' + err.message });
  }
}

// =====================================================
// AUTH
// =====================================================

function login(data) {
  const { username, password } = data;
  if (!username || !password) {
    return { success: false, message: 'Username dan password diperlukan' };
  }

  const sheet = SS.getSheetByName('Users');
  if (!sheet) return { success: false, message: 'Sheet Users tidak ditemukan. Jalankan setup terlebih dahulu.' };

  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[0]).trim() === String(username).trim() &&
        String(row[1]).trim() === String(password).trim()) {

      // Check active status
      if (String(row[4]).trim() !== 'active') {
        return { success: false, message: 'Akun Anda telah dinonaktifkan. Hubungi Owner.' };
      }

      return {
        success: true,
        user: {
          username: row[0],
          role:     row[2],
          name:     row[3],
          phone:    row[5] || '',
        },
      };
    }
  }

  return { success: false, message: 'Username atau password salah' };
}

// =====================================================
// FUEL PRICES
// =====================================================

function getFuelPrices() {
  const sheet = SS.getSheetByName('FuelPrices');
  if (!sheet) return { success: true, data: [] };

  const rows   = sheet.getDataRange().getValues();
  const prices = [];

  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    prices.push({
      fuel_type:  rows[i][0],
      price:      parseFloat(rows[i][1]) || 0,
      updated_at: rows[i][2] ? rows[i][2].toString() : '',
    });
  }

  return { success: true, data: prices };
}

function updateFuelPrice(data) {
  const { fuel_type, price } = data;
  if (!fuel_type || !price) {
    return { success: false, message: 'Jenis BBM dan harga diperlukan' };
  }

  const sheet = SS.getSheetByName('FuelPrices');
  const rows  = sheet.getDataRange().getValues();
  const now   = new Date().toISOString();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(fuel_type).trim()) {
      sheet.getRange(i + 1, 2).setValue(parseFloat(price));
      sheet.getRange(i + 1, 3).setValue(now);
      return { success: true, message: 'Harga ' + fuel_type + ' berhasil diperbarui' };
    }
  }

  // New fuel type
  sheet.appendRow([fuel_type, parseFloat(price), now]);
  return { success: true, message: 'Jenis BBM baru berhasil ditambahkan' };
}

// =====================================================
// ORDERS
// =====================================================

function createOrder(data) {
  const {
    order_date, delivery_date, company, fuel_type,
    price_per_liter, volume, total,
    file_data, file_name, file_type,
    username,
  } = data;

  // Validate required fields
  if (!order_date || !company || !fuel_type || !volume) {
    return { success: false, message: 'Data pemesanan tidak lengkap' };
  }

  // Upload bukti bayar ke Drive
  let paymentProofUrl  = '';
  let paymentProofName = '';

  if (file_data && file_name) {
    try {
      const uploaded     = uploadFileToDrive(file_data, file_name, file_type || 'image/jpeg');
      paymentProofUrl    = uploaded.url;
      paymentProofName   = uploaded.name;
    } catch (uploadErr) {
      Logger.log('Upload error: ' + uploadErr.message);
      return { success: false, message: 'Gagal mengupload bukti pembayaran: ' + uploadErr.message };
    }
  }

  const sheet = SS.getSheetByName('Orders');
  const orderId = 'ORD-' + Utilities.getUuid().substring(0, 8).toUpperCase();
  const now     = new Date().toISOString();

  sheet.appendRow([
    orderId,            // A: id
    order_date,         // B: order_date
    delivery_date,      // C: delivery_date
    company,            // D: company
    fuel_type,          // E: fuel_type
    parseFloat(price_per_liter) || 0,  // F: price_per_liter
    parseFloat(volume) || 0,           // G: volume
    parseFloat(total) || 0,            // H: total
    paymentProofUrl,    // I: payment_proof_url
    paymentProofName,   // J: payment_proof_name
    'Menunggu',         // K: status
    username || '',     // L: created_by
    now,                // M: created_at
    '',                 // N: confirmed_by
    '',                 // O: confirmed_at
    '',                 // P: driver_name
    '',                 // Q: driver_phone
  ]);

  return { success: true, message: 'Pemesanan berhasil dibuat', id: orderId };
}

function getOrders(data) {
  const { username, role } = data;
  const sheet = SS.getSheetByName('Orders');
  if (!sheet) return { success: true, data: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, data: [] };

  const rows   = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
  const orders = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;

    // Sales sees only own orders
    if (role === 'Sales' && String(row[11]) !== String(username)) continue;

    orders.push({
      id:                   row[0],
      order_date:           row[1] ? (row[1] instanceof Date ? row[1].toISOString().split('T')[0] : row[1].toString()) : '',
      delivery_date:        row[2] ? (row[2] instanceof Date ? row[2].toISOString().split('T')[0] : row[2].toString()) : '',
      company:              row[3],
      fuel_type:            row[4],
      price_per_liter:      row[5],
      volume:               row[6],
      total:                row[7],
      payment_proof_url:    row[8],
      payment_proof_name:   row[9],
      status:               row[10] || 'Menunggu',
      created_by:           row[11],
      created_at:           row[12] ? row[12].toString() : '',
      confirmed_by:         row[13],
      confirmed_at:         row[14] ? row[14].toString() : '',
      driver_name:          row[15],
      driver_phone:         row[16],
    });
  }

  // Newest first
  orders.reverse();
  return { success: true, data: orders };
}

function confirmPayment(data) {
  const { order_id, confirmed_by, driver_name, driver_phone } = data;
  if (!order_id) return { success: false, message: 'ID order diperlukan' };

  const sheet   = SS.getSheetByName('Orders');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, message: 'Order tidak ditemukan' };

  const rows = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const now  = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(order_id).trim()) {
      const rowNum = i + 2;
      sheet.getRange(rowNum, 11).setValue('Terkonfirmasi');
      sheet.getRange(rowNum, 14).setValue(confirmed_by || '');
      sheet.getRange(rowNum, 15).setValue(now);
      sheet.getRange(rowNum, 16).setValue(driver_name  || '');
      sheet.getRange(rowNum, 17).setValue(driver_phone || '');
      return { success: true, message: 'Pembayaran berhasil dikonfirmasi', orderId: order_id };
    }
  }

  return { success: false, message: 'Order ' + order_id + ' tidak ditemukan' };
}

// =====================================================
// STATISTICS (Owner)
// =====================================================

function getStats() {
  const sheet = SS.getSheetByName('Orders');
  if (!sheet) return { success: true, data: { totalOrders: 0, totalRevenue: 0, pendingOrders: 0, confirmedOrders: 0, monthlyRevenue: {}, fuelDistribution: {} } };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, data: { totalOrders: 0, totalRevenue: 0, pendingOrders: 0, confirmedOrders: 0, monthlyRevenue: {}, fuelDistribution: {} } };

  const rows = sheet.getRange(2, 1, lastRow - 1, 13).getValues();

  let totalOrders   = 0;
  let totalRevenue  = 0;
  let pendingOrders = 0;
  let confirmedOrders = 0;
  const monthlyRevenue  = {};
  const fuelDistribution = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;

    totalOrders++;
    const total  = parseFloat(row[7]) || 0;
    const status = row[10] || 'Menunggu';

    if (status !== 'Dibatalkan') totalRevenue += total;
    if (status === 'Menunggu')      pendingOrders++;
    if (status === 'Terkonfirmasi') confirmedOrders++;

    // Monthly revenue
    const createdAt = row[12];
    let monthKey = '';
    try {
      monthKey = createdAt instanceof Date
        ? createdAt.toISOString().substring(0, 7)
        : createdAt.toString().substring(0, 7);
    } catch (_) {}

    if (monthKey && status !== 'Dibatalkan') {
      monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + total;
    }

    // Fuel distribution
    const fuelType = row[4];
    if (fuelType) {
      fuelDistribution[fuelType] = (fuelDistribution[fuelType] || 0) + 1;
    }
  }

  return {
    success: true,
    data: { totalOrders, totalRevenue, pendingOrders, confirmedOrders, monthlyRevenue, fuelDistribution },
  };
}

// =====================================================
// USER MANAGEMENT
// =====================================================

function getUsers() {
  const sheet = SS.getSheetByName('Users');
  if (!sheet) return { success: true, data: [] };

  const rows  = sheet.getDataRange().getValues();
  const users = [];

  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    users.push({
      username: rows[i][0],
      role:     rows[i][2],
      name:     rows[i][3],
      status:   rows[i][4] || 'active',
      phone:    rows[i][5] || '',
    });
  }

  return { success: true, data: users };
}

function createUser(data) {
  const { username, password, role, name, phone } = data;
  if (!username || !password || !role || !name) {
    return { success: false, message: 'Data pengguna tidak lengkap' };
  }

  const sheet = SS.getSheetByName('Users');
  const rows  = sheet.getDataRange().getValues();

  // Check duplicate
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(username).trim()) {
      return { success: false, message: 'Username "' + username + '" sudah digunakan' };
    }
  }

  sheet.appendRow([username, password, role, name, 'active', phone || '']);
  return { success: true, message: 'Pengguna ' + name + ' berhasil ditambahkan' };
}

function updateUser(data) {
  const { username, password, name, phone, status } = data;
  if (!username) return { success: false, message: 'Username diperlukan' };

  const sheet = SS.getSheetByName('Users');
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(username).trim()) {
      if (password !== undefined && password !== '') sheet.getRange(i + 1, 2).setValue(password);
      if (name     !== undefined && name !== '')     sheet.getRange(i + 1, 4).setValue(name);
      if (status   !== undefined)                    sheet.getRange(i + 1, 5).setValue(status);
      if (phone    !== undefined)                    sheet.getRange(i + 1, 6).setValue(phone);
      return { success: true, message: 'Pengguna berhasil diperbarui' };
    }
  }

  return { success: false, message: 'Pengguna tidak ditemukan' };
}

function deleteUser(data) {
  const { username } = data;
  if (!username) return { success: false, message: 'Username diperlukan' };

  const sheet = SS.getSheetByName('Users');
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(username).trim()) {
      // Prevent deleting Owner
      if (String(rows[i][2]).trim() === 'Owner') {
        return { success: false, message: 'Akun Owner tidak dapat dihapus' };
      }
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Pengguna berhasil dihapus' };
    }
  }

  return { success: false, message: 'Pengguna tidak ditemukan' };
}

// =====================================================
// DRIVER MANAGEMENT
// =====================================================

function getDrivers() {
  const sheet = SS.getSheetByName('Drivers');
  if (!sheet) return { success: true, data: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, data: [] };

  const rows    = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const drivers = [];

  for (let i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    drivers.push({
      id:         rows[i][0],
      name:       rows[i][1],
      phone:      rows[i][2],
      vehicle:    rows[i][3] || '',
      status:     rows[i][4] || 'active',
      created_at: rows[i][5] ? rows[i][5].toString() : '',
    });
  }

  return { success: true, data: drivers };
}

function createDriver(data) {
  const { name, phone, vehicle } = data;
  if (!name || !phone) {
    return { success: false, message: 'Nama dan nomor telepon supir diperlukan' };
  }

  const sheet = SS.getSheetByName('Drivers');
  const id    = 'DRV-' + Utilities.getUuid().substring(0, 8).toUpperCase();
  const now   = new Date().toISOString();

  sheet.appendRow([id, name, phone, vehicle || '', 'active', now]);
  return { success: true, message: 'Supir ' + name + ' berhasil ditambahkan', id };
}

function deleteDriver(data) {
  const { id } = data;
  if (!id) return { success: false, message: 'ID supir diperlukan' };

  const sheet   = SS.getSheetByName('Drivers');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, message: 'Supir tidak ditemukan' };

  const rows = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 2);
      return { success: true, message: 'Supir berhasil dihapus' };
    }
  }

  return { success: false, message: 'Supir tidak ditemukan' };
}

// =====================================================
// SETTINGS (Bank Account, etc)
// =====================================================

function getSettings() {
  const sheet = SS.getSheetByName('Settings');
  if (!sheet) return { success: true, data: {} };

  const rows = sheet.getDataRange().getValues();
  const settings = {};

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) {
      settings[rows[i][0]] = rows[i][1];
    }
  }

  return { success: true, data: settings };
}

function updateSettings(data) {
  const sheet = SS.getSheetByName('Settings');
  if (!sheet) return { success: false, message: 'Sheet Settings tidak ditemukan' };

  const allowedKeys = ['bank_name', 'bank_account', 'bank_owner', 'truck_fee'];
  const settingsToSave = {};
  allowedKeys.forEach(k => {
    if (data[k] !== undefined) settingsToSave[k] = data[k];
  });

  const rows = sheet.getDataRange().getValues();
  
  for (const [key, value] of Object.entries(settingsToSave)) {
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === key) {
        sheet.getRange(i + 1, 2).setValue(value || '');
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, value || '']);
    }
  }

  return { success: true, message: 'Pengaturan berhasil disimpan' };
}

// =====================================================
// FILE UPLOAD TO GOOGLE DRIVE
// =====================================================

function uploadFileToDrive(base64Data, fileName, mimeType) {
  let folder;
  const folderName = 'SalesPertamina_BuktiBayar';

  // Find or create folder
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('DRIVE_FOLDER_ID');

  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (_) {
      folder = null;
    }
  }

  if (!folder) {
    const folders = DriveApp.getFoldersByName(folderName);
    folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    props.setProperty('DRIVE_FOLDER_ID', folder.getId());
  }

  // Decode base64 and create file
  const timestamp  = new Date().getTime();
  const uniqueName = timestamp + '_' + fileName;
  const decoded    = Utilities.base64Decode(base64Data);
  const blob       = Utilities.newBlob(decoded, mimeType || 'application/octet-stream', uniqueName);
  const file       = folder.createFile(blob);

  // Make file accessible via link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    url:  'https://drive.google.com/file/d/' + file.getId() + '/view',
    name: uniqueName,
    id:   file.getId(),
  };
}

// =====================================================
// SETUP: Initialize Sheets (Jalankan SEKALI SAJA)
// =====================================================

function setupSheets() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date().toISOString();

  // ── Users Sheet ──────────────────────────────
  let sheet = ss.getSheetByName('Users');
  if (!sheet) {
    sheet = ss.insertSheet('Users');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['username', 'password', 'role', 'name', 'status', 'phone']);
    sheet.appendRow(['owner',  'owner123',  'Owner', 'Owner Pertamina',  'active', '']);
    sheet.appendRow(['admin1', 'admin123',  'Admin', 'Admin Pertamina',  'active', '']);
    sheet.appendRow(['sales1', 'sales123',  'Sales', 'Sales Pertamina',  'active', '']);
    // Style header
    sheet.getRange(1, 1, 1, 6).setBackground('#CC0000').setFontColor('white').setFontWeight('bold');
  }

  // ── Orders Sheet ─────────────────────────────
  sheet = ss.getSheetByName('Orders');
  if (!sheet) {
    sheet = ss.insertSheet('Orders');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'id','order_date','delivery_date','company','fuel_type',
      'price_per_liter','volume','total',
      'payment_proof_url','payment_proof_name',
      'status','created_by','created_at','confirmed_by','confirmed_at',
      'driver_name','driver_phone',
    ]);
    sheet.getRange(1, 1, 1, 17).setBackground('#CC0000').setFontColor('white').setFontWeight('bold');
  }

  // ── FuelPrices Sheet ─────────────────────────
  sheet = ss.getSheetByName('FuelPrices');
  if (!sheet) {
    sheet = ss.insertSheet('FuelPrices');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['fuel_type', 'price', 'updated_at']);
    sheet.getRange(1, 1, 1, 3).setBackground('#CC0000').setFontColor('white').setFontWeight('bold');
    const fuels = [
      ['Solar (B30)',        6800,  now],
      ['Pertalite',          10000, now],
      ['Pertamax',           13900, now],
      ['Pertamax Turbo',     14400, now],
      ['Pertamax Green 95',  13900, now],
      ['Dex',                18350, now],
      ['Dexlite',            15350, now],
    ];
    fuels.forEach(f => sheet.appendRow(f));
  }

  // ── Drivers Sheet ─────────────────────────────
  sheet = ss.getSheetByName('Drivers');
  if (!sheet) {
    sheet = ss.insertSheet('Drivers');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'name', 'phone', 'vehicle', 'status', 'created_at']);
    sheet.getRange(1, 1, 1, 6).setBackground('#CC0000').setFontColor('white').setFontWeight('bold');
  }

  // ── Settings Sheet ─────────────────────────────
  sheet = ss.getSheetByName('Settings');
  if (!sheet) {
    sheet = ss.insertSheet('Settings');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['key', 'value']);
    sheet.getRange(1, 1, 1, 2).setBackground('#CC0000').setFontColor('white').setFontWeight('bold');
    sheet.appendRow(['bank_name', 'BCA']);
    sheet.appendRow(['bank_account', '1234567890']);
    sheet.appendRow(['bank_owner', 'PT Pertamina Sales']);
    sheet.appendRow(['truck_fee', '500000']);
  }

  return {
    success: true,
    message: '✅ Setup berhasil! Semua sheet telah dibuat.\n\nAkun default:\n• Owner: owner / owner123\n• Admin: admin1 / admin123\n• Sales: sales1 / sales123\n\nSEGERA GANTI PASSWORD setelah login pertama!',
  };
}
