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
 * Initialize service dependencies
 */
const orderRepository = new OrderRepository();
const companyRepository = new CompanyRepository();
const invoiceRepository = new InvoiceRepository();
const pdfGenerator = new PDFGenerator();
const paymentLinkGenerator = new PaymentLinkGenerator(process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3002');
const invoiceService = new InvoiceService(
    invoiceRepository,
    orderRepository,
    companyRepository,
    pdfGenerator,
    paymentLinkGenerator
);
const templateRepository = new TemplateRepository();

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
            const invoice = await invoiceService.createInvoice(req.body);
            res.status(201).json(invoice);
        } catch (error) {
            res.status(500).json({ error: 'Failed to create invoice' });
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

            // Get template
            const template = await templateRepository.findById(invoice.templateId);
            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }

            // Get company details
            const company = await companyRepository.findById(invoice.companyId);
            if (!company) {
                return res.status(404).json({ error: 'Company details not found' });
            }

            // Get order details
            const orders = await orderRepository.findByBatchId(invoice.orderBatchId);
            if (!orders || orders.length === 0) {
                return res.status(404).json({ error: 'Order details not found' });
            }

            const order = orders[0];

            // Get customer details
            const customer = await orderRepository.findCustomerById(order.customerId);
            if (!customer) {
                return res.status(404).json({ error: 'Customer details not found' });
            }

            // Calculate totals
            const subtotal = invoice.items.reduce((sum, item) =>
                sum + (item.quantity * item.unitPrice), 0);
            const tax = subtotal * 0.20; // Assuming 20% tax rate
            const total = subtotal + tax;

            // Format customer address
            const customerAddress = [
                customer.addressLine1,
                customer.addressLine2,
                customer.addressLine3,
                customer.city,
                customer.county,
                customer.postcode,
                customer.country
            ].filter(Boolean).join('\n');

            // Replace template variables with actual data
            let html = template.html
                .replace('{{company.name}}', company.name)
                .replace('{{company.address}}', company.address ?? '')
                .replace('{{company.email}}', company.email)
                .replace('{{company.phone}}', company.phone ?? '')
                .replace('{{company.bank_name}}', company.bankName ?? '')
                .replace('{{company.account_name}}', company.accountName ?? '')
                .replace('{{company.account_number}}', company.accountNumber ?? '')
                .replace('{{company.sort_code}}', company.sortCode ?? '')
                .replace('{{customer.name}}', `${customer.firstName} ${customer.lastName}`)
                .replace('{{customer.address}}', customerAddress)
                .replace('{{customer.email}}', customer.email)
                .replace('{{customer.phone}}', customer.phone ?? '')
                .replace('{{invoice.id}}', invoice.id)
                .replace('{{invoice.date}}', invoice.createdAt.toLocaleDateString())
                .replace('{{invoice.dueDate}}', invoice.dueDate.toLocaleDateString())
                .replace('{{invoice.subtotal}}', subtotal.toFixed(2))
                .replace('{{invoice.tax}}', tax.toFixed(2))
                .replace('{{invoice.total}}', total.toFixed(2))
                .replace('{{invoice.currency}}', invoice.currency);

            // Replace items table
            const itemsHtml = invoice.items.map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${item.unitPrice.toFixed(2)}</td>
                    <td>${(item.quantity * item.unitPrice).toFixed(2)}</td>
                </tr>
            `).join('');
            html = html.replace('{{invoice.items}}', itemsHtml);

            // Send response with HTML and CSS
            res.json({
                html,
                css: template.css ?? ''
            });

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