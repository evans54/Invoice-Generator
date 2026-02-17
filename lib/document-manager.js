const fs = require('fs').promises;
const path = require('path');
const { streamInvoicePDF, generateReceiptNumberSequential } = require('./server-app');

// Storage paths
const INVOICES_PATH = path.join(__dirname, '..', 'data', 'invoices.json');
const RECEIPTS_PATH = path.join(__dirname, '..', 'data', 'receipts.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(__dirname, '..', 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Read invoices from storage
async function readInvoices() {
  await ensureDataDir();
  try {
    const data = await fs.readFile(INVOICES_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Write invoices to storage
async function writeInvoices(invoices) {
  await ensureDataDir();
  await fs.writeFile(INVOICES_PATH, JSON.stringify(invoices, null, 2));
}

// Read receipts from storage
async function readReceipts() {
  await ensureDataDir();
  try {
    const data = await fs.readFile(RECEIPTS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Write receipts to storage
async function writeReceipts(receipts) {
  await ensureDataDir();
  await fs.writeFile(RECEIPTS_PATH, JSON.stringify(receipts, null, 2));
}

// Save invoice with automatic status
async function saveInvoice(invoiceData) {
  const invoices = await readInvoices();
  
  // Check if invoice already exists
  const existingIndex = invoices.findIndex(inv => inv.invoiceNumber === invoiceData.invoiceNumber);
  
  const invoice = {
    id: existingIndex >= 0 ? invoices[existingIndex].id : Date.now().toString(),
    invoiceNumber: invoiceData.invoiceNumber,
    status: invoiceData.status || 'pending', // Default to pending
    clientName: invoiceData.clientName,
    clientCompany: invoiceData.clientCompany,
    clientEmail: invoiceData.clientEmail,
    clientPhone: invoiceData.clientPhone,
    clientAddress: invoiceData.clientAddress,
    issueDate: invoiceData.issueDate,
    dueDate: invoiceData.dueDate,
    currency: invoiceData.currency || 'USD',
    taxRate: invoiceData.taxRate || 0,
    discount: invoiceData.discount || 0,
    services: invoiceData.services || [],
    subtotal: calculateSubtotal(invoiceData.services || []),
    total: calculateTotal(invoiceData),
    notes: invoiceData.invoiceNotes || '',
    createdAt: existingIndex >= 0 ? invoices[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    invoices[existingIndex] = invoice;
  } else {
    invoices.push(invoice);
  }

  await writeInvoices(invoices);
  
  return {
    success: true,
    invoice: invoice,
    message: existingIndex >= 0 ? 'Invoice updated successfully' : 'Invoice saved successfully'
  };
}

// Update invoice status
async function updateInvoiceStatus(invoiceId, newStatus) {
  const invoices = await readInvoices();
  const invoiceIndex = invoices.findIndex(inv => inv.id === invoiceId);
  
  if (invoiceIndex === -1) {
    throw new Error('Invoice not found');
  }

  const validStatuses = ['pending', 'paid', 'completed'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid status. Must be one of: pending, paid, completed');
  }

  invoices[invoiceIndex].status = newStatus;
  invoices[invoiceIndex].updatedAt = new Date().toISOString();

  // If status is being changed to completed, generate a receipt
  if (newStatus === 'completed') {
    await generateReceipt(invoiceId);
  }

  await writeInvoices(invoices);

  return {
    success: true,
    invoice: invoices[invoiceIndex],
    message: `Invoice status updated to ${newStatus}`
  };
}

// Generate receipt for completed invoice
async function generateReceipt(invoiceId) {
  const invoices = await readInvoices();
  const invoice = invoices.find(inv => inv.id === invoiceId);
  
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.status !== 'completed') {
    throw new Error('Invoice must be completed to generate receipt');
  }

  // Check if receipt already exists
  const receipts = await readReceipts();
  const existingReceipt = receipts.find(r => r.invoiceId === invoiceId);
  if (existingReceipt) {
    return {
      success: true,
      receipt: existingReceipt,
      message: 'Receipt already exists for this invoice'
    };
  }

  const receiptNumber = generateReceiptNumberSequential();
  
  const receipt = {
    id: Date.now().toString(),
    receiptNumber: receiptNumber,
    invoiceId: invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    clientCompany: invoice.clientCompany,
    amount: invoice.total,
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    receiptDate: new Date().toISOString().split('T')[0],
    status: 'issued',
    createdAt: new Date().toISOString()
  };

  receipts.push(receipt);
  await writeReceipts(receipts);

  return {
    success: true,
    receipt: receipt,
    message: 'Receipt generated successfully'
  };
}

// Search documents by reference number
async function searchDocuments(query) {
  if (!query || query.trim().length < 2) {
    return { invoices: [], receipts: [] };
  }

  const searchTerm = query.toLowerCase().trim();
  const invoices = await readInvoices();
  const receipts = await readReceipts();

  const matchedInvoices = invoices.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchTerm) ||
    inv.clientName.toLowerCase().includes(searchTerm) ||
    (inv.clientCompany && inv.clientCompany.toLowerCase().includes(searchTerm)) ||
    inv.clientEmail?.toLowerCase().includes(searchTerm) ||
    inv.clientPhone?.includes(searchTerm)
  );

  const matchedReceipts = receipts.filter(rec => 
    rec.receiptNumber.toLowerCase().includes(searchTerm) ||
    rec.invoiceNumber.toLowerCase().includes(searchTerm) ||
    rec.clientName.toLowerCase().includes(searchTerm) ||
    (rec.clientCompany && rec.clientCompany.toLowerCase().includes(searchTerm))
  );

  return {
    invoices: matchedInvoices,
    receipts: matchedReceipts,
    total: matchedInvoices.length + matchedReceipts.length
  };
}

// Get all invoices
async function getInvoices() {
  const invoices = await readInvoices();
  return {
    success: true,
    invoices: invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    total: invoices.length
  };
}

// Get all receipts
async function getReceipts() {
  const receipts = await readReceipts();
  return {
    success: true,
    receipts: receipts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    total: receipts.length
  };
}

// Helper functions
function calculateSubtotal(services) {
  return services.reduce((sum, service) => {
    const qty = parseFloat(service.qty) || 0;
    const rate = parseFloat(service.rate) || 0;
    return sum + (qty * rate);
  }, 0);
}

function calculateTotal(invoiceData) {
  const subtotal = calculateSubtotal(invoiceData.services || []);
  const taxRate = parseFloat(invoiceData.taxRate) || 0;
  const discount = parseFloat(invoiceData.discount) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  return subtotal + taxAmount - discount;
}

module.exports = {
  saveInvoice,
  updateInvoiceStatus,
  generateReceipt,
  searchDocuments,
  getInvoices,
  getReceipts
};
