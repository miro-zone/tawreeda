import { persistState, registerRender, state } from './state.js';
import {
  buildPickingListText,
  formatMoney,
  getAllBrands,
  getAllCategories,
  showToast,
} from './utils.js';
import {
  adjustCart,
  getFilteredCustomerProducts,
  renderCustomerProductCard,
  renderCustomerView,
  updateStickyCartBar,
} from './customer.js';
import {
  applyBulkPriceUpdate,
  getBulkPreviewText,
  renderMerchantView,
  updateFloatingSaveBar,
} from './merchant.js';
import { getAggregatedPickingList, openSettlementModal } from './orders.js';
import { openCsvModal } from './csv.js';
import {
  closeModal,
  openAddProductModal,
  openCheckoutDrawer,
  openResetConfirmModal,
} from './modals.js';

// =========================================================================
// APP ENTRY POINT: HEADER, RENDER, EVENTS & BOOT
// =========================================================================

function updateHeaderUI() {
  const btnCustomer = document.getElementById('role-customer');
  const btnMerchant = document.getElementById('role-merchant');
  const ordersBadge = document.getElementById('header-orders-badge');

  const activeOrders = state.orders.filter((o) => o.status !== 'rejected');
  const needsAction = state.orders.filter((o) => o.status === 'new' || o.status === 'approved').length;
  ordersBadge.textContent = needsAction || activeOrders.length;
  ordersBadge.title = `${needsAction} أوردرات بانتظار الاعتماد أو التحميل`;

  if (state.role === 'customer') {
    btnCustomer.className =
      'min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all bg-emerald-500 text-slate-950 shadow-sm';
    btnMerchant.className =
      'min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all text-slate-300 hover:text-white hover:bg-slate-700/60';
  } else {
    btnCustomer.className =
      'min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all text-slate-300 hover:text-white hover:bg-slate-700/60';
    btnMerchant.className =
      'min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all bg-white text-slate-900 shadow-sm';
  }
}

function render() {
  updateHeaderUI();
  const main = document.getElementById('app-main');
  main.innerHTML = state.role === 'customer' ? renderCustomerView() : renderMerchantView();
  updateStickyCartBar();
  updateFloatingSaveBar();
  bindViewEvents();
}

function bindViewEvents() {
  const main = document.getElementById('app-main');

  if (state.role === 'customer') {
    const searchInput = document.getElementById('customer-search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (clearSearchBtn) {
          clearSearchBtn.classList.toggle('hidden', !state.searchQuery);
        }
        const listEl = document.getElementById('customer-products-list');
        const products = getFilteredCustomerProducts();
        listEl.innerHTML =
          products.length === 0
            ? `<div class="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <p class="text-base font-bold text-slate-700">مفيش أصناف مطابقة للبحث ده</p>
                <p class="text-xs text-slate-500 mt-1">جرب تكتب اسم تاني أو اختار قسم "الكل"</p>
                <button id="btn-reset-filters" type="button" class="mt-4 min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">عرض كل الأصناف</button>
              </div>`
            : products.map(renderCustomerProductCard).join('');
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        state.searchQuery = '';
        render();
      });
    }

    main.querySelectorAll('.category-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeCategory = btn.getAttribute('data-category');
        render();
      });
    });
  }

  if (state.role === 'merchant') {
    const tabInv = document.getElementById('merchant-tab-inventory');
    const tabOrd = document.getElementById('merchant-tab-orders');
    if (tabInv) {
      tabInv.addEventListener('click', () => {
        state.merchantTab = 'inventory';
        render();
      });
    }
    if (tabOrd) {
      tabOrd.addEventListener('click', () => {
        state.merchantTab = 'orders';
        render();
      });
    }

    const addBtn = document.getElementById('btn-open-add-product');
    if (addBtn) addBtn.addEventListener('click', openAddProductModal);

    const csvBtn = document.getElementById('btn-open-csv-modal');
    if (csvBtn) csvBtn.addEventListener('click', openCsvModal);

    const toggleBulkBtn = document.getElementById('btn-toggle-bulk-panel');
    if (toggleBulkBtn) {
      toggleBulkBtn.addEventListener('click', () => {
        state.bulkPanelOpen = !state.bulkPanelOpen;
        render();
      });
    }

    const scopeTypeEl = document.getElementById('bulk-scope-type');
    if (scopeTypeEl) {
      scopeTypeEl.addEventListener('change', (e) => {
        state.bulkScopeType = e.target.value;
        if (state.bulkScopeType === 'brand') state.bulkScopeValue = getAllBrands()[0] || '';
        if (state.bulkScopeType === 'category') state.bulkScopeValue = getAllCategories()[0] || '';
        render();
      });
    }

    const scopeValEl = document.getElementById('bulk-scope-value');
    if (scopeValEl) {
      scopeValEl.addEventListener('change', (e) => {
        state.bulkScopeValue = e.target.value;
        const previewEl = document.getElementById('bulk-preview-text');
        if (previewEl) previewEl.textContent = getBulkPreviewText();
      });
    }

    const bulkValInput = document.getElementById('bulk-value-input');
    if (bulkValInput) {
      bulkValInput.addEventListener('input', (e) => {
        state.bulkValue = e.target.value;
        const previewEl = document.getElementById('bulk-preview-text');
        if (previewEl) previewEl.textContent = getBulkPreviewText();
      });
    }

    const applyBulkBtn = document.getElementById('btn-apply-bulk');
    if (applyBulkBtn) applyBulkBtn.addEventListener('click', applyBulkPriceUpdate);

    const mSearch = document.getElementById('merchant-search-input');
    if (mSearch) {
      mSearch.addEventListener('input', (e) => {
        const pos = e.target.selectionStart;
        state.merchantSearchQuery = e.target.value;
        render();
        const refreshed = document.getElementById('merchant-search-input');
        if (refreshed) {
          refreshed.focus();
          try {
            refreshed.setSelectionRange(pos, pos);
          } catch (_) {}
        }
      });
    }

    const copyPickBtn = document.getElementById('btn-copy-picking');
    if (copyPickBtn) {
      copyPickBtn.addEventListener('click', () => {
        const approved = state.orders.filter((o) => o.status === 'approved');
        const agg = getAggregatedPickingList(approved);
        if (agg.length === 0) {
          showToast('لا توجد أوردرات معتمدة في ورقة التحميل حالياً', 'warning');
          return;
        }
        const txt = buildPickingListText(agg);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(() => showToast('تم نسخ ورقة التحميل لإرسالها للمخزن ✓'));
        } else {
          showToast('تم تجهيز ورقة التحميل ✓');
        }
      });
    }

    const printPickBtn = document.getElementById('btn-print-picking');
    if (printPickBtn) {
      printPickBtn.addEventListener('click', () => window.print());
    }
  }
}

// =========================================================================
// DELEGATED INTERACTIONS
// =========================================================================
document.getElementById('app-main').addEventListener('click', (e) => {
  const target = e.target;

  if (target.closest('#btn-reset-filters')) {
    state.searchQuery = '';
    state.activeCategory = 'الكل';
    render();
    return;
  }

  // Bulk op & unit buttons
  const bulkOpBtn = target.closest('[data-bulk-op]');
  if (bulkOpBtn) {
    state.bulkOperation = bulkOpBtn.getAttribute('data-bulk-op');
    render();
    return;
  }
  const bulkUnitBtn = target.closest('[data-bulk-unit]');
  if (bulkUnitBtn) {
    state.bulkUnit = bulkUnitBtn.getAttribute('data-bulk-unit');
    render();
    return;
  }

  const unitBtn = target.closest('[data-select-unit]');
  if (unitBtn && !unitBtn.disabled) {
    const pid = unitBtn.getAttribute('data-pid');
    const unit = unitBtn.getAttribute('data-select-unit');
    state.selectedUnitByProduct[pid] = unit;
    render();
    return;
  }

  const qtyBtn = target.closest('[data-qty-delta]');
  if (qtyBtn) {
    const pid = qtyBtn.getAttribute('data-pid');
    const unit = qtyBtn.getAttribute('data-unit');
    const delta = parseInt(qtyBtn.getAttribute('data-qty-delta'), 10);
    adjustCart(pid, unit, delta);
    return;
  }

  const quickBtn = target.closest('[data-quick-add]');
  if (quickBtn) {
    const pid = quickBtn.getAttribute('data-pid');
    const unit = quickBtn.getAttribute('data-unit');
    const amount = parseInt(quickBtn.getAttribute('data-quick-add'), 10);
    adjustCart(pid, unit, amount);
    return;
  }

  const stockToggle = target.closest('[data-toggle-stock]');
  if (stockToggle) {
    const pid = stockToggle.getAttribute('data-toggle-stock');
    const prod = state.products.find((p) => p.id === pid);
    if (prod) {
      prod.inStock = !prod.inStock;
      if (!prod.inStock && state.cart[pid]) {
        delete state.cart[pid];
      }
      persistState();
      render();
      showToast(
        prod.inStock ? `تم تفعيل "${prod.name}" كمتاح في الكتالوج ✓` : `تم تحويل "${prod.name}" إلى خلصان`,
        prod.inStock ? 'success' : 'warning'
      );
    }
    return;
  }

  const clearanceToggle = target.closest('[data-toggle-clearance]');
  if (clearanceToggle) {
    const pid = clearanceToggle.getAttribute('data-toggle-clearance');
    const prod = state.products.find((p) => p.id === pid);
    if (prod) {
      prod.isClearance = !prod.isClearance;
      if (prod.isClearance && !prod.originalCartonPrice) {
        prod.originalCartonPrice = Math.round(prod.cartonPrice * 1.1);
      }
      persistState();
      render();
      showToast(
        prod.isClearance
          ? `🔥 تم تثبيت "${prod.name}" بأعلى الكتالوج كـ "لقطة اليوم - كمية محدودة"`
          : `تم إلغاء وضع حرق السعر عن "${prod.name}"`,
        prod.isClearance ? 'warning' : 'info'
      );
    }
    return;
  }

  const orderToggle = target.closest('[data-toggle-order]');
  if (orderToggle) {
    const oid = orderToggle.getAttribute('data-toggle-order');
    state.expandedOrders[oid] = !state.expandedOrders[oid];
    render();
    return;
  }

  // Order Lifecycle Actions
  const orderActionBtn = target.closest('[data-order-action]');
  if (orderActionBtn) {
    const action = orderActionBtn.getAttribute('data-order-action');
    const oid = orderActionBtn.getAttribute('data-oid');
    const order = state.orders.find((o) => o.id === oid);
    if (!order) return;

    if (action === 'approve') {
      order.status = 'approved';
      persistState();
      render();
      showToast(`تم اعتماد أوردر #${order.number} (${order.shopName}) وإضافته لورقة تحميل العربية ✓`);
    } else if (action === 'reject') {
      order.status = 'rejected';
      persistState();
      render();
      showToast(`تم رفض وإلغاء أوردر #${order.number}`, 'warning');
    } else if (action === 'restore') {
      order.status = 'new';
      persistState();
      render();
      showToast(`تم استرجاع أوردر #${order.number} كطلب جديد بانتظار الاعتماد`, 'info');
    } else if (action === 'dispatch') {
      order.status = 'dispatched';
      persistState();
      render();
      showToast(`🚚 تم تحويل أوردر #${order.number} (${order.shopName}) إلى: خرج للتوصيل مع السواق`);
    } else if (action === 'open-settle') {
      openSettlementModal(order);
    }
    return;
  }
});

document.getElementById('app-main').addEventListener('input', (e) => {
  const priceInput = e.target.closest('[data-price-input]');
  if (priceInput) {
    const pid = priceInput.getAttribute('data-pid');
    const field = priceInput.getAttribute('data-price-input');
    const prod = state.products.find((p) => p.id === pid);
    if (!prod) return;

    if (!state.pendingPriceEdits[pid]) state.pendingPriceEdits[pid] = {};
    const rawVal = priceInput.value;

    if (field === 'carton') {
      state.pendingPriceEdits[pid].cartonPrice = rawVal;
      const num = parseFloat(rawVal);
      if (num > 0 && prod.unitsPerCarton) {
        const unitEl = document.getElementById(`live-unit-cost-${pid}`);
        if (unitEl) unitEl.textContent = `${formatMoney(+(num / prod.unitsPerCarton).toFixed(2))} ج`;
      }
    } else {
      state.pendingPriceEdits[pid].packetPrice = rawVal;
    }

    const edit = state.pendingPriceEdits[pid];
    const cartonUnchanged =
      edit.cartonPrice === undefined || String(edit.cartonPrice) === String(prod.cartonPrice);
    const packetUnchanged =
      edit.packetPrice === undefined ||
      String(edit.packetPrice) === String(prod.packetPrice == null ? '' : prod.packetPrice);

    if (cartonUnchanged && packetUnchanged) {
      delete state.pendingPriceEdits[pid];
      priceInput.classList.remove('border-amber-400', 'bg-amber-50/40');
      priceInput.classList.add('border-slate-200', 'bg-slate-50');
    } else {
      priceInput.classList.remove('border-slate-200', 'bg-slate-50');
      priceInput.classList.add('border-amber-400', 'bg-amber-50/40');
    }

    updateFloatingSaveBar();
  }
});

document.getElementById('app-main').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.closest('[data-price-input]')) {
    if (Object.keys(state.pendingPriceEdits).length > 0) {
      e.preventDefault();
      document.getElementById('btn-save-prices').click();
    }
  }
});

document.getElementById('app-main').addEventListener('change', (e) => {
  const check = e.target.closest('[data-picking-check]');
  if (check) {
    const key = check.getAttribute('data-picking-check');
    state.pickingChecked[key] = check.checked;
    persistState();
    render();
  }
});

document.getElementById('role-customer').addEventListener('click', () => {
  state.role = 'customer';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('role-merchant').addEventListener('click', () => {
  state.role = 'merchant';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('btn-reset-demo').addEventListener('click', openResetConfirmModal);

document.getElementById('btn-open-checkout').addEventListener('click', openCheckoutDrawer);

document.getElementById('btn-discard-prices').addEventListener('click', () => {
  state.pendingPriceEdits = {};
  render();
  showToast('تم إلغاء تعديلات الأسعار غير المحفوظة', 'info');
});

document.getElementById('btn-save-prices').addEventListener('click', () => {
  let updatedCount = 0;
  Object.entries(state.pendingPriceEdits).forEach(([pid, edit]) => {
    const prod = state.products.find((p) => p.id === pid);
    if (!prod) return;

    if (edit.cartonPrice !== undefined) {
      const val = parseFloat(edit.cartonPrice);
      if (val > 0) {
        if (prod.isClearance && val < prod.cartonPrice && !prod.originalCartonPrice) {
          prod.originalCartonPrice = prod.cartonPrice;
        }
        prod.cartonPrice = val;
        if (prod.unitsPerCarton > 0) {
          prod.unitCost = +(val / prod.unitsPerCarton).toFixed(2);
        }
        updatedCount += 1;
      }
    }
    if (edit.packetPrice !== undefined) {
      const raw = String(edit.packetPrice).trim();
      if (raw === '' || parseFloat(raw) <= 0) {
        prod.packetPrice = null;
      } else {
        prod.packetPrice = parseFloat(raw);
      }
      if (edit.cartonPrice === undefined) updatedCount += 1;
    }
  });

  state.pendingPriceEdits = {};
  persistState();
  render();
  showToast(`تم حفظ الأسعار وتحديث كتالوج العملاء لحظياً (${updatedCount} ${updatedCount === 1 ? 'صنف' : 'أصناف'}) ✓`);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const root = document.getElementById('modal-root');
    if (!root.classList.contains('hidden')) closeModal();
  }
});

// Boot
registerRender(render);
render();
