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
    phone: string;
    /** Name on the bank account */
    account_name: string;
    /** Bank account number */
    account_number: string;
    /** Bank sort code */
    sort_code: string;
    /** Bank name */
    bank_name: string;
    /** Creation timestamp */
    created_at: Date;
    /** Last update timestamp */
    updated_at: Date;
    /** Company address line 1 */
    address_line1: string;
    /** Company address line 2 */
    address_line2: string | null;
    /** Company postcode */
    postcode: string;
    /** Company IBAN number */
    iban_number: string | null;
    /** Company city */
    city: string;
    /** Company county */
    county: string | null;
} 