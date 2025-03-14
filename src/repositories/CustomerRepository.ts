import { Pool } from 'pg';
import { Customer } from '../interfaces/Customer';
import { pools } from '../config/database';

/**
 * Repository class for handling customer data persistence
 */
export class CustomerRepository {
    private readonly db: Pool;

    /**
     * Creates an instance of CustomerRepository
     */
    constructor() {
        this.db = pools.ordering;
    }

    /**
     * Finds a customer by their ID
     * @param id - Customer ID
     * @returns Promise resolving to the customer if found, null otherwise
     */
    async findById(id: string): Promise<Customer | null> {
        const result = await this.db.query(
            `SELECT 
                *
            FROM customer 
            WHERE id = $1`,
            [id]
        );

        console.log("Customer result", result.rows[0])


        return result.rows[0] || null;
    }
} 