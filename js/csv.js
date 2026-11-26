import { persistState, requestRender, state } from './state.js';
import {
  cleanNumericValue,
  escapeHtml,
  formatMoney,
  normalizeNameKey,
  parseBonusRule,
  showToast,
} from './utils.js';
import { closeModal, openModal } from './modals.js';

// =========================================================================
// CSV EXPORT, TEMPLATE, SAFE PARSER & IMPORT MODAL
// =========================================================================

const CSV_HEADERS = ['اسم الصنف', 'الفئة', 'الشركة', 'سعر الكرتونة', 'سعر الشرنك', 'تكلفة القطعة', 'نص العرض'];

function csvEscapeField(val) {
  const s = String(val == null ? '' : val);
  if (/[",\r\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function triggerCsvDownload(filename, rows) {
  const csvLines = rows.map((row) => row.map(csvEscapeField).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csvLines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

export function downloadCsvTemplate() {
  const rows = [
    CSV_HEADERS,
    ['شيبسي عائلي أطعمة مشكلة (12 كيس)', 'شيبسي وسناكس', 'بيبسيكو', '170', '88', '14.17', 'عرض 10+1 (كرتونة هدية على كل 10 كراتين)'],
    ['بسكويت نواعم فانيليا (24 باكو)', 'بسكويت وويفر', 'بيسكو مصر', '144', '75', '6', ''],
  ];
  triggerCsvDownload('tawreeda_template.csv', rows);
  showToast('تم تحميل قالب CSV جاهز بترميز عربي صحيح (UTF-8) ✓');
}

export function exportCurrentCatalogCsv() {
  const rows = [
    CSV_HEADERS,
    ...state.products.map((p) => [
      p.name,
      p.category,
      p.brand || '',
      p.cartonPrice,
      p.packetPrice != null ? p.packetPrice : '',
      p.unitCost,
      p.promoText || '',
    ]),
  ];
  const dateTag = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(`tawreeda_catalog_${dateTag}.csv`, rows);
  showToast(`تم تصدير ${state.products.length} صنف إلى ملف إكسل (CSV) ✓`);
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export function parseUploadedCsv(rawText) {
  const text = String(rawText || '').replace(/^\uFEFF/, '');
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], skipped: 0, error: 'الملف فارغ ولا يحتوي على بيانات.' };
  }

  // Auto-detect comma vs semicolon delimiter from header/first line
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  let startIdx = 0;
  const firstCols = parseCsvLine(firstLine, delimiter);
  if (firstCols[0] && /اسم|صنف|name|product/i.test(firstCols[0])) {
    startIdx = 1;
  }

  const existingMap = new Map(state.products.map((p) => [normalizeNameKey(p.name), p]));
  const parsedRows = [];
  let skipped = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const name = (cols[0] || '').trim();
    const category = (cols[1] || '').trim() || 'معلبات ونواشف';
    const brand = (cols[2] || '').trim() || 'توريد عام';
    const cartonPrice = cleanNumericValue(cols[3]);
    const packetRaw = (cols[4] || '').trim();
    const packetNum = packetRaw ? cleanNumericValue(packetRaw) : NaN;
    const packetPrice = Number.isFinite(packetNum) && packetNum > 0 ? packetNum : null;
    const unitCostNum = cleanNumericValue(cols[5]);
    const promoText = (cols[6] || '').trim();

    if (!name || !Number.isFinite(cartonPrice) || cartonPrice <= 0) {
      skipped += 1;
      continue;
    }

    const existing = existingMap.get(normalizeNameKey(name));
    const computedUnitCost =
      Number.isFinite(unitCostNum) && unitCostNum > 0
        ? +unitCostNum.toFixed(2)
        : existing && existing.unitsPerCarton > 0
        ? +(cartonPrice / existing.unitsPerCarton).toFixed(2)
        : +(cartonPrice / 12).toFixed(2);

    parsedRows.push({
      action: existing ? 'update' : 'new',
      existingId: existing ? existing.id : null,
      oldCartonPrice: existing ? existing.cartonPrice : null,
      name,
      category,
      brand,
      cartonPrice: +cartonPrice.toFixed(2),
      packetPrice: packetPrice != null ? +packetPrice.toFixed(2) : null,
      unitCost: computedUnitCost,
      promoText,
    });
  }

  return { rows: parsedRows, skipped, error: null };
}

export function openCsvModal() {
  let previewRows = [];

  openModal(`
    <div class="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
      <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <h2 class="text-lg font-black text-slate-900">استيراد / تصدير الكتالوج (Excel / CSV)</h2>
          <p class="text-xs font-semibold text-slate-500">حدّث مئات الأسعار أو أضف أصناف جديدة دفعة واحدة من ملف إكسل بدون أخطاء</p>
        </div>
        <button type="button" id="btn-close-modal" class="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600" aria-label="إغلاق">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="p-5 overflow-y-auto space-y-4">
        <!-- Step 1 & 2: Download Template / Export Current -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            id="btn-download-template"
            type="button"
            class="min-h-[52px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-colors"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
            <span>تحميل قالب CSV جاهز</span>
          </button>
          <button
            id="btn-export-catalog"
            type="button"
            class="min-h-[52px] px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-colors"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            <span>تصدير الكتالوج الحالي (${state.products.length})</span>
          </button>
        </div>

        <!-- Step 3: Upload CSV -->
        <div class="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50 text-center">
          <label for="csv-file-input" class="cursor-pointer block">
            <div class="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
            </div>
            <span class="text-sm font-extrabold text-slate-900 block">رفع ملف CSV لمعاينة التعديلات قبل الحفظ</span>
            <span class="text-[11px] font-semibold text-slate-500 block mt-1">الأعمدة: اسم الصنف، الفئة، الشركة، سعر الكرتونة، سعر الشرنك، تكلفة القطعة، نص العرض</span>
            <span class="mt-3 inline-flex items-center justify-center min-h-[42px] px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-extrabold text-slate-800 hover:bg-slate-100 shadow-sm">
              اختيار ملف CSV من جهازك
            </span>
            <input id="csv-file-input" type="file" accept=".csv,text/csv" class="hidden" />
          </label>
        </div>

        <!-- Preview Area -->
        <div id="csv-preview-area" class="hidden space-y-3"></div>
      </div>
    </div>
  `);

  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-download-template').addEventListener('click', downloadCsvTemplate);
  document.getElementById('btn-export-catalog').addEventListener('click', exportCurrentCatalogCsv);

  const fileInput = document.getElementById('csv-file-input');
  const previewArea = document.getElementById('csv-preview-area');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseUploadedCsv(reader.result);
      previewArea.classList.remove('hidden');

      if (parsed.error || parsed.rows.length === 0) {
        previewRows = [];
        previewArea.innerHTML = `
          <div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-xs font-extrabold">
            ${escapeHtml(parsed.error || 'لم يتم العثور على صفوف صالحة للاستيراد. تأكد من استخدام القالب الجاهز.')}
          </div>
        `;
        return;
      }

      previewRows = parsed.rows;
      const updateCount = previewRows.filter((r) => r.action === 'update').length;
      const newCount = previewRows.filter((r) => r.action === 'new').length;

      previewArea.innerHTML = `
        <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs sm:text-sm font-extrabold text-emerald-950">
          ✓ تم قراءة ${previewRows.length} صنف (تحديث أسعار ${updateCount} صنف موجود + إضافة ${newCount} صنف جديد)
          ${parsed.skipped > 0 ? `<span class="block text-[11px] font-semibold text-amber-800 mt-1">تم تجاهل ${parsed.skipped} سطر غير مكتمل.</span>` : ''}
        </div>

        <div class="border border-slate-200 rounded-xl overflow-x-auto max-h-64 overflow-y-auto">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-100 text-slate-700 font-extrabold sticky top-0">
              <tr>
                <th class="px-2.5 py-2">الحالة</th>
                <th class="px-2.5 py-2">الصنف</th>
                <th class="px-2.5 py-2">الشركة</th>
                <th class="px-2.5 py-2">الكرتونة</th>
                <th class="px-2.5 py-2">الشرنك</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              ${previewRows
                .map(
                  (r) => `
                    <tr>
                      <td class="px-2.5 py-2 whitespace-nowrap">
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          r.action === 'update' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                        }">${r.action === 'update' ? 'تحديث' : 'جديد'}</span>
                      </td>
                      <td class="px-2.5 py-2 font-bold text-slate-900">
                        ${escapeHtml(r.name)}
                        <span class="block text-[10px] text-slate-400 font-semibold">${escapeHtml(r.category)}</span>
                      </td>
                      <td class="px-2.5 py-2 font-semibold text-slate-600 whitespace-nowrap">${escapeHtml(r.brand)}</td>
                      <td class="px-2.5 py-2 font-black text-slate-900 tabular-nums whitespace-nowrap">
                        ${
                          r.action === 'update' && r.oldCartonPrice !== r.cartonPrice
                            ? `<span class="text-slate-400 line-through ml-1">${formatMoney(r.oldCartonPrice)}</span>→ ${formatMoney(r.cartonPrice)} ج`
                            : `${formatMoney(r.cartonPrice)} ج`
                        }
                      </td>
                      <td class="px-2.5 py-2 font-bold text-slate-700 tabular-nums whitespace-nowrap">
                        ${r.packetPrice != null ? `${formatMoney(r.packetPrice)} ج` : '—'}
                      </td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <button
          id="btn-confirm-csv-import"
          type="button"
          class="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md transition-colors"
        >تأكيد واعتماد الاستيراد (${previewRows.length} صنف)</button>
      `;

      document.getElementById('btn-confirm-csv-import').addEventListener('click', () => {
        let updated = 0;
        let added = 0;

        previewRows.forEach((r) => {
          const { bonusBuy, bonusFree } = parseBonusRule(r.promoText);
          const existing = state.products.find((p) => p.id === r.existingId);
          if (existing) {
            existing.category = r.category;
            existing.brand = r.brand;
            existing.cartonPrice = r.cartonPrice;
            existing.packetPrice = r.packetPrice;
            existing.unitCost = r.unitCost;
            if (existing.unitCost > 0) {
              existing.unitsPerCarton = Math.max(1, Math.round(existing.cartonPrice / existing.unitCost));
            }
            if (r.promoText) {
              existing.promoText = r.promoText;
              existing.bonusBuy = bonusBuy;
              existing.bonusFree = bonusFree;
            }
            updated += 1;
          } else {
            const unitsPerCarton = r.unitCost > 0 ? Math.max(1, Math.round(r.cartonPrice / r.unitCost)) : 12;
            const unitsPerPacket = r.packetPrice ? Math.max(1, Math.round(unitsPerCarton / 2)) : null;
            state.products.unshift({
              id: 'p-csv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              name: r.name,
              category: r.category,
              brand: r.brand,
              cartonPrice: r.cartonPrice,
              originalCartonPrice: null,
              packetPrice: r.packetPrice,
              unitsPerCarton,
              unitsPerPacket,
              unitCost: r.unitCost,
              unitLabel: 'قطعة',
              promoText: r.promoText,
              bonusBuy,
              bonusFree,
              inStock: true,
              isClearance: false,
            });
            added += 1;
          }
        });

        state.pendingPriceEdits = {};
        persistState();
        closeModal();
        requestRender();
        showToast(`تم اعتماد الاستيراد بنجاح: تحديث ${updated} صنف + إضافة ${added} صنف جديد ✓`);
      });
    };
    reader.readAsText(file, 'UTF-8');
  });
}
