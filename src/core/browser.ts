import { chromium, Browser, Page } from 'playwright';

export class BrowserManager {
  private browser?: Browser;

  async start(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
    });
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not started');
    }

    const page = await this.browser.newPage({
      viewport: {
        width: 1440,
        height: 1000,
      },
    });

    page.setDefaultTimeout(30_000);

    return page;
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }
}