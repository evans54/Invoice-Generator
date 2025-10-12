# Invoice-Generator

This small app creates invoices and receipts. Recent updates:

- Save Invoice: new "Save Invoice" button saves an invoice to local history without downloading.
- Mark as Pending: new button to explicitly mark an invoice as pending (doesn't consume a new invoice number).
- Receipt numbering: receipts now request a server-generated sequential receipt number via POST `/api/receipt-number`. The client will persist that number on the receipt payload and include it in the downloaded PDF filename.
- UI feedback: inline toast notifications are shown instead of blocking alerts. A spinner overlay appears while the client requests server-generated receipt numbers or streams PDFs.
- Invoice numbering: invoice numbers are auto-generated as `INV-0001` and incremented only when a new invoice is saved. The next available invoice number is stored in `localStorage.lastInvoiceNumber`.

See `assets/app.js` for the client logic and `server.js` + `lib/server-app.js` for server-side PDF and receipt number generation.