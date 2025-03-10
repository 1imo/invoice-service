import { Pool } from 'pg';
import { Template } from '../interfaces/Template';
import { pools } from '../config/database';

/**
 * Repository class for handling template data persistence
 */
export class TemplateRepository {
    private readonly db: Pool;

    constructor() {
        this.db = pools.invoicing;
    }

    /**
     * Creates a new template
     * @param template - Template data without ID and timestamps
     * @returns Promise resolving to the created template
     */
    async create(template: Omit<Template, 'id' | 'created_at' | 'updated_at'>): Promise<Template> {
        const result = await this.db.query(
            'INSERT INTO templates (name, html, css, company_id, is_default) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [template.name, template.html, template.css, template.company_id, template.is_default]
        );
        return result.rows[0];
    }

    /**
     * Finds a template by its ID
     * @param id - Template ID
     * @returns Promise resolving to the template if found, null otherwise
     */
    async findById(id: string): Promise<Template | null> {
        console.log('Finding template with ID:', id);

        const result = await this.db.query(
            'SELECT * FROM templates WHERE id = $1::uuid',
            [id]
        );

        console.log('Query result:', result.rows);
        return result.rows[0] || null;
    }

    /**
     * Finds the default template for a company
     * @param companyId - Company ID
     * @returns Promise resolving to the default template if found, null otherwise
     */
    async findDefaultByCompanyId(companyId: string): Promise<Template | null> {
        const result = await this.db.query(
            'SELECT * FROM templates WHERE company_id = $1 AND is_default = true',
            [companyId]
        );
        return result.rows[0] || null;
    }

    /**
     * Updates a template
     * @param id - Template ID
     * @param template - Updated template data
     * @returns Promise resolving to the updated template
     */
    async update(id: string, template: Partial<Omit<Template, 'id' | 'created_at' | 'updated_at'>>): Promise<Template> {
        const fields = Object.keys(template);
        const values = Object.values(template);
        const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

        const result = await this.db.query(
            `UPDATE templates SET ${setClause} WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return result.rows[0];
    }
} 