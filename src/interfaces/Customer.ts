/**
 * Represents a customer in the system
 */
export interface Customer {
    /** Unique identifier for the customer */
    id: string;
    /** Customer's first name */
    firstName: string;
    /** Customer's last name */
    lastName: string;
    /** Customer's email */
    email: string;
    /** Customer's phone number */
    phone?: string;
    /** First line of address */
    addressLine1: string;
    /** Second line of address */
    addressLine2?: string;
    /** Third line of address */
    addressLine3?: string;
    /** City */
    city: string;
    /** County */
    county?: string;
    /** Postal code */
    postcode: string;
    /** Country */
    country: string;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
} 