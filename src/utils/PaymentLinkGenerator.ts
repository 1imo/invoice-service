import { Invoice } from '../interfaces/Invoice';

/**
 * Service for generating payment links for invoices
 */
export class PaymentLinkGenerator {
    /**
     * Creates an instance of PaymentLinkGenerator
     * @param paymentServiceUrl - Base URL of the payment service
     */
    constructor(private readonly paymentServiceUrl: string) { }

    /**
     * Generates a payment link for an invoice
     * @param invoice - Invoice to generate payment link for
     * @returns Promise resolving to the payment link URL
     */
    async generate(invoice: Invoice): Promise<string> {
        // Generate payment link using payment service URL
        return `${this.paymentServiceUrl}/pay/${invoice.id}`;
    }
} 