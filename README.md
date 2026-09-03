# 🔥 Pertamina Sales System

Sistem manajemen pemesanan bahan bakar Pertamina berbasis web — HTML + Bootstrap + Google Apps Script + GitHub Pages.

---

## 📋 Daftar Isi

1. [Fitur](#fitur)
2. [Setup Google Sheets & Apps Script](#setup-google-apps-script)
3. [Konfigurasi Frontend](#konfigurasi-frontend)
4. [Deploy ke GitHub Pages](#deploy-ke-github-pages)
5. [Akun Default](#akun-default)
6. [Struktur File](#struktur-file)

---

## ✨ Fitur

| Role   | Fitur |
|--------|-------|
| **Sales**  | Input pemesanan BBM, auto-harga terbaru, upload bukti bayar, riwayat order |
| **Admin**  | Lihat semua order, konfirmasi pembayaran, cetak bukti, kirim notif WA supir, update harga BBM |
| **Owner**  | Dashboard analitik + grafik, laporan lengkap + export CSV, kelola user (Sales/Admin), kelola supir |

---

## 🛠️ Setup Google Apps Script

### Langkah 1: Buat Google Sheet Baru

1. Buka [Google Sheets](https://sheets.google.com)
2. Buat spreadsheet baru → beri nama: **"Pertamina Sales System"**

### Langkah 2: Buka Apps Script Editor

1. Di Google Sheets: klik **Extensions** → **Apps Script**
2. Hapus kode default yang ada
3. Copy-paste **seluruh isi file `Code.gs`** dari project ini
4. Klik **Save** (ikon disket atau Ctrl+S)

### Langkah 3: Inisialisasi Sheet (SEKALI SAJA)

1. Di editor Apps Script, pilih fungsi **`setupSheets`** dari dropdown
2. Klik tombol **Run** (▶)
3. Izinkan akses yang diminta (Google akan minta izin pertama kali)
4. Tunggu sampai muncul pesan sukses di panel Execution Log

> ⚠️ Jalankan `setupSheets` hanya **SEKALI**. Jika dijalankan ulang saat sheet sudah ada, tidak akan menimpa data yang ada.

### Langkah 4: Deploy sebagai Web App

1. Klik **Deploy** → **New deployment**
2. Klik ikon ⚙️ di "Select type" → pilih **Web app**
3. Isi konfigurasi:
   - **Description**: `Pertamina Sales System v1.0`
   - **Execute as**: `Me` (akun Google Anda)
   - **Who has access**: `Anyone`
4. Klik **Deploy**
5. **Izinkan akses** yang diminta
6. **Copy URL** yang muncul — ini adalah GAS_URL Anda

   Contoh URL:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

---

## ⚙️ Konfigurasi Frontend

Buka file `assets/js/config.js` dan ganti URL:

```javascript
const CONFIG = {
  // Ganti baris ini dengan URL dari langkah 4 di atas:
  GAS_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  // ...
};
```

---

## 🚀 Deploy ke GitHub Pages

### Langkah 1: Buat Repository GitHub

1. Buka [github.com](https://github.com) → Login
2. Klik **New repository**
3. Nama repo: `salescsm` (atau nama lain)
4. Visibility: **Public** (diperlukan untuk GitHub Pages gratis)
5. **Jangan** centang "Initialize with README"
6. Klik **Create repository**

### Langkah 2: Push Kode ke GitHub

Buka terminal di folder project (`c:\xampp\htdocs\salescsm`) dan jalankan:

```bash
git init
git add .
git commit -m "Initial commit - Pertamina Sales System"
git branch -M main
git remote add origin https://github.com/USERNAME/salescsm.git
git push -u origin main
```

> Ganti `USERNAME` dengan username GitHub Anda.

### Langkah 3: Aktifkan GitHub Pages

1. Di repo GitHub, klik **Settings**
2. Di sidebar kiri, klik **Pages**
3. Di bawah "Build and deployment":
   - Source: **Deploy from a branch**
   - Branch: **main** / **(root)**
4. Klik **Save**
5. Tunggu ~2-3 menit
6. URL situs Anda akan muncul:
   ```
   https://USERNAME.github.io/salescsm/
   ```

### Langkah 4: Update GAS_URL jika perlu

Jika Anda mengubah kode Apps Script dan melakukan re-deploy, pastikan URL baru diupdate di `config.js`, commit, dan push ulang.

---

## 🔑 Akun Default

Setelah menjalankan `setupSheets`, akun berikut akan tersedia:

| Username | Password  | Role  |
|----------|-----------|-------|
| `owner`  | `owner123`  | Owner |
| `admin1` | `admin123`  | Admin |
| `sales1` | `sales123`  | Sales |

> ⚠️ **SEGERA GANTI PASSWORD** akun-akun ini setelah login pertama melalui panel Owner → Kelola Pengguna.

---

## 📁 Struktur File

```
salescsm/
├── index.html          ← Halaman login
├── sales.html          ← Dashboard Sales
├── admin.html          ← Dashboard Admin
├── owner.html          ← Dashboard Owner
├── Code.gs             ← Google Apps Script (backend)
├── assets/
│   ├── css/
│   │   └── style.css   ← Satu file CSS global (design system)
│   └── js/
│       ├── config.js   ← Konfigurasi & konstanta
│       ├── auth.js     ← Auth, API helper, UI utilities
│       ├── sales.js    ← Logic halaman Sales
│       ├── admin.js    ← Logic halaman Admin
│       └── owner.js    ← Logic halaman Owner
└── README.md
```

---

## 🗂️ Struktur Google Sheet

### Sheet: `Users`
| username | password | role | name | status | phone |

### Sheet: `Orders`
| id | order_date | delivery_date | company | fuel_type | price_per_liter | volume | total | payment_proof_url | payment_proof_name | status | created_by | created_at | confirmed_by | confirmed_at | driver_name | driver_phone |

### Sheet: `FuelPrices`
| fuel_type | price | updated_at |

### Sheet: `Drivers`
| id | name | phone | vehicle | status | created_at |

---

## 🔄 Update Harga BBM

Admin dapat mengupdate harga BBM langsung dari dashboard:
1. Login sebagai Admin
2. Klik **Update Harga BBM** di sidebar
3. Ubah harga → klik **Simpan**

Harga baru akan langsung berlaku saat Sales membuat order baru.

---

## 📱 Fitur WhatsApp Notifikasi

Setelah Admin mengkonfirmasi pembayaran:
1. Klik tombol **WA** di baris order
2. Pilih supir dari dropdown
3. Preview pesan akan muncul secara otomatis
4. Klik **Buka WhatsApp** → otomatis membuka WA dengan pesan terformat

---

## 🖨️ Cetak Bukti Pemesanan

1. Klik tombol **Cetak** di baris order
2. Dialog print browser akan muncul
3. Bukti pemesanan berisi: detail order, tabel BBM, status konfirmasi, dan kolom tanda tangan

---

## ❓ Troubleshooting

**"Koneksi gagal" saat login:**
- Pastikan GAS_URL di `config.js` sudah benar
- Pastikan Web App di-deploy dengan akses "Anyone"
- Coba buka GAS_URL langsung di browser — seharusnya muncul JSON

**Upload bukti bayar gagal:**
- Periksa ukuran file (maks. 5 MB)
- Format yang didukung: JPG, PNG, WEBP, PDF
- Pastikan Apps Script punya izin akses ke Google Drive

**Grafik tidak muncul (Owner):**
- Pastikan ada data order di sheet
- Refresh halaman

**Re-deploy Apps Script:**
- Jika Anda mengubah kode GAS dan re-deploy, URL biasanya **tetap sama**
- Tapi jika URL berubah, update `config.js` dan push ulang ke GitHub

---

*Dibuat dengan ❤️ untuk sistem manajemen BBM Pertamina*
