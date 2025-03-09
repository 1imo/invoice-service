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
    css?: string;
    /** ID of the company this template belongs to */
    companyId: string;
    /** Whether this is the default template for the company */
    isDefault: boolean;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
} 