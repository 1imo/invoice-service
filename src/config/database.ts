import { Pool } from 'pg';
import dotenv from 'dotenv';

/**
 * Loads environment variables from .env file
 */
dotenv.config();

// Log the actual env variables we're using
console.log('Database configuration:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    port: process.env.DB_PORT,
    databases: ['invoicing', 'ordering', 'clients']
});

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
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'papstorea',
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: 'invoicing'
    }),
    ordering: new Pool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'papstorea',
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: 'ordering'
    }),
    client: new Pool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'papstorea',
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: 'clients'
    })
};

// Add error handlers
Object.entries(pools).forEach(([name, pool]) => {
    pool.on('error', (err) => {
        console.error(`Unexpected error on ${name} pool:`, err);
    });

    // Test each connection
    pool.query('SELECT NOW()')
        .then(() => console.log(`${name} database connected successfully`))
        .catch(err => console.error(`${name} database connection failed:`, err));
});

/**
 * Get database pool by name
 */
export function getPool(database: keyof typeof pools): Pool {
    return pools[database];
}

// Function to list all databases
export async function listDatabases() {
    try {
        const result = await pools.invoicing.query(`
            SELECT datname 
            FROM pg_database 
            WHERE datistemplate = false
            ORDER BY datname;
        `);
        console.log('Available databases:', result.rows.map(row => row.datname));
    } catch (error) {
        console.error('Error listing databases:', error);
    }
} 