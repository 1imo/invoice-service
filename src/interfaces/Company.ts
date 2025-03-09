/**
 * Represents a company in the system
 */
export interface Company {
    /** Unique identifier for the company */
    id: string;
    /** Company name */
    name: string;
    /** Company email */
    email: string;
    /** Company phone number */
    phone?: string;
    /** Company address */
    address?: string;
    /** Name on the bank account */
    accountName: string;
    /** Bank account number */
    accountNumber: string;
    /** Bank sort code */
    sortCode: string;
    /** Bank name */
    bankName: string;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
} 