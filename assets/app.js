// Frontend application module for Invoice Generator
// Moved from inline <script> in index.html. This module initializes UI and handles
// server-side PDF generation (with currency conversion support) and client-side fallback.

const currencySymbols = {
  USD: '$',
  KSH: 'KSh ',
  TZS: 'TSh ',
  EURO: '€',
  PUNDS: '£'
};

// Static exchange rates relative to USD. These are editable in the module.
// Interpretation: 1 unit of key = rates[key] USD. To convert between currencies, use USD as bridge.
const staticRatesToUSD = {
  USD: 1.0,
  KSH: 1 / 155.0,   // 1 KSH ~= 0.00645 USD (i.e., 155 KSH = 1 USD)
  TZS: 1 / 2350.0,  // 1 TZS ~= 0.0004255 USD
  EURO: 1.08,       // 1 EURO ~= 1.08 USD (example static)
  PUNDS: 1.25      // 1 GBP ~= 1.25 USD (example static)
};

function convertAmount(amount, from, to) {
  if (!from || !to || from === to) return amount;
  // Convert 'amount' (in 'from' currency) to USD, then to 'to' currency
  const fromToUsd = staticRatesToUSD[from] || 1.0;
  const toToUsd = staticRatesToUSD[to] || 1.0;

  // Interpretation here: staticRatesToUSD stores USD per unit for currencies where value >1 (e.g., EURO:1.08 means 1 EURO=1.08 USD)
  // For currencies entered as fraction (like KSH stored as 1/155), the math still holds.
  const amountInUsd = amount * fromToUsd;
  const converted = amountInUsd / toToUsd;
  return converted;
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize feather icons
  if (window.feather) feather.replace();

  // Set default dates
  const today = new Date();
  const dueDate = new Date();
  dueDate.setDate(today.getDate() + 14);

  document.getElementById('issueDate').valueAsDate = today;
  document.getElementById('dueDate').valueAsDate = dueDate;

  // Initialize invoice number
    // lastInvoiceNumber is stored as an integer value (next available number)
    let lastNumRaw = localStorage.getItem('lastInvoiceNumber');
    let lastNum = lastNumRaw ? parseInt(lastNumRaw, 10) : 1;
    if (isNaN(lastNum) || lastNum < 1) lastNum = 1;
    document.getElementById('invoiceNumber').value = `INV-${String(lastNum).padStart(4, '0')}`;

  // Event listeners
  document.getElementById('addService').addEventListener('click', addServiceRow);
  document.getElementById('previewBtn').addEventListener('click', updatePreview);
  document.getElementById('generateInvoiceBtn').addEventListener('click', generateInvoiceServerPDF);
    // New save & pending buttons
    const saveBtn = document.getElementById('saveInvoiceBtn');
    if (saveBtn) saveBtn.addEventListener('click', async () => { await saveInvoice(); });
    const pendingBtn = document.getElementById('markAsPendingBtn');
    if (pendingBtn) pendingBtn.addEventListener('click', async () => { await markAsPending(); });
  document.getElementById('markAsPaidBtn').addEventListener('click', markAsPaid);
  document.getElementById('downloadReceiptBtn').addEventListener('click', generateReceiptServerPDF);
  document.getElementById('historyBtn').addEventListener('click', openHistoryModal);
  document.getElementById('closeHistoryModal').addEventListener('click', closeHistoryModal);
    // Receipts dashboard
    const receiptsBtn = document.getElementById('receiptsBtn');
    if (receiptsBtn) receiptsBtn.addEventListener('click', openReceiptsModal);
    const closeReceipts = document.getElementById('closeReceiptsModal');
    if (closeReceipts) closeReceipts.addEventListener('click', closeReceiptsModal);
        // Create new invoice button
        const createNewBtn = document.getElementById('createNewInvoiceBtn');
        if (createNewBtn) createNewBtn.addEventListener('click', () => { createNewInvoice(); });
        const duplicateBtn = document.getElementById('duplicateInvoiceBtn');
        if (duplicateBtn) duplicateBtn.addEventListener('click', () => { duplicateInvoice(); });
        // Duplicate confirm modal buttons
        const cancelDup = document.getElementById('cancelDuplicateBtn');
        const confirmDup = document.getElementById('confirmDuplicateBtn');
        if (cancelDup) cancelDup.addEventListener('click', () => { document.getElementById('confirmDuplicateModal').classList.add('hidden'); });
        if (confirmDup) confirmDup.addEventListener('click', () => { document.getElementById('confirmDuplicateModal').classList.add('hidden'); actuallyConfirmDuplicate(); });

        // History download selected (downloads most recent by default)
        const downloadSelectedHistoryBtn = document.getElementById('downloadSelectedHistoryBtn');
        if (downloadSelectedHistoryBtn) downloadSelectedHistoryBtn.addEventListener('click', downloadSelectedFromHistory);

  // Calculate amounts when inputs change
  document.addEventListener('input', function(e) {
      if (e.target.classList.contains('service-qty') || 
          e.target.classList.contains('service-rate') ||
          e.target.id === 'taxRate' ||
          e.target.id === 'discountAmt' ||
          e.target.id === 'currencySelect') {
          calculateAmounts();
      }
  });

  // Initial calculation
  calculateAmounts();
});

// Toast helper (non-blocking inline notifications)
function showToast(message, type = 'info', timeout = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    const color = type === 'success' ? 'bg-green-100 text-green-800' : type === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';
    el.className = `${color} px-4 py-2 rounded shadow-md`;
    el.innerText = message;
    container.appendChild(el);
    setTimeout(() => { el.remove(); }, timeout);
}

// Create a new invoice form (does not increment lastInvoiceNumber until save)
function createNewInvoice() {
    // If form has unsaved changes, show confirmation modal first
    if (hasUnsavedChanges()) {
        const modal = document.getElementById('confirmDiscardModal');
        if (modal) modal.classList.remove('hidden');
        // wire modal buttons
        const cancel = document.getElementById('cancelDiscardBtn');
        const confirm = document.getElementById('confirmDiscardBtn');
        if (cancel) cancel.onclick = () => { document.getElementById('confirmDiscardModal').classList.add('hidden'); };
        if (confirm) confirm.onclick = () => { document.getElementById('confirmDiscardModal').classList.add('hidden'); actuallyCreateNewInvoice(); };
        return;
    }

    actuallyCreateNewInvoice();
}

function actuallyCreateNewInvoice() {
    // reset client fields
    document.getElementById('clientName').value = '';
    document.getElementById('clientCompany').value = '';
    document.getElementById('clientEmail').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientAddress').value = '';
    document.getElementById('invoiceNotes').value = '';
    document.getElementById('taxRate').value = '0';
    document.getElementById('discountAmt').value = '0';
    document.getElementById('currencySelect').value = 'USD';
    if (document.getElementById('invoiceStatus')) document.getElementById('invoiceStatus').value = 'pending';

    // reset dates
    const today = new Date();
    const dueDate = new Date(); dueDate.setDate(today.getDate() + 14);
    document.getElementById('issueDate').valueAsDate = today;
    document.getElementById('dueDate').valueAsDate = dueDate;

    // reset services table to one empty row
    const table = document.getElementById('servicesTable');
    table.innerHTML = '';
    addServiceRow();

    // set invoice number to next available but do NOT increment lastInvoiceNumber yet
    let nextNum = parseInt(localStorage.getItem('lastInvoiceNumber') || '1', 10);
    if (isNaN(nextNum) || nextNum < 1) nextNum = 1;
    document.getElementById('invoiceNumber').value = `INV-${String(nextNum).padStart(4, '0')}`;

    calculateAmounts();
    showToast('New invoice form initialized', 'success');
}

    // Strict unsaved-change detection: compare current form to lastLoadedPayload if available
    let lastLoadedPayload = null; // updated in loadInvoiceFromHistory
    function hasUnsavedChanges() {
        const current = collectInvoiceData();
        if (!lastLoadedPayload) {
            // if no loaded payload, treat non-default values as changes
            const defaults = { clientName: '', clientCompany: '', clientEmail: '', clientPhone: '', clientAddress: '', invoiceNotes: '', taxRate: '0', discount: '0', services: [] };
            for (const k of ['clientName','clientCompany','clientEmail','clientPhone','clientAddress','invoiceNotes','taxRate','discount']) {
                if ((current[k]||'').toString().trim() !== (defaults[k]||'').toString().trim()) return true;
            }
            if ((current.services || []).length > 0) {
                for (const s of current.services) {
                    if ((s.desc||'').trim() !== '' || (s.qty||'').toString().trim() !== '' || (s.rate||'').toString().trim() !== '') return true;
                }
            }
            return false;
        }
        // Compare scalar fields
        const keys = ['clientName','clientCompany','clientEmail','clientPhone','clientAddress','invoiceNotes','taxRate','discount','paymentMethod','currency'];
        for (const k of keys) {
            if ((current[k]||'').toString().trim() !== (lastLoadedPayload[k]||'').toString().trim()) return true;
        }
        // Compare services
        const curS = current.services || [];
        const oldS = lastLoadedPayload.services || [];
        if (curS.length !== oldS.length) return true;
        for (let i=0;i<curS.length;i++) {
            const a = curS[i] || {};
            const b = oldS[i] || {};
            if ((a.desc||'').trim() !== (b.desc||'').trim()) return true;
            if ((a.qty||'').toString().trim() !== (b.qty||'').toString().trim()) return true;
            if ((a.rate||'').toString().trim() !== (b.rate||'').toString().trim()) return true;
        }
        return false;
    }

    // Duplicate the currently loaded invoice into a new draft (next invoice number prefilled)
    function duplicateInvoice() {
        // Find the currently loaded invoice (from form invoiceNumber) in history
        const currentNum = document.getElementById('invoiceNumber').value;
        const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
        const item = history.find(h => h.number === currentNum && h.type === 'invoice');
        if (!item || !item.payload) {
            showToast('No saved invoice found to duplicate', 'error');
            return;
        }

        // Create a draft from the payload
        const p = item.payload;
        // Reset form with payload values
        loadInvoiceFromHistory(currentNum);

        // Assign next available invoice number (do not increment counter yet)
        let nextNum = parseInt(localStorage.getItem('lastInvoiceNumber') || '1', 10);
        if (isNaN(nextNum) || nextNum < 1) nextNum = 1;
        document.getElementById('invoiceNumber').value = `INV-${String(nextNum).padStart(4, '0')}`;

        showToast('Invoice duplicated into a new draft', 'success');
    }

    function actuallyConfirmDuplicate() {
        const source = window.__duplicateSource;
        if (!source) return;
        const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
        const item = history.find(h => h.number === source && h.type === 'invoice');
        if (!item || !item.payload) { showToast('No saved invoice found to duplicate', 'error'); return; }
        // Load payload into form
        loadInvoiceFromHistory(source);
        // prefill next invoice number
        let nextNum = parseInt(localStorage.getItem('lastInvoiceNumber') || '1', 10);
        if (isNaN(nextNum) || nextNum < 1) nextNum = 1;
        document.getElementById('invoiceNumber').value = `INV-${String(nextNum).padStart(4, '0')}`;
        // show duplicate badge
        const badge = document.getElementById('duplicateBadge');
        const sourceEl = document.getElementById('duplicateSource');
        if (badge && sourceEl) { sourceEl.innerText = source; badge.classList.remove('hidden'); }
        showToast('Invoice duplicated into a new draft', 'success');
    }

    async function downloadSelectedFromHistory() {
        const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
        if (history.length === 0) { showToast('No history to download from', 'error'); return; }
        // download most recent by default
        const item = history[0];
        if (!item || !item.payload) { showToast('No downloadable item found', 'error'); return; }
        const payload = item.payload; payload.type = item.type === 'receipt' ? 'receipt' : 'invoice';
        try {
            showSpinner();
            const resp = await fetch('/api/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            hideSpinner();
            if (!resp.ok) throw new Error('Server failed');
            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const name = (payload.type === 'receipt' ? (payload.receiptNumber || payload.invoiceNumber) : payload.invoiceNumber) || item.number;
            a.download = `${payload.type}_${name}.pdf`;
            document.body.appendChild(a);
            a.click(); a.remove(); window.URL.revokeObjectURL(url);
        } catch (e) { hideSpinner(); showToast('Download failed', 'error'); }
    }

function showSpinner() { const s = document.getElementById('spinnerOverlay'); if (s) s.classList.remove('hidden'); }
function hideSpinner() { const s = document.getElementById('spinnerOverlay'); if (s) s.classList.add('hidden'); }

// Add new service row
export function addServiceRow() {
  const table = document.getElementById('servicesTable');
  const rowCount = table.children.length;
  const newRow = document.createElement('tr');
  newRow.className = 'border-b';
  newRow.dataset.row = rowCount;
  
  newRow.innerHTML = `
      <td class="py-2"><input type="text" class="w-full px-2 py-1 border rounded service-desc" placeholder="Service description"></td>
      <td class="py-2"><input type="number" min="1" value="1" class="w-20 px-2 py-1 border rounded text-right service-qty"></td>
      <td class="py-2"><input type="number" min="0" step="0.01" class="w-24 px-2 py-1 border rounded text-right service-rate" placeholder="0.00"></td>
      <td class="py-2"><input type="text" class="w-24 px-2 py-1 border rounded text-right service-amt" placeholder="0.00" readonly></td>
      <td class="py-2 text-center"><button class="remove-row text-red-500 hover:text-red-700"><i data-feather="trash-2" class="w-4 h-4"></i></button></td>
  `;
  
  table.appendChild(newRow);
  if (window.feather) feather.replace();
  
  // Add event listener to remove button
  newRow.querySelector('.remove-row').addEventListener('click', function() {
      table.removeChild(newRow);
      renumberRows();
      calculateAmounts();
  });
}

// Renumber rows after deletion
function renumberRows() {
  const rows = document.querySelectorAll('#servicesTable tr');
  rows.forEach((row, index) => {
      row.dataset.row = index;
  });
}

// Calculate amounts for each service and total (with optional conversion to selected currency)
function calculateAmounts() {
  const rows = document.querySelectorAll('#servicesTable tr');
  let subtotal = 0;
  const displayCurrency = document.getElementById('currencySelect')?.value || 'USD';

  rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.service-qty').value) || 0;
      const rateInput = parseFloat(row.querySelector('.service-rate').value) || 0;

      // Treat rateInput as entered in the selected currency
      const amount = qty * rateInput;
      row.querySelector('.service-amt').value = amount.toFixed(2);
      subtotal += amount;
  });

  const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
  const discount = parseFloat(document.getElementById('discountAmt').value) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  const symbol = currencySymbols[displayCurrency] || '';
  document.getElementById('totalDue').value = `${symbol}${total.toFixed(2)}`;
}

// Update invoice preview (HTML)
function updatePreview() {
  const invoiceNumber = document.getElementById('invoiceNumber').value;
  const issueDate = document.getElementById('issueDate').value;
  const dueDate = document.getElementById('dueDate').value;
  const clientName = document.getElementById('clientName').value;
  const clientCompany = document.getElementById('clientCompany').value;
  const clientEmail = document.getElementById('clientEmail').value;
  const clientPhone = document.getElementById('clientPhone').value;
  const clientAddress = document.getElementById('clientAddress').value;
  const paymentMethod = document.getElementById('paymentMethod').value;
  const invoiceNotes = document.getElementById('invoiceNotes').value;
  const displayCurrency = document.getElementById('currencySelect')?.value || 'USD';

  // Format dates
  const formattedIssueDate = issueDate ? new Date(issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  // Generate services HTML
  let servicesHTML = '';
  const rows = document.querySelectorAll('#servicesTable tr');
  let subtotal = 0;

  rows.forEach(row => {
      const desc = row.querySelector('.service-desc').value || '-';
      const qty = row.querySelector('.service-qty').value || '0';
      const rate = parseFloat(row.querySelector('.service-rate').value) || 0;
      const amount = parseFloat(row.querySelector('.service-amt').value) || 0;
      subtotal += amount;

      servicesHTML += `
          <tr class="border-b">
              <td class="py-2">${desc}</td>
              <td class="py-2 text-right">${qty}</td>
              <td class="py-2 text-right">${currencySymbols[displayCurrency] || ''}${rate.toFixed(2)}</td>
              <td class="py-2 text-right">${currencySymbols[displayCurrency] || ''}${amount.toFixed(2)}</td>
          </tr>
      `;
  });

  const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
  const discount = parseFloat(document.getElementById('discountAmt').value) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  // Generate preview HTML (kept simple)
  const previewHTML = `
      <div class="mb-8">
          <div class="flex justify-between items-start mb-8">
              <div>
                  <div class="w-16 h-16 bg-lessy-blue rounded-lg flex items-center justify-center mb-2">
                      <i data-feather="file-text" class="text-lessy-gold w-8 h-8"></i>
                  </div>
                  <h2 class="text-2xl font-bold text-lessy-blue">INVOICE</h2>
              </div>
              <div class="text-right">
                  <p class="text-sm text-gray-500">Invoice #</p>
                  <p class="font-semibold text-lessy-blue">${invoiceNumber}</p>
                  <p class="text-sm text-gray-500 mt-2">Issue Date</p>
                  <p class="font-semibold">${formattedIssueDate}</p>
                  <p class="text-sm text-gray-500 mt-2">Due Date</p>
                  <p class="font-semibold">${formattedDueDate}</p>
              </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                  <h3 class="text-sm font-medium text-gray-500 mb-1">From</h3>
                  <p class="font-bold text-lessy-blue">Lessy Communication Agency</p>
                  <p class="text-sm">RED DIAMOND GROUND FLOOR ROOM: 2, RUARAKA, OTERING ROAD</p>
                  <p class="text-sm">Nairobi, Kenya</p>
                  <p class="text-sm">Phone: +254717321229</p>
                  <p class="text-sm">Email: admin@lessycommunications.co.ke</p>
              </div>
              <div>
                  <h3 class="text-sm font-medium text-gray-500 mb-1">Bill To</h3>
                  <p class="font-bold">${clientName || 'Client Name'}</p>
                  ${clientCompany ? `<p class="text-sm">${clientCompany}</p>` : ''}
                  ${clientAddress ? `<p class="text-sm">${clientAddress}</p>` : ''}
                  ${clientPhone ? `<p class="text-sm">Phone: ${clientPhone}</p>` : ''}
                  ${clientEmail ? `<p class="text-sm">Email: ${clientEmail}</p>` : ''}
              </div>
          </div>
          
          <table class="w-full mb-6">
              <thead>
                  <tr class="border-b border-t">
                      <th class="text-left py-3 text-sm font-medium text-gray-700">Description</th>
                      <th class="text-right py-3 text-sm font-medium text-gray-700">Qty</th>
                      <th class="text-right py-3 text-sm font-medium text-gray-700">Rate</th>
                      <th class="text-right py-3 text-sm font-medium text-gray-700">Amount</th>
                  </tr>
              </thead>
              <tbody>
                  ${servicesHTML || '<tr><td colspan="4" class="py-4 text-center text-gray-400">No services added</td></tr>'}
              </tbody>
          </table>
          
          <div class="w-full md:w-1/2 ml-auto">
              <div class="flex justify-between py-2">
                  <span class="text-sm text-gray-600">Subtotal:</span>
                  <span class="font-medium">${currencySymbols[displayCurrency] || ''}${subtotal.toFixed(2)}</span>
              </div>
              ${taxRate > 0 ? `
              <div class="flex justify-between py-2">
                  <span class="text-sm text-gray-600">Tax (${taxRate}%):</span>
                  <span class="font-medium">${currencySymbols[displayCurrency] || ''}${taxAmount.toFixed(2)}</span>
              </div>
              ` : ''}
              ${discount > 0 ? `
              <div class="flex justify-between py-2">
                  <span class="text-sm text-gray-600">Discount:</span>
                  <span class="font-medium">-${currencySymbols[displayCurrency] || ''}${discount.toFixed(2)}</span>
              </div>
              ` : ''}
              <div class="flex justify-between py-2 border-t border-b font-bold text-lg mt-2">
                  <span>Total Due:</span>
                  <span>${currencySymbols[displayCurrency] || ''}${total.toFixed(2)}</span>
              </div>
          </div>
          
          <div class="mt-6 pt-4 border-t">
              <h3 class="text-sm font-medium text-gray-500 mb-2">Bank / Payment Details</h3>
              <p class="text-sm">A/C Name: LESSY COMMUNICATIONS AGEN</p>
              <p class="text-sm">Currency: KES</p>
              <p class="text-sm">Account Number: 08544740008</p>
              <p class="text-sm">Bank Name: Bank of Africa Kenya Limited</p>
              <p class="text-sm">Branch: EMBAKASI</p>
              <p class="text-sm">Bank Code: 019 &middot; Branch Code: 012 &middot; Swift: AFRIKENX</p>
              <p class="text-sm">Mpesa Paybill: 972900 &middot; Account: 08544740008</p>
          </div>

          ${invoiceNotes ? `
          <div class="mt-8 pt-4 border-t">
              <h3 class="text-sm font-medium text-gray-500 mb-2">Notes</h3>
              <p class="text-sm">${invoiceNotes}</p>
          </div>
          ` : ''}
      </div>
  `;
  
  document.getElementById('invoicePreview').innerHTML = previewHTML;
  if (window.feather) feather.replace();
}

// Client-side PDF generation fallback (unchanged)
async function generateInvoicePDF() {
    updatePreview();
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('invoicePreview');

    try {
        const canvas = await html2canvas(element);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
        }

        pdf.save(`invoice_${document.getElementById('invoiceNumber').value}.pdf`);

        // Save to history
        await saveToHistory('invoice');
    } catch (e) {
        console.warn('Client-side PDF generation failed', e);
    }
}

// Generate invoice on backend; payload includes currency and optional conversion info
async function generateInvoiceServerPDF() {
  updatePreview();
  const payload = collectInvoiceData();

  try {
      const resp = await fetch('/api/invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('Server returned ' + resp.status);
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${document.getElementById('invoiceNumber').value}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    await saveToHistory('invoice');
  } catch (err) {
      console.warn('Backend invoice generation failed, falling back to client PDF', err);
      generateInvoicePDF();
  }
}

// Generate receipt on backend (type=receipt). Falls back to client-side receipt creation if needed.
async function generateReceiptServerPDF() {
    updatePreview();
    // Save to history first to request a server-generated receipt number and persist the payload
  await saveToHistory('receipt');
    const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const entry = history.find(h => h.number === invoiceNumber && h.type === 'receipt');
    const payload = (entry && entry.payload) ? entry.payload : collectInvoiceData();
    payload.type = 'receipt';

  try {
      showSpinner();
      const resp = await fetch('/api/invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      hideSpinner();
      if (!resp.ok) throw new Error('Server returned ' + resp.status);
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const rn = payload.receiptNumber || document.getElementById('invoiceNumber').value;
      a.download = `receipt_${rn}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
  } catch (err) {
      hideSpinner();
      console.warn('Backend receipt generation failed, falling back to client PDF', err);
      showToast('Server failed — falling back to client PDF', 'error');
      generateReceiptPDF();
  }
}

function generateReceiptPDF() {
  updatePreview();
  // Clone invoice preview and add payment details markup
  const invoiceContent = document.getElementById('invoicePreview').innerHTML;
  const receiptEl = document.getElementById('receiptPreview');
  receiptEl.innerHTML = `\n      <div class="relative z-10">\n          ${invoiceContent.replace('INVOICE', 'RECEIPT')}\n          <div class="mt-4 p-3 bg-green-50 rounded-md">\n              <p class="text-green-700 text-sm">Payment received on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>\n          </div>\n      </div>\n  `;

  document.getElementById('invoicePreview').classList.add('hidden');
  document.getElementById('receiptPreview').classList.remove('hidden');
  document.getElementById('downloadReceiptBtn').classList.remove('hidden');

  html2canvas(receiptEl).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 295;
      while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= 295;
      }

      pdf.save(`receipt_${document.getElementById('invoiceNumber').value}.pdf`);
  });
}

// Collect invoice data into a serializable object for backend
function collectInvoiceData() {
  const rows = document.querySelectorAll('#servicesTable tr');
  const services = Array.from(rows).map(row => ({
      desc: row.querySelector('.service-desc').value || '-',
      qty: row.querySelector('.service-qty').value || '0',
      rate: row.querySelector('.service-rate').value || '0'
  }));

  return {
      invoiceNumber: document.getElementById('invoiceNumber').value,
      issueDate: document.getElementById('issueDate').value,
      dueDate: document.getElementById('dueDate').value,
      clientName: document.getElementById('clientName').value,
      clientCompany: document.getElementById('clientCompany').value,
      clientEmail: document.getElementById('clientEmail').value,
      clientPhone: document.getElementById('clientPhone').value,
      clientAddress: document.getElementById('clientAddress').value,
      paymentMethod: document.getElementById('paymentMethod').value,
      invoiceNotes: document.getElementById('invoiceNotes').value,
            invoiceStatus: document.getElementById('invoiceStatus') ? document.getElementById('invoiceStatus').value : 'pending',
      taxRate: document.getElementById('taxRate').value || '0',
      discount: document.getElementById('discountAmt').value || '0',
      currency: document.getElementById('currencySelect').value || 'USD',
      services: services
  };
}

// Save invoice/receipt to history (existing localStorage flow)
async function saveToHistory(type) {
    // Save the full invoice payload into history (so it can be re-loaded/edited)
    let history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
    const payload = collectInvoiceData();
    const invoiceNumber = payload.invoiceNumber;
    const date = new Date().toISOString();

    // If saving a receipt, request a server-generated unique receipt number if not already present
    if (type === 'receipt') {
        if (!payload.receiptNumber) {
            try {
                const resp = await fetch('/api/receipt-number', { method: 'POST' });
                if (resp.ok) {
                    const data = await resp.json();
                    payload.receiptNumber = data.receiptNumber || data.number || payload.receiptNumber;
                } else {
                    // fallback: small client-side random suffix if server fails
                    const now = new Date();
                    const seq = Math.floor(Math.random() * 9000) + 1000;
                    payload.receiptNumber = `RCT-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${seq}`;
                }
            } catch (e) {
                const now = new Date();
                const seq = Math.floor(Math.random() * 9000) + 1000;
                payload.receiptNumber = `RCT-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${seq}`;
            }
        }
    }

        // Attach status to payload (so history reflects whether invoice is pending/paid)
        payload.invoiceStatus = document.getElementById('invoiceStatus') ? document.getElementById('invoiceStatus').value : 'pending';

        // Ensure invoiceNumber exists and is unique for new invoices
        let finalInvoiceNumber = invoiceNumber;
        if (!finalInvoiceNumber || finalInvoiceNumber.trim() === '') {
            const next = parseInt(localStorage.getItem('lastInvoiceNumber') || lastNum || 1, 10);
            finalInvoiceNumber = `INV-${String(next).padStart(4, '0')}`;
            // update on the form so user sees it
            document.getElementById('invoiceNumber').value = finalInvoiceNumber;
        }

        const entry = {
            number: invoiceNumber,
            type: type === 'receipt' ? 'receipt' : 'invoice',
            date: date,
            client: payload.clientName || 'Unnamed Client',
            amount: document.getElementById('totalDue').value,
            payload: payload
        };

        const existingIndex = history.findIndex(item => item.number === invoiceNumber);
        if (existingIndex >= 0) {
            // If saving a receipt, keep the original invoice entry but also add/replace a receipt entry
            if (type === 'receipt') {
                // Update invoice entry status to 'paid'
                history[existingIndex].payload = { ...history[existingIndex].payload, ...payload };
                history[existingIndex].payload.invoiceStatus = 'paid';

                // Add a separate receipt entry (so receipts dashboard can list receipts separately)
                history.unshift({ number: invoiceNumber, type: 'receipt', date: date, client: payload.clientName || 'Unnamed Client', amount: document.getElementById('totalDue').value, payload: payload });
            } else {
                // update invoice entry
                history[existingIndex] = { ...history[existingIndex], ...entry };
            }
        } else {
            // New invoice: add it
            history.unshift(entry);

            // If this is an invoice save (not a receipt), increment lastInvoiceNumber so next invoice gets a new number
            if (type === 'invoice') {
                // Use the invoice number just stored to compute next
                const currentNum = parseInt(finalInvoiceNumber.split('-')[1], 10) || (lastNum);
                const nextNum = currentNum + 1;
                localStorage.setItem('lastInvoiceNumber', String(nextNum));
                document.getElementById('invoiceNumber').value = `INV-${String(nextNum).padStart(4, '0')}`;
            }
        }

    localStorage.setItem('invoiceHistory', JSON.stringify(history));
}

// Open history modal
function openHistoryModal() {
    const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
    const historyList = document.getElementById('historyList');

    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="text-center py-10 text-gray-400">
                <i data-feather="clock" class="w-10 h-10 mx-auto mb-4"></i>
                <p>No invoice history yet</p>
            </div>
        `;
    } else {
        historyList.innerHTML = history.map(item => {
            const status = item.payload?.invoiceStatus || 'pending';
            const statusBadge = status === 'paid' ? `<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Paid</span>` : `<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pending</span>`;
            const extra = item.type === 'receipt' && item.payload?.receiptNumber ? ` - ${item.payload.receiptNumber}` : '';
            return `
            <div class="p-3 border rounded-lg hover:bg-gray-50 flex justify-between items-center">
                <div>
                    <p class="font-medium text-lessy-blue">${item.number}${extra} ${status === 'paid' ? '' : ''}</p>
                    <p class="text-sm text-gray-600">${item.client}</p>
                </div>
                <div class="text-right flex items-center gap-2">
                    <div class="text-right mr-4">
                        <p class="font-medium">${item.amount}</p>
                        <p class="text-xs text-gray-500">${new Date(item.date).toLocaleDateString()}</p>
                        <div class="mt-1">${statusBadge}</div>
                    </div>
                    <div class="flex gap-2">
                        <button data-number="${item.number}" class="edit-history px-2 py-1 bg-lessy-blue text-white text-sm rounded">Edit</button>
                        <button data-number="${item.number}" class="regen px-2 py-1 bg-lessy-gold text-lessy-blue text-sm rounded">Download</button>
                    </div>
                </div>
            </div>
        `}).join('');

        // Attach handlers for edit and download
        historyList.querySelectorAll('.edit-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const num = e.currentTarget.getAttribute('data-number');
                loadInvoiceFromHistory(num);
                document.getElementById('historyModal').classList.add('hidden');
            });
        });

        historyList.querySelectorAll('.regen').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const num = e.currentTarget.getAttribute('data-number');
                const item = history.find(h => h.number === num);
                if (!item) return;
                // If item is a receipt, download receipt; else download invoice
                const payload = item.payload || {};
                if (item.type === 'receipt') payload.type = 'receipt';
                try {
                    const resp = await fetch('/api/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!resp.ok) throw new Error('Server failed');
                    const blob = await resp.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${item.type === 'receipt' ? 'receipt' : 'invoice'}_${item.number}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                } catch (err) {
                    console.warn('Download failed', err);
                }
            });
        });
    }

    document.getElementById('historyModal').classList.remove('hidden');
    if (window.feather) feather.replace();
}

// Receipts dashboard functions
function openReceiptsModal() {
    renderReceiptsList();
    document.getElementById('receiptsModal').classList.remove('hidden');
    if (window.feather) feather.replace();
}

function closeReceiptsModal() {
    document.getElementById('receiptsModal').classList.add('hidden');
}

function renderReceiptsList() {
    const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
    const receipts = history.filter(h => h.type === 'receipt');
    const list = document.getElementById('receiptsList');
    const previewArea = document.getElementById('receiptPreviewArea');
    const previewPanel = document.getElementById('receiptPreviewPanel');
    const downloadBtn = document.getElementById('downloadSelectedReceiptBtn');

    previewArea.classList.add('hidden');
    previewPanel.innerHTML = '';

    if (receipts.length === 0) {
        list.innerHTML = `
            <div class="text-center py-10 text-gray-400">
                <i data-feather="file-text" class="w-10 h-10 mx-auto mb-4"></i>
                <p>No receipts yet</p>
            </div>
        `;
        return;
    }

    list.innerHTML = receipts.map(r => `
        <div class="p-3 border rounded-lg hover:bg-gray-50 flex justify-between items-center">
            <div>
                <p class="font-medium text-lessy-blue">${r.number} - ${r.payload?.receiptNumber || ''}</p>
                <p class="text-sm text-gray-600">${r.client}</p>
            </div>
            <div class="flex gap-2 items-center">
                <button data-number="${r.number}" class="preview-receipt px-2 py-1 bg-lessy-blue text-white text-sm rounded">Preview</button>
                <button data-number="${r.number}" class="download-receipt px-2 py-1 bg-lessy-gold text-lessy-blue text-sm rounded">Download</button>
            </div>
        </div>
    `).join('');

    // Attach handlers
    list.querySelectorAll('.preview-receipt').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const num = e.currentTarget.getAttribute('data-number');
            selectReceipt(num);
        });
    });

    list.querySelectorAll('.download-receipt').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const num = e.currentTarget.getAttribute('data-number');
            await downloadReceiptFromHistory(num);
        });
    });
}

function selectReceipt(number) {
    const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
    const entry = history.find(h => h.number === number && h.type === 'receipt');
    if (!entry) return;

    const previewArea = document.getElementById('receiptPreviewArea');
    const previewPanel = document.getElementById('receiptPreviewPanel');
    previewArea.classList.remove('hidden');

    // Render a simple preview using saved payload via updatePreview-like rendering
    const p = entry.payload || {};
    const formatted = `
        <div class="p-3">
            <p class="font-semibold">Receipt #: ${p.receiptNumber || ''}</p>
            <p class="text-sm">Invoice #: ${p.invoiceNumber || ''}</p>
            <p class="text-sm">Client: ${p.clientName || ''}</p>
            <p class="text-sm">Date: ${new Date(entry.date).toLocaleDateString()}</p>
            <div class="mt-2">
                <table class="w-full text-sm">
                    ${ (p.services || []).map(s => `<tr><td>${s.desc}</td><td class="text-right">${s.qty}</td><td class="text-right">${s.rate}</td></tr>`).join('') }
                </table>
            </div>
            <div class="mt-2 text-right font-bold">Total: ${entry.amount}</div>
        </div>
    `;

    previewPanel.innerHTML = formatted;
}

async function downloadReceiptFromHistory(number) {
    const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
    const entry = history.find(h => h.number === number && h.type === 'receipt');
    if (!entry) return;

    const payload = entry.payload || {};
    payload.type = 'receipt';
    // If this payload doesn't have a server-assigned receiptNumber (older receipts), request one
    if (!payload.receiptNumber) {
        try {
            showSpinner();
            const rnResp = await fetch('/api/receipt-number', { method: 'POST' });
            hideSpinner();
            if (rnResp.ok) {
                const rnData = await rnResp.json();
                payload.receiptNumber = rnData.receiptNumber || rnData.number || payload.receiptNumber;
                // update history and persist
                entry.payload = payload;
                localStorage.setItem('invoiceHistory', JSON.stringify(history));
            }
        } catch (e) {
            hideSpinner();
            // ignore and continue with existing payload
            showToast('Could not assign server receipt number; using local copy', 'error');
        }
    }

    try {
        showSpinner();
        const resp = await fetch('/api/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        hideSpinner();
        if (!resp.ok) throw new Error('Server failed');
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const rn = payload.receiptNumber || payload.invoiceNumber || number;
        a.download = `receipt_${rn}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        hideSpinner();
        console.warn('Download failed', err);
        showToast('Download failed', 'error');
    }
}

// Load an invoice payload from history into the form for editing
function loadInvoiceFromHistory(number) {
    const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
    const item = history.find(h => h.number === number);
    if (!item || !item.payload) return;
    const p = item.payload;

    document.getElementById('invoiceNumber').value = p.invoiceNumber || document.getElementById('invoiceNumber').value;
    document.getElementById('issueDate').value = p.issueDate || document.getElementById('issueDate').value;
    document.getElementById('dueDate').value = p.dueDate || document.getElementById('dueDate').value;
    document.getElementById('clientName').value = p.clientName || '';
    document.getElementById('clientCompany').value = p.clientCompany || '';
    document.getElementById('clientEmail').value = p.clientEmail || '';
    document.getElementById('clientPhone').value = p.clientPhone || '';
    document.getElementById('clientAddress').value = p.clientAddress || '';
    document.getElementById('paymentMethod').value = p.paymentMethod || 'M-Pesa';
    document.getElementById('invoiceNotes').value = p.invoiceNotes || '';
    document.getElementById('taxRate').value = p.taxRate || '0';
    document.getElementById('discountAmt').value = p.discount || '0';
    document.getElementById('currencySelect').value = p.currency || 'USD';

    // Rebuild services table
    const table = document.getElementById('servicesTable');
    table.innerHTML = '';
    (p.services || []).forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b';
        tr.dataset.row = idx;
        tr.innerHTML = `
            <td class="py-2"><input type="text" class="w-full px-2 py-1 border rounded service-desc" value="${s.desc || ''}"></td>
            <td class="py-2"><input type="number" min="1" value="${s.qty || '1'}" class="w-20 px-2 py-1 border rounded text-right service-qty"></td>
            <td class="py-2"><input type="number" min="0" step="0.01" class="w-24 px-2 py-1 border rounded text-right service-rate" value="${s.rate || '0'}"></td>
            <td class="py-2"><input type="text" class="w-24 px-2 py-1 border rounded text-right service-amt" value="${(parseFloat(s.qty||0)*parseFloat(s.rate||0)).toFixed(2)}" readonly></td>
            <td class="py-2 text-center"><button class="remove-row text-red-500 hover:text-red-700"><i data-feather="trash-2" class="w-4 h-4"></i></button></td>
        `;
        table.appendChild(tr);
        tr.querySelector('.remove-row').addEventListener('click', function() { tr.remove(); renumberRows(); calculateAmounts(); });
    });

    calculateAmounts();
}

// Close history modal
function closeHistoryModal() {
  document.getElementById('historyModal').classList.add('hidden');
}

// Mark as paid: show receipt preview and enable receipt download
async function markAsPaid() {
        // Mark form status as paid, then save to history to request server receiptNumber and persist payload
        if (document.getElementById('invoiceStatus')) document.getElementById('invoiceStatus').value = 'paid';
        await saveToHistory('receipt');
    const invoiceContent = document.getElementById('invoicePreview').innerHTML;
    const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const entry = history.find(h => h.number === invoiceNumber && h.type === 'receipt');
    const receiptNumber = entry && entry.payload ? entry.payload.receiptNumber : null;

  document.getElementById('receiptPreview').innerHTML = `
      <div class="relative z-10">
          ${invoiceContent.replace('INVOICE', 'RECEIPT')}
          ${receiptNumber ? `<p class="text-sm font-medium">Receipt #: ${receiptNumber}</p>` : ''}
          <div class="mt-4 p-3 bg-green-50 rounded-md">
              <p class="text-green-700 text-sm"><i data-feather="check-circle" class="w-4 h-4 inline mr-1"></i> Payment received on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} via ${document.getElementById('paymentMethod').value}</p>
          </div>
      </div>
  `;

  document.getElementById('invoicePreview').classList.add('hidden');
  document.getElementById('receiptPreview').classList.remove('hidden');
  document.getElementById('downloadReceiptBtn').classList.remove('hidden');
  if (window.feather) feather.replace();
}

// Save invoice without downloading
async function saveInvoice() {
    // Ensure invoiceStatus is set (default pending)
    if (!document.getElementById('invoiceStatus')) return;
    document.getElementById('invoiceStatus').value = document.getElementById('invoiceStatus').value || 'pending';
    await saveToHistory('invoice');
    // small visual feedback (could be enhanced)
    alert('Invoice saved to history');
}

// Mark current invoice explicitly as pending (useful if previously marked paid)
async function markAsPending() {
    if (document.getElementById('invoiceStatus')) document.getElementById('invoiceStatus').value = 'pending';
    await saveToHistory('invoice');
    alert('Invoice marked as pending');
}

// Expose a minimal API for tests or other scripts if needed
export default {
  collectInvoiceData,
  convertAmount
};
