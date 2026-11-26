import { getInitialPersistedState } from './seed.js';

// =========================================================================
// DYNAMIC URL PERSONALIZATION, CONSTANTS & APPLICATION STATE
// =========================================================================

const urlParams = new URLSearchParams(window.location.search);
const DEFAULT_STORE_NAME = 'مكتب الحاج محمود لتوزيع المواد الغذائية - جملة الجملة';
const DEFAULT_WHATSAPP = '201000000000';

export const STORE_NAME = (urlParams.get('name') || '').trim() || DEFAULT_STORE_NAME;
const cleanedWa = (urlParams.get('wa') || '').replace(/[^\d]/g, '');
export const WHATSAPP_NUMBER = cleanedWa || DEFAULT_WHATSAPP;

if (STORE_NAME !== DEFAULT_STORE_NAME) {
  document.title = `توريدة | ${STORE_NAME}`;
}

export const STORAGE_KEY = 'tawreeda_mvp_state_v2';
export const CUSTOMER_PROFILE_KEY = 'tawreeda_customer_profile_v1';
export const MIN_ORDER_VALUE = 1000;
export const FREE_DELIVERY_THRESHOLD = 3000;

export const BASE_CATEGORIES = [
  'شيبسي وسناكس',
  'بسكويت وويفر',
  'عصائر ومشروبات',
  'معلبات ونواشف',
];

const memoryStorage = {};
export const safeStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return memoryStorage[key] || null;
    }
  },
  set(key, val) {
    try {
      window.localStorage.setItem(key, val);
    } catch (_) {
      memoryStorage[key] = val;
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (_) {
      delete memoryStorage[key];
    }
  },
};

export function loadPersistedState() {
  const raw = safeStorage.get(STORAGE_KEY);
  if (!raw) {
    const fresh = getInitialPersistedState();
    safeStorage.set(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.orders)) {
      throw new Error('Invalid state');
    }
    parsed.products.forEach((p) => {
      if (!p.brand) p.brand = 'توريد عام';
    });
    return {
      products: parsed.products,
      orders: parsed.orders,
      nextOrderNumber: parsed.nextOrderNumber || 1003,
      pickingChecked: parsed.pickingChecked || {},
    };
  } catch (_) {
    const fresh = getInitialPersistedState();
    safeStorage.set(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

export function loadSavedCustomerProfile() {
  const raw = safeStorage.get(CUSTOMER_PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.shopName) return parsed;
  } catch (_) {}
  return null;
}

export function saveCustomerProfile(profile) {
  safeStorage.set(
    CUSTOMER_PROFILE_KEY,
    JSON.stringify({
      shopName: profile.shopName || '',
      address: profile.address || '',
      phone: profile.phone || '',
    })
  );
}

// =========================================================================
// APPLICATION STATE
// =========================================================================
const persisted = loadPersistedState();
const savedProfile = loadSavedCustomerProfile();

export const state = {
  products: persisted.products,
  orders: persisted.orders,
  nextOrderNumber: persisted.nextOrderNumber,
  pickingChecked: persisted.pickingChecked,

  role: 'customer',
  merchantTab: 'inventory',
  searchQuery: '',
  merchantSearchQuery: '',
  activeCategory: 'الكل',
  selectedUnitByProduct: {},
  cart: {},
  pendingPriceEdits: {},
  expandedOrders: {},

  // Bulk Price Update UI State
  bulkPanelOpen: true,
  bulkScopeType: 'brand', // 'all' | 'category' | 'brand'
  bulkScopeValue: 'بيبسيكو',
  bulkOperation: 'increase', // 'increase' | 'decrease'
  bulkUnit: 'percent', // 'percent' | 'fixed'
  bulkValue: '5',
  lastBulkSnapshot: null,
  undoTimerId: null,

  // Customer Checkout Draft
  savedCustomerProfile: savedProfile,
  checkoutDraft: {
    shopName: savedProfile ? savedProfile.shopName : '',
    address: savedProfile ? savedProfile.address : '',
    phone: savedProfile ? savedProfile.phone : '',
    paymentMethod: 'كاش عند الاستلام',
    notes: '',
  },
};

export function persistState() {
  safeStorage.set(
    STORAGE_KEY,
    JSON.stringify({
      products: state.products,
      orders: state.orders,
      nextOrderNumber: state.nextOrderNumber,
      pickingChecked: state.pickingChecked,
    })
  );
}

// Render hook to avoid circular imports with app.js
let renderCallback = () => {};

export function registerRender(fn) {
  renderCallback = fn;
}

export function requestRender() {
  renderCallback();
}
