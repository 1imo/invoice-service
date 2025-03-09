import { Pool } from 'pg';
import dotenv from 'dotenv';

/**
 * Loads environment variables from .env file
 */
dotenv.config();

interface DatabaseConfig {
    host: string;
    user: string;
    password: string;
    port?: number;
}

/**
 * Common database configuration
 */
const dbConfig: DatabaseConfig = {
    host: process.env.DB_HOST ?? 'localhost',
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    port: parseInt(process.env.DB_PORT ?? '5432')
};

/**
 * PostgreSQL connection pools for different databases
 */
export const pools = {
    invoicing: new Pool({
        ...dbConfig,
        database: 'invoicing'
    }),
    client: new Pool({
        ...dbConfig,
        database: 'client'
    }),
    ordering: new Pool({
        ...dbConfig,
        database: 'ordering'
    })
};

/**
 * Get database pool by name
 */
export function getPool(database: keyof typeof pools): Pool {
    return pools[database];
} 