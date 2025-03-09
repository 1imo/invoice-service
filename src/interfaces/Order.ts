/**
 * Represents an order in the system
 */
export interface Order {
    /** Unique identifier for the order */
    id: string;
    /** Batch ID for grouped orders */
    batchId: string;
    /** ID of the customer who placed the order */
    customerId: string;
    /** ID of the company fulfilling the order */
    companyId: string;
    /** Name of the product */
    productName: string;
    /** Quantity ordered */
    quantity: number;
    /** Price per unit */
    unitPrice: number;
    /** Total price for the order */
    totalPrice: number;
    /** Current status of the order */
    status: string;
    /** Additional notes */
    notes?: string;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
} 