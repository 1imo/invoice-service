/**
 * Represents an invoice template in the system
 */
export interface Template {
    /** Unique identifier for the template */
    id: string;
    /** Template name */
    name: string;
    /** HTML content of the template */
    html: string;
    /** CSS styles for the template */
    css: string;
    /** ID of the company this template belongs to */
    company_id: string;
    /** Whether this is the default template for the company */
    is_default: boolean;
    /** Email Credential Key */
    credential: string;
    /** Creation timestamp */
    created_at: Date;
    /** Last update timestamp */
    updated_at: Date;
} 