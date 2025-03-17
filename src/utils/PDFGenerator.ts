import { Invoice } from '../interfaces/Invoice';
import puppeteer from 'puppeteer';
import axios from 'axios';

/**
 * Service for generating PDF documents from invoices
 */
export class PDFGenerator {
    private readonly apiUrl: string;
    private readonly maxRetries: number = 3;
    private readonly retryDelay: number = 1000; // 1 second

    constructor() {
        this.apiUrl = process.env.INVOICE_SERVICE_URL || 'http://localhost:3002';
    }

    /**
     * Generates a PDF for an invoice
     * @param invoice - Invoice to generate PDF for
     * @returns Promise resolving to PDF buffer
     */
    async generate(invoice: Invoice): Promise<Buffer> {
        let lastError: Error | null = null;

        // Try multiple times with delay
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }

                // Launch browser
                const browser = await puppeteer.launch({
                    headless: true,
                    executablePath: '/usr/bin/chromium',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu'
                    ]
                });

                try {
                    // Create new page
                    const page = await browser.newPage();

                    // Fetch HTML content directly from API
                    const response = await axios.get(`${this.apiUrl}/api/invoices/${invoice.id}`, {
                        headers: {
                            'Accept': 'text/html'  // Explicitly request HTML
                        }
                    });

                    if (typeof response.data !== 'string') {
                        throw new Error('Invalid response format: Expected HTML string');
                    }

                    // Set content directly instead of navigating
                    await page.setContent(response.data, {
                        waitUntil: 'networkidle0'
                    });

                    // Generate PDF
                    const pdfBuffer = await page.pdf({
                        format: 'A4',
                        printBackground: true,
                        margin: {
                            top: '20px',
                            right: '20px',
                            bottom: '20px',
                            left: '20px'
                        }
                    });

                    return Buffer.from(pdfBuffer);
                } finally {
                    // Ensure browser is closed even if error occurs
                    await browser.close();
                }
            } catch (error) {
                lastError = error as Error;
                console.error(`Attempt ${attempt + 1} failed:`, error);

                // If it's not a 404 error, don't retry
                if (axios.isAxiosError(error) && error.response?.status !== 404) {
                    throw error;
                }

                // If this was the last attempt, throw the error
                if (attempt === this.maxRetries - 1) {
                    throw new Error(`Failed to generate PDF after ${this.maxRetries} attempts: ${lastError.message}`);
                }
            }
        }

        // This should never be reached due to the throw in the loop
        throw new Error('Failed to generate PDF: Unknown error');
    }
} 