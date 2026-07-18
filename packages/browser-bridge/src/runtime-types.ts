/**
 * The small Playwright surface used by this package. Keeping the bridge
 * transport structural avoids coupling domain code to Playwright's large type
 * graph while the worker still loads the official `playwright` package at run
 * time.
 */
export interface BrowserLocator {
  count(): Promise<number>;
  isVisible(): Promise<boolean>;
  fill(value: string): Promise<void>;
  setInputFiles(path: string): Promise<void>;
  selectOption(value: string): Promise<unknown>;
  check(): Promise<void>;
  uncheck(): Promise<void>;
  click(): Promise<void>;
}

export interface BrowserPage {
  url(): string;
  title(): Promise<string>;
  isClosed(): boolean;
  goto(
    url: string,
    options?: { waitUntil?: "domcontentloaded" | "load" | "networkidle" },
  ): Promise<unknown>;
  locator(selector: string): BrowserLocator;
  evaluate<Result>(pageFunction: string): Promise<Result>;
  evaluate<Result>(
    pageFunction: () => Result | Promise<Result>,
  ): Promise<Awaited<Result>>;
  evaluate<Result, Argument>(
    pageFunction: (argument: Argument) => Result | Promise<Result>,
    argument: Argument,
  ): Promise<Awaited<Result>>;
  screenshot(options: { path: string; fullPage?: boolean }): Promise<unknown>;
  waitForLoadState(
    state?: "domcontentloaded" | "load" | "networkidle",
    options?: { timeout?: number },
  ): Promise<void>;
}

export interface PersistentBrowserContext {
  pages(): BrowserPage[];
  newPage(): Promise<BrowserPage>;
  on(event: "page", listener: (page: BrowserPage) => void): void;
  close(): Promise<void>;
}

export interface PlaywrightRuntime {
  chromium: {
    launchPersistentContext(
      userDataDir: string,
      options: {
        headless: boolean;
        slowMo: number;
        viewport: null;
        acceptDownloads: boolean;
        args: string[];
      },
    ): Promise<PersistentBrowserContext>;
  };
}
