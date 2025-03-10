/**
 * Represents an order in the system
 */
export interface Order {
    /** Unique identifier for the order */
    id: string;
    /** Batch ID for grouped orders */
    batch_id: string;
    /** ID of the customer who placed the order */
    customer_id: string;
    /** ID of the company fulfilling the order */
    company_id: string;
    /** Name of the product */
    product_name: string;
    /** Quantity ordered */
    quantity: number;
    /** Price per unit */
    unit_price: string;
    /** Total price for the order */
    total_price: string;
    /** Current status of the order */
    status: string;
    /** Additional notes */
    notes: string | null;
    /** Creation timestamp */
    created_at: Date;
    /** Last update timestamp */
    updated_at: Date;
} 