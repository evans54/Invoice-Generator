# Invoice Generator

A professional invoice and receipt generator built with Node.js backend and vanilla JavaScript frontend.

## Features

- **Invoice Generation**: Create professional invoices with customizable client information, services, and payment details
- **Receipt Generation**: Generate receipts for paid invoices with sequential numbering
- **Multi-Currency Support**: Support for USD, KSH, TZS, EURO, and POUNDS with automatic conversion
- **PDF Export**: Server-side PDF generation using PDFKit
- **Invoice History**: Track and manage previous invoices
- **Responsive Design**: Mobile-friendly interface using Tailwind CSS

## Recent Updates

- **Save Invoice**: New "Save Invoice" button saves an invoice to local history without downloading
- **Mark as Pending**: New button to explicitly mark an invoice as pending (doesn't consume a new invoice number)
- **Receipt Numbering**: Receipts now request a server-generated sequential receipt number via POST `/api/receipt-number`
- **UI Feedback**: Inline toast notifications and spinner overlay for better user experience
- **Security Enhancements**: Added rate limiting, CORS protection, and input validation
- **Bug Fixes**: Fixed currency typo (PUNDS → POUNDS) throughout the application

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. For production:
   ```bash
   npm start
   ```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example` and configure:

- `NODE_ENV`: Set to 'production' for production deployment
- `PORT`: Server port (default: 3000)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS
- Business information and bank details for PDF generation

### Business Details

Update the business information in `.env` to customize your invoices:
- Business name and address
- Bank details for payments
- M-Pesa paybill information

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configurable origin restrictions
- **Security Headers**: Helmet.js for security headers
- **Input Validation**: Server-side validation for all inputs
- **Content Security Policy**: CSP headers for XSS protection

## API Endpoints

### POST /api/invoice
Generate invoice PDF

**Request Body:**
```json
{
  "type": "invoice|receipt",
  "invoiceNumber": "INV-0001",
  "clientName": "Client Name",
  "clientCompany": "Company Name",
  "clientEmail": "email@example.com",
  "clientPhone": "+1234567890",
  "clientAddress": "Client Address",
  "services": [
    {
      "desc": "Service Description",
      "qty": 1,
      "rate": 100.00
    }
  ],
  "taxRate": 0,
  "discount": 0,
  "currency": "USD",
  "issueDate": "2024-01-01",
  "dueDate": "2024-01-15",
  "paymentMethod": "Bank Transfer",
  "invoiceNotes": "Additional notes"
}
```

### POST /api/receipt-number
Generate sequential receipt number

**Response:**
```json
{
  "receiptNumber": "RCT-20240101-0001"
}
```

## Development

### Project Structure

```
Invoice-Generator/
├── lib/
│   └── server-app.js          # PDF generation logic
├── assets/
│   └── app.js                 # Frontend application
├── data/                      # Receipt counter storage
├── index.html                 # Main application page
├── server.js                  # Express server
├── package.json               # Dependencies
└── README.md                  # This file
```

### Scripts

- `npm start`: Start production server
- `npm run dev`: Start development server with nodemon
- `npm audit`: Check for security vulnerabilities
- `npm outdated`: Check for outdated packages

## Security Considerations

1. **Update Dependencies**: Regularly run `npm audit fix` to address vulnerabilities
2. **Environment Configuration**: Use environment variables for sensitive data
3. **CORS Settings**: Configure allowed origins for production
4. **Rate Limiting**: Adjust rate limits based on your usage patterns
5. **Input Validation**: All inputs are validated server-side

## License

This project is proprietary software.

## Support

For support and issues, please contact the development team.