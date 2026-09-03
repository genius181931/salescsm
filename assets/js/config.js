// ================================================
// PERTAMINA SALES SYSTEM - Configuration
// ================================================

const CONFIG = {
  // *** GANTI URL INI DENGAN URL GOOGLE APPS SCRIPT ANDA ***
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxeZJGXzVp2ujKVRFwNSWwShhM1rS-u8-tnFDi0in5fVo2G0HzwlfTfbjuQEVu_Q-s6fw/exec',

  APP_NAME:    'Pertamina Sales System',
  APP_SHORT:   'SalesPertamina',
  VERSION:     '1.0.0',

  // Session
  SESSION_KEY: 'salespertamina_session',

  // Pages per role
  ROLE_PAGES: {
    Owner: 'owner.html',
    Admin: 'admin.html',
    Sales: 'sales.html',
  },

  // Fuel type labels (mirrored from sheet, for display)
  FUEL_TYPES: [
    'Solar (B30)',
    'Pertalite',
    'Pertamax',
    'Pertamax Turbo',
    'Pertamax Green 95',
    'Dex',
    'Dexlite',
  ],

  // Status labels
  STATUS: {
    WAITING:   'Menunggu',
    CONFIRMED: 'Terkonfirmasi',
    DELIVERED: 'Terkirim',
    CANCELLED: 'Dibatalkan',
  },

  // Max file size for upload (5 MB)
  MAX_FILE_SIZE: 5 * 1024 * 1024,

  // Allowed file types for payment proof
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};
