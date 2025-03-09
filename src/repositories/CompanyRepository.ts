import { Pool } from 'pg';
import { Company } from '../interfaces/Company';
import { pools } from '../config/database';

/**
 * Repository class for handling company data persistence
 */
export class CompanyRepository {
    private readonly db: Pool;

    /**
     * Creates an instance of CompanyRepository
     */
    constructor() {
        this.db = pools.client;
    }

    /**
     * Finds a company by its ID
     * @param id - Company ID
     * @returns Promise resolving to the company if found, null otherwise
     */
    async findById(id: string): Promise<Company | null> {
        const result = await this.db.query(
            'SELECT * FROM company WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
} 