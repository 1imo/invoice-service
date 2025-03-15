import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { InvoiceRepository } from './repositories/InvoiceRepository';
import { InvoiceService } from './services/InvoiceService';
import { PDFGenerator } from './utils/PDFGenerator';
import { PaymentLinkGenerator } from './utils/PaymentLinkGenerator';
import { OrderRepository } from './repositories/OrderRepository';
import { CompanyRepository } from './repositories/CompanyRepository';
import { CustomerRepository } from './repositories/CustomerRepository';
import { serviceAuth } from './middleware/serviceAuth';
import { createInvoiceLimiter, generatePdfLimiter, paymentLinkLimiter } from './middleware/rateLimiter';
import { TemplateRepository } from './repositories/TemplateRepository';
import axios from 'axios';

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
app.set('trust proxy', 1);


/**
 * Initialize repositories
 */
const templateRepository = new TemplateRepository();
const orderRepository = new OrderRepository();
const invoiceRepository = new InvoiceRepository();
const companyRepository = new CompanyRepository();
const customerRepository = new CustomerRepository();
const pdfGenerator = new PDFGenerator();
const paymentLinkGenerator = new PaymentLinkGenerator(process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3006');

/**
 * Initialize service dependencies
 */
const invoiceService = new InvoiceService(
    invoiceRepository,
    orderRepository,
    templateRepository,
    companyRepository,
    customerRepository,
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

            // Calculate totals from the batch orders and merge products
            const mergedProducts = orders.reduce((acc, order) => {
                const existing = acc.find(p => p.product_name === order.product_name);
                if (existing) {
                    existing.quantity += order.quantity;
                    existing.total_price = (parseFloat(existing.total_price) + parseFloat(order.total_price)).toString();
                } else {
                    acc.push({
                        product_name: order.product_name,
                        quantity: order.quantity,
                        unit_price: order.unit_price,
                        total_price: order.total_price
                    });
                }
                return acc;
            }, [] as Array<{
                product_name: string;
                quantity: number;
                unit_price: string;
                total_price: string;
            }>);

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
                .replaceAll('{{company.county}}', company.county ? company.county : '')
                .replaceAll('{{company.postcode}}', company.postcode)
                .replaceAll('{{company.email}}', company.email)
                .replaceAll('{{company.phone}}', formatPhoneNumber(company.phone))
                .replaceAll('{{company.website}}', company.website || '')
                .replace('{{company.logo}}', `${process.env.IMAGE_SERVICE_URL}/api/media/company-logo/file/${company.id}`)

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
                .replaceAll('{{invoice.key_id}}', `${process.env.PAYMENT_SERVICE_URL}/api/pay/${invoice.id}`)
                .replaceAll('{{invoice.created_at}}', invoice.created_at.toLocaleDateString())
                .replaceAll('{{invoice.due_date}}', invoice.due_date.toLocaleDateString())
                .replaceAll('{{invoice.status}}', invoice.status.toUpperCase())
                .replaceAll('{{invoice.currency}}', invoice.currency)
                .replaceAll('{{invoice.subtotal}}', subtotal.toFixed(2))
                .replaceAll('{{invoice.tax}}', tax.toFixed(2))
                .replaceAll('{{invoice.total}}', total.toFixed(2))
                .replaceAll('{{invoice.items}}', mergedProducts.map(product => `
                    <tr>
                        <td>${product.product_name}</td>
                        <td>${product.quantity}</td>
                        <td>${parseFloat(product.unit_price).toFixed(2)}</td>
                        <td>${parseFloat(product.total_price).toFixed(2)}</td>
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
 * Get an invoice by ID with full template data and action buttons
 * @route GET /api/invoices/:id/with-actions
 * @param {string} req.params.id - Invoice ID
 * @returns {InvoiceTemplate} Invoice template with all data and action buttons
 */
app.get('/api/invoices/:id/view',
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

            // Calculate totals from the batch orders and merge products
            const mergedProducts = orders.reduce((acc, order) => {
                const existing = acc.find(p => p.product_name === order.product_name);
                if (existing) {
                    existing.quantity += order.quantity;
                    existing.total_price = (parseFloat(existing.total_price) + parseFloat(order.total_price)).toString();
                } else {
                    acc.push({
                        product_name: order.product_name,
                        quantity: order.quantity,
                        unit_price: order.unit_price,
                        total_price: order.total_price
                    });
                }
                return acc;
            }, [] as Array<{
                product_name: string;
                quantity: number;
                unit_price: string;
                total_price: string;
            }>);

            const subtotal = orders.reduce((sum, order) =>
                sum + parseFloat(order.total_price), 0);
            const tax = subtotal * 0.20; // Assuming 20% tax rate
            const total = subtotal + tax;

            // Get customer details from first order (they'll all be the same customer)
            const customer = await orderRepository.findCustomerById(orders[0].customer_id);
            if (!customer) {
                return res.status(404).json({ error: 'Customer details not found' });
            }

            // Update the action buttons to a nav bar with logo
            const actionButtons = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background-color: white;
                    padding: 10px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    z-index: 1000;
                ">
                    <img 
                        src="${process.env.IMAGE_SERVICE_URL}/api/media/company-logo/file/${company.id}"
                        alt="${company.name} logo"
                        style="height: 40px; object-fit: contain;"
                    />
                    <div style="display: flex; gap: 10px;">
                        <a href="${process.env.PAYMENT_SERVICE_URL}/api/pay/${invoice.id}" 
                           style="
                            padding: 10px 20px;
                            background-color: #1a73e8;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                            font-weight: 500;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            transition: background-color 0.2s;
                        ">
                            Pay Invoice
                        </a>
                        <a href="/api/invoices/${invoice.id}/pdf" 
                           style="
                            padding: 10px 20px;
                            background-color: #5f6368;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                            font-weight: 500;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            transition: background-color 0.2s;
                        ">
                            Download PDF
                        </a>
                    </div>
                </div>
                <div style="height: 60px;"></div> <!-- Spacer to prevent content from going under navbar -->
            `;

            // Format phone number helper function
            const formatPhoneNumber = (phone: string | null): string => {
                if (!phone) return '';
                const digits = phone.replace(/\D/g, '');
                if (digits.startsWith('07') || digits.startsWith('447')) {
                    const cleaned = digits.startsWith('447') ? digits.slice(2) : digits.slice(1);
                    if (cleaned.length === 10 && cleaned.startsWith('7')) {
                        return `+44 (0) ${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
                    }
                }
                if (digits.match(/^(0[123]|44[123])/)) {
                    const cleaned = digits.startsWith('44') ? digits.slice(2) : digits.slice(1);
                    if (cleaned.length === 10) {
                        return `+44 (0) ${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
                    }
                }
                return phone;
            };

            // Replace template variables with actual data
            let html = template.html
                // Company address handling
                .replaceAll('{{company.name}}', company.name)
                .replaceAll('{{company.address_line1}}', company.address_line1 ? company.address_line2 ? company.address_line1 + ', ' : company.address_line1 : '')
                .replaceAll('{{company.address_line2}}', company.address_line2 ? company.address_line2 : '')
                .replaceAll('{{company.city}}', company.city)
                .replaceAll('{{company.county}}', company.county ? company.county : '')
                .replaceAll('{{company.postcode}}', company.postcode)
                .replaceAll('{{company.email}}', company.email)
                .replaceAll('{{company.phone}}', formatPhoneNumber(company.phone))
                .replaceAll('{{company.website}}', company.website || '')
                .replace('{{company.logo}}', `${process.env.IMAGE_SERVICE_URL}/api/media/company-logo/file/${company.id}`)

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
                .replaceAll('{{invoice.key_id}}', `${process.env.PAYMENT_SERVICE_URL}/api/pay/${invoice.id}`)
                .replaceAll('{{invoice.created_at}}', invoice.created_at.toLocaleDateString())
                .replaceAll('{{invoice.due_date}}', invoice.due_date.toLocaleDateString())
                .replaceAll('{{invoice.status}}', invoice.status.toUpperCase())
                .replaceAll('{{invoice.currency}}', invoice.currency)
                .replaceAll('{{invoice.subtotal}}', subtotal.toFixed(2))
                .replaceAll('{{invoice.tax}}', tax.toFixed(2))
                .replaceAll('{{invoice.total}}', total.toFixed(2))
                .replaceAll('{{invoice.items}}', mergedProducts.map(product => `
                    <tr>
                        <td>${product.product_name}</td>
                        <td>${product.quantity}</td>
                        <td>${parseFloat(product.unit_price).toFixed(2)}</td>
                        <td>${parseFloat(product.total_price).toFixed(2)}</td>
                    </tr>
                `).join(''));

            // Insert the action buttons after the opening body tag
            let renderedHtml = html.replace('<body>', '<body>' + actionButtons);

            // Add the CSS
            renderedHtml = renderedHtml.replace('</head>', `
                <style>
                    ${template.css}
                    @media print {
                        /* Hide nav bar when printing */
                        div[style*="position: fixed"] {
                            display: none !important;
                        }
                        /* Hide spacer when printing */
                        div[style*="height: 60px"] {
                            display: none !important;
                        }
                    }
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

/**
 * Send invoice to customer
 * @route POST /api/invoices/:id/send
 * @param {string} req.params.id - Invoice ID
 */
app.post('/api/invoices/:id/send',
    async (req, res) => {
        try {
            const invoice = await invoiceRepository.findById(req.params.id);
            if (!invoice) {
                return res.status(404).json({ error: 'Invoice not found' });
            }

            // Get company and customer details
            const company = await companyRepository.findById(invoice.company_id);
            if (!company) {
                return res.status(404).json({ error: 'Company not found' });
            }

            const customer = await customerRepository.findById(invoice.customer_id);
            if (!customer) {
                return res.status(404).json({ error: 'Customer not found' });
            }

            const template = await templateRepository.findDefaultByCompanyId(company.id);
            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }

            // Update invoice status
            await invoiceRepository.update(invoice.id, {
                status: 'awaiting payment',
            });

            // Generate PDF
            const pdfBuffer = await invoiceService.generatePDF(invoice.id);
            const pdfBase64 = pdfBuffer.toString('base64');

            // Get all orders in the same batch
            const batchOrders = await orderRepository.findByBatchId(invoice.order_batch_id);
            console.log('Batch orders found:', batchOrders);

            batchOrders.forEach(async order => await orderRepository.update(order.id, {
                status: 'awaiting payment',
            }))

            // Calculate total price from all orders in batch and convert to string
            const totalAmount = batchOrders
                .reduce((sum, order) => sum + parseFloat(order.total_price), 0)
                .toFixed(2);

            // Send email via contact service
            await axios.post(
                `${process.env.CONTACT_SERVICE_URL}/api/email/send`,
                {
                    credentialId: '0393647b-adc5-4e90-a670-016f4499a162',
                    message: {
                        to: customer.email,
                        subject: `Invoice #${invoice.reference}`,
                        html: `
                            <!DOCTYPE html>
                            <html lang="en">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            </head>
                            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f1f5f9;">
                                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
                                    <tr>
                                        <td align="center">
                                            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); margin: 0 auto;">
                                                <tr>
                                                    <td style="padding: 30px 40px; border-bottom: 1px solid #e2e8f0;">
                                                        <img src="${process.env.IMAGE_SERVICE_URL}/api/media/company-logo/file/${company.id}" 
                                                             alt="${company.name}" 
                                                             style="max-height: 50px; width: auto;">
                                                    </td>
                                                </tr>
                                                
                                                <tr>
                                                    <td style="padding: 40px;">
                                                        <h2 style="color: #1e293b; font-size: 24px; margin: 0 0 20px 0;">Invoice from ${company.name}</h2>
                                                        
                                                        <p style="margin: 0 0 16px 0;">Dear ${customer.first_name} ${customer.last_name},</p>
                                                        
                                                        <p style="margin: 0 0 16px 0;">Please find attached your invoice for recent services. Here's a summary of the details:</p>
                                                        
                                                        <table width="100%" cellpadding="25" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 25px 0;">
                                                            <tr>
                                                                <td>
                                                                    <p style="margin: 0 0 10px 0;"><span style="font-weight: 600; color: #64748b;">Invoice Number:</span> ${invoice.reference}</p>
                                                                    <p style="margin: 0 0 10px 0;"><span style="font-weight: 600; color: #64748b;">Amount Due:</span> <span style="font-size: 28px; font-weight: bold; color: #1e293b;">${invoice.currency}${totalAmount}</span></p>
                                                                    <p style="margin: 0;"><span style="font-weight: 600; color: #64748b;">Due Date:</span> <span style="color: #dc2626; font-weight: 600;">${invoice.due_date.toLocaleDateString()}</span></p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                        
                                                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                                            <tr>
                                                                <td align="center">
                                                                    <table cellpadding="0" cellspacing="0" style="margin-right: 10px; display: inline-block;">
                                                                        <tr>
                                                                            <td style="background-color: #2563eb; border-radius: 4px; padding: 14px 28px;">
                                                                                <a href="${process.env.PAYMENT_SERVICE_URL}/api/pay/${invoice.id}" 
                                                                                   style="color: #ffffff; text-decoration: none; font-weight: bold; display: inline-block;">Pay Now</a>
                                                                            </td>
                                                                        </tr>
                                                                    </table>
                                                                    <table cellpadding="0" cellspacing="0" style="display: inline-block;">
                                                                        <tr>
                                                                            <td style="background-color: #475569; border-radius: 4px; padding: 14px 28px;">
                                                                                <a href="${process.env.INVOICE_SERVICE_URL}/api/invoices/${invoice.id}/view" 
                                                                                   style="color: #ffffff; text-decoration: none; font-weight: bold; display: inline-block;">View Invoice</a>
                                                                            </td>
                                                                        </tr>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                        
                                                        <p style="margin: 0 0 16px 0;">For your convenience, you can view the invoice online or process your payment directly using the buttons above. The invoice is also attached to this email for your records.</p>
                                                        
                                                        <p style="margin: 0 0 16px 0;">If you have any questions or concerns, please don't hesitate to contact our support team.</p>
                                                    </td>
                                                </tr>
                                                
                                                <tr>
                                                    <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 14px; color: #64748b;">
                                                        <p style="margin: 0 0 8px 0;"><strong>${company.name}</strong></p>
                                                        <p style="margin: 0 0 8px 0;">${company.address_line1}, ${company.city}, ${company.postcode}</p>
                                                        <p style="margin: 0 0 8px 0;">${company.email} | ${company.phone}</p>
                                                        <p style="margin: 0;">© ${new Date().getFullYear()} ${company.name}. All rights reserved.</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </body>
                            </html>
                        `,
                        attachments: [{
                            filename: `invoice-${invoice.reference}.pdf`,
                            content: pdfBase64,
                            contentType: 'application/pdf'
                        }]
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': process.env.API_KEY,
                        'X-Service-Name': 'invoice-service',
                        'X-Credential-Key': template.credential
                    }
                }
            );

            res.json({ message: 'Invoice sent successfully' });

        } catch (error) {
            console.error('Error sending invoice:', error);
            res.status(500).json({ error: 'Failed to send invoice' });
        }
    });

export default app;