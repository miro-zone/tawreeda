import { WHATSAPP_NUMBER, persistState, requestRender, state } from './state.js';
import {
  buildWhatsAppMessage,
  escapeHtml,
  formatMoney,
  getNowArabicTime,
  normalizeArabicDigits,
  showToast,
} from './utils.js';
import { closeModal, openModal } from './modals.js';

// =========================================================================
// MERCHANT ORDERS TAB, PICKING LIST & DRIVER SETTLEMENT
// =========================================================================

export function getAggregatedPickingList(orders) {
  const map = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const key = item.productId || item.name;
      if (!map[key]) {
        map[key] = {
          key,
          name: item.name,
          cartons: 0,
          packets: 0,
          bonusCartons: 0,
          orderCount: 0,
        };
      }
      map[key].cartons += item.cartons || 0;
      map[key].packets += item.packets || 0;
      map[key].bonusCartons += item.bonusCartons || 0;
      map[key].orderCount += 1;
    });
  });
  return Object.values(map).sort((a, b) => b.cartons + b.bonusCartons - (a.cartons + a.bonusCartons));
}

export function renderMerchantOrdersTab() {
  const activeOrders = state.orders.filter((o) => o.status !== 'rejected');
  const newOrders = activeOrders.filter((o) => o.status === 'new');
  const approvedOrders = activeOrders.filter((o) => o.status === 'approved');
  const dispatchedOrders = activeOrders.filter((o) => o.status === 'dispatched');
  const settledOrders = activeOrders.filter((o) => o.status === 'settled');
  const outOrSettledCount = dispatchedOrders.length + settledOrders.length;

  const totalSales = activeOrders.reduce((s, o) => s + o.totalAmount, 0);
  const confirmedSales = activeOrders
    .filter((o) => o.status !== 'new')
    .reduce((s, o) => s + o.totalAmount, 0);

  // Driver Cash & Remaining Credit KPIs
  const actualCashCollected = settledOrders.reduce((s, o) => s + (Number(o.actualCashCollected) || 0), 0);
  const settledRemainingCredit = settledOrders.reduce((s, o) => s + (Number(o.remainingCredit) || 0), 0);
  const pendingCreditOrdersTotal = activeOrders
    .filter((o) => o.status !== 'settled' && !o.paymentMethod.includes('كاش'))
    .reduce((s, o) => s + o.totalAmount, 0);
  const totalRemainingCredit = settledRemainingCredit + pendingCreditOrdersTotal;
  const cashShareBase = actualCashCollected + totalRemainingCredit;
  const cashBarPct = cashShareBase > 0 ? Math.round((actualCashCollected / cashShareBase) * 100) : 0;

  // ONLY approved orders populate the Warehouse Truck Loading / Picking List!
  const aggregated = getAggregatedPickingList(approvedOrders);
  const totalLoadCartons = aggregated.reduce((s, i) => s + i.cartons, 0);
  const totalLoadBonus = aggregated.reduce((s, i) => s + i.bonusCartons, 0);
  const totalLoadPackets = aggregated.reduce((s, i) => s + i.packets, 0);
  const checkedCount = aggregated.filter((i) => state.pickingChecked[i.key]).length;

  return `
    <!-- Updated KPI Cards -->
    <section class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 no-print">
      <!-- KPI 1: Orders Lifecycle Breakdown -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500">حالة أوردرات اليوم</span>
          <span class="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"/></svg>
          </span>
        </div>
        <div class="text-2xl font-black text-slate-900 mt-1 tabular-nums">${activeOrders.length} <span class="text-sm font-bold text-slate-500">أوردر نشط</span></div>
        <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
          <span class="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md tabular-nums">${newOrders.length} جديد بانتظار الاعتماد</span>
          <span class="bg-sky-100 text-sky-900 px-2 py-0.5 rounded-md tabular-nums">${approvedOrders.length} قيد التحميل</span>
          <span class="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md tabular-nums">${outOrSettledCount} خرج للتوصيل أو مقفل</span>
        </div>
      </div>

      <!-- KPI 2: Total Sales Value -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500">إجمالي المبيعات</span>
          <span class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
          </span>
        </div>
        <div class="text-2xl font-black text-emerald-700 mt-1 tabular-nums">${formatMoney(totalSales)} <span class="text-sm font-bold">جنيه</span></div>
        <p class="text-[11px] font-bold text-slate-600 mt-2 tabular-nums">معتمد ومؤكد: ${formatMoney(confirmedSales)} ج</p>
        <p class="text-[11px] font-semibold text-slate-400 tabular-nums">متوسط الأوردر: ${activeOrders.length > 0 ? formatMoney(Math.round(totalSales / activeOrders.length)) : 0} ج</p>
      </div>

      <!-- KPI 3: Driver Cash Custody & Remaining Credit -->
      <div class="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm p-4">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-extrabold text-slate-800">💰 عهدة السواق والتحصيل</span>
          <span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full tabular-nums">${settledOrders.length} مقفل</span>
        </div>
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-extrabold">
            <span class="text-emerald-700">💵 كاش في جيب السواق:</span>
            <span class="text-emerald-800 font-black tabular-nums">${formatMoney(actualCashCollected)} ج</span>
          </div>
          <div class="flex items-center justify-between text-xs font-extrabold">
            <span class="text-amber-700">📒 الآجل المتبقي عند العملاء:</span>
            <span class="text-amber-900 font-black tabular-nums">${formatMoney(totalRemainingCredit)} ج</span>
          </div>
          <div class="w-full h-2 bg-amber-200 rounded-full overflow-hidden flex mt-1">
            <div class="h-full bg-emerald-500 transition-all" style="width: ${cashBarPct}%"></div>
          </div>
          <p class="text-[10px] font-semibold text-slate-500">
            ${dispatchedOrders.length > 0 ? `بانتظار تقفيل ${dispatchedOrders.length} أوردر مع السواق حالياً` : 'يتم تحديث العهدة فور تقفيل حساب كل أوردر'}
          </p>
        </div>
      </div>
    </section>

    <!-- Aggregated Warehouse Truck Loading Sheet (Approved Orders ONLY) -->
    <section id="print-area" class="bg-white rounded-2xl border-2 border-slate-900 shadow-sm overflow-hidden mb-4">
      <div class="bg-slate-900 text-white p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base sm:text-lg font-black flex items-center gap-2">
              <span>🚛</span>
              <span>ورقة تحميل العربية للمخزن</span>
            </h2>
            <p class="text-xs text-slate-300 mt-0.5">تظهر هنا الأوردرات <strong class="text-emerald-300">المعتمدة فقط</strong> (لا تدخل الأوردرات الجديدة قبل موافقتك)</p>
          </div>
          <div class="flex items-center gap-1.5 no-print">
            <button
              id="btn-copy-picking"
              type="button"
              class="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition-colors"
            >
              <span>نسخ للمخزن</span>
            </button>
            <button
              id="btn-print-picking"
              type="button"
              class="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition-colors"
            >طباعة</button>
          </div>
        </div>

        <div class="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-bold text-sky-300 bg-sky-500/15 border border-sky-400/30 px-2.5 py-1 rounded-lg tabular-nums">
            أوردرات معتمدة قيد التحميل: ${approvedOrders.length}
          </span>

          <div class="flex items-center gap-2 text-xs font-extrabold flex-wrap">
            <span class="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg tabular-nums">📦 ${totalLoadCartons} كرتونة</span>
            ${totalLoadBonus > 0 ? `<span class="bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-1 rounded-lg tabular-nums">🎁 +${totalLoadBonus} هدية</span>` : ''}
            ${totalLoadPackets > 0 ? `<span class="bg-sky-400/20 text-sky-300 border border-sky-400/30 px-2.5 py-1 rounded-lg tabular-nums">🛍️ ${totalLoadPackets} شرنك</span>` : ''}
          </div>
        </div>
      </div>

      <div class="p-3.5 sm:p-4">
        ${
          aggregated.length === 0
            ? `<div class="py-7 text-center">
                <p class="text-sm font-extrabold text-slate-700">لا توجد أوردرات معتمدة قيد التحميل حالياً</p>
                <p class="text-xs text-slate-500 mt-1">${
                  newOrders.length > 0
                    ? `يوجد ${newOrders.length} أوردر جديد بالأسفل — اضغط "اعتماد وتحويل للمخزن" لإضافته لورقة التحميل`
                    : 'تم تحميل وخروج جميع الأوردرات المعتمدة ✓'
                }</p>
              </div>`
            : `
              <div class="flex items-center justify-between text-xs font-bold text-slate-500 mb-2.5 no-print">
                <span>علّم على كل صنف بعد تحميله في العربية:</span>
                <span class="text-emerald-700 tabular-nums">تم تجهيز ${checkedCount} من ${aggregated.length}</span>
              </div>
              <ul class="divide-y divide-slate-100">
                ${aggregated
                  .map((item) => {
                    const isChecked = !!state.pickingChecked[item.key];
                    return `
                      <li class="py-3 first:pt-1 last:pb-1">
                        <label class="flex items-center justify-between gap-3 cursor-pointer select-none">
                          <div class="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              data-picking-check="${escapeHtml(item.key)}"
                              ${isChecked ? 'checked' : ''}
                              class="w-6 h-6 rounded-lg accent-emerald-600 cursor-pointer flex-shrink-0 no-print"
                            />
                            <div class="min-w-0">
                              <p class="text-sm font-extrabold ${isChecked ? 'line-through text-slate-400' : 'text-slate-900'} leading-snug">
                                ${escapeHtml(item.name)}
                              </p>
                              <p class="text-[11px] font-semibold text-slate-500 mt-0.5">مجمع من ${item.orderCount} ${item.orderCount === 1 ? 'أوردر معتمد' : 'أوردرات معتمدة'}</p>
                            </div>
                          </div>

                          <div class="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
                            ${item.cartons > 0 ? `<span class="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-black tabular-nums">${item.cartons} كرتونة</span>` : ''}
                            ${item.bonusCartons > 0 ? `<span class="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black tabular-nums">+${item.bonusCartons} هدية 🎁</span>` : ''}
                            ${item.packets > 0 ? `<span class="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 border border-sky-200 text-xs font-black tabular-nums">${item.packets} شرنك</span>` : ''}
                          </div>
                        </label>
                      </li>
                    `;
                  })
                  .join('')}
              </ul>
            `
        }
      </div>
    </section>

    <!-- Orders Feed with Approval Gate & Driver Settlement -->
    <section class="no-print">
      <div class="flex items-center justify-between mb-2.5 px-1">
        <h2 class="text-base font-black text-slate-900">إدارة أوردرات العملاء (${state.orders.length})</h2>
        <span class="text-xs font-bold text-slate-500">الأحدث أولاً</span>
      </div>

      ${
        state.orders.length === 0
          ? `<div class="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm font-bold text-slate-500">لا توجد أوردرات مستلمة اليوم بعد</div>`
          : `<div class="space-y-3">
              ${state.orders.map(renderOrderCard).join('')}
            </div>`
      }
    </section>
  `;
}

function renderOrderCard(order) {
  const isExpanded = !!state.expandedOrders[order.id];
  const isCash = order.paymentMethod.includes('كاش');

  const statusMeta = {
    new: {
      label: '🔔 طلب جديد - بانتظار التأكيد',
      badgeCls: 'bg-amber-100 text-amber-900 border border-amber-300',
      cardBorder: 'border-amber-300 ring-1 ring-amber-200/70',
    },
    approved: {
      label: '📦 معتمد - قيد التحميل',
      badgeCls: 'bg-sky-100 text-sky-900 border border-sky-200',
      cardBorder: 'border-sky-300',
    },
    dispatched: {
      label: '🚚 خرج للتوصيل مع السواق',
      badgeCls: 'bg-cyan-600 text-white',
      cardBorder: 'border-cyan-300',
    },
    settled: {
      label: '✅ تم التسليم والتقفيل',
      badgeCls: 'bg-emerald-600 text-white',
      cardBorder: 'border-emerald-300 bg-emerald-50/20',
    },
    rejected: {
      label: '✕ مرفوض / ملغي',
      badgeCls: 'bg-slate-200 text-slate-600',
      cardBorder: 'border-slate-200 opacity-65',
    },
  };

  const meta = statusMeta[order.status] || statusMeta.new;

  let primaryActionsHtml = '';
  if (order.status === 'new') {
    primaryActionsHtml = `
      <div class="px-3.5 sm:px-4 pb-3 flex items-center gap-2">
        <button
          type="button"
          data-order-action="approve"
          data-oid="${order.id}"
          class="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold shadow-sm transition-all"
        >✓ اعتماد وتحويل للمخزن</button>
        <button
          type="button"
          data-order-action="reject"
          data-oid="${order.id}"
          class="min-h-[44px] px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-extrabold transition-colors"
        >رفض / إلغاء</button>
      </div>
    `;
  } else if (order.status === 'approved') {
    primaryActionsHtml = `
      <div class="px-3.5 sm:px-4 pb-3 flex items-center gap-2">
        <button
          type="button"
          data-order-action="dispatch"
          data-oid="${order.id}"
          class="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold shadow-sm transition-all"
        >🚚 خرج للتوصيل مع السواق</button>
      </div>
    `;
  } else if (order.status === 'dispatched') {
    primaryActionsHtml = `
      <div class="px-3.5 sm:px-4 pb-3 flex items-center gap-2">
        <button
          type="button"
          data-order-action="open-settle"
          data-oid="${order.id}"
          class="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold shadow-sm transition-all"
        >💰 تسليم وتقفيل الحساب (عهدة السواق)</button>
      </div>
    `;
  } else if (order.status === 'settled') {
    primaryActionsHtml = `
      <div class="px-3.5 sm:px-4 pb-3">
        <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-emerald-800 tabular-nums">💵 كاش محصل: ${formatMoney(order.actualCashCollected || 0)} ج</span>
            <span class="text-slate-300">|</span>
            <span class="${(order.remainingCredit || 0) > 0 ? 'text-amber-800' : 'text-slate-500'} tabular-nums">📒 متبقي آجل: ${formatMoney(order.remainingCredit || 0)} ج</span>
          </div>
          <button
            type="button"
            data-order-action="open-settle"
            data-oid="${order.id}"
            class="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline"
          >تعديل التقفيل</button>
        </div>
      </div>
    `;
  } else if (order.status === 'rejected') {
    primaryActionsHtml = `
      <div class="px-3.5 sm:px-4 pb-3 flex items-center justify-end">
        <button
          type="button"
          data-order-action="restore"
          data-oid="${order.id}"
          class="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
        >↩️ استرجاع كطلب جديد</button>
      </div>
    `;
  }

  return `
    <article class="bg-white rounded-2xl border ${meta.cardBorder} shadow-sm overflow-hidden">
      <button
        type="button"
        data-toggle-order="${order.id}"
        class="w-full p-3.5 sm:p-4 text-right flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span class="text-xs font-black text-slate-500 tabular-nums">#${order.number}</span>
            <span class="text-xs font-bold text-slate-400">• ${escapeHtml(order.createdAt)}</span>
            <span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
              isCash ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
            }">${escapeHtml(order.paymentMethod)}</span>
            <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${meta.badgeCls}">${meta.label}</span>
          </div>
          <h3 class="text-sm sm:text-base font-black text-slate-900 truncate">${escapeHtml(order.shopName)}</h3>
          <p class="text-xs font-semibold text-slate-500 truncate mt-0.5">📍 ${escapeHtml(order.address)}</p>
        </div>

        <div class="flex items-center gap-2.5 flex-shrink-0">
          <div class="text-left">
            <div class="text-base sm:text-lg font-black text-slate-900 tabular-nums">${formatMoney(order.totalAmount)} <span class="text-xs font-bold">ج</span></div>
            <div class="text-[11px] font-bold text-slate-500 tabular-nums">
              ${order.items.length} أصناف
              ${order.totalBonusCartons > 0 ? `• +${order.totalBonusCartons} هدية` : ''}
            </div>
          </div>
          <svg class="w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      ${primaryActionsHtml}

      ${
        isExpanded
          ? `<div class="px-3.5 sm:px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/60 animate-fade-in">
              <div class="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 mb-3">
                ${order.items
                  .map(
                    (it) => `
                      <div class="p-2.5 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <div class="font-extrabold text-slate-900">${escapeHtml(it.name)}</div>
                          <div class="text-slate-600 font-semibold mt-0.5 flex items-center gap-2 flex-wrap">
                            ${it.cartons > 0 ? `<span>${it.cartons} كرتونة × ${formatMoney(it.cartonPrice)} ج</span>` : ''}
                            ${it.packets > 0 && it.packetPrice != null ? `<span>${it.packets} شرنك × ${formatMoney(it.packetPrice)} ج</span>` : ''}
                            ${it.bonusCartons > 0 ? `<span class="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-extrabold">🎁 +${it.bonusCartons} كرتونة هدية</span>` : ''}
                          </div>
                        </div>
                        <div class="font-black text-slate-900 tabular-nums flex-shrink-0">${formatMoney(it.lineTotal)} ج</div>
                      </div>
                    `
                  )
                  .join('')}
              </div>

              ${
                order.notes || order.phone
                  ? `<div class="mb-3 text-xs text-slate-600 space-y-1 bg-white rounded-xl p-2.5 border border-slate-200">
                      ${order.phone ? `<div>📞 <strong>موبايل العميل:</strong> <span class="tabular-nums">${escapeHtml(order.phone)}</span></div>` : ''}
                      ${order.notes ? `<div>📝 <strong>ملاحظات:</strong> ${escapeHtml(order.notes)}</div>` : ''}
                    </div>`
                  : ''
              }

              <div class="flex items-center justify-end">
                <a
                  href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(order))}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>إعادة فتح الفاتورة في واتساب</span>
                </a>
              </div>
            </div>`
          : ''
      }
    </article>
  `;
}

export function openSettlementModal(order) {
  const isCash = order.paymentMethod.includes('كاش');
  const defaultCash =
    order.actualCashCollected != null
      ? order.actualCashCollected
      : isCash
      ? order.totalAmount
      : 0;

  openModal(`
    <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
      <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <h2 class="text-lg font-black text-slate-900">💰 تسليم وتقفيل الحساب</h2>
          <p class="text-xs font-semibold text-slate-500">أوردر #${order.number} — ${escapeHtml(order.shopName)}</p>
        </div>
        <button type="button" id="btn-close-modal" class="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600" aria-label="إغلاق">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <form id="settlement-form" class="p-5 space-y-4" novalidate>
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs font-bold">
          <div>
            <span class="text-slate-500 block">إجمالي الفاتورة</span>
            <span class="text-lg font-black text-slate-900 tabular-nums">${formatMoney(order.totalAmount)} جنيه</span>
          </div>
          <span class="px-2.5 py-1 rounded-full ${isCash ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'} font-extrabold">
            ${escapeHtml(order.paymentMethod)}
          </span>
        </div>

        <div>
          <label for="input-actual-cash" class="block text-xs font-extrabold text-slate-800 mb-1.5">
            المبلغ الكاش المحصل فعلاً من العميل (ج)
          </label>
          <input
            id="input-actual-cash"
            type="number"
            inputmode="decimal"
            min="0"
            max="${order.totalAmount}"
            step="any"
            value="${defaultCash}"
            class="w-full min-h-[50px] px-4 py-2.5 rounded-xl border-2 border-emerald-400 focus:border-emerald-600 outline-none text-xl font-black text-slate-900 tabular-nums"
          />
          <div class="flex items-center gap-1.5 mt-2 flex-wrap">
            <button type="button" data-quick-cash="${order.totalAmount}" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold">كامل المبلغ (${formatMoney(order.totalAmount)} ج)</button>
            <button type="button" data-quick-cash="${Math.round(order.totalAmount / 2)}" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold">نصف المبلغ</button>
            <button type="button" data-quick-cash="0" class="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-extrabold">آجل بالكامل (0 ج)</button>
          </div>
        </div>

        <div class="bg-slate-900 text-white rounded-xl p-3.5 space-y-1.5 text-xs font-extrabold">
          <div class="flex items-center justify-between">
            <span class="text-emerald-300">💵 يُضاف لعهدة السواق (كاش):</span>
            <span id="settle-preview-cash" class="text-base font-black text-emerald-400 tabular-nums">${formatMoney(defaultCash)} ج</span>
          </div>
          <div class="flex items-center justify-between pt-1.5 border-t border-slate-700">
            <span class="text-amber-300">📒 يُرحّل كآجل على العميل:</span>
            <span id="settle-preview-credit" class="text-base font-black text-amber-300 tabular-nums">${formatMoney(Math.max(0, order.totalAmount - defaultCash))} ج</span>
          </div>
        </div>

        <div id="settle-error" class="hidden bg-red-50 border border-red-200 text-red-700 text-xs font-extrabold rounded-xl px-3 py-2"></div>

        <button type="submit" class="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md transition-colors">
          تأكيد التسليم وتقفيل الحساب ✓
        </button>
      </form>
    </div>
  `);

  const cashInput = document.getElementById('input-actual-cash');
  const previewCash = document.getElementById('settle-preview-cash');
  const previewCredit = document.getElementById('settle-preview-credit');

  function updateSettlementPreview() {
    const val = Math.max(0, parseFloat(cashInput.value) || 0);
    const capped = Math.min(val, order.totalAmount);
    const credit = Math.max(0, +(order.totalAmount - capped).toFixed(2));
    previewCash.textContent = `${formatMoney(capped)} ج`;
    previewCredit.textContent = `${formatMoney(credit)} ج`;
  }

  cashInput.addEventListener('input', updateSettlementPreview);
  document.querySelectorAll('[data-quick-cash]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cashInput.value = btn.getAttribute('data-quick-cash');
      updateSettlementPreview();
    });
  });

  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('settlement-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = parseFloat(normalizeArabicDigits(cashInput.value));
    const errEl = document.getElementById('settle-error');
    if (!Number.isFinite(val) || val < 0 || val > order.totalAmount) {
      errEl.textContent = `برجاء إدخال مبلغ بين 0 و ${formatMoney(order.totalAmount)} جنيه.`;
      errEl.classList.remove('hidden');
      return;
    }

    order.actualCashCollected = +val.toFixed(2);
    order.remainingCredit = +Math.max(0, order.totalAmount - order.actualCashCollected).toFixed(2);
    order.status = 'settled';
    order.settledAt = getNowArabicTime();
    persistState();
    closeModal();
    requestRender();
    showToast(
      `تم تقفيل أوردر #${order.number}: كاش ${formatMoney(order.actualCashCollected)} ج • آجل ${formatMoney(order.remainingCredit)} ج ✓`
    );
  });
}
