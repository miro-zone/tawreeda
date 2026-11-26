// =========================================================================
// TAWREEDA DEMO LINK GENERATOR (share.html)
// Standalone lightweight ES module — zero coupling to main demo state.
// =========================================================================

const HISTORY_KEY = 'tawreeda_share_history_v1';
const TEMPLATE_KEY = 'tawreeda_share_template_v1';
const MAX_HISTORY_ITEMS = 15;

const DEFAULT_TEMPLATE = [
  'أهلاً بحضرتك يا أستاذنا 🤝',
  'جهّزت لحضرتك نسخة تجريبية سريعة من نظام *توريدة* مخصوص باسم *{name}* عشان تشوف بنفسك إزاي السوبر ماركت يطلب منك أونلاين وتتابع الأسعار وتحميل العربيات من الموبايل 👇',
  '',
  '{link}',
  '',
  'جربها في دقيقة واحدة من غير تسجيل، وقولي رأي حضرتك فيها إيه 🌷',
].join('\n');

// =========================================================================
// SAFE STORAGE & HELPERS
// =========================================================================

const memoryStorage = {};
const safeStorage = {
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

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeWhatsAppNumber(raw) {
  let digits = String(raw == null ? '' : raw)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[^\d]/g, '');

  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^2001[0125]\d{8}$/.test(digits)) return `20${digits.slice(3)}`;
  if (/^01[0125]\d{8}$/.test(digits)) return `2${digits}`;
  if (/^1[0125]\d{8}$/.test(digits)) return `20${digits}`;
  return digits;
}

function getBaseDemoUrl() {
  const url = new URL('./', window.location.href);
  url.search = '';
  url.hash = '';
  return url.href;
}

function buildDemoLink(storeName, normalizedWa) {
  const base = getBaseDemoUrl();
  const params = [];
  const trimmedName = String(storeName || '').trim();
  if (trimmedName) {
    params.push(`name=${encodeURIComponent(trimmedName)}`);
  }
  if (normalizedWa) {
    params.push(`wa=${encodeURIComponent(normalizedWa)}`);
  }
  return params.length > 0 ? `${base}?${params.join('&')}` : base;
}

function buildShareMessage(template, storeName, demoLink) {
  const displayName = String(storeName || '').trim() || 'مكتبك';
  const rawTemplate = template && template.trim() ? template : DEFAULT_TEMPLATE;
  let result = rawTemplate
    .replace(/\{name\}/g, displayName)
    .replace(/\{link\}/g, demoLink);

  if (!rawTemplate.includes('{link}')) {
    result = `${result.trim()}\n\n${demoLink}`;
  }
  return result;
}

function buildWhatsAppUrl(normalizedWa, message) {
  const encodedText = encodeURIComponent(message);
  if (normalizedWa) {
    return `https://wa.me/${normalizedWa}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // Fallback below
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch (_) {
    return false;
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const styles = {
    success: 'bg-slate-900 text-white border-emerald-500/60',
    warning: 'bg-amber-950 text-amber-100 border-amber-500/60',
    info: 'bg-slate-800 text-white border-slate-600',
  };
  const icon =
    type === 'warning'
      ? '<svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>'
      : '<svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

  const el = document.createElement('div');
  el.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-xl text-xs sm:text-sm font-bold animate-fade-in max-w-md ${styles[type] || styles.success}`;
  el.innerHTML = `${icon}<span class="leading-snug">${escapeHtml(message)}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s ease';
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

// =========================================================================
// HISTORY & TEMPLATE PERSISTENCE
// =========================================================================

function loadHistory() {
  const raw = safeStorage.get(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveHistory(items) {
  safeStorage.set(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
}

function loadTemplate() {
  return safeStorage.get(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
}

function saveTemplate(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed === DEFAULT_TEMPLATE) {
    safeStorage.remove(TEMPLATE_KEY);
  } else {
    safeStorage.set(TEMPLATE_KEY, text);
  }
}

function formatArabicDate(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  } catch (_) {
    return '';
  }
}

// =========================================================================
// DOM REFERENCES & STATE
// =========================================================================

const inputStoreName = document.getElementById('input-store-name');
const inputWhatsapp = document.getElementById('input-whatsapp');
const phoneStatus = document.getElementById('phone-status');
const linkModeBadge = document.getElementById('link-mode-badge');
const generatedLinkBox = document.getElementById('generated-link-box');
const btnSendWhatsapp = document.getElementById('btn-send-whatsapp');
const btnSendWhatsappLabel = document.getElementById('btn-send-whatsapp-label');
const btnCopyLink = document.getElementById('btn-copy-link');
const btnCopyMessage = document.getElementById('btn-copy-message');
const linkPreviewDemo = document.getElementById('link-preview-demo');
const btnClearForm = document.getElementById('btn-clear-form');

const messagePreview = document.getElementById('message-preview');
const btnToggleTemplate = document.getElementById('btn-toggle-template');
const templateEditorWrap = document.getElementById('template-editor-wrap');
const inputTemplate = document.getElementById('input-template');
const btnResetTemplate = document.getElementById('btn-reset-template');

const historyCount = document.getElementById('history-count');
const btnClearHistory = document.getElementById('btn-clear-history');
const historyList = document.getElementById('history-list');

let historyItems = loadHistory();
let currentTemplate = loadTemplate();

function getFormValues() {
  const storeName = (inputStoreName.value || '').trim();
  const rawPhone = (inputWhatsapp.value || '').trim();
  const normalizedWa = normalizeWhatsAppNumber(rawPhone);
  const demoLink = buildDemoLink(storeName, normalizedWa);
  const message = buildShareMessage(currentTemplate, storeName, demoLink);
  const waUrl = buildWhatsAppUrl(normalizedWa, message);
  return { storeName, rawPhone, normalizedWa, demoLink, message, waUrl };
}

function recordCurrentInHistory() {
  const { storeName, rawPhone, normalizedWa } = getFormValues();
  if (!storeName && !normalizedWa) return;

  const dedupeKey = `${storeName.toLowerCase()}__${normalizedWa}`;
  const filtered = historyItems.filter(
    (item) => `${(item.storeName || '').toLowerCase()}__${item.normalizedWa || ''}` !== dedupeKey
  );

  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    storeName,
    rawPhone,
    normalizedWa,
    createdAt: new Date().toISOString(),
  };

  historyItems = [entry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
  saveHistory(historyItems);
  renderHistory();
}

// =========================================================================
// RENDERING
// =========================================================================

function updatePreview() {
  const { storeName, rawPhone, normalizedWa, demoLink, message, waUrl } = getFormValues();

  // Phone status helper
  if (!rawPhone) {
    phoneStatus.className = 'mt-1.5 text-xs font-semibold text-slate-500 min-h-[18px]';
    phoneStatus.textContent = 'اكتب الرقم بأي صيغة (010... أو ٠١٠... أو +20) وهيتظبط تلقائي.';
  } else if (normalizedWa.length < 10) {
    phoneStatus.className = 'mt-1.5 text-xs font-bold text-amber-600 min-h-[18px]';
    phoneStatus.textContent = `الرقم يبدو غير مكتمل (${normalizedWa || 'بدون أرقام'}) — تأكد من عدد الأرقام.`;
  } else {
    phoneStatus.className = 'mt-1.5 text-xs font-bold text-emerald-700 min-h-[18px]';
    phoneStatus.innerHTML = `✓ الصيغة الدولية الجاهزة لواتساب: <span dir="ltr" class="inline-block font-mono tabular-nums">+${escapeHtml(normalizedWa)}</span>`;
  }

  // Customized badge
  if (storeName || normalizedWa) {
    linkModeBadge.textContent = 'رابط مخصّص ✓';
    linkModeBadge.className = 'text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
  } else {
    linkModeBadge.textContent = 'الرابط الافتراضي';
    linkModeBadge.className = 'text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600';
  }

  // Link & CTAs
  generatedLinkBox.textContent = demoLink;
  linkPreviewDemo.href = demoLink;
  btnSendWhatsapp.href = waUrl;
  btnSendWhatsappLabel.textContent =
    normalizedWa.length >= 10
      ? 'إرسال مباشر على واتساب التاجر'
      : 'مشاركة الرسالة عبر واتساب';

  // Message preview
  messagePreview.textContent = message;
}

function renderHistory() {
  historyCount.textContent = String(historyItems.length);
  btnClearHistory.classList.toggle('hidden', historyItems.length === 0);

  if (historyItems.length === 0) {
    historyList.innerHTML = `
      <div class="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center">
        <p class="text-xs sm:text-sm font-bold text-slate-500">لسه مفيش روابط محفوظة</p>
        <p class="text-[11px] text-slate-400 mt-1">أول ما تنسخ أو تبعت رابط لتاجر هيظهر هنا عشان ترجعله بضغطة زر.</p>
      </div>
    `;
    return;
  }

  historyList.innerHTML = historyItems
    .map((item) => {
      const link = buildDemoLink(item.storeName, item.normalizedWa);
      const msg = buildShareMessage(currentTemplate, item.storeName, link);
      const waHref = buildWhatsAppUrl(item.normalizedWa, msg);
      const title = item.storeName || 'تاجر بدون اسم';
      const dateText = formatArabicDate(item.createdAt);

      return `
        <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-extrabold text-slate-900 truncate">${escapeHtml(title)}</p>
              ${dateText ? `<span class="text-[11px] font-semibold text-slate-400">${escapeHtml(dateText)}</span>` : ''}
            </div>
            ${
              item.normalizedWa
                ? `<p dir="ltr" class="text-xs font-mono font-bold text-slate-600 text-right tabular-nums mt-0.5">+${escapeHtml(item.normalizedWa)}</p>`
                : `<p class="text-[11px] text-slate-400 mt-0.5">بدون رقم واتساب</p>`
            }
          </div>

          <div class="flex items-center gap-1.5 flex-shrink-0">
            <a
              href="${escapeHtml(waHref)}"
              target="_blank"
              rel="noopener noreferrer"
              class="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1 transition-colors"
              title="فتح واتساب"
            >
              <span>واتساب</span>
            </a>
            <button
              type="button"
              data-history-action="copy"
              data-history-id="${escapeHtml(item.id)}"
              class="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
            >نسخ</button>
            <button
              type="button"
              data-history-action="edit"
              data-history-id="${escapeHtml(item.id)}"
              class="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-colors"
            >تعديل</button>
            <button
              type="button"
              data-history-action="delete"
              data-history-id="${escapeHtml(item.id)}"
              class="min-h-[36px] px-2 py-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
              title="حذف من السجل"
              aria-label="حذف من السجل"
            >✕</button>
          </div>
        </div>
      `;
    })
    .join('');
}

// =========================================================================
// EVENT WIRING
// =========================================================================

inputStoreName.addEventListener('input', updatePreview);
inputWhatsapp.addEventListener('input', updatePreview);

btnClearForm.addEventListener('click', () => {
  inputStoreName.value = '';
  inputWhatsapp.value = '';
  updatePreview();
  inputStoreName.focus();
});

btnSendWhatsapp.addEventListener('click', () => {
  recordCurrentInHistory();
});

btnCopyLink.addEventListener('click', async () => {
  const { demoLink } = getFormValues();
  const ok = await copyTextToClipboard(demoLink);
  recordCurrentInHistory();
  showToast(ok ? 'تم نسخ رابط الديمو بنجاح ✓' : 'تعذر النسخ تلقائياً — انسخ الرابط يدوياً من المربع', ok ? 'success' : 'warning');
});

btnCopyMessage.addEventListener('click', async () => {
  const { message } = getFormValues();
  const ok = await copyTextToClipboard(message);
  recordCurrentInHistory();
  showToast(ok ? 'تم نسخ رسالة واتساب كاملة بالرابط ✓' : 'تعذر النسخ تلقائياً', ok ? 'success' : 'warning');
});

btnToggleTemplate.addEventListener('click', () => {
  const isHidden = templateEditorWrap.classList.toggle('hidden');
  btnToggleTemplate.textContent = isHidden ? 'تعديل صيغة الرسالة' : 'إخفاء التعديل';
  if (!isHidden) {
    inputTemplate.focus();
  }
});

inputTemplate.value = currentTemplate;
inputTemplate.addEventListener('input', () => {
  currentTemplate = inputTemplate.value;
  saveTemplate(currentTemplate);
  updatePreview();
  renderHistory();
});

btnResetTemplate.addEventListener('click', () => {
  currentTemplate = DEFAULT_TEMPLATE;
  inputTemplate.value = DEFAULT_TEMPLATE;
  saveTemplate(DEFAULT_TEMPLATE);
  updatePreview();
  renderHistory();
  showToast('تمت استعادة صيغة الرسالة الافتراضية', 'info');
});

btnClearHistory.addEventListener('click', () => {
  historyItems = [];
  safeStorage.remove(HISTORY_KEY);
  renderHistory();
  showToast('تم مسح سجل الروابط', 'info');
});

historyList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-history-action]');
  if (!btn) return;
  const action = btn.dataset.historyAction;
  const id = btn.dataset.historyId;
  const item = historyItems.find((h) => h.id === id);
  if (!item) return;

  if (action === 'copy') {
    const link = buildDemoLink(item.storeName, item.normalizedWa);
    const ok = await copyTextToClipboard(link);
    showToast(ok ? `تم نسخ رابط "${item.storeName || 'التاجر'}" ✓` : 'تعذر النسخ تلقائياً', ok ? 'success' : 'warning');
    return;
  }

  if (action === 'edit') {
    inputStoreName.value = item.storeName || '';
    inputWhatsapp.value = item.rawPhone || item.normalizedWa || '';
    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    inputStoreName.focus();
    showToast('تم تحميل بيانات التاجر للتعديل', 'info');
    return;
  }

  if (action === 'delete') {
    historyItems = historyItems.filter((h) => h.id !== id);
    saveHistory(historyItems);
    renderHistory();
  }
});

// Pre-fill from query params if someone opens share.html?name=...&wa=...
const initialParams = new URLSearchParams(window.location.search);
if (initialParams.get('name')) inputStoreName.value = initialParams.get('name');
if (initialParams.get('wa')) inputWhatsapp.value = initialParams.get('wa');

// Initial render
updatePreview();
renderHistory();
