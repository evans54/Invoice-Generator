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
  let invoiceNumber = localStorage.getItem('lastInvoiceNumber') || 1;
  document.getElementById('invoiceNumber').value = `INV-${String(invoiceNumber).padStart(4, '0')}`;

  // Event listeners
  document.getElementById('addService').addEventListener('click', addServiceRow);
  document.getElementById('previewBtn').addEventListener('click', updatePreview);
  document.getElementById('generateInvoiceBtn').addEventListener('click', generateInvoiceServerPDF);
  document.getElementById('markAsPaidBtn').addEventListener('click', markAsPaid);
  document.getElementById('downloadReceiptBtn').addEventListener('click', generateReceiptServerPDF);
  document.getElementById('historyBtn').addEventListener('click', openHistoryModal);
  document.getElementById('closeHistoryModal').addEventListener('click', closeHistoryModal);

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
                  <p class="text-sm">123 Business Street</p>
                  <p class="text-sm">Nairobi, Kenya</p>
                  <p class="text-sm">Phone: +254 700 123456</p>
                  <p class="text-sm">Email: invoicing@lessyagency.com</p>
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
function generateInvoicePDF() {
  updatePreview();
  const { jsPDF } = window.jspdf;
  const element = document.getElementById('invoicePreview');

  html2canvas(element).then(canvas => {
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
      saveToHistory('invoice');
  });
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

      saveToHistory('invoice');
  } catch (err) {
      console.warn('Backend invoice generation failed, falling back to client PDF', err);
      generateInvoicePDF();
  }
}

// Generate receipt on backend (type=receipt). Falls back to client-side receipt creation if needed.
async function generateReceiptServerPDF() {
  updatePreview();
  const payload = collectInvoiceData();
  payload.type = 'receipt';

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
      a.download = `receipt_${document.getElementById('invoiceNumber').value}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
  } catch (err) {
      console.warn('Backend receipt generation failed, falling back to client PDF', err);
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
      taxRate: document.getElementById('taxRate').value || '0',
      discount: document.getElementById('discountAmt').value || '0',
      currency: document.getElementById('currencySelect').value || 'USD',
      services: services
  };
}

// Save invoice/receipt to history (existing localStorage flow)
function saveToHistory(type) {
  let history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
  const invoiceNumber = document.getElementById('invoiceNumber').value;
  const clientName = document.getElementById('clientName').value || 'Unnamed Client';
  const totalDue = document.getElementById('totalDue').value;
  const date = new Date().toISOString();

  const existingIndex = history.findIndex(item => item.number === invoiceNumber);
  
  if (existingIndex >= 0) {
      history[existingIndex] = {
          ...history[existingIndex],
          type: type === 'receipt' ? 'receipt' : 'invoice',
          date: date,
          client: clientName,
          amount: totalDue
      };
  } else {
      history.unshift({
          number: invoiceNumber,
          type: type === 'receipt' ? 'receipt' : 'invoice',
          date: date,
          client: clientName,
          amount: totalDue
      });
  }

  localStorage.setItem('invoiceHistory', JSON.stringify(history));

  if (type === 'invoice') {
      const currentNum = parseInt(invoiceNumber.split('-')[1]);
      localStorage.setItem('lastInvoiceNumber', currentNum + 1);
      document.getElementById('invoiceNumber').value = `INV-${String(currentNum + 1).padStart(4, '0')}`;
  }
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
      historyList.innerHTML = history.map(item => `
          <div class="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex justify-between items-center">
              <div>
                  <p class="font-medium text-lessy-blue">${item.number}</p>
                  <p class="text-sm text-gray-600">${item.client}</p>
              </div>
              <div class="text-right">
                  <p class="font-medium">${item.amount}</p>
                  <p class="text-xs text-gray-500">${new Date(item.date).toLocaleDateString()}</p>
              </div>
          </div>
      `).join('');
  }
  
  document.getElementById('historyModal').classList.remove('hidden');
  if (window.feather) feather.replace();
}

// Close history modal
function closeHistoryModal() {
  document.getElementById('historyModal').classList.add('hidden');
}

// Mark as paid: show receipt preview and enable receipt download
function markAsPaid() {
  updatePreview();
  const invoiceContent = document.getElementById('invoicePreview').innerHTML;
  document.getElementById('receiptPreview').innerHTML = `
      <div class="relative z-10">
          ${invoiceContent.replace('INVOICE', 'RECEIPT')}
          <div class="mt-4 p-3 bg-green-50 rounded-md">
              <p class="text-green-700 text-sm"><i data-feather="check-circle" class="w-4 h-4 inline mr-1"></i> Payment received on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} via ${document.getElementById('paymentMethod').value}</p>
          </div>
      </div>
  `;

  document.getElementById('invoicePreview').classList.add('hidden');
  document.getElementById('receiptPreview').classList.remove('hidden');
  document.getElementById('downloadReceiptBtn').classList.remove('hidden');
  if (window.feather) feather.replace();

  saveToHistory('receipt');
}

// Expose a minimal API for tests or other scripts if needed
export default {
  collectInvoiceData,
  convertAmount
};
