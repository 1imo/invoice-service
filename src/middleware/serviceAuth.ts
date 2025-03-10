import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3003';

export interface AuthenticatedRequest extends Request {
    service?: {
        id: string;
        name: string;
        allowedServices: string[];
    };
}

export const serviceAuth = () => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/verify`, {}, {
            headers: {
                'X-API-Key': req.header('X-API-Key'),
                'X-Service-Name': req.header('X-Service-Name'),
                'X-Target-Service': 'invoice-service',
                'Content-Type': 'application/json'
            }
        });

        // Log the full response for debugging
        console.log('Auth service response:', {
            status: response.status,
            data: response.data,
            headers: response.headers
        });

        if (response.status === 200) {
            next();
        } else {
            console.log('Auth failed with status:', response.status);
            res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        // Log the full error for debugging
        if (axios.isAxiosError(error)) {
            console.error('Service authentication error:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
        } else {
            console.error('Service authentication error:', error);
        }
        res.status(401).json({ error: 'Unauthorized' });
    }
}; 