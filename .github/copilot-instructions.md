# Repo-specific instructions for AI coding assistants

This repository started as a single-page Invoice Generator web app implemented entirely in `index.html` (Vanilla HTML/CSS/JS). A minimal Node.js backend has been added to provide server-side PDF generation and currency-labelled outputs.

Keep guidance concise and specific to what's discoverable in the codebase below.

1) Big-picture architecture
- Single-page client-only app: everything (UI, business logic, persistence) lives in `index.html`. There is no server/backend code in this repo. Data persistence is localStorage-based (`invoiceHistory`, `lastInvoiceNumber`).
- Major responsibilities in `index.html`:
  - UI layout & styling: Tailwind CDN and a small embedded CSS block.
  - Business logic: DOM-based functions for adding/removing service rows, calculating totals, preview rendering, generating PDFs, marking invoices as paid, and maintaining invoice history.
  - 3rd-party integrations: jsPDF + html2canvas for PDF export; Feather icons for UI icons; Tailwind for layout.

2) Developer workflows and commands
- No build/test scripts for the frontend — you can open `index.html` directly, or serve the folder with a static server for better local routing.
  - Python: `python -m http.server 8000` (run from repo root)
  - Node: `npx serve .`

- Minimal Node backend added: `server.js` with `package.json`. The backend exposes POST `/api/invoice` which accepts the invoice JSON and returns a PDF. It uses `express`, `body-parser`, `cors`, and `pdfkit`.

- To run the backend locally:

```powershell
cd c:\Users\Administrator\Invoice-Generator
npm install
npm start
```

- The frontend `index.html` will attempt to POST to `/api/invoice` on the same origin. If the backend is not available, the client falls back to the existing client-side PDF generation (html2canvas + jsPDF).

- For debugging, open the browser DevTools Console to inspect runtime errors and inspect `localStorage` keys: `invoiceHistory`, `lastInvoiceNumber`.

3) Project-specific conventions & patterns
- Historically this was a single-file app. Recently the frontend JS was moved into `assets/app.js` as an ES module. Prefer adding new UI/business logic there (or split into more modules under `assets/`) rather than editing large inline blocks in `index.html`.
- Keep DOM queries scoped (use container elements) to avoid accidental global collisions.
- Data shape for history stored in localStorage: array of objects each with { number, type: 'invoice'|'receipt', date (ISO string), client, amount }.
  - Example access: JSON.parse(localStorage.getItem('invoiceHistory') || '[]')
 - Data shape for history stored in localStorage: array of objects each with { number, type: 'invoice'|'receipt', date (ISO string), client, amount, payload }.
  - `payload` contains the full invoice/receipt data and `payload.invoiceStatus` ("pending"|"paid").
  - Receipts include `payload.receiptNumber` with format `RCT-YYYYMMDD-XXXX` (client-generated random suffix).
- Invoice numbering is formatted as `INV-0001` and last used number stored in `lastInvoiceNumber` (integer).
- PDF generation flow: call `updatePreview()` to render HTML for export, then `html2canvas` the preview element, convert to image and feed to jsPDF. Pagination logic is implemented by slicing based on canvas height.

- Frontend CDN libraries:
  - Tailwind CSS via `https://cdn.tailwindcss.com`
  - Feather icons via `https://unpkg.com/feather-icons` (and an additional jsdelivr link)
  - jsPDF v2.x (`jspdf.umd.min.js`) and html2canvas v1.x

- Backend (added):
  - `server.js` (Node + Express) uses `pdfkit` to generate a server-side PDF. See `package.json` for exact dependency versions.
  - Server-side logic is in `lib/server-app.js` (PDF assembly, currency symbols and static exchange rates). Frontend logic lives in `assets/app.js`.
- Frontend CDN libraries:
  - Tailwind CSS via `https://cdn.tailwindcss.com`
  - Feather icons via `https://unpkg.com/feather-icons` (and an additional jsdelivr link)
  - jsPDF v2.x (`jspdf.umd.min.js`) and html2canvas v1.x

- Backend (added):
  - `server.js` (Node + Express) uses `pdfkit` to generate a server-side PDF. See `package.json` for exact dependency versions.

- Endpoint: `POST /api/invoice` expects JSON like:

```json
{
  "invoiceNumber": "INV-0001",
  "issueDate": "2025-10-12",
  "dueDate": "2025-10-26",
  "clientName": "...",
  "taxRate": "0",
  "discount": "0",
  "currency": "USD",
  "services": [{"desc":"Design","qty":"1","rate":"100"}, ...]
}
```

It returns a `application/pdf` attachment.

5) Concrete examples & patterns to follow when modifying code
- Adding UI controls: follow existing pattern where elements are created in HTML and hooked by id at DOMContentLoaded, e.g., `document.getElementById('generateInvoiceBtn').addEventListener('click', generateInvoicePDF)`.
- Adding a new computed field: update `calculateAmounts()` (central place for amounts) and ensure preview (`updatePreview()`) outputs matching values.
- Mutating history: use `saveToHistory(type)` helper which ensures uniqueness by `number` and increments `lastInvoiceNumber` when saving invoices.
 - Mutating history: use `saveToHistory(type)` helper which now stores the full payload under `payload` and sets `payload.invoiceStatus`. When saving a receipt (`type: 'receipt'`) the invoice entry is updated to `invoiceStatus: 'paid'` and a separate receipt entry is inserted so receipts can be listed independently.
  - History now stores the full `payload` object for each entry (so invoices and receipts can be re-loaded and re-downloaded). Use `localStorage.getItem('invoiceHistory')` to inspect.
  - Receipts are stored with `type: 'receipt'` and a generated `payload.receiptNumber` (format `RCT-YYYYMMDD-XXXX`).

6) Edge-cases and conservative defaults observed in code
- Numeric parsing uses `parseFloat(... ) || 0` to default invalid inputs to zero. Follow similar defensive parsing.
- Dates are stored as ISO strings in history; format for user display using `toLocaleDateString(...)` as done in the preview and history rendering.

7) Quick edit checklist for contributors (keeps PRs small and focused)
- Keep logic and UI changes grouped and documented with inline comments in `index.html`.
- Add tests/CI only after extracting JS into separate modules (not required now). For small improvements, manual QA by opening `index.html` in browser + checking DevTools is sufficient.
- When adding libraries prefer CDN usage consistent with the current pattern, unless adding a build step and package.json.

8) What not to change without discussion
- Global data keys in localStorage (`invoiceHistory`, `lastInvoiceNumber`) — changing them will break persisted user data and history migration must be provided.
- The basic client-side PDF generation approach (html2canvas -> jsPDF) — it's fragile but works offline; any replacement should preserve offline/export behavior.
- The backend `lib/server-app.js` uses a simple PDFKit template. Replacing it with a headless-browser rendering (Puppeteer) is possible but will add heavier dependencies and a different deployment model.

Receipts dashboard
- A new Receipts dashboard is available in the header (button `Receipts`). It lists generated receipts (read-only): you can preview and download receipts. Receipts are automatically created when an invoice is marked as paid (the client saves a receipt entry to `invoiceHistory` with `type: 'receipt'`).
- The Receipts dashboard only allows previewing and downloading receipts; it does not allow editing receipts (invoices remain editable via Invoice History -> Edit).

CI:
- A lightweight GitHub Actions workflow is present at `.github/workflows/nodejs.yml` which installs dependencies and runs a smoke `require('./server.js')` to catch syntax/runtime issues in the server.

If anything in this file is unclear or you want more detail (e.g., proposed JS modularization plan, sample migration for localStorage keys, or a small test harness), tell me which section to expand and I will iterate.