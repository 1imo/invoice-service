/**
 * Represents a customer in the system
 */
export interface Customer {
    /** Unique identifier for the customer */
    id: string;
    /** Customer's first name */
    first_name: string;
    /** Customer's last name */
    last_name: string;
    /** Customer's email */
    email: string;
    /** Customer's phone number */
    phone: string | null;
    /** Customer's company ID */
    company_id: string;
    /** First line of address */
    address_line1: string;
    /** Second line of address */
    address_line2: string | null;
    /** Third line of address */
    address_line3: string | null;
    /** City */
    city: string;
    /** County */
    county: string | null;
    /** Postal code */
    postcode: string;
    /** Country */
    country: string;
    /** Creation timestamp */
    created_at: Date;
    /** Last update timestamp */
    updated_at: Date;
} 