/**
 * Represents an invoice item in the system
 */
export interface InvoiceItem {
    /** Description of the item */
    description: string;
    /** Quantity of items */
    quantity: number;
    /** Price per unit */
    unitPrice: number;
}

/**
 * Represents an invoice in the system
 */
export interface Invoice {
    /** Unique identifier for the invoice */
    id: string;
    /** Reference number for the invoice */
    reference: string;
    /** ID of the company that created this invoice */
    company_id: string;
    /** ID of the customer this invoice belongs to */
    customer_id: string;
    /** ID of the batch of orders this invoice is for */
    order_batch_id: string;
    /** ID of the template used for this invoice */
    template_id: string;
    /** Total amount of the invoice */
    amount: string;
    /** Currency code (e.g., 'USD', 'EUR') */
    currency: string;
    /** Due date for the invoice */
    due_date: Date;
    /** Current status of the invoice */
    status: string;
    /** Creation timestamp */
    created_at: Date;
    /** Last update timestamp */
    updated_at: Date;
    /** Stripe payment intent */
    payment_intent_id: string | null;
}