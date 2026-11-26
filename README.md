# Tawreeda (توريدة) — FMCG Wholesale Catalog & Distribution Demo

An interactive, Arabic RTL (`dir="rtl"`) client-side demo for FMCG wholesale ordering, merchant price & inventory management, truck loading (picking) lists, and driver cash/credit settlement—built for food distributors and supermarkets in Egypt.

> **Demo Notice:** This repository is a zero-build static demo powered by `localStorage` for showcasing workflows and UX. A full production version will be built separately with React + TypeScript.

## Live Demo

- **GitHub Pages:** [https://miro-zone.github.io/tawreeda/](https://miro-zone.github.io/tawreeda/)
- **Demo Link Generator (Internal):** Open [`share.html`](https://miro-zone.github.io/tawreeda/share.html) to quickly generate a properly encoded demo link for any merchant by name and phone number, send it directly via WhatsApp, and keep a local history of recent merchants.
- **URL Personalization:** Customize the store name and WhatsApp number directly via query parameters (Egyptian formats like `010...` or Arabic digits are normalized automatically to `201...`):
  ```text
  https://miro-zone.github.io/tawreeda/?name=مكتب%20النور%20للتوزيع&wa=01000000000
  ```

---

## Features

### 1. Customer Storefront (`واجهة العميل`)
- Instant product search and category filtering with clearance/deal highlights.
- Dual-unit ordering (Carton / Packet) with automatic per-unit cost calculation.
- Automatic bonus/free-carton calculation (e.g., `10+1` promos) with toast notifications.
- Sticky bottom cart bar with minimum-order (`1,000 EGP`) and free-delivery (`3,000 EGP`) progress tracking.
- Checkout drawer with saved shop profile and one-tap formatted **WhatsApp** order invoice generation.

### 2. Merchant Dashboard (`لوحة تحكم التاجر`)
- **Inventory & Pricing:** Inline carton/packet price editing with a floating save bar, instant stock (`متاح` / `خلصان`) and clearance toggles, and an Add Product modal.
- **Bulk Price Updates:** Increase or decrease prices by percentage (`%`) or fixed amount across all products, a specific category, or a specific supplier brand—with one-click **Undo**.
- **Excel / CSV Import & Export:** Download a UTF-8 Arabic-ready CSV template, export the current catalog, or upload a CSV file with a full diff preview before applying updates.

### 3. Orders, Picking List & Driver Settlement
- Full order lifecycle: `New` → `Approved` (or `Rejected`) → `Dispatched` → `Settled`.
- Auto-aggregated **Truck Picking List** (`ورقة تحميل العربية`) from approved orders, with checklist tracking, copy-to-clipboard, and print-friendly layout (`@media print`).
- **Driver Settlement Modal:** Record actual cash collected vs. deferred credit balance per delivered order.

---

## Tech Stack

- **HTML5 / CSS3 / Vanilla JavaScript (Native ES Modules)**
- **Tailwind CSS** via Play CDN (`cdn.tailwindcss.com`)
- **Google Fonts** (`Cairo`)
- **Browser `localStorage`** for client-side state persistence (with one-click **Reset Demo** in the top bar)
- **Zero build step & zero dependencies** — runs directly on GitHub Pages without Node, npm, or bundlers.

---

## Project Structure

```text
tawreeda/
├── index.html          # Static HTML shell & layout containers
├── share.html          # Internal demo link generator for sending personalized links
├── styles.css          # Custom CSS, animations, toggle styles, and print rules
├── js/
│   ├── app.js          # Entry point, render loop, and event wiring
│   ├── state.js        # Config, URL params, localStorage persistence, and app state
│   ├── share.js        # Standalone script for share.html (phone normalization, template, history)
│   ├── seed.js         # Default demo products and orders
│   ├── utils.js        # Formatting, bonus/cart calculations, toasts, and message builders
│   ├── customer.js     # Customer storefront view and sticky cart bar
│   ├── merchant.js     # Merchant inventory tab and bulk pricing logic
│   ├── orders.js       # Orders tab, truck picking list, and driver settlement modal
│   ├── csv.js          # CSV template, export, parser, and import preview modal
│   └── modals.js       # Shared modal core, checkout, add-product, and reset modals
├── README.md           # Project overview and usage guide
├── PROJECT_CONTEXT.md  # Detailed architecture reference for contributors & AI agents
└── AGENTS.md           # Workspace instructions for AI coding agents
```

---

## Running Locally

Because the app uses native ES Modules (`<script type="module">`), browsers block opening `index.html` directly via `file://` due to CORS. Serve the repository over a local HTTP server instead:

```bash
# Built-in on macOS / Linux (no installation needed)
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.  
*(You can also use the **Live Server** extension in VS Code.)*

---

## Deployment (GitHub Pages)

1. Push changes to the `main` branch.
2. In GitHub repository **Settings → Pages**, set the source to **Deploy from a branch** (`main` / `/ (root)`).
3. All asset and module paths are relative (`./styles.css`, `./js/app.js`), so the app works automatically under subpath URLs like `https://<username>.github.io/<repo>/`.
