import axios from 'axios';
import { Invoice } from '../interfaces/Invoice';
import { InvoiceRepository } from '../repositories/InvoiceRepository';
import { OrderRepository } from '../repositories/OrderRepository';
import { PDFGenerator } from '../utils/PDFGenerator';
import { PaymentLinkGenerator } from '../utils/PaymentLinkGenerator';
import { TemplateRepository } from '../repositories/TemplateRepository';
import { CompanyRepository } from '../repositories/CompanyRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';

/**
 * Service class for handling invoice-related business logic
 */
export class InvoiceService {
    private readonly contactServiceUrl: string;
    private readonly frontendUrl: string;
    private readonly paymentServiceUrl: string;

    /**
     * Creates an instance of InvoiceService
     * @param invoiceRepository - Repository for invoice data persistence
     * @param orderRepository - Repository for order data persistence
     * @param companyRepository - Repository for company data persistence
     * @param customerRepository - Repository for customer data persistence
     * @param pdfGenerator - Service for generating PDF documents
     * @param paymentLinkGenerator - Service for generating payment links
     */
    constructor(
        private readonly invoiceRepository: InvoiceRepository,
        private readonly orderRepository: OrderRepository,
        private readonly templateRepository: TemplateRepository,
        private readonly companyRepository: CompanyRepository,
        private readonly customerRepository: CustomerRepository,
        private readonly pdfGenerator: PDFGenerator,
        private readonly paymentLinkGenerator: PaymentLinkGenerator
    ) {
        this.contactServiceUrl = process.env.CONTACT_SERVICE_URL ?? 'http://localhost:3005';
        this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
        this.paymentServiceUrl = process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3007';
    }

    /**
     * Creates a new invoice
     * @param data - Data for the new invoice
     * @returns Promise resolving to the created invoice
     */
    async createInvoice(data: { orderBatchId: string; templateId: string, host: string }) {
        try {
            console.log('Creating invoice with data:', data);

            // Get the template first to get company_id and credential_id
            const template = await this.templateRepository.findById(data.templateId);
            if (!template) {
                throw new Error(`Template not found: ${data.templateId}`);
            }

            // Get all orders in the same batch
            const batchOrders = await this.orderRepository.findByBatchId(data.orderBatchId);
            console.log('Batch orders found:', batchOrders);

            // Calculate total price from all orders in batch and convert to string
            const totalAmount = batchOrders
                .reduce((sum, order) => sum + parseFloat(order.total_price), 0)
                .toFixed(2);

            const invoice: Omit<Invoice, 'id' | 'reference' | 'created_at' | 'updated_at'> = {
                company_id: batchOrders[0].company_id,
                customer_id: batchOrders[0].customer_id,
                order_batch_id: batchOrders[0].batch_id,
                template_id: data.templateId,
                amount: totalAmount,
                currency: '£',
                due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'draft',
                payment_intent_id: null
            };

            console.log('Creating invoice with data:', invoice);

            const createdInvoice = await this.invoiceRepository.create(invoice);
            console.log('Invoice created:', createdInvoice);

            await axios.post(
                `${this.paymentServiceUrl}/api/payments`,
                {
                    invoiceId: createdInvoice.id,
                    amount: parseFloat(totalAmount) * 100, // Convert to smallest currency unit (pence)
                    currency: 'gbp',
                    successUrl: `http://${data.host}/payment/success`,
                    cancelUrl: `http://${data.host}/payment/cancelled`,
                    companyId: invoice.company_id
                },
                {
                    headers: {
                        'X-API-Key': process.env.API_KEY,
                        'X-Service-Name': process.env.SERVICE_NAME,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return createdInvoice;
        } catch (error) {
            console.error('Error creating invoice:', error);
            throw error;
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