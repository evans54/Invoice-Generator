const PDFDocument = require('pdfkit');

const currencySymbols = {
  USD: '$',
  KSH: 'KSh ',
  TZS: 'TSh ',
  EURO: '€',
  PUNDS: '£'
};

// Static rates: USD per unit
const staticRatesToUSD = {
  USD: 1.0,
  KSH: 1 / 155.0,
  TZS: 1 / 2350.0,
  EURO: 1.08,
  PUNDS: 1.25
};

function convertAmount(amount, from, to) {
  if (!from || !to || from === to) return amount;
  const fromToUsd = staticRatesToUSD[from] || 1.0;
  const toToUsd = staticRatesToUSD[to] || 1.0;
  const amountInUsd = amount * fromToUsd;
  const converted = amountInUsd / toToUsd;
  return converted;
}

function getSymbol(code) {
  return currencySymbols[code] || '';
}

// Build a PDF document and stream to `res` (Express response)
function streamInvoicePDF(res, data) {
  const currency = data.currency || 'USD';
  const symbol = getSymbol(currency);

  const services = Array.isArray(data.services) ? data.services : [];
  let subtotal = 0;
  services.forEach(s => {
    const qty = parseFloat(s.qty) || 0;
    const rate = parseFloat(s.rate) || 0;
    subtotal += qty * rate;
  });
  const taxRate = parseFloat(data.taxRate) || 0;
  const discount = parseFloat(data.discount) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-disposition', `attachment; filename=${data.type === 'receipt' ? 'receipt' : 'invoice'}_${data.invoiceNumber || 'invoice'}.pdf`);
  res.setHeader('Content-type', 'application/pdf');
  doc.pipe(res);

  // Header
  doc.fontSize(20).fillColor('#1a365d').text(data.type === 'receipt' ? 'RECEIPT' : 'INVOICE', { align: 'left' });
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('black');
  doc.text(`Invoice #: ${data.invoiceNumber || ''}`);
  doc.text(`Issue Date: ${data.issueDate || ''}`);
  doc.text(`Due Date: ${data.dueDate || ''}`);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').text('From:');
  doc.font('Helvetica').text('Lessy Communication Agency');
  doc.text('123 Business Street, Nairobi, Kenya');
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').text('Bill To:');
  doc.font('Helvetica').text(`${data.clientName || ''}`);
  if (data.clientCompany) doc.text(`${data.clientCompany}`);
  if (data.clientAddress) doc.text(`${data.clientAddress}`);
  if (data.clientPhone) doc.text(`Phone: ${data.clientPhone}`);
  if (data.clientEmail) doc.text(`Email: ${data.clientEmail}`);

  doc.moveDown(1);

  // Table header
  doc.font('Helvetica-Bold');
  doc.text('Description', 50, doc.y, { continued: true });
  doc.text('Qty', 300, doc.y, { width: 50, align: 'right', continued: true });
  doc.text('Rate', 360, doc.y, { width: 80, align: 'right', continued: true });
  doc.text('Amount', 450, doc.y, { width: 90, align: 'right' });
  doc.moveDown(0.5);
  doc.font('Helvetica');

  services.forEach(s => {
    const desc = s.desc || '-';
    const qty = parseFloat(s.qty) || 0;
    const rate = parseFloat(s.rate) || 0;
    const amt = qty * rate;

    doc.text(desc, 50, doc.y, { continued: true });
    doc.text(qty.toString(), 300, doc.y, { width: 50, align: 'right', continued: true });
    doc.text(`${symbol}${rate.toFixed(2)}`, 360, doc.y, { width: 80, align: 'right', continued: true });
    doc.text(`${symbol}${amt.toFixed(2)}`, 450, doc.y, { width: 90, align: 'right' });
    doc.moveDown(0.5);
  });

  doc.moveDown(1);
  doc.font('Helvetica');
  doc.text(`Subtotal: ${symbol}${subtotal.toFixed(2)}`, { align: 'right' });
  if (taxRate > 0) doc.text(`Tax (${taxRate}%): ${symbol}${taxAmount.toFixed(2)}`, { align: 'right' });
  if (discount > 0) doc.text(`Discount: -${symbol}${discount.toFixed(2)}`, { align: 'right' });
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text(`Total Due: ${symbol}${total.toFixed(2)}`, { align: 'right' });

  if (data.invoiceNotes) {
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Notes:');
    doc.font('Helvetica').text(data.invoiceNotes);
  }

  doc.end();
}

module.exports = {
  streamInvoicePDF,
  convertAmount
};
