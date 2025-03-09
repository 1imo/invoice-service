import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export interface AuthenticatedRequest extends Request {
    service?: {
        id: string;
        name: string;
        allowedServices: string[];
    };
}

export const serviceAuth = () => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const apiKey = req.get('X-API-Key');
        const serviceName = req.get('X-Service-Name');

        if (!apiKey || !serviceName) {
            return res.status(401).json({ error: 'Missing authentication credentials' });
        }

        try {
            const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/verify`, null, {
                headers: {
                    'X-API-Key': apiKey,
                    'X-Service-Name': serviceName,
                    'X-Target-Service': 'invoice-service'
                }
            });

            (req as AuthenticatedRequest).service = response.data;
            next();
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                return res.status(401).json({ error: 'Invalid authentication credentials' });
            }
            if (axios.isAxiosError(error) && error.response?.status === 403) {
                return res.status(403).json({ error: 'Service does not have permission to access invoice service' });
            }
            console.error('Service authentication error:', error);
            res.status(500).json({ error: 'Authentication failed' });
        }
    };
}; 