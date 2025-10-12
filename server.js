const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { streamInvoicePDF } = require('./lib/server-app');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

app.post('/api/invoice', (req, res) => {
  try {
    const data = req.body || {};
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
