import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { InvoiceRepository } from './repositories/InvoiceRepository';
import { InvoiceService } from './services/InvoiceService';
import { PDFGenerator } from './utils/PDFGenerator';
import { PaymentLinkGenerator } from './utils/PaymentLinkGenerator';
import { OrderRepository } from './repositories/OrderRepository';
import { CompanyRepository } from './repositories/CompanyRepository';
import { serviceAuth } from './middleware/serviceAuth';
import { createInvoiceLimiter, generatePdfLimiter, paymentLinkLimiter } from './middleware/rateLimiter';
import { TemplateRepository } from './repositories/TemplateRepository';

/**
 * Load environment variables from .env file
 */
dotenv.config();

/**
 * Express application instance
 */
const app = express();

/**
 * Middleware configuration
 */
app.use(express.json());
app.use(cors());

/**
 * Initialize repositories
 */
const templateRepository = new TemplateRepository();
const orderRepository = new OrderRepository();
const invoiceRepository = new InvoiceRepository();
const pdfGenerator = new PDFGenerator();
const paymentLinkGenerator = new PaymentLinkGenerator(process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3006');

/**
 * Initialize service dependencies
 */
const companyRepository = new CompanyRepository();
const invoiceService = new InvoiceService(
    invoiceRepository,
    orderRepository,
    templateRepository,
    pdfGenerator,
    paymentLinkGenerator
);

/**
 * Create a new invoice
 * @route POST /api/invoices
 * @param {object} req.body - Invoice data
 * @param {string} req.body.customerId - ID of the customer
 * @param {number} req.body.amount - Total amount of the invoice
 * @param {string} req.body.currency - Currency code (e.g., 'USD', 'EUR')
 * @param {string} req.body.dueDate - Due date of the invoice (ISO 8601 format)
 * @param {object[]} req.body.items - Array of invoice items
 * @param {string} req.body.items[].description - Description of the item
 * @param {number} req.body.items[].quantity - Quantity of items
 * @param {number} req.body.items[].unitPrice - Price per unit
 * @param {('draft'|'sent'|'paid'|'void')} [req.body.status=draft] - Invoice status
 * @returns {object} Created invoice
 * @example
 * // Request body example:
 * {
 *   "customerId": "CUST-001",
 *   "amount": 299.99,
 *   "currency": "USD",
 *   "dueDate": "2024-04-01T00:00:00.000Z",
 *   "items": [
 *     {
 *       "description": "Premium Widget",
 *       "quantity": 1,
 *       "unitPrice": 299.99
 *     }
 *   ],
 *   "status": "draft"
 * }
 */
app.post('/api/invoices',
    createInvoiceLimiter,
    serviceAuth(),
    async (req, res) => {
        try {
            console.log('Creating invoice with data:', req.body);
            const invoice = await invoiceService.createInvoice(req.body);
            res.status(201).json(invoice);
        } catch (error) {
            console.error('Failed to create invoice:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to create invoice'
            });
        }
    });

/**
 * Get an invoice by ID with full template data
 * @route GET /api/invoices/:id
 * @param {string} req.params.id - Invoice ID
 * @returns {InvoiceTemplate} Invoice template with all data
 */
app.get('/api/invoices/:id',
    createInvoiceLimiter,
    async (req, res) => {
        try {
            const invoice = await invoiceRepository.findById(req.params.id);
            if (!invoice) {
                return res.status(404).json({ error: 'Invoice not found' });
            }

            console.log('Invoice found:', invoice);

            // Get template
            const template = await templateRepository.findById(invoice.template_id);
            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }

            // Get company details
            const company = await companyRepository.findById(invoice.company_id);
            if (!company) {
                return res.status(404).json({ error: 'Company not found' });
            }

            // Get orders for this invoice's batch
            const orders = await orderRepository.findByBatchId(invoice.order_batch_id);
            if (!orders || orders.length === 0) {
                return res.status(404).json({ error: 'Order details not found' });
            }

            // Calculate totals from the batch orders
            const subtotal = orders.reduce((sum, order) =>
                sum + parseFloat(order.total_price), 0);
            const tax = subtotal * 0.20; // Assuming 20% tax rate
            const total = subtotal + tax;

            // Get customer details from first order (they'll all be the same customer)
            const customer = await orderRepository.findCustomerById(orders[0].customer_id);
            if (!customer) {
                return res.status(404).json({ error: 'Customer details not found' });
            }

            console.log(customer)
            console.log(subtotal)
            console.log(company)

            // Format phone number helper function
            const formatPhoneNumber = (phone: string | null): string => {
                if (!phone) return '';
                // Remove all non-digit characters
                const digits = phone.replace(/\D/g, '');

                // Handle UK mobile numbers (starting with 07 or 447)
                if (digits.startsWith('07') || digits.startsWith('447')) {
                    const cleaned = digits.startsWith('447') ? digits.slice(2) : digits.slice(1);
                    if (cleaned.length === 10 && cleaned.startsWith('7')) {
                        return `+44 (0) ${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
                    }
                }

                // Handle UK landlines (starting with 02, 03, 01 or 442, 443, 441)
                if (digits.match(/^(0[123]|44[123])/)) {
                    const cleaned = digits.startsWith('44') ? digits.slice(2) : digits.slice(1);
                    if (cleaned.length === 10) {
                        return `+44 (0) ${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
                    }
                }

                return phone; // Return original if not a UK number
            };

            // Replace template variables with actual data
            let html = template.html
                // Company address handling
                .replaceAll('{{company.name}}', company.name)
                .replaceAll('{{company.address_line1}}', company.address_line1 ? company.address_line2 ? company.address_line1 + ', ' : company.address_line1 : '')
                .replaceAll('{{company.address_line2}}', company.address_line2 ? company.address_line2 : '')
                .replaceAll('{{company.city}}', company.city)
                .replaceAll('{{company.county}}', company.county ? company.county + '<br>' : '')
                .replaceAll('{{company.postcode}}', company.postcode)
                .replaceAll('{{company.email}}', company.email)
                .replaceAll('{{company.phone}}', formatPhoneNumber(company.phone))

                // Company payment details
                .replaceAll('{{company.bank_name}}', company.bank_name || '')
                .replaceAll('{{company.account_name}}', company.account_name || '')
                .replaceAll('{{company.account_number}}', company.account_number || '')
                .replaceAll('{{company.sort_code}}', company.sort_code || '')
                .replaceAll('{{company.iban_number}}', company.iban_number || '')

                // Customer address handling
                .replaceAll('{{customer.first_name}} {{customer.last_name}}', `${customer.first_name} ${customer.last_name}`)
                .replaceAll('{{customer.address_line1}}', customer.address_line1 ? customer.address_line2 ? customer.address_line1 + ', ' : customer.address_line1 : '')
                .replaceAll('{{customer.address_line2}}', customer.address_line2 ? customer.address_line2 : '')
                .replaceAll('{{customer.city}}', customer.city)
                .replaceAll('{{customer.county}}', customer.county ? customer.county + '<br>' : '')
                .replaceAll('{{customer.postcode}}', customer.postcode)
                .replaceAll('{{customer.country}}', customer.country)
                .replaceAll('{{customer.email}}', customer.email)
                .replaceAll('{{customer.phone}}', formatPhoneNumber(customer.phone))

                .replaceAll('{{invoice.id}}', invoice.reference)
                .replaceAll('{{invoice.created_at}}', invoice.created_at.toLocaleDateString())
                .replaceAll('{{invoice.due_date}}', invoice.due_date.toLocaleDateString())
                .replaceAll('{{invoice.status}}', invoice.status.toUpperCase())
                .replaceAll('{{invoice.currency}}', invoice.currency)
                .replaceAll('{{invoice.subtotal}}', subtotal.toFixed(2))
                .replaceAll('{{invoice.tax}}', tax.toFixed(2))
                .replaceAll('{{invoice.total}}', total.toFixed(2))
                .replaceAll('{{invoice.items}}', orders.map(order => `
                    <tr>
                        <td>${order.product_name}</td>
                        <td>${order.quantity}</td>
                        <td>${invoice.currency}${parseFloat(order.unit_price).toFixed(2)}</td>
                        <td>${invoice.currency}${parseFloat(order.total_price).toFixed(2)}</td>
                    </tr>
                `).join(''));

            // Find the </head> tag and insert our CSS before it
            const renderedHtml = html.replace('</head>', `
                <style>
                    ${template.css}
                </style>
            </head>`);

            // Send the complete HTML document
            res.setHeader('Content-Type', 'text/html');
            res.send(renderedHtml);

        } catch (error) {
            console.error('Error building invoice template:', error);
            res.status(500).json({ error: 'Failed to build invoice template' });
        }
    });

/**
 * Generate PDF for an invoice
 * @route GET /api/invoices/:id/pdf
 * @param {string} req.params.id - Invoice ID
 * @returns {Buffer} PDF file
 */
app.get('/api/invoices/:id/pdf',
    generatePdfLimiter,
    async (req, res) => {
        try {
            const pdf = await invoiceService.generatePDF(req.params.id);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=invoice-${req.params.id}.pdf`);
            res.send(pdf);
        } catch (error) {
            res.status(500).json({ error: 'Failed to generate PDF' });
        }
    });

/**
 * Generate payment link for an invoice
 * @route GET /api/invoices/:id/payment-link
 * @param {string} req.params.id - Invoice ID
 * @returns {object} Payment link URL
 */
app.get('/api/invoices/:id/payment-link',
    paymentLinkLimiter,
    async (req, res) => {
        try {
            const paymentLink = await invoiceService.generatePaymentLink(req.params.id);
            res.json({ paymentLink });
        } catch (error) {
            res.status(500).json({ error: 'Failed to generate payment link' });
        }
    });

export default app; 