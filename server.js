const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { streamInvoicePDF } = require('./lib/server-app');

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
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Replace with your actual domain
    : true, // Allow all origins in development
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

app.post('/api/invoice', (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Invoice backend running on http://localhost:${PORT}`);
});
