import { Pool } from 'pg';
import { Order } from '../interfaces/Order';
import { Customer } from '../interfaces/Customer';
import { pools } from '../config/database';

/**
 * Repository class for handling order and customer data from ordering database
 */
export class OrderRepository {
    private readonly db: Pool;

    /**
     * Creates an instance of OrderRepository
     */
    constructor() {
        this.db = pools.ordering;
    }

    /**
     * Finds a customer by their ID
     * @param id - Customer ID
     * @returns Promise resolving to the customer if found, null otherwise
     */
    async findCustomerById(id: string): Promise<Customer | null> {
        const result = await this.db.query(
            'SELECT * FROM customer WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Finds customers by company ID from their orders
     * @param companyId - Company ID
     * @returns Promise resolving to array of customers
     */
    async findCustomersByCompanyId(companyId: string): Promise<Customer[]> {
        const result = await this.db.query(
            `SELECT DISTINCT c.* 
             FROM customer c
             INNER JOIN "order" o ON o.customer_id = c.id
             WHERE o.company_id = $1`,
            [companyId]
        );
        return result.rows;
    }

    /**
     * Finds orders by batch ID
     * @param batchId - Batch ID
     * @returns Promise resolving to array of orders
     */
    async findByBatchId(batchId: string): Promise<Order[]> {
        const result = await this.db.query(
            'SELECT * FROM "order" WHERE batch_id = $1',
            [batchId]
        );
        return result.rows;
    }

    /**
     * Gets order summary by batch ID
     * @param batchId - Batch ID
     * @returns Promise resolving to summary of orders
     */
    async getOrderSummaryByBatchId(batchId: string): Promise<{
        totalAmount: string;
        items: Array<{
            productName: string;
            quantity: number;
            unitPrice: string;
            totalPrice: string;
        }>;
    }> {
        const orders = await this.findByBatchId(batchId);

        const items = orders.map(order => ({
            productName: order.product_name,
            quantity: order.quantity,
            unitPrice: order.unit_price,
            totalPrice: order.total_price
        }));

        const totalAmount = orders
            .reduce((sum, order) => sum + parseFloat(order.total_price), 0)
            .toFixed(2);

        return {
            totalAmount,
            items
        };
    }

    /**
     * Gets all orders for a customer
     * @param customerId - Customer ID
     * @returns Promise resolving to array of orders
     */
    async findByCustomerId(customerId: string): Promise<Order[]> {
        const result = await this.db.query(
            'SELECT * FROM "order" WHERE customer_id = $1 ORDER BY created_at DESC',
            [customerId]
        );
        return result.rows;
    }

    async findById(id: string): Promise<Order | null> {
        const result = await this.db.query(
            `SELECT 
                id,
                batch_id,
                customer_id,
                company_id,
                product_name,
                quantity,
                unit_price,
                total_price,
                status,
                notes,
                created_at,
                updated_at
            FROM "order"  
            WHERE batch_id = $1`,
            [id]
        );

        return result.rows[0] || null;
    }
} 