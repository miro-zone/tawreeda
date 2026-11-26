import { getInitialPersistedState } from './seed.js';
import {
  CUSTOMER_PROFILE_KEY,
  FREE_DELIVERY_THRESHOLD,
  MIN_ORDER_VALUE,
  STORAGE_KEY,
  WHATSAPP_NUMBER,
  persistState,
  requestRender,
  safeStorage,
  saveCustomerProfile,
  state,
} from './state.js';
import {
  buildWhatsAppMessage,
  escapeHtml,
  formatMoney,
  getAllBrands,
  getAllCategories,
  getCartSummary,
  getNowArabicTime,
  parseBonusRule,
  showToast,
} from './utils.js';

// =========================================================================
// MODALS & DRAWERS (Core, Checkout, Add Product & Reset)
// =========================================================================

export function closeModal() {
  const root = document.getElementById('modal-root');
  root.classList.add('hidden');
  root.innerHTML = '';
  document.body.style.overflow = '';
}

export function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div id="modal-backdrop" class="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
      ${html}
    </div>
  `;
  root.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });
}

export function openCheckoutDrawer() {
  const summary = getCartSummary();
  if (!summary.hasItems) return;

  if (summary.totalAmount < MIN_ORDER_VALUE) {
    const remaining = MIN_ORDER_VALUE - summary.totalAmount;
    showToast(`الحد الأدنى للطلب ${formatMoney(MIN_ORDER_VALUE)} ج — فاضلك ${formatMoney(remaining)} جنيه`, 'warning');
    return;
  }

  const profile = state.savedCustomerProfile;
  if (profile) {
    if (!state.checkoutDraft.shopName) state.checkoutDraft.shopName = profile.shopName || '';
    if (!state.checkoutDraft.address) state.checkoutDraft.address = profile.address || '';
    if (!state.checkoutDraft.phone) state.checkoutDraft.phone = profile.phone || '';
  }

  openModal(`
    <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
      <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <h2 class="text-lg font-black text-slate-900">مراجعة وإرسال الطلب</h2>
          <p class="text-xs font-semibold text-slate-500">فاتورة فورية عبر واتساب + إرسال مباشر للمكتب للاعتماد</p>
        </div>
        <button type="button" id="btn-close-modal" class="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600" aria-label="إغلاق">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="p-5 overflow-y-auto space-y-4">
        ${
          profile && profile.shopName
            ? `<div class="bg-sky-50 border border-sky-200 text-sky-900 rounded-xl px-3.5 py-2.5 text-xs font-extrabold flex items-center gap-2">
                <span>👋</span>
                <span>أهلاً بعودتك يا ${escapeHtml(profile.shopName)} — بياناتك محفوظة للطلب السريع</span>
              </div>`
            : ''
        }

        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-extrabold text-slate-700">الأصناف المطلوبة (${summary.lines.length})</span>
            <button type="button" id="btn-clear-cart" class="text-xs font-bold text-red-600 hover:underline">تفريغ السلة</button>
          </div>
          <div class="bg-slate-50 rounded-2xl border border-slate-200 divide-y divide-slate-200/80">
            ${summary.lines
              .map(
                (line) => `
                  <div class="p-3 flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">${escapeHtml(line.name)}</p>
                      <div class="mt-1 text-xs font-semibold text-slate-600 flex flex-wrap items-center gap-2">
                        ${line.cartons > 0 ? `<span class="bg-white border border-slate-200 px-2 py-0.5 rounded-md tabular-nums">${line.cartons} كرتونة × ${formatMoney(line.cartonPrice)} ج</span>` : ''}
                        ${line.packets > 0 ? `<span class="bg-white border border-slate-200 px-2 py-0.5 rounded-md tabular-nums">${line.packets} شرنك × ${formatMoney(line.packetPrice)} ج</span>` : ''}
                        ${line.bonusCartons > 0 ? `<span class="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-extrabold">🎁 +${line.bonusCartons} كرتونة هدية</span>` : ''}
                      </div>
                    </div>
                    <div class="text-left flex-shrink-0">
                      <div class="text-sm font-black text-slate-900 tabular-nums">${formatMoney(line.lineTotal)} ج</div>
                    </div>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>

        <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-1.5">
          <div class="flex items-center justify-between text-xs font-bold text-emerald-900">
            <span>إجمالي الكميات:</span>
            <span class="tabular-nums">
              ${summary.totalCartons > 0 ? `${summary.totalCartons} كرتونة` : ''}
              ${summary.totalCartons > 0 && summary.totalPackets > 0 ? ' + ' : ''}
              ${summary.totalPackets > 0 ? `${summary.totalPackets} شرنك` : ''}
              ${summary.totalBonusCartons > 0 ? ` (+${summary.totalBonusCartons} هدية 🎁)` : ''}
            </span>
          </div>
          <div class="flex items-center justify-between text-xs font-bold text-emerald-900">
            <span>التوصيل:</span>
            <span>${summary.totalAmount >= FREE_DELIVERY_THRESHOLD ? 'مجاني لباب المحل ✓' : `مجاني فوق ${formatMoney(FREE_DELIVERY_THRESHOLD)} ج`}</span>
          </div>
          <div class="pt-2 border-t border-emerald-200 flex items-center justify-between">
            <span class="text-sm font-black text-emerald-950">الإجمالي المطلوب:</span>
            <span class="text-xl font-black text-emerald-700 tabular-nums">${formatMoney(summary.totalAmount)} جنيه</span>
          </div>
        </div>

        <form id="checkout-form" class="space-y-3.5" novalidate>
          <div>
            <label for="input-shop-name" class="block text-xs font-extrabold text-slate-800 mb-1.5">
              اسم السوبر ماركت / المحل <span class="text-red-500">*</span>
            </label>
            <input
              id="input-shop-name"
              type="text"
              required
              value="${escapeHtml(state.checkoutDraft.shopName)}"
              placeholder="مثلاً: سوبر ماركت النور - أولاد علي"
              class="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-bold text-slate-900"
            />
          </div>

          <div>
            <label for="input-shop-address" class="block text-xs font-extrabold text-slate-800 mb-1.5">
              العنوان / المنطقة <span class="text-red-500">*</span>
            </label>
            <input
              id="input-shop-address"
              type="text"
              required
              value="${escapeHtml(state.checkoutDraft.address)}"
              placeholder="مثلاً: شارع الهرم - محطة الطالبية بجوار صيدلية..."
              class="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-bold text-slate-900"
            />
          </div>

          <div>
            <label for="input-shop-phone" class="block text-xs font-bold text-slate-700 mb-1.5">
              رقم الموبايل للتواصل (اختياري)
            </label>
            <input
              id="input-shop-phone"
              type="tel"
              inputmode="tel"
              value="${escapeHtml(state.checkoutDraft.phone)}"
              placeholder="010xxxxxxxx"
              class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-sm font-bold text-slate-900 tabular-nums"
            />
          </div>

          <div>
            <span class="block text-xs font-extrabold text-slate-800 mb-1.5">طريقة الدفع</span>
            <div class="grid grid-cols-2 gap-2.5">
              <label class="cursor-pointer">
                <input type="radio" name="paymentMethod" value="كاش عند الاستلام" class="peer sr-only" ${
                  state.checkoutDraft.paymentMethod === 'كاش عند الاستلام' ? 'checked' : ''
                } />
                <div class="min-h-[62px] p-3 rounded-xl border-2 border-slate-200 peer-checked:border-emerald-600 peer-checked:bg-emerald-50 text-center transition-all flex flex-col justify-center">
                  <span class="text-xs sm:text-sm font-extrabold text-slate-900">💵 كاش عند الاستلام</span>
                  <span class="text-[10px] font-semibold text-slate-500 mt-0.5">نقدي للسواق</span>
                </div>
              </label>
              <label class="cursor-pointer">
                <input type="radio" name="paymentMethod" value="آجل (على الحساب)" class="peer sr-only" ${
                  state.checkoutDraft.paymentMethod === 'آجل (على الحساب)' ? 'checked' : ''
                } />
                <div class="min-h-[62px] p-3 rounded-xl border-2 border-slate-200 peer-checked:border-amber-500 peer-checked:bg-amber-50 text-center transition-all flex flex-col justify-center">
                  <span class="text-xs sm:text-sm font-extrabold text-slate-900">📒 آجل (على الحساب)</span>
                  <span class="text-[10px] font-bold text-amber-800 mt-0.5 leading-tight">للعملاء المعتمدين لدى المكتب فقط</span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label for="input-shop-notes" class="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات إضافية (اختياري)</label>
            <input
              id="input-shop-notes"
              type="text"
              value="${escapeHtml(state.checkoutDraft.notes)}"
              placeholder="مثلاً: التسليم بعد الظهر أو الاتصال قبل الوصول"
              class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-sm font-semibold text-slate-900"
            />
          </div>

          <div id="checkout-error" class="hidden bg-red-50 border border-red-200 text-red-700 text-xs font-extrabold rounded-xl px-3.5 py-2.5"></div>

          <button
            type="submit"
            class="w-full min-h-[52px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-base shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z"/></svg>
            <span>تأكيد وإرسال الفاتورة عبر واتساب</span>
          </button>
        </form>
      </div>
    </div>
  `);

  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-clear-cart').addEventListener('click', () => {
    state.cart = {};
    closeModal();
    requestRender();
    showToast('تم تفريغ السلة', 'info');
  });

  document.getElementById('checkout-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const shopName = document.getElementById('input-shop-name').value.trim();
    const address = document.getElementById('input-shop-address').value.trim();
    const phone = document.getElementById('input-shop-phone').value.trim();
    const notes = document.getElementById('input-shop-notes').value.trim();
    const paymentInput = document.querySelector('input[name="paymentMethod"]:checked');
    const paymentMethod = paymentInput ? paymentInput.value : 'كاش عند الاستلام';

    state.checkoutDraft = { shopName, address, phone, paymentMethod, notes };

    const errEl = document.getElementById('checkout-error');
    if (!shopName || !address) {
      errEl.textContent = 'برجاء إدخال اسم السوبر ماركت والعنوان / المنطقة أولاً لإرسال الطلب.';
      errEl.classList.remove('hidden');
      return;
    }

    const currentSummary = getCartSummary();
    if (!currentSummary.hasItems) {
      closeModal();
      return;
    }
    if (currentSummary.totalAmount < MIN_ORDER_VALUE) {
      errEl.textContent = `الحد الأدنى للطلب ${formatMoney(MIN_ORDER_VALUE)} جنيه.`;
      errEl.classList.remove('hidden');
      return;
    }

    // Save repeat customer profile automatically
    const nextProfile = { shopName, address, phone };
    state.savedCustomerProfile = nextProfile;
    saveCustomerProfile(nextProfile);

    const newOrder = {
      id: `ORD-${state.nextOrderNumber}`,
      number: state.nextOrderNumber,
      createdAt: getNowArabicTime(),
      shopName,
      address,
      phone,
      paymentMethod,
      notes,
      status: 'new', // Lands in approval gate first
      actualCashCollected: null,
      remainingCredit: null,
      settledAt: null,
      totalAmount: currentSummary.totalAmount,
      totalCartons: currentSummary.totalCartons,
      totalPackets: currentSummary.totalPackets,
      totalBonusCartons: currentSummary.totalBonusCartons,
      items: currentSummary.lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        cartons: l.cartons,
        packets: l.packets,
        cartonPrice: l.cartonPrice,
        packetPrice: l.packetPrice,
        bonusCartons: l.bonusCartons,
        lineTotal: l.lineTotal,
      })),
    };

    state.orders.unshift(newOrder);
    state.nextOrderNumber += 1;
    state.cart = {};
    state.checkoutDraft.notes = '';
    persistState();
    requestRender();

    const waText = buildWhatsAppMessage(newOrder);
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;

    try {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (_) {}

    openOrderSuccessModal(newOrder, waText, waUrl);
    showToast(`تم تسجيل الأوردر #${newOrder.number} في بوابة اعتماد التاجر!`, 'success');
  });
}

export function openOrderSuccessModal(order, waText, waUrl) {
  openModal(`
    <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
      <div class="bg-emerald-600 text-white p-5 text-center">
        <div class="w-12 h-12 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-2">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="2.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        </div>
        <h2 class="text-xl font-black">تم إرسال طلبك رقم #${order.number}</h2>
        <p class="text-xs font-semibold text-emerald-100 mt-1">الطلب وصل للوحة التاجر كـ "طلب جديد" وبانتظار الاعتماد والتحويل للمخزن</p>
      </div>

      <div class="p-5 overflow-y-auto space-y-4">
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-extrabold text-slate-700">معاينة رسالة فاتورة واتساب:</span>
            <button type="button" id="btn-copy-invoice" class="text-xs font-extrabold text-emerald-700 hover:underline">نسخ النص</button>
          </div>
          <pre class="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-sans whitespace-pre-wrap text-slate-800 leading-relaxed max-h-56 overflow-y-auto">${escapeHtml(waText)}</pre>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <a
            href="${waUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>فتح واتساب الآن</span>
          </a>
          <button
            type="button"
            id="btn-go-merchant-orders"
            class="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>اعتماد في لوحة التاجر</span>
          </button>
        </div>

        <button type="button" id="btn-done-modal" class="w-full min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors">
          متابعة التسوق
        </button>
      </div>
    </div>
  `);

  document.getElementById('btn-copy-invoice').addEventListener('click', () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(waText).then(() => showToast('تم نسخ الفاتورة ✓'));
    } else {
      showToast('انسخ النص مباشرة من المعاينة', 'info');
    }
  });
  document.getElementById('btn-go-merchant-orders').addEventListener('click', () => {
    closeModal();
    state.role = 'merchant';
    state.merchantTab = 'orders';
    state.expandedOrders[order.id] = true;
    requestRender();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('btn-done-modal').addEventListener('click', closeModal);
}

export function openAddProductModal() {
  const categories = getAllCategories();
  const brands = getAllBrands();

  openModal(`
    <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
      <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <h2 class="text-lg font-black text-slate-900">إضافة صنف جديد للكتالوج</h2>
          <p class="text-xs font-semibold text-slate-500">هيظهر فوراً في واجهة العملاء بمجرد الحفظ</p>
        </div>
        <button type="button" id="btn-close-modal" class="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600" aria-label="إغلاق">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <form id="add-product-form" class="p-5 overflow-y-auto space-y-3.5" novalidate>
        <div>
          <label for="new-prod-name" class="block text-xs font-extrabold text-slate-800 mb-1">اسم الصنف والعبوة <span class="text-red-500">*</span></label>
          <input id="new-prod-name" type="text" required placeholder="مثلاً: بسكويت أهلاوي شوكولاتة (24 باكو)" class="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-sm font-bold" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="new-prod-cat" class="block text-xs font-extrabold text-slate-800 mb-1">القسم</label>
            <select id="new-prod-cat" class="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-sm font-bold bg-white">
              ${categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="new-prod-brand" class="block text-xs font-extrabold text-slate-800 mb-1">الشركة المورّدة <span class="text-red-500">*</span></label>
            <input id="new-prod-brand" type="text" list="brands-datalist" required placeholder="اختر أو اكتب شركة..." class="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-sm font-bold" />
            <datalist id="brands-datalist">
              ${brands.map((b) => `<option value="${escapeHtml(b)}"></option>`).join('')}
            </datalist>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="new-prod-carton" class="block text-xs font-extrabold text-slate-800 mb-1">سعر الكرتونة (ج) <span class="text-red-500">*</span></label>
            <input id="new-prod-carton" type="number" inputmode="decimal" min="1" step="any" required placeholder="مثلاً: 240" class="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-sm font-black tabular-nums" />
          </div>
          <div>
            <label for="new-prod-packet" class="block text-xs font-extrabold text-slate-800 mb-1">سعر الشرنك / الباكت (اختياري)</label>
            <input id="new-prod-packet" type="number" inputmode="decimal" min="0" step="any" placeholder="اتركه فارغاً للكرتونة فقط" class="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-sm font-black tabular-nums" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="new-prod-unitcost" class="block text-xs font-extrabold text-slate-800 mb-1">تكلفة القطعة (ج) <span class="text-red-500">*</span></label>
            <input id="new-prod-unitcost" type="number" inputmode="decimal" min="0.25" step="any" required placeholder="مثلاً: 10" class="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-sm font-black tabular-nums" />
          </div>
          <div>
            <label for="new-prod-promo" class="block text-xs font-extrabold text-slate-800 mb-1">نص العرض / البونص (اختياري)</label>
            <input id="new-prod-promo" type="text" placeholder="مثلاً: عرض 10+1" class="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-sm font-bold" />
          </div>
        </div>

        <div id="add-prod-error" class="hidden bg-red-50 border border-red-200 text-red-700 text-xs font-extrabold rounded-xl px-3.5 py-2.5"></div>

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" class="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-sm transition-colors">
            حفظ وإضافة للكتالوج
          </button>
          <button type="button" id="btn-cancel-add" class="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  `);

  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-add').addEventListener('click', closeModal);

  document.getElementById('add-product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-prod-name').value.trim();
    const category = document.getElementById('new-prod-cat').value;
    const brand = document.getElementById('new-prod-brand').value.trim() || 'توريد عام';
    const cartonPrice = parseFloat(document.getElementById('new-prod-carton').value);
    const packetRaw = document.getElementById('new-prod-packet').value.trim();
    const packetPrice = packetRaw ? parseFloat(packetRaw) : null;
    const unitCost = parseFloat(document.getElementById('new-prod-unitcost').value);
    const promoText = document.getElementById('new-prod-promo').value.trim();

    const errEl = document.getElementById('add-prod-error');
    if (!name || !(cartonPrice > 0) || !(unitCost > 0)) {
      errEl.textContent = 'برجاء إدخال اسم الصنف وسعر الكرتونة وتكلفة القطعة بشكل صحيح.';
      errEl.classList.remove('hidden');
      return;
    }

    const unitsPerCarton = Math.max(1, Math.round(cartonPrice / unitCost));
    const unitsPerPacket = packetPrice && packetPrice > 0 ? Math.max(1, Math.round(unitsPerCarton / 2)) : null;
    const { bonusBuy, bonusFree } = parseBonusRule(promoText);

    const newItem = {
      id: 'p-' + Date.now(),
      name,
      category,
      brand,
      cartonPrice,
      originalCartonPrice: null,
      packetPrice: packetPrice && packetPrice > 0 ? packetPrice : null,
      unitsPerCarton,
      unitsPerPacket,
      unitCost,
      unitLabel: 'قطعة',
      promoText,
      bonusBuy,
      bonusFree,
      inStock: true,
      isClearance: false,
    };

    state.products.unshift(newItem);
    persistState();
    closeModal();
    requestRender();
    showToast(`تمت إضافة "${name}" (${brand}) للكتالوج بنجاح ✓`);
  });
}

export function openResetConfirmModal() {
  openModal(`
    <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 animate-slide-up">
      <div class="text-center">
        <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center mb-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </div>
        <h2 class="text-lg font-black text-slate-900">إعادة ضبط البيانات التجريبية؟</h2>
        <p class="text-xs font-semibold text-slate-600 mt-1.5 leading-relaxed">
          سيتم استرجاع جميع الأسعار وحالات المخزون والأوردرات التجريبية وبيانات العميل المحفوظة لحالتها الافتراضية.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2.5 mt-5">
        <button type="button" id="btn-confirm-reset" class="min-h-[46px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm transition-colors">
          نعم، إعادة ضبط
        </button>
        <button type="button" id="btn-cancel-reset" class="min-h-[46px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors">
          إلغاء
        </button>
      </div>
    </div>
  `);

  document.getElementById('btn-cancel-reset').addEventListener('click', closeModal);
  document.getElementById('btn-confirm-reset').addEventListener('click', () => {
    safeStorage.remove(STORAGE_KEY);
    safeStorage.remove(CUSTOMER_PROFILE_KEY);
    const fresh = getInitialPersistedState();
    state.products = fresh.products;
    state.orders = fresh.orders;
    state.nextOrderNumber = fresh.nextOrderNumber;
    state.pickingChecked = {};
    state.cart = {};
    state.pendingPriceEdits = {};
    state.searchQuery = '';
    state.merchantSearchQuery = '';
    state.activeCategory = 'الكل';
    state.expandedOrders = {};
    state.savedCustomerProfile = null;
    state.checkoutDraft = {
      shopName: '',
      address: '',
      phone: '',
      paymentMethod: 'كاش عند الاستلام',
      notes: '',
    };
    persistState();
    closeModal();
    requestRender();
    showToast('تمت إعادة ضبط البيانات التجريبية بنجاح ✓');
  });
}
