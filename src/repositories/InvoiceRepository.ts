import { Pool } from 'pg';
import { Invoice } from '../interfaces/Invoice';
import { pools } from '../config/database';

/**
 * Repository class for handling invoice data persistence
 */
export class InvoiceRepository {
    private readonly db: Pool;

    /**
     * Creates an instance of InvoiceRepository
     */
    constructor() {
        this.db = pools.invoicing;
    }

    /**
     * Creates a new invoice
     * @param invoice - Invoice data without ID
     * @returns Promise resolving to the created invoice
     */
    async create(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
        const result = await this.db.query(
            `INSERT INTO invoices (
                company_id, customer_id, order_batch_id, template_id,
                amount, currency, due_date, items, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                invoice.companyId,
                invoice.customerId,
                invoice.orderBatchId,
                invoice.templateId,
                invoice.amount,
                invoice.currency,
                invoice.dueDate,
                JSON.stringify(invoice.items),
                invoice.status
            ]
        );
        return result.rows[0];
    }

    /**
     * Finds an invoice by its ID
     * @param id - Invoice ID
     * @returns Promise resolving to the invoice if found, null otherwise
     */
    async findById(id: string): Promise<Invoice | null> {
        const result = await this.db.query(
            'SELECT * FROM invoices WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
} 