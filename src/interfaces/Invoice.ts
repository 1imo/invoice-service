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
    /** ID of the company that created this invoice */
    companyId: string;
    /** ID of the customer this invoice belongs to */
    customerId: string;
    /** ID of the batch of orders this invoice is for */
    orderBatchId: string;
    /** ID of the template used for this invoice */
    templateId: string;
    /** Total amount of the invoice */
    amount: number;
    /** Currency code (e.g., 'USD', 'EUR') */
    currency: string;
    /** Due date for the invoice */
    dueDate: Date;
    /** Array of items included in this invoice */
    items: InvoiceItem[];
    /** Current status of the invoice */
    status: 'draft' | 'sent' | 'paid' | 'void';
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}