import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// Create different rate limiters for different endpoints
export const createInvoiceLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each service to 100 requests per windowMs
    message: { error: 'Too many requests from this service, please try again later' },
    keyGenerator: (req: Request) => req.get('X-Service-Name') ?? req.ip ?? 'unknown',
    standardHeaders: true,
    legacyHeaders: false,
});

export const generatePdfLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200, // Limit to 200 PDF generations per hour
    message: { error: 'Too many PDF generation requests, please try again later' },
    keyGenerator: (req: Request) => req.get('X-Service-Name') ?? req.ip ?? 'unknown',
    standardHeaders: true,
    legacyHeaders: false,
});

export const paymentLinkLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 300, // Limit to 300 payment link generations per hour
    message: { error: 'Too many payment link requests, please try again later' },
    keyGenerator: (req: Request) => req.get('X-Service-Name') ?? req.ip ?? 'unknown',
    standardHeaders: true,
    legacyHeaders: false,
}); 