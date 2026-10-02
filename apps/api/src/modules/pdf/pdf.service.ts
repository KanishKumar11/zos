// PdfService — Puppeteer-backed HTML→PDF renderer used by payslips, invoices, SOW.
// Browser is launched lazily on first render and reused across requests for performance.
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const PX_PER_MM = 96 / 25.4;
const A4_WIDTH_PX = Math.round(210 * PX_PER_MM);
const A4_HEIGHT_PX = Math.round(297 * PX_PER_MM);
const BOTTOM_MARGIN_MM = 10;
/** Below this, shrinking reads as small print — let the document take a second page. */
const MIN_FIT_SCALE = 0.82;

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

  /**
   * `fitOnePage` shrinks a document that overflows A4 by only a little (down to
   * MIN_FIT_SCALE) so it prints on one page instead of stranding its last block
   * on page 2. Anything longer flows onto further pages at full size.
   */
  async renderPdf(html: string, opts: { fitOnePage?: boolean } = {}): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // 'load' (not 'domcontentloaded') so linked stylesheets are applied, then wait on
      // fonts.ready — otherwise the webfont race silently prints the fallback family.
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      // String form: this runs in the page context, and the API tsconfig has no DOM lib.
      await page.evaluate('(async () => { await document.fonts.ready; })()');
      const scale = opts.fitOnePage ? await this.onePageScale(page) : 1;
      const buf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: '<div style="width:100%;font-size:9px;color:#9ca3af;text-align:center;font-family:\'Plus Jakarta Sans\',sans-serif;padding-bottom:6px">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
        margin: { top: '0', right: '0', bottom: `${BOTTOM_MARGIN_MM}mm`, left: '0' },
        scale,
      });
      return Buffer.from(buf);
    } finally {
      await page.close();
    }
  }

  private async onePageScale(page: Page): Promise<number> {
    // A4 at 96 dpi in print media, so the measured height matches the printed page.
    await page.setViewport({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX });
    await page.emulateMediaType('print');
    // String form: this runs in the page context, and the API tsconfig has no DOM lib.
    const height = (await page.evaluate('document.documentElement.scrollHeight')) as number;
    const printable = A4_HEIGHT_PX - BOTTOM_MARGIN_MM * PX_PER_MM;
    if (height <= printable) return 1;
    const fit = Math.floor((printable / height) * 1000) / 1000 - 0.005;
    return fit >= MIN_FIT_SCALE ? fit : 1;
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
