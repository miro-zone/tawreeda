import { persistState, requestRender, state } from './state.js';
import {
  escapeHtml,
  formatMoney,
  getAllBrands,
  getAllCategories,
  normalizeArabicDigits,
  showToast,
} from './utils.js';
import { renderMerchantOrdersTab } from './orders.js';

// =========================================================================
// VIEW 2: MERCHANT DASHBOARD (Inventory & Bulk Pricing)
// =========================================================================

export function getBulkMatchingProducts() {
  if (state.bulkScopeType === 'all') return state.products;
  if (state.bulkScopeType === 'category') {
    return state.products.filter((p) => p.category === state.bulkScopeValue);
  }
  if (state.bulkScopeType === 'brand') {
    return state.products.filter((p) => p.brand === state.bulkScopeValue);
  }
  return [];
}

export function getBulkPreviewText() {
  const matched = getBulkMatchingProducts();
  const val = parseFloat(state.bulkValue);
  if (matched.length === 0) {
    return 'لا توجد أصناف مطابقة للنطاق المختار حالياً.';
  }
  const scopeDesc =
    state.bulkScopeType === 'all'
      ? 'من كل الكتالوج'
      : state.bulkScopeType === 'category'
      ? `من فئة "${state.bulkScopeValue}"`
      : `من شركة "${state.bulkScopeValue}"`;
  const opWord = state.bulkOperation === 'increase' ? 'بزيادة' : 'بخصم';
  const sign = state.bulkOperation === 'increase' ? '+' : '-';
  const unitLabel = state.bulkUnit === 'percent' ? '%' : ' جنيه';
  const displayVal = Number.isFinite(val) && val > 0 ? `${sign}${val}${unitLabel}` : '(أدخل القيمة)';
  return `سيتم تعديل ${matched.length} ${matched.length === 1 ? 'صنف' : 'أصناف'} ${scopeDesc} ${opWord} ${displayVal}`;
}

export function applyBulkPriceUpdate() {
  const val = parseFloat(normalizeArabicDigits(state.bulkValue));
  if (!Number.isFinite(val) || val <= 0) {
    showToast('برجاء إدخال رقم صحيح أكبر من صفر للتعديل الجماعي', 'warning');
    return;
  }
  const matched = getBulkMatchingProducts();
  if (matched.length === 0) {
    showToast('لا توجد أصناف مطابقة للتعديل', 'warning');
    return;
  }

  const sign = state.bulkOperation === 'increase' ? 1 : -1;
  const snapshot = state.products.map((p) => ({
    id: p.id,
    cartonPrice: p.cartonPrice,
    packetPrice: p.packetPrice,
    unitCost: p.unitCost,
    originalCartonPrice: p.originalCartonPrice,
  }));

  matched.forEach((p) => {
    const oldCarton = p.cartonPrice;
    let newCarton =
      state.bulkUnit === 'percent'
        ? Math.round(oldCarton * (1 + (sign * val) / 100))
        : Math.round(oldCarton + sign * val);
    newCarton = Math.max(1, newCarton);

    const ratio = oldCarton > 0 ? newCarton / oldCarton : 1;
    p.cartonPrice = newCarton;

    if (p.packetPrice != null && p.packetPrice > 0) {
      let newPacket = Math.max(1, Math.round(p.packetPrice * ratio));
      // Keep single-piece cost of packet >= single-piece cost of carton
      if (p.unitsPerCarton > 0 && p.unitsPerPacket > 0) {
        const minPacket = Math.ceil((newCarton / p.unitsPerCarton) * p.unitsPerPacket);
        if (newPacket < minPacket) newPacket = minPacket;
      }
      if (newPacket >= newCarton && newCarton > 1) {
        newPacket = Math.max(1, Math.round(newCarton * 0.52));
      }
      p.packetPrice = newPacket;
    }

    if (p.unitsPerCarton > 0) {
      p.unitCost = +(newCarton / p.unitsPerCarton).toFixed(2);
    } else {
      p.unitCost = +(Math.max(0.25, (p.unitCost || 1) * ratio)).toFixed(2);
    }

    delete state.pendingPriceEdits[p.id];
  });

  state.lastBulkSnapshot = snapshot;
  if (state.undoTimerId) clearTimeout(state.undoTimerId);
  persistState();
  requestRender();

  const unitSym = state.bulkUnit === 'percent' ? '%' : ' ج';
  const opSym = sign > 0 ? '+' : '-';
  const toastObj = showToast(
    `تم تعديل أسعار ${matched.length} ${matched.length === 1 ? 'صنف' : 'أصناف'} (${opSym}${val}${unitSym}) وتحديث الكتالوج ✓`,
    'success',
    {
      replaceId: 'bulk-undo-toast',
      duration: 6000,
      actionLabel: 'تراجع (Undo)',
      onAction: () => {
        if (!state.lastBulkSnapshot) return;
        const snapMap = new Map(state.lastBulkSnapshot.map((s) => [s.id, s]));
        state.products.forEach((p) => {
          const orig = snapMap.get(p.id);
          if (orig) {
            p.cartonPrice = orig.cartonPrice;
            p.packetPrice = orig.packetPrice;
            p.unitCost = orig.unitCost;
            p.originalCartonPrice = orig.originalCartonPrice;
          }
        });
        state.lastBulkSnapshot = null;
        if (state.undoTimerId) clearTimeout(state.undoTimerId);
        persistState();
        requestRender();
        showToast('تم التراجع واسترجاع الأسعار السابقة بالكامل ✓', 'info');
      },
    }
  );
  if (toastObj) state.undoTimerId = toastObj.timerId;
}

export function updateFloatingSaveBar() {
  const bar = document.getElementById('floating-save-bar');
  const editCount = Object.keys(state.pendingPriceEdits).length;
  if (state.role !== 'merchant' || state.merchantTab !== 'inventory' || editCount === 0) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  document.getElementById('unsaved-count-text').textContent =
    editCount === 1 ? 'تم تعديل سعر صنف واحد' : `تم تعديل أسعار ${editCount} أصناف`;
}

export function renderMerchantView() {
  const newOrdersCount = state.orders.filter((o) => o.status === 'new').length;
  const approvedOrdersCount = state.orders.filter((o) => o.status === 'approved').length;
  const badgeCount = newOrdersCount + approvedOrdersCount;

  return `
    <section class="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 mb-3.5 no-print">
      <div class="grid grid-cols-2 gap-1.5">
        <button
          id="merchant-tab-inventory"
          type="button"
          class="min-h-[48px] px-3 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all ${
            state.merchantTab === 'inventory'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
          <span>إدارة الأسعار والمخزون</span>
        </button>

        <button
          id="merchant-tab-orders"
          type="button"
          class="min-h-[48px] px-3 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all ${
            state.merchantTab === 'orders'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
          <span>أوردرات اليوم وعهدة السواق</span>
          ${
            badgeCount > 0
              ? `<span class="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-black rounded-full ${
                  state.merchantTab === 'orders' ? 'bg-amber-400 text-slate-950' : 'bg-red-500 text-white'
                } tabular-nums">${badgeCount}</span>`
              : ''
          }
        </button>
      </div>
    </section>

    ${state.merchantTab === 'inventory' ? renderMerchantInventoryTab() : renderMerchantOrdersTab()}
  `;
}

// ---- Merchant Tab 1: Inventory + Bulk Price Update + CSV ----
function renderBulkPricePanel() {
  const categories = getAllCategories();
  const brands = getAllBrands();

  if (state.bulkScopeType === 'category' && !categories.includes(state.bulkScopeValue)) {
    state.bulkScopeValue = categories[0] || '';
  }
  if (state.bulkScopeType === 'brand' && !brands.includes(state.bulkScopeValue)) {
    state.bulkScopeValue = brands[0] || '';
  }

  const previewText = getBulkPreviewText();

  return `
    <section class="bg-white rounded-2xl border border-slate-200 shadow-sm mb-3.5 overflow-hidden">
      <button
        id="btn-toggle-bulk-panel"
        type="button"
        class="w-full px-4 py-3 flex items-center justify-between gap-2 bg-slate-50 hover:bg-slate-100/80 transition-colors text-right"
      >
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-black flex-shrink-0">⚡</span>
          <div>
            <h2 class="text-sm font-black text-slate-900">تعديل جماعي سريع للأسعار</h2>
            <p class="text-[11px] font-semibold text-slate-500">ارفع أو خصم أسعار شركة كاملة أو فئة بضغطة واحدة مع إمكانية التراجع</p>
          </div>
        </div>
        <span class="text-xs font-extrabold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg flex-shrink-0">
          ${state.bulkPanelOpen ? 'إخفاء ▲' : 'فتح ▼'}
        </span>
      </button>

      ${
        state.bulkPanelOpen
          ? `<div class="p-3.5 sm:p-4 border-t border-slate-200 space-y-3 animate-fade-in">
              <!-- Scope Row -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-xs font-bold text-slate-600 mb-1" for="bulk-scope-type">نطاق التعديل</label>
                  <select id="bulk-scope-type" class="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none text-xs sm:text-sm font-extrabold text-slate-900">
                    <option value="brand" ${state.bulkScopeType === 'brand' ? 'selected' : ''}>شركة مورّدة محددة</option>
                    <option value="category" ${state.bulkScopeType === 'category' ? 'selected' : ''}>فئة محددة</option>
                    <option value="all" ${state.bulkScopeType === 'all' ? 'selected' : ''}>كل الأصناف في الكتالوج</option>
                  </select>
                </div>

                ${
                  state.bulkScopeType === 'all'
                    ? `<div class="flex items-end">
                        <div class="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 flex items-center text-xs font-bold text-slate-600">
                          يشمل جميع الأصناف (${state.products.length} صنف)
                        </div>
                      </div>`
                    : `<div>
                        <label class="block text-xs font-bold text-slate-600 mb-1" for="bulk-scope-value">
                          ${state.bulkScopeType === 'brand' ? 'اختر الشركة المورّدة' : 'اختر الفئة'}
                        </label>
                        <select id="bulk-scope-value" class="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none text-xs sm:text-sm font-extrabold text-slate-900">
                          ${(state.bulkScopeType === 'brand' ? brands : categories)
                            .map(
                              (opt) =>
                                `<option value="${escapeHtml(opt)}" ${state.bulkScopeValue === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`
                            )
                            .join('')}
                        </select>
                      </div>`
                }
              </div>

              <!-- Operation, Value & Unit Row -->
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <!-- Increase / Decrease -->
                <div class="sm:col-span-4 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    data-bulk-op="increase"
                    class="min-h-[40px] rounded-lg text-xs font-extrabold transition-all ${
                      state.bulkOperation === 'increase'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-white'
                    }"
                  >زيادة (+)</button>
                  <button
                    type="button"
                    data-bulk-op="decrease"
                    class="min-h-[40px] rounded-lg text-xs font-extrabold transition-all ${
                      state.bulkOperation === 'decrease'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-white'
                    }"
                  >خصم (-)</button>
                </div>

                <!-- Numeric Value -->
                <div class="sm:col-span-4">
                  <input
                    id="bulk-value-input"
                    type="number"
                    inputmode="decimal"
                    min="0.1"
                    step="any"
                    value="${escapeHtml(state.bulkValue)}"
                    placeholder="أدخل القيمة..."
                    class="w-full min-h-[48px] px-3.5 py-2 rounded-xl border-2 border-slate-200 focus:border-emerald-500 bg-slate-50 focus:bg-white outline-none text-base font-black text-slate-900 tabular-nums"
                  />
                </div>

                <!-- Percent / Fixed -->
                <div class="sm:col-span-4 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    data-bulk-unit="percent"
                    class="min-h-[40px] rounded-lg text-xs font-extrabold transition-all ${
                      state.bulkUnit === 'percent'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-white'
                    }"
                  >نسبة (%)</button>
                  <button
                    type="button"
                    data-bulk-unit="fixed"
                    class="min-h-[40px] rounded-lg text-xs font-extrabold transition-all ${
                      state.bulkUnit === 'fixed'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-white'
                    }"
                  >مبلغ (جنيه)</button>
                </div>
              </div>

              <!-- Live Preview & Apply Button -->
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-amber-50/80 border border-amber-200 rounded-xl p-3">
                <div class="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-amber-950">
                  <span>👁️</span>
                  <span id="bulk-preview-text">${escapeHtml(previewText)}</span>
                </div>
                <button
                  id="btn-apply-bulk"
                  type="button"
                  class="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold whitespace-nowrap shadow-sm transition-all flex-shrink-0"
                >تطبيق على الكتالوج</button>
              </div>
            </div>`
          : ''
      }
    </section>
  `;
}

function renderMerchantInventoryTab() {
  const total = state.products.length;
  const available = state.products.filter((p) => p.inStock).length;
  const outOfStock = total - available;
  const clearance = state.products.filter((p) => p.isClearance && p.inStock).length;

  const q = state.merchantSearchQuery.trim().toLowerCase();
  const filtered = state.products.filter((p) => {
    if (!q) return true;
    return `${p.name} ${p.category} ${p.brand || ''}`.toLowerCase().includes(q);
  });

  return `
    <section class="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 sm:p-4 mb-3.5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h1 class="text-base sm:text-lg font-black text-slate-900">تحديث الأسعار والمخزون لحظياً</h1>
          <p class="text-xs text-slate-500 mt-0.5">عدّل أي سعر مباشرة أو فعّل "خلصان / حرق سعر" لينعكس فوراً عند السوبر ماركت</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button
            id="btn-open-csv-modal"
            type="button"
            class="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-all"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
            <span>استيراد / تصدير إكسل (CSV)</span>
          </button>
          <button
            id="btn-open-add-product"
            type="button"
            class="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            <span>إضافة صنف جديد</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-3">
        <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
          <div class="text-lg font-black text-emerald-700 tabular-nums">${available}</div>
          <div class="text-[11px] font-bold text-emerald-900">صنف متاح</div>
        </div>
        <div class="bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-center">
          <div class="text-lg font-black text-slate-700 tabular-nums">${outOfStock}</div>
          <div class="text-[11px] font-bold text-slate-600">خلصان</div>
        </div>
        <div class="bg-orange-50 border border-orange-200 rounded-xl p-2.5 text-center">
          <div class="text-lg font-black text-orange-700 tabular-nums">${clearance}</div>
          <div class="text-[11px] font-bold text-orange-900">حرق أسعار</div>
        </div>
      </div>

      <div class="relative">
        <div class="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <input
          id="merchant-search-input"
          type="search"
          value="${escapeHtml(state.merchantSearchQuery)}"
          placeholder="فلترة الأصناف أو الشركات للتعديل السريع..."
          class="w-full min-h-[44px] pr-10 pl-4 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white outline-none text-sm font-semibold text-slate-900"
        />
      </div>
    </section>

    ${renderBulkPricePanel()}

    <section class="space-y-3">
      ${filtered.map(renderMerchantProductRow).join('')}
    </section>
  `;
}

function renderMerchantProductRow(p) {
  const pending = state.pendingPriceEdits[p.id] || {};
  const cartonVal = pending.cartonPrice !== undefined ? pending.cartonPrice : p.cartonPrice;
  const packetVal =
    pending.packetPrice !== undefined
      ? pending.packetPrice
      : p.packetPrice != null
      ? p.packetPrice
      : '';

  const isDirty = pending.cartonPrice !== undefined || pending.packetPrice !== undefined;
  const liveUnitCost =
    p.unitsPerCarton && Number(cartonVal) > 0
      ? +(Number(cartonVal) / p.unitsPerCarton).toFixed(2)
      : p.unitCost;

  return `
    <div class="bg-white rounded-2xl border ${
      isDirty
        ? 'border-amber-400 ring-2 ring-amber-200/60'
        : p.isClearance
        ? 'border-orange-300'
        : !p.inStock
        ? 'border-slate-200 bg-slate-50/70'
        : 'border-slate-200'
    } shadow-sm p-3.5 sm:p-4 transition-all" data-merchant-row="${p.id}">
      <div class="flex items-start justify-between gap-2 mb-3">
        <div>
          <div class="flex items-center gap-1.5 flex-wrap mb-1">
            <span class="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">${escapeHtml(p.category)}</span>
            ${p.brand ? `<span class="text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">🏢 ${escapeHtml(p.brand)}</span>` : ''}
            ${!p.inStock ? `<span class="text-[11px] font-extrabold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">خلصان</span>` : ''}
            ${p.isClearance ? `<span class="text-[11px] font-extrabold bg-orange-100 text-red-700 px-2 py-0.5 rounded-md">🔥 حرق سعر - مثبت بالأعلى</span>` : ''}
            ${p.promoText && !p.isClearance ? `<span class="text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">🎁 ${escapeHtml(p.promoText)}</span>` : ''}
          </div>
          <h2 class="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">${escapeHtml(p.name)}</h2>
        </div>
        <div class="text-left flex-shrink-0">
          <span class="text-[11px] text-slate-500 block">سعر القطعة</span>
          <span id="live-unit-cost-${p.id}" class="text-sm font-black text-emerald-700 tabular-nums">${formatMoney(liveUnitCost)} ج</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5 mb-3">
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1" for="price-carton-${p.id}">سعر الكرتونة (ج)</label>
          <div class="relative">
            <input
              id="price-carton-${p.id}"
              type="number"
              inputmode="decimal"
              min="1"
              step="any"
              value="${escapeHtml(cartonVal)}"
              data-price-input="carton"
              data-pid="${p.id}"
              class="w-full min-h-[44px] px-3 py-2 rounded-xl border-2 ${
                pending.cartonPrice !== undefined
                  ? 'border-amber-400 bg-amber-50/40'
                  : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500'
              } outline-none text-base font-black text-slate-900 tabular-nums transition-colors"
            />
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">ج</span>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1" for="price-packet-${p.id}">سعر الشرنك / الباكت (ج)</label>
          <div class="relative">
            <input
              id="price-packet-${p.id}"
              type="number"
              inputmode="decimal"
              min="0"
              step="any"
              value="${escapeHtml(packetVal)}"
              placeholder="كرتونة فقط"
              data-price-input="packet"
              data-pid="${p.id}"
              class="w-full min-h-[44px] px-3 py-2 rounded-xl border-2 ${
                pending.packetPrice !== undefined
                  ? 'border-amber-400 bg-amber-50/40'
                  : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500'
              } outline-none text-base font-black text-slate-900 placeholder:text-xs placeholder:font-semibold placeholder:text-slate-400 tabular-nums transition-colors"
            />
            ${packetVal !== '' ? `<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">ج</span>` : ''}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 border-t border-slate-100">
        <div class="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2 min-h-[48px]">
          <div>
            <span class="text-xs font-extrabold ${p.inStock ? 'text-emerald-800' : 'text-slate-600'}">
              ${p.inStock ? 'متاح في المخزن' : 'خلصان (مخفي الطلب)'}
            </span>
            <span class="block text-[10px] text-slate-500">تحديث فوري في الكتالوج</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked="${p.inStock}"
            aria-label="تبديل حالة التوفر"
            data-toggle-stock="${p.id}"
            data-checked="${p.inStock}"
            class="toggle-track ${p.inStock ? 'bg-emerald-500' : 'bg-slate-300'}"
          >
            <span class="toggle-thumb"></span>
          </button>
        </div>

        <div class="flex items-center justify-between gap-2 ${
          p.isClearance ? 'bg-orange-50 border border-orange-200' : 'bg-slate-50'
        } rounded-xl px-3 py-2 min-h-[48px]">
          <div>
            <span class="text-xs font-extrabold ${p.isClearance ? 'text-red-700' : 'text-slate-700'}">
              🔥 حرق سعر - صلاحية قريبة
            </span>
            <span class="block text-[10px] ${p.isClearance ? 'text-orange-700' : 'text-slate-500'}">
              يظهر للعميل كـ "لقطة اليوم - كمية محدودة"
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked="${p.isClearance}"
            aria-label="تبديل وضع حرق السعر"
            data-toggle-clearance="${p.id}"
            data-checked="${p.isClearance}"
            class="toggle-track ${p.isClearance ? 'bg-orange-500' : 'bg-slate-300'}"
          >
            <span class="toggle-thumb"></span>
          </button>
        </div>
      </div>
    </div>
  `;
}
