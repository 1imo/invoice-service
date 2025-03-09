import axios from 'axios';
import { Invoice } from '../interfaces/Invoice';
import { InvoiceRepository } from '../repositories/InvoiceRepository';
import { OrderRepository } from '../repositories/OrderRepository';
import { CompanyRepository } from '../repositories/CompanyRepository';
import { PDFGenerator } from '../utils/PDFGenerator';
import { PaymentLinkGenerator } from '../utils/PaymentLinkGenerator';

/**
 * Service class for handling invoice-related business logic
 */
export class InvoiceService {
    private readonly contactServiceUrl: string;
    private readonly frontendUrl: string;

    /**
     * Creates an instance of InvoiceService
     * @param invoiceRepository - Repository for invoice data persistence
     * @param orderRepository - Repository for order data persistence
     * @param companyRepository - Repository for company data persistence
     * @param pdfGenerator - Service for generating PDF documents
     * @param paymentLinkGenerator - Service for generating payment links
     */
    constructor(
        private readonly invoiceRepository: InvoiceRepository,
        private readonly orderRepository: OrderRepository,
        private readonly companyRepository: CompanyRepository,
        private readonly pdfGenerator: PDFGenerator,
        private readonly paymentLinkGenerator: PaymentLinkGenerator
    ) {
        this.contactServiceUrl = process.env.CONTACT_SERVICE_URL ?? 'http://localhost:3005';
        this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    }

    /**
     * Creates a new invoice
     * @param data - Data for the new invoice
     * @returns Promise resolving to the created invoice
     */
    async createInvoice(data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
        // Create invoice
        const invoice = await this.invoiceRepository.create(data);

        try {
            // Generate PDF
            const pdf = await this.generatePDF(invoice.id);

            // Get customer email from order
            const orders = await this.orderRepository.findByBatchId(invoice.orderBatchId);
            if (!orders || orders.length === 0) {
                throw new Error('Order not found');
            }
            const customer = await this.orderRepository.findCustomerById(orders[0].customerId);
            if (!customer) {
                throw new Error('Customer not found');
            }

            // Get company details for email
            const company = await this.companyRepository.findById(invoice.companyId);
            if (!company) {
                throw new Error('Company not found');
            }

            const invoiceViewUrl = `${this.frontendUrl}/invoices/${invoice.id}`;

            // Send email via contact service
            await axios.post(
                `${this.contactServiceUrl}/api/email/send`,
                {
                    credentialId: process.env.DEFAULT_EMAIL_CREDENTIAL_ID,
                    message: {
                        to: customer.email,
                        subject: `Invoice ${invoice.id} from ${company.name}`,
                        html: `
                            <h1>Invoice from ${company.name}</h1>
                            <p>Dear ${customer.firstName} ${customer.lastName},</p>
                            <p>Please find attached your invoice ${invoice.id}.</p>
                            <p>You can view your invoice online using the following link:</p>
                            <p><a href="${invoiceViewUrl}">View Invoice</a></p>
                            <p>If you have any questions, please don't hesitate to contact us.</p>
                            <p>Best regards,<br>${company.name}</p>
                        `,
                        attachments: [{
                            filename: `invoice-${invoice.id}.pdf`,
                            content: pdf.toString('base64'),
                            contentType: 'application/pdf'
                        }]
                    }
                },
                {
                    headers: {
                        'X-API-Key': process.env.API_KEY,
                        'X-Service-Name': 'invoice-service',
                        'X-Credential-Key': process.env.DEFAULT_EMAIL_CREDENTIAL_KEY
                    }
                }
            );

            return invoice;
        } catch (error) {
            console.error('Failed to send invoice email:', error);
            // Don't throw - email sending failure shouldn't prevent invoice creation
            return invoice;
        }
    }

    /**
     * Generates a PDF for an invoice
     * @param id - ID of the invoice
     * @returns Promise resolving to the PDF buffer
     * @throws Error if invoice is not found
     */
    async generatePDF(id: string): Promise<Buffer> {
        const invoice = await this.invoiceRepository.findById(id);
        if (!invoice) throw new Error('Invoice not found');
        return this.pdfGenerator.generate(invoice);
    }

    /**
     * Generates a payment link for an invoice
     * @param id - ID of the invoice
     * @returns Promise resolving to the payment link URL
     * @throws Error if invoice is not found
     */
    async generatePaymentLink(id: string): Promise<string> {
        const invoice = await this.invoiceRepository.findById(id);
        if (!invoice) throw new Error('Invoice not found');
        return this.paymentLinkGenerator.generate(invoice);
    }
} 