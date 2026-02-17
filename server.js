const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { streamInvoicePDF } = require('./lib/server-app');

// Load environment variables
require('dotenv').config();

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Configure CORS for specific origins in production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In production, allow the same origin as the server
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [
        process.env.FRONTEND_URL, // Custom frontend URL if set
        // Add your production domain here when you know it
        // 'https://yourdomain.com',
        // 'https://www.yourdomain.com'
      ].filter(Boolean); // Remove undefined values

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    }

    // In development, allow all origins
    return callback(null, true);
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

app.use(bodyParser.json({ limit: '2mb' }));

// Serve static files (frontend)
app.use(express.static('.'));

// Route for root path - serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/api/invoice', async (req, res) => {
  try {
    const data = req.body || {};
    
    // Basic input validation
    if (!data.invoiceNumber || typeof data.invoiceNumber !== 'string') {
      return res.status(400).json({ error: 'Invalid invoice number' });
    }
    
    if (data.services && !Array.isArray(data.services)) {
      return res.status(400).json({ error: 'Services must be an array' });
    }
    
    // Default to invoice; allow 'type' to be 'receipt'
    data.type = data.type || 'invoice';
    
    // Auto-save invoice with pending status
    try {
      const { saveInvoice } = require('./lib/document-manager');
      await saveInvoice({
        ...data,
        status: 'pending'
      });
    } catch (saveError) {
      console.warn('Failed to auto-save invoice:', saveError);
      // Continue with PDF generation even if save fails
    }
    
    streamInvoicePDF(res, data);
  } catch (err) {
    console.error('Invoice generation error', err);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// Endpoint to generate a server-unique receipt number (sequential)
app.post('/api/receipt-number', (req, res) => {
  try {
    const rn = require('./lib/server-app').generateReceiptNumberSequential();
    res.json({ receiptNumber: rn });
  } catch (err) {
    console.error('Failed to generate receipt number', err);
    res.status(500).json({ error: 'Failed to generate receipt number' });
  }
});

// Save invoice with status
app.post('/api/invoices/save', async (req, res) => {
  try {
    const { saveInvoice } = require('./lib/document-manager');
    const result = await saveInvoice(req.body);
    res.json(result);
  } catch (err) {
    console.error('Failed to save invoice', err);
    res.status(500).json({ error: 'Failed to save invoice' });
  }
});

// Update invoice status
app.put('/api/invoices/:id/status', async (req, res) => {
  try {
    const { updateInvoiceStatus } = require('./lib/document-manager');
    const result = await updateInvoiceStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (err) {
    console.error('Failed to update invoice status', err);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

// Generate receipt for completed invoice
app.post('/api/receipts/generate', async (req, res) => {
  try {
    const { generateReceipt } = require('./lib/document-manager');
    const result = await generateReceipt(req.body.invoiceId);
    res.json(result);
  } catch (err) {
    console.error('Failed to generate receipt', err);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

// Search invoices and receipts
app.get('/api/documents/search', async (req, res) => {
  try {
    const { searchDocuments } = require('./lib/document-manager');
    const result = await searchDocuments(req.query.q);
    res.json(result);
  } catch (err) {
    console.error('Failed to search documents', err);
    res.status(500).json({ error: 'Failed to search documents' });
  }
});

// Get all invoices
app.get('/api/invoices', async (req, res) => {
  try {
    const { getInvoices } = require('./lib/document-manager');
    const result = await getInvoices();
    res.json(result);
  } catch (err) {
    console.error('Failed to get invoices', err);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

// Get all receipts
app.get('/api/receipts', async (req, res) => {
  try {
    const { getReceipts } = require('./lib/document-manager');
    const result = await getReceipts();
    res.json(result);
  } catch (err) {
    console.error('Failed to get receipts', err);
    res.status(500).json({ error: 'Failed to get receipts' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Invoice backend running on http://localhost:${PORT}`);
});
