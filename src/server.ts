import app from './app';
import { pools } from './config/database';

const PORT = process.env.PORT || 3003;

async function startServer() {
    try {
        // Test database connection
        await pools.invoicing.query('SELECT 1');
        console.log('Database connection established');

        app.listen(PORT, () => {
            console.log(`Invoice service listening on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 