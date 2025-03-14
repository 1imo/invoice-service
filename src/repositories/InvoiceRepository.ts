import { Pool } from 'pg';
import { Invoice } from '../interfaces/Invoice';
import { pools } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

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

    private generateReference(): string {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Creates a new invoice
     * @param invoice - Invoice data without ID
     * @returns Promise resolving to the created invoice
     */
    async create(invoice: Omit<Invoice, 'id' | 'reference' | 'created_at' | 'updated_at'>): Promise<Invoice> {
        const id = uuidv4();
        const reference = this.generateReference();

        const result = await this.db.query(
            `INSERT INTO invoices (
                id,
                reference,
                company_id,
                customer_id,
                order_batch_id,
                template_id,
                amount,
                currency,
                due_date,
                status,
                payment_intent_id,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
            RETURNING *`,
            [
                id,
                reference,
                invoice.company_id,
                invoice.customer_id,
                invoice.order_batch_id,
                invoice.template_id,
                invoice.amount,
                invoice.currency,
                invoice.due_date,
                invoice.status,
                invoice.payment_intent_id
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

    async update(id: string, data: Partial<Invoice>): Promise<Invoice> {
        const setClause = Object.entries(data)
            .map(([key, _], index) => `${key} = $${index + 2}`)
            .join(', ');

        const values = Object.values(data);

        const query = `
            UPDATE invoices 
            SET ${setClause}
            WHERE id = $1
            RETURNING *
        `;

        const result = await this.db.query(query, [id, ...values]);
        return result.rows[0];
    }
} 