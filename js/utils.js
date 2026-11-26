import { BASE_CATEGORIES, FREE_DELIVERY_THRESHOLD, STORE_NAME, state } from './state.js';

// =========================================================================
// HELPERS, FORMATTING, TOAST & MESSAGE BUILDERS
// =========================================================================

export function formatMoney(num) {
  const n = Number(num) || 0;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeArabicDigits(str) {
  return String(str == null ? '' : str)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

export function cleanNumericValue(str) {
  const cleaned = normalizeArabicDigits(str).replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

export function normalizeNameKey(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getAllCategories() {
  const set = new Set(BASE_CATEGORIES);
  state.products.forEach((p) => {
    if (p.category && p.category.trim()) set.add(p.category.trim());
  });
  return Array.from(set);
}

export function getAllBrands() {
  const set = new Set();
  state.products.forEach((p) => {
    if (p.brand && p.brand.trim()) set.add(p.brand.trim());
  });
  return Array.from(set);
}

export function parseBonusRule(promoText) {
  if (!promoText) return { bonusBuy: 0, bonusFree: 0 };
  const normalized = normalizeArabicDigits(promoText);
  const match = normalized.match(/(\d+)\s*\+\s*(\d+)/);
  if (match) {
    return {
      bonusBuy: parseInt(match[1], 10) || 0,
      bonusFree: parseInt(match[2], 10) || 0,
    };
  }
  return { bonusBuy: 0, bonusFree: 0 };
}

export function calcBonusCartons(product, cartonsQty) {
  if (!product.bonusBuy || !product.bonusFree || cartonsQty < product.bonusBuy) return 0;
  return Math.floor(cartonsQty / product.bonusBuy) * product.bonusFree;
}

export function calcUnitCostForMode(product, mode) {
  if (mode === 'packet' && product.packetPrice != null) {
    if (product.unitsPerPacket && product.unitsPerPacket > 0) {
      return +(product.packetPrice / product.unitsPerPacket).toFixed(2);
    }
    if (product.unitsPerCarton && product.unitsPerCarton > 0) {
      return +(product.packetPrice / (product.unitsPerCarton / 2)).toFixed(2);
    }
  }
  if (product.unitsPerCarton && product.unitsPerCarton > 0) {
    return +(product.cartonPrice / product.unitsPerCarton).toFixed(2);
  }
  return Number(product.unitCost) || 0;
}

export function getNowArabicTime() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const period = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
}

export function getCartSummary() {
  let totalAmount = 0;
  let totalCartons = 0;
  let totalPackets = 0;
  let totalBonusCartons = 0;
  const lines = [];

  state.products.forEach((p) => {
    const entry = state.cart[p.id];
    if (!entry || !p.inStock) return;
    const cartons = entry.cartons || 0;
    const packets = p.packetPrice != null ? (entry.packets || 0) : 0;
    if (cartons <= 0 && packets <= 0) return;

    const bonusCartons = calcBonusCartons(p, cartons);
    const lineTotal = cartons * p.cartonPrice + packets * (p.packetPrice || 0);
    totalAmount += lineTotal;
    totalCartons += cartons;
    totalPackets += packets;
    totalBonusCartons += bonusCartons;

    lines.push({
      productId: p.id,
      name: p.name,
      cartons,
      packets,
      cartonPrice: p.cartonPrice,
      packetPrice: p.packetPrice,
      bonusCartons,
      lineTotal,
      product: p,
    });
  });

  return {
    lines,
    totalAmount,
    totalCartons,
    totalPackets,
    totalBonusCartons,
    hasItems: lines.length > 0,
  };
}

export function showToast(message, type = 'success', options = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  if (options.replaceId) {
    const existing = document.getElementById(options.replaceId);
    if (existing) existing.remove();
  }

  const styles = {
    success: 'bg-slate-900 text-white border-emerald-500/60',
    warning: 'bg-amber-950 text-amber-100 border-amber-500/60',
    info: 'bg-slate-800 text-white border-slate-600',
  };
  const icon =
    type === 'warning'
      ? `<svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>`
      : `<svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

  const el = document.createElement('div');
  if (options.replaceId) el.id = options.replaceId;
  el.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-xl text-xs sm:text-sm font-bold animate-fade-in max-w-md ${styles[type] || styles.success}`;
  el.innerHTML = `${icon}<span class="leading-snug">${escapeHtml(message)}</span>`;

  if (options.actionLabel && typeof options.onAction === 'function') {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className =
      'mr-1 px-3 py-1.5 min-h-[34px] rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black whitespace-nowrap transition-colors flex-shrink-0';
    actionBtn.textContent = options.actionLabel;
    actionBtn.addEventListener('click', () => {
      options.onAction();
      el.remove();
    });
    el.appendChild(actionBtn);
  }

  container.appendChild(el);

  const duration = options.duration || 2800;
  const timerId = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s ease';
    setTimeout(() => el.remove(), 220);
  }, duration);

  return { element: el, timerId };
}

export function buildWhatsAppMessage(order) {
  const lines = [
    `📦 *طلب توريد جديد - توريدة*`,
    `🏪 *اسم المحل:* ${order.shopName}`,
    `📍 *العنوان:* ${order.address}`,
  ];
  if (order.phone) lines.push(`📞 *الموبايل:* ${order.phone}`);
  lines.push(`💳 *طريقة الدفع:* ${order.paymentMethod}`);
  lines.push(`🧾 *رقم الفاتورة:* #${order.number}`);
  lines.push(`━━━━━━━━━━━━━━`);
  lines.push(`*الأصناف المطلوبة:*`);

  order.items.forEach((item, idx) => {
    lines.push(`${idx + 1}. *${item.name}*`);
    if (item.cartons > 0) {
      lines.push(`   • ${item.cartons} كرتونة × ${formatMoney(item.cartonPrice)} ج = ${formatMoney(item.cartons * item.cartonPrice)} ج`);
    }
    if (item.packets > 0 && item.packetPrice != null) {
      lines.push(`   • ${item.packets} شرنك × ${formatMoney(item.packetPrice)} ج = ${formatMoney(item.packets * item.packetPrice)} ج`);
    }
    if (item.bonusCartons > 0) {
      lines.push(`   🎁 *بونص هدية: +${item.bonusCartons} كرتونة مجاناً*`);
    }
  });

  lines.push(`━━━━━━━━━━━━━━`);
  const qtyParts = [];
  if (order.totalCartons > 0) qtyParts.push(`${order.totalCartons} كرتونة`);
  if (order.totalPackets > 0) qtyParts.push(`${order.totalPackets} شرنك`);
  if (order.totalBonusCartons > 0) qtyParts.push(`+${order.totalBonusCartons} كرتونة هدية 🎁`);
  lines.push(`📊 *إجمالي الكمية:* ${qtyParts.join(' • ')}`);
  lines.push(`💰 *الإجمالي المطلوب:* ${formatMoney(order.totalAmount)} جنيه`);
  if (order.totalAmount >= FREE_DELIVERY_THRESHOLD) {
    lines.push(`🚚 *التوصيل:* مجاني ✓`);
  } else {
    lines.push(`🚚 *التوصيل:* يحدد حسب المنطقة (التوصيل مجاني فوق ${formatMoney(FREE_DELIVERY_THRESHOLD)} ج)`);
  }
  if (order.notes) {
    lines.push(`📝 *ملاحظات:* ${order.notes}`);
  }
  lines.push(`━━━━━━━━━━━━━━`);
  lines.push(STORE_NAME);
  return lines.join('\n');
}

export function buildPickingListText(aggregatedItems) {
  const lines = [
    `🚛 *ورقة تحميل العربية للمخزن - توريدة*`,
    `📋 *النطاق:* الأوردرات المعتمدة قيد التحميل`,
    `━━━━━━━━━━━━━━`,
  ];
  aggregatedItems.forEach((item, i) => {
    const parts = [];
    if (item.cartons > 0) parts.push(`${item.cartons} كرتونة`);
    if (item.packets > 0) parts.push(`${item.packets} شرنك`);
    if (item.bonusCartons > 0) parts.push(`+${item.bonusCartons} كرتونة هدية`);
    lines.push(`${i + 1}. ${item.name} ⬅️ *${parts.join(' + ')}*`);
  });
  lines.push(`━━━━━━━━━━━━━━`);
  lines.push(STORE_NAME);
  return lines.join('\n');
}
