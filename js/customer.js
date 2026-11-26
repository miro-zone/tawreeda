import { FREE_DELIVERY_THRESHOLD, MIN_ORDER_VALUE, STORE_NAME, requestRender, state } from './state.js';
import {
  calcBonusCartons,
  calcUnitCostForMode,
  escapeHtml,
  formatMoney,
  getAllCategories,
  getCartSummary,
  showToast,
} from './utils.js';

// =========================================================================
// VIEW 1: CUSTOMER STOREFRONT & CART BAR
// =========================================================================

export function updateStickyCartBar() {
  const bar = document.getElementById('sticky-cart-bar');
  const summary = getCartSummary();

  if (state.role !== 'customer' || !summary.hasItems) {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  document.getElementById('cart-bar-total').textContent = `${formatMoney(summary.totalAmount)} ج`;

  const parts = [];
  if (summary.totalCartons > 0) parts.push(`<span>${summary.totalCartons} كرتونة</span>`);
  if (summary.totalPackets > 0) parts.push(`<span>${summary.totalPackets} شرنك</span>`);
  if (summary.totalBonusCartons > 0) {
    parts.push(
      `<span class="inline-flex items-center gap-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">🎁 +${summary.totalBonusCartons} كرتونة هدية</span>`
    );
  }
  document.getElementById('cart-bar-summary').innerHTML = parts.join('<span class="text-slate-600">•</span>');

  const deliveryEl = document.getElementById('cart-delivery-progress');
  const checkoutBtn = document.getElementById('btn-open-checkout');
  const checkoutLabel = document.getElementById('btn-open-checkout-label');

  if (summary.totalAmount < MIN_ORDER_VALUE) {
    const remainingMin = MIN_ORDER_VALUE - summary.totalAmount;
    const pctMin = Math.min(100, Math.round((summary.totalAmount / MIN_ORDER_VALUE) * 100));
    deliveryEl.innerHTML = `
      <div class="flex items-center justify-between text-[11px] font-bold text-amber-300 mb-1 gap-2">
        <span>⚠️ فاضلك <strong class="tabular-nums">${formatMoney(remainingMin)} جنيه</strong> للوصول للحد الأدنى للطلب (${formatMoney(MIN_ORDER_VALUE)} ج)</span>
        <span class="tabular-nums flex-shrink-0">${pctMin}%</span>
      </div>
      <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div class="h-full bg-red-400 rounded-full transition-all duration-300" style="width: ${pctMin}%"></div>
      </div>
    `;
    checkoutBtn.className =
      'min-h-[48px] px-4 sm:px-5 py-2.5 rounded-xl bg-slate-700 text-slate-300 border border-slate-600 font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all flex-shrink-0 cursor-not-allowed';
    checkoutLabel.textContent = `الحد الأدنى ${formatMoney(MIN_ORDER_VALUE)} ج`;
  } else if (summary.totalAmount < FREE_DELIVERY_THRESHOLD) {
    const remainingFree = FREE_DELIVERY_THRESHOLD - summary.totalAmount;
    const pctFree = Math.min(100, Math.round((summary.totalAmount / FREE_DELIVERY_THRESHOLD) * 100));
    deliveryEl.innerHTML = `
      <div class="flex items-center justify-between text-[11px] font-bold text-emerald-300 mb-1 gap-2">
        <span>وصلت للحد الأدنى ✓ — فاضلك <strong class="text-amber-300 tabular-nums">${formatMoney(remainingFree)} جنيه</strong> وتاخد توصيل مجاني</span>
        <span class="tabular-nums flex-shrink-0">${pctFree}%</span>
      </div>
      <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div class="h-full bg-amber-400 rounded-full transition-all duration-300" style="width: ${pctFree}%"></div>
      </div>
    `;
    checkoutBtn.className =
      'min-h-[48px] px-4 sm:px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all flex-shrink-0';
    checkoutLabel.textContent = 'مراجعة وإرسال الطلب';
  } else {
    deliveryEl.innerHTML = `
      <div class="flex items-center justify-between text-[11px] font-bold text-emerald-300 mb-1">
        <span>🚚 مبروك! طلبك مؤهل للتوصيل المجاني لباب المحل</span>
        <span>100%</span>
      </div>
      <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div class="h-full bg-emerald-400 rounded-full transition-all duration-300" style="width: 100%"></div>
      </div>
    `;
    checkoutBtn.className =
      'min-h-[48px] px-4 sm:px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all flex-shrink-0';
    checkoutLabel.textContent = 'مراجعة وإرسال الطلب';
  }
}

export function getFilteredCustomerProducts() {
  const q = state.searchQuery.trim().toLowerCase();
  const filtered = state.products.filter((p) => {
    if (state.activeCategory === 'عروض') {
      if (!p.isClearance && !p.promoText) return false;
    } else if (state.activeCategory !== 'الكل') {
      if (p.category !== state.activeCategory) return false;
    }
    if (q) {
      const hay = `${p.name} ${p.category} ${p.brand || ''} ${p.promoText || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    const score = (item) => {
      if (!item.inStock) return 3;
      if (item.isClearance) return 0;
      if (item.promoText) return 1;
      return 2;
    };
    return score(a) - score(b);
  });
}

export function renderCustomerView() {
  const dealsCount = state.products.filter((p) => p.inStock && (p.isClearance || p.promoText)).length;
  const products = getFilteredCustomerProducts();
  const allCategories = getAllCategories();

  const categoryPills = [
    { id: 'الكل', label: 'الكل' },
    { id: 'عروض', label: `🔥 عروض وحرق أسعار (${dealsCount})`, isSpecial: true },
    ...allCategories.map((c) => ({ id: c, label: c })),
  ];

  return `
    <section class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-3.5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h1 class="text-base sm:text-xl font-black text-slate-900 leading-snug">
            ${escapeHtml(STORE_NAME)}
          </h1>
          <div class="mt-2 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold">
            <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
            <span>الأسعار محدثة لحظياً - الحد الأدنى 1,000 ج والتوصيل مجاني فوق 3,000 ج</span>
          </div>
        </div>
        <div class="hidden sm:flex flex-col items-end text-left flex-shrink-0">
          <span class="text-xs font-bold text-slate-500">الأصناف المتاحة</span>
          <span class="text-lg font-black text-emerald-600 tabular-nums">${state.products.filter((p) => p.inStock).length} / ${state.products.length}</span>
        </div>
      </div>

      <div class="relative mt-3.5">
        <div class="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <input
          id="customer-search-input"
          type="search"
          value="${escapeHtml(state.searchQuery)}"
          placeholder="ابحث باسم الصنف أو الشركة... مثلاً: شيبسي، بيبسيكو، إندومي"
          class="w-full min-h-[48px] pr-11 pl-10 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400 transition-all"
        />
        <button id="btn-clear-search" type="button" class="${
          state.searchQuery ? '' : 'hidden '
        }absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 hover:text-slate-700" aria-label="مسح البحث">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pt-3 pb-0.5 -mx-1 px-1">
        ${categoryPills
          .map((pill) => {
            const isActive = state.activeCategory === pill.id;
            let cls = '';
            if (pill.isSpecial) {
              cls = isActive
                ? 'bg-gradient-to-l from-red-600 to-orange-500 text-white border-transparent shadow-sm'
                : 'bg-orange-50 text-red-700 border-orange-300 hover:bg-orange-100';
            } else {
              cls = isActive
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
            }
            return `
              <button
                type="button"
                data-category="${escapeHtml(pill.id)}"
                class="category-pill min-h-[40px] px-3.5 py-1.5 rounded-full border text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${cls}"
              >${escapeHtml(pill.label)}</button>
            `;
          })
          .join('')}
      </div>
    </section>

    <section id="customer-products-list" class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      ${
        products.length === 0
          ? `<div class="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <p class="text-base font-bold text-slate-700">مفيش أصناف مطابقة للبحث ده</p>
              <p class="text-xs text-slate-500 mt-1">جرب تكتب اسم تاني أو اختار قسم "الكل"</p>
              <button id="btn-reset-filters" type="button" class="mt-4 min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">عرض كل الأصناف</button>
            </div>`
          : products.map(renderCustomerProductCard).join('')
      }
    </section>
  `;
}

export function renderCustomerProductCard(p) {
  const hasPacket = p.packetPrice != null && p.packetPrice > 0;
  const selectedMode =
    hasPacket && state.selectedUnitByProduct[p.id] === 'packet' ? 'packet' : 'carton';
  const cartEntry = state.cart[p.id] || { cartons: 0, packets: 0 };
  const activeQty = selectedMode === 'carton' ? cartEntry.cartons : cartEntry.packets;
  const currentPrice = selectedMode === 'carton' ? p.cartonPrice : p.packetPrice;
  const unitCost = calcUnitCostForMode(p, selectedMode);
  const earnedBonus = p.inStock ? calcBonusCartons(p, cartEntry.cartons) : 0;
  const toNextBonus =
    p.inStock && p.bonusBuy > 0 && cartEntry.cartons > 0
      ? p.bonusBuy - (cartEntry.cartons % p.bonusBuy)
      : 0;

  const savings =
    p.isClearance && p.originalCartonPrice && p.originalCartonPrice > p.cartonPrice
      ? p.originalCartonPrice - p.cartonPrice
      : 0;

  const safePromoText =
    p.promoText && !p.promoText.includes('صلاحية') ? p.promoText : '';

  const cardBorder = !p.inStock
    ? 'border-slate-200 opacity-75'
    : p.isClearance
    ? 'border-orange-300 shadow-md shadow-orange-100/70'
    : cartEntry.cartons > 0 || cartEntry.packets > 0
    ? 'border-emerald-400 shadow-sm'
    : 'border-slate-200 shadow-sm';

  return `
    <article class="bg-white rounded-2xl border ${cardBorder} overflow-hidden flex flex-col justify-between transition-all" data-product-card="${p.id}">
      ${
        p.isClearance && p.inStock
          ? `<div class="bg-gradient-to-l from-red-600 to-orange-500 text-white px-3.5 py-2 flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 text-xs font-extrabold">
                <span>🔥</span>
                <span>لقطة اليوم / عرض تصفية - كمية محدودة</span>
              </div>
              ${
                savings > 0
                  ? `<span class="text-[11px] font-black bg-white text-red-700 px-2 py-0.5 rounded-full tabular-nums flex-shrink-0">وفر ${formatMoney(savings)} ج</span>`
                  : `<span class="text-[11px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full flex-shrink-0">عرض خاص</span>`
              }
            </div>`
          : ''
      }

      ${
        !p.inStock
          ? `<div class="bg-slate-200 text-slate-700 px-3.5 py-2 flex items-center justify-between gap-2">
              <span class="text-xs font-extrabold flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-slate-500"></span>
                خلصان حالاً - بيتوفر بكرة
              </span>
              <span class="text-[11px] font-bold text-slate-500">غير متاح للطلب</span>
            </div>`
          : ''
      }

      <div class="p-3.5 sm:p-4 flex-1 flex flex-col">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span class="inline-block text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">${escapeHtml(p.category)}</span>
              ${
                p.brand
                  ? `<span class="inline-block text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-md">${escapeHtml(p.brand)}</span>`
                  : ''
              }
            </div>
            <h2 class="text-base font-extrabold text-slate-900 leading-snug">${escapeHtml(p.name)}</h2>
          </div>
          ${
            p.inStock && (cartEntry.cartons > 0 || cartEntry.packets > 0)
              ? `<div class="flex flex-col items-end gap-1 flex-shrink-0">
                  ${
                    cartEntry.cartons > 0
                      ? `<span class="text-[11px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg tabular-nums">${cartEntry.cartons} كرتونة</span>`
                      : ''
                  }
                  ${
                    cartEntry.packets > 0
                      ? `<span class="text-[11px] font-extrabold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-lg tabular-nums">${cartEntry.packets} شرنك</span>`
                      : ''
                  }
                </div>`
              : ''
          }
        </div>

        ${
          safePromoText && !p.isClearance && p.inStock
            ? `<div class="mt-2.5 flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1.5 rounded-xl text-xs font-extrabold">
                <span>🎁</span>
                <span>${escapeHtml(safePromoText)}</span>
              </div>`
            : ''
        }

        <div class="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            data-select-unit="carton"
            data-pid="${p.id}"
            ${!p.inStock ? 'disabled' : ''}
            class="min-h-[54px] px-2.5 py-2 rounded-xl border-2 text-right transition-all flex flex-col justify-center ${
              selectedMode === 'carton'
                ? 'border-emerald-600 bg-emerald-50/70'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            } ${!p.inStock ? 'cursor-not-allowed' : 'cursor-pointer'}"
          >
            <div class="flex items-center justify-between w-full">
              <span class="text-xs font-bold ${selectedMode === 'carton' ? 'text-emerald-900' : 'text-slate-600'}">الكرتونة</span>
              ${
                p.isClearance && p.originalCartonPrice && p.originalCartonPrice > p.cartonPrice
                  ? `<span class="text-[11px] text-slate-400 line-through tabular-nums">${formatMoney(p.originalCartonPrice)} ج</span>`
                  : ''
              }
            </div>
            <div class="text-base font-black tabular-nums ${selectedMode === 'carton' ? 'text-emerald-700' : 'text-slate-900'}">
              ${formatMoney(p.cartonPrice)} <span class="text-xs font-bold">ج</span>
            </div>
          </button>

          ${
            hasPacket
              ? `<button
                  type="button"
                  data-select-unit="packet"
                  data-pid="${p.id}"
                  ${!p.inStock ? 'disabled' : ''}
                  class="min-h-[54px] px-2.5 py-2 rounded-xl border-2 text-right transition-all flex flex-col justify-center ${
                    selectedMode === 'packet'
                      ? 'border-emerald-600 bg-emerald-50/70'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  } ${!p.inStock ? 'cursor-not-allowed' : 'cursor-pointer'}"
                >
                  <span class="text-xs font-bold ${selectedMode === 'packet' ? 'text-emerald-900' : 'text-slate-600'}">الشرنك / الباكت</span>
                  <div class="text-base font-black tabular-nums ${selectedMode === 'packet' ? 'text-emerald-700' : 'text-slate-900'}">
                    ${formatMoney(p.packetPrice)} <span class="text-xs font-bold">ج</span>
                  </div>
                </button>`
              : `<div class="min-h-[54px] px-2.5 py-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col justify-center items-center text-center">
                  <span class="text-[11px] font-bold text-slate-400">يباع بالكرتونة فقط</span>
                  <span class="text-[10px] text-slate-400">غير متاح شرنك</span>
                </div>`
          }
        </div>

        <div class="mt-2.5 flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
          <span class="text-xs font-bold text-slate-600">تقف عليك بـ</span>
          <span class="text-sm font-black text-slate-900 tabular-nums">
            ${formatMoney(unitCost)} جنيه <span class="text-xs font-semibold text-slate-500">/ لل${escapeHtml(p.unitLabel || 'قطعة')}</span>
          </span>
        </div>

        ${
          earnedBonus > 0
            ? `<div class="mt-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold flex items-center justify-between">
                <span>🎉 كسبت +${earnedBonus} كرتونة هدية مجاناً!</span>
                ${toNextBonus > 0 && toNextBonus <= 3 ? `<span class="text-[11px] font-bold text-emerald-700">باقي ${toNextBonus} لهدية تانية</span>` : ''}
              </div>`
            : toNextBonus > 0 && toNextBonus < p.bonusBuy
            ? `<div class="mt-2 px-3 py-1.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-800 text-[11px] font-bold flex items-center justify-between">
                <span>فاضلك ${toNextBonus} كرتونة وتاخد ${p.bonusFree} كرتونة هدية 🎁</span>
                <button type="button" data-quick-add="${toNextBonus}" data-pid="${p.id}" data-unit="carton" class="underline font-extrabold text-amber-900 mr-2">كمّل العرض</button>
              </div>`
            : ''
        }

        <div class="mt-auto pt-3">
          ${
            !p.inStock
              ? `<button type="button" disabled class="w-full min-h-[46px] rounded-xl bg-slate-200 text-slate-500 font-extrabold text-sm cursor-not-allowed">
                  خلصان حالاً - غير متاح للطلب
                </button>`
              : activeQty === 0
              ? `<div class="flex items-center gap-2">
                  <button
                    type="button"
                    data-qty-delta="1"
                    data-pid="${p.id}"
                    data-unit="${selectedMode}"
                    class="flex-1 min-h-[46px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-sm shadow-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                    <span>أضف ${selectedMode === 'carton' ? 'كرتونة' : 'شرنك'} (${formatMoney(currentPrice)} ج)</span>
                  </button>
                  ${
                    selectedMode === 'carton' && p.bonusBuy > 0
                      ? `<button
                          type="button"
                          data-quick-add="${p.bonusBuy}"
                          data-pid="${p.id}"
                          data-unit="carton"
                          title="إضافة ${p.bonusBuy} كراتين للاستفادة من العرض"
                          class="min-h-[46px] px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-extrabold text-xs whitespace-nowrap transition-colors"
                        >+${p.bonusBuy} للعرض</button>`
                      : ''
                  }
                </div>`
              : `<div class="flex items-center justify-between gap-2 bg-slate-50 p-1 rounded-xl border border-emerald-300">
                  <button
                    type="button"
                    data-qty-delta="1"
                    data-pid="${p.id}"
                    data-unit="${selectedMode}"
                    aria-label="زيادة الكمية"
                    class="w-12 h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xl flex items-center justify-center transition-all"
                  >+</button>
                  <div class="text-center flex-1">
                    <div class="text-base font-black text-slate-900 tabular-nums leading-tight">${activeQty} <span class="text-xs font-bold text-slate-600">${selectedMode === 'carton' ? 'كرتونة' : 'شرنك'}</span></div>
                    <div class="text-[11px] font-bold text-emerald-700 tabular-nums">${formatMoney(activeQty * currentPrice)} ج</div>
                  </div>
                  <button
                    type="button"
                    data-qty-delta="-1"
                    data-pid="${p.id}"
                    data-unit="${selectedMode}"
                    aria-label="تقليل الكمية"
                    class="w-12 h-[44px] rounded-lg bg-white hover:bg-red-50 active:scale-95 text-slate-800 hover:text-red-600 border border-slate-300 font-black text-xl flex items-center justify-center transition-all"
                  >−</button>
                </div>`
          }
        </div>
      </div>
    </article>
  `;
}

export function adjustCart(pid, unit, delta) {
  const prod = state.products.find((p) => p.id === pid);
  if (!prod || !prod.inStock) return;

  if (!state.cart[pid]) state.cart[pid] = { cartons: 0, packets: 0 };
  const field = unit === 'packet' ? 'packets' : 'cartons';
  const prevBonus = calcBonusCartons(prod, state.cart[pid].cartons);

  state.cart[pid][field] = Math.max(0, (state.cart[pid][field] || 0) + delta);
  if (state.cart[pid].cartons === 0 && state.cart[pid].packets === 0) {
    delete state.cart[pid];
  } else {
    const newBonus = calcBonusCartons(prod, state.cart[pid].cartons);
    if (newBonus > prevBonus) {
      showToast(`🎁 مبروك! كسبت +${newBonus} كرتونة هدية على ${prod.name.split('(')[0].trim()}`, 'success');
    }
  }

  requestRender();
}
