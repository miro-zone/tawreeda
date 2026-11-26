# Project Context — Tawreeda (توريدة) Demo

> **For AI Agents & Contributors:** Read this file first to understand the codebase structure, constraints, and conventions without scanning all source files.

## 1. What This Project Is
- **Tawreeda (`توريدة`)** is an Arabic (`lang="ar"`, `dir="rtl"`) interactive **demo / MVP** for FMCG wholesale ordering, merchant price/inventory management, truck picking lists, and driver cash/credit settlement.
- **Demo Scope:** This repository is strictly a client-side demo (the full production system will be built separately in React + TypeScript). Keep changes lightweight and avoid over-engineering.
- **Hosting:** Deployed directly as static files on **GitHub Pages** (`miro-zone/tawreeda`) from the `main` branch with no build pipeline.

---

## 2. Hard Constraints & Conventions
1. **Zero Build / Zero Installs:** No `package.json`, no bundler, no `node_modules`, and no extra binaries required. Uses Vanilla JS **Native ES Modules**, **Tailwind Play CDN** (`cdn.tailwindcss.com`), and **Google Fonts (`Cairo`)**.
2. **GitHub Pages Relative Paths Only:** Always use relative paths (`./styles.css`, `./js/app.js`, `./state.js`) with explicit `.js` extensions on all ES module imports. Never use root-relative `/js/...` paths (breaks GitHub Pages subpath hosting).
3. **No Circular Imports:** Never import `js/app.js` from any other module. To trigger a UI re-render from a feature/modal module, call `requestRender()` imported from `./state.js`.
4. **No Inline HTML Handlers:** Never use `onclick="..."` in template literals. Bind interactions via `addEventListener` in `bindViewEvents()`, modal initializers, or delegated `#app-main` listeners using `data-*` attributes.
5. **Local Preview:** Because `<script type="module">` is blocked by browser CORS on `file://`, preview locally using macOS built-in Python:
   ```bash
   python3 -m http.server 8000
   ```
   Then open `http://localhost:8000`.

---

## 3. File Map & Responsibilities

Flat layout — `index.html`, `share.html`, `styles.css`, and 10 ES modules inside `js/`:

| File | Responsibility | Key Exports / Contents | Edit Here When... |
| --- | --- | --- | --- |
| `index.html` | Static HTML shell | Head (Cairo font, Tailwind CDN + config, Open Graph/Twitter meta tags), sticky role switcher header, `#app-main`, `#sticky-cart-bar`, `#floating-save-bar`, `#modal-root`, `#toast-container`, `<script type="module" src="./js/app.js">` | Changing top bar, static containers, meta tags, or Tailwind config |
| `share.html` | Internal demo link generator (`noindex`) | Standalone page to generate personalized `?name=&wa=` demo links, preview/edit WhatsApp pitch message, send via `wa.me`, and manage recent merchants history (`<script type="module" src="./js/share.js">`) | Changing demo link generator UI or sharing workflow |
| `styles.css` | Custom CSS | `.no-scrollbar`, `.tabular-nums`, `.toggle-track`/`.toggle-thumb`, `slideUp`/`fadeIn` animations, `@media print` | Tweaking custom CSS, animations, or print layout |
| `js/seed.js` | Demo seed data | `createSeedProducts`, `createSeedOrders`, `getInitialPersistedState` | Adding/editing default demo products, brands, or initial orders |
| `js/state.js` | Config, storage & central state | `normalizeWhatsAppNumber`, `STORE_NAME`, `WHATSAPP_NUMBER`, `MIN_ORDER_VALUE`, `FREE_DELIVERY_THRESHOLD`, `BASE_CATEGORIES`, `safeStorage`, `state`, `persistState`, `saveCustomerProfile`, `registerRender`, `requestRender` | Changing thresholds, URL params (`?name=&wa=`), phone normalization, storage keys, or state fields |
| `js/share.js` | Demo link generator logic (standalone) | `normalizeWhatsAppNumber`, link/WhatsApp URL builders, editable message template, clipboard copy with fallback, recent merchants history (`localStorage`) | Changing share link encoding, default WhatsApp pitch template, or history behavior |
| `js/utils.js` | Shared helpers | `formatMoney`, `escapeHtml`, `normalizeArabicDigits`, `cleanNumericValue`, `normalizeNameKey`, `getAllCategories`, `getAllBrands`, `parseBonusRule`, `calcBonusCartons`, `calcUnitCostForMode`, `getNowArabicTime`, `getCartSummary`, `showToast`, `buildWhatsAppMessage`, `buildPickingListText` | Changing calculations, formatting, toast UI, or WhatsApp/picking text |
| `js/modals.js` | Core modal system & main modals | `openModal`, `closeModal`, `openCheckoutDrawer`, `openOrderSuccessModal`, `openAddProductModal`, `openResetConfirmModal` | Editing checkout flow, order confirmation, add-product form, or reset confirmation |
| `js/csv.js` | Excel/CSV feature (self-contained) | `downloadCsvTemplate`, `exportCurrentCatalogCsv`, `parseUploadedCsv`, `openCsvModal` | Changing CSV columns, parser logic, export format, or CSV import preview modal |
| `js/orders.js` | Merchant orders & settlement | `getAggregatedPickingList`, `renderMerchantOrdersTab`, `openSettlementModal` | Changing order lifecycle cards, truck picking list, or driver cash/credit settlement |
| `js/customer.js` | Customer storefront view | `getFilteredCustomerProducts`, `renderCustomerView`, `renderCustomerProductCard`, `updateStickyCartBar`, `adjustCart` | Editing customer catalog, product cards, unit toggle, or bottom cart/delivery bar |
| `js/merchant.js` | Merchant inventory & bulk pricing | `getBulkMatchingProducts`, `getBulkPreviewText`, `applyBulkPriceUpdate`, `updateFloatingSaveBar`, `renderMerchantView` | Editing merchant tabs shell, inline price rows, stock/clearance toggles, or bulk price update + Undo |
| `js/app.js` | Entry point & event wiring | `updateHeaderUI`, `render`, `bindViewEvents`, delegated `#app-main` listeners, global static listeners, `registerRender(render)`, initial `render()` | Wiring new buttons, `data-*` actions, keyboard shortcuts, or top-level render flow |
| `README.md` | Project documentation | Overview, features, URL personalization, local run, and GitHub Pages deployment | Updating user-facing documentation or feature list |
| `AGENTS.md` | Workspace agent rules | Always-on instructions requiring reading & updating `PROJECT_CONTEXT.md` | Updating AI agent workflow rules |

---

## 4. Dependency Graph (Strict One-Way DAG)

```text
js/seed.js
  └─▶ js/state.js (owns state + registerRender/requestRender bridge)
        └─▶ js/utils.js
              ├─▶ js/modals.js (also imports js/seed.js for reset)
              │     ├─▶ js/csv.js
              │     └─▶ js/orders.js
              ├─▶ js/customer.js
              └─▶ js/merchant.js (imports renderMerchantOrdersTab from js/orders.js)
                    └─▶ js/app.js (entry point; imports all UI/modal modules & registers render())

share.html ─▶ js/share.js (standalone utility page; zero imports from main app)
```

---

## 5. Data Model, URL Params & Persistence

- **URL Personalization:**
  - `?name=<store-name>` overrides `STORE_NAME` and `document.title`.
  - `?wa=<phone>` overrides `WHATSAPP_NUMBER` via `normalizeWhatsAppNumber()` (converts Arabic/Persian digits, strips non-digits, and auto-normalizes Egyptian formats such as `010...`, `10...`, `+20 010...`, `0020...` into `201...`).
  - Internal generator page: `share.html` creates properly percent-encoded links and pre-filled WhatsApp messages (also supports pre-filling via `share.html?name=...&wa=...`).
- **`localStorage` Keys** (wrapped in `safeStorage` with in-memory fallback):
  - `tawreeda_mvp_state_v2`: `{ products, orders, nextOrderNumber, pickingChecked }`
  - `tawreeda_customer_profile_v1`: `{ shopName, address, phone }`
  - `tawreeda_share_history_v1`: recent generated merchant links in `share.html` (max 15 items)
  - `tawreeda_share_template_v1`: custom WhatsApp pitch template saved in `share.html`
- **Business Rules:**
  - `MIN_ORDER_VALUE = 1000` (EGP)
  - `FREE_DELIVERY_THRESHOLD = 3000` (EGP)
- **Product Shape:**
  `{ id, name, category, brand, cartonPrice, originalCartonPrice, packetPrice, unitsPerCarton, unitsPerPacket, unitCost, unitLabel, promoText, bonusBuy, bonusFree, inStock, isClearance }`
- **Order Shape & Lifecycle:**
  `{ id, number, shopName, address, phone, paymentMethod, notes, createdAt, status, items[], totalCartons, totalPackets, totalBonusCartons, totalAmount, actualCashCollected, remainingCredit, settledAt? }`
  - Valid `status` values: `'new'` → `'approved'` (or `'rejected'`) → `'dispatched'` → `'settled'`.
  - Picking list aggregates items from orders with `status === 'approved'`.

---

## 6. UI Rendering & Interaction Pattern

- **Render Cycle:** Calling `render()` (or `requestRender()` from sub-modules) runs:
  1. `updateHeaderUI()`
  2. Re-renders `#app-main` via `renderCustomerView()` or `renderMerchantView()` based on `state.role` (`'customer' | 'merchant'`)
  3. `updateStickyCartBar()` & `updateFloatingSaveBar()`
  4. `bindViewEvents()`
- **Delegated Events on `#app-main`** (in `js/app.js`):
  - Clicks: `[data-bulk-op]`, `[data-bulk-unit]`, `[data-select-unit]`, `[data-qty-delta]`, `[data-quick-add]`, `[data-toggle-stock]`, `[data-toggle-clearance]`, `[data-toggle-order]`, `[data-order-action]`, `#btn-reset-filters`
  - Inputs/Keys/Changes: `[data-price-input]` (live unit cost + pending edits + Enter to save), `[data-picking-check]`
- **Modals:** Rendered into `#modal-root` via `openModal(html)`. Clicking `#modal-backdrop` or pressing `Escape` calls `closeModal()`.
- **Toasts:** Rendered into `#toast-container` via `showToast(message, type, options)` where `type` is `'success' | 'warning' | 'info'`, and `options` supports `{ replaceId, duration, actionLabel, onAction }` (used for Bulk Price Undo).
