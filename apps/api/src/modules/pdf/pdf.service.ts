// PdfService — Puppeteer-backed HTML→PDF renderer used by payslips, invoices, SOW.
// Browser is launched lazily on first render and reused across requests for performance.
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      ...(executablePath ? { executablePath } : {}),
    });
    return this.browser;
  }

  async renderPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const buf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: '<div style="width:100%;font-size:9px;color:#9ca3af;text-align:center;font-family:\'Plus Jakarta Sans\',sans-serif;padding-bottom:6px">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
        margin: { top: '0', right: '0', bottom: '10mm', left: '0' },
      });
      return Buffer.from(buf);
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        this.logger.warn(`browser close failed: ${(e as Error).message}`);
      }
    }
  }
}
