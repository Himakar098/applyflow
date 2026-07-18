import { chmod, mkdir } from "node:fs/promises";
import path from "node:path";

import {
  isCredentialFreeHttpUrl,
  publicUrlForLog,
} from "../../../lib/security/url-policy";

import type {
  BrowserPage,
  PersistentBrowserContext,
  PlaywrightRuntime,
} from "./runtime-types";
import type { BrowserActivitySink } from "./types";

export interface LocalPlaywrightWorkerOptions {
  profileDirectory?: string;
  screenshotDirectory?: string;
  /** Visible by default. Headless mode is intended only for isolated CI fixtures. */
  headless?: boolean;
  slowMoMs?: number;
  activitySink?: BrowserActivitySink;
}

const safeArtifactName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "page";

export class LocalPlaywrightWorker {
  readonly profileDirectory: string;
  readonly screenshotDirectory: string;
  readonly headless: boolean;

  private context?: PersistentBrowserContext;
  private activePage?: BrowserPage;
  private readonly slowMoMs: number;
  private readonly activitySink?: BrowserActivitySink;

  constructor(options: LocalPlaywrightWorkerOptions = {}) {
    this.profileDirectory = path.resolve(
      options.profileDirectory ?? ".local/job-agent-browser",
    );
    this.screenshotDirectory = path.resolve(
      options.screenshotDirectory ?? "output/playwright",
    );
    this.headless = options.headless ?? false;
    this.slowMoMs = options.slowMoMs ?? 40;
    this.activitySink = options.activitySink;
  }

  private async emit(
    action: Parameters<NonNullable<BrowserActivitySink>>[0]["action"],
    message: string,
  ) {
    await this.activitySink?.({
      timestamp: new Date().toISOString(),
      action,
      message,
    });
  }

  async start(): Promise<BrowserPage> {
    if (this.context) return this.page();

    await mkdir(this.profileDirectory, { recursive: true, mode: 0o700 });
    await mkdir(this.screenshotDirectory, { recursive: true, mode: 0o700 });
    await Promise.all([
      chmod(this.profileDirectory, 0o700),
      chmod(this.screenshotDirectory, 0o700),
    ]);

    const playwrightPackage = "playwright";
    const { chromium } = (await import(playwrightPackage)) as PlaywrightRuntime;
    this.context = await chromium.launchPersistentContext(this.profileDirectory, {
      headless: this.headless,
      slowMo: this.headless ? 0 : this.slowMoMs,
      viewport: null,
      acceptDownloads: true,
      args: this.headless ? [] : ["--start-maximized"],
    });

    this.activePage = this.context.pages()[0] ?? (await this.context.newPage());
    this.context.on("page", (page) => {
      this.activePage = page;
    });
    await this.emit(
      "browser_started",
      `Persistent Chromium session started in ${this.profileDirectory}`,
    );
    return this.activePage;
  }

  async page(): Promise<BrowserPage> {
    if (!this.context) return this.start();
    if (this.activePage && !this.activePage.isClosed()) return this.activePage;
    this.activePage = this.context.pages().find((page) => !page.isClosed());
    if (!this.activePage) this.activePage = await this.context.newPage();
    return this.activePage;
  }

  async open(url: string): Promise<BrowserPage> {
    const parsed = new URL(url);
    if (!isCredentialFreeHttpUrl(parsed.toString())) {
      throw new Error("The local browser worker only opens credential-free http:// or https:// URLs.");
    }
    const page = await this.page();
    await page.goto(parsed.toString(), { waitUntil: "domcontentloaded" });
    await this.emit("page_opened", `Opened ${publicUrlForLog(parsed)}`);
    return page;
  }

  async screenshot(label = "page"): Promise<string> {
    const page = await this.page();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(
      this.screenshotDirectory,
      `${timestamp}-${safeArtifactName(label)}.png`,
    );
    await page.screenshot({ path: filePath, fullPage: true });
    await chmod(filePath, 0o600);
    return filePath;
  }

  async close(): Promise<void> {
    if (!this.context) return;
    await this.context.close();
    this.context = undefined;
    this.activePage = undefined;
    await this.emit("browser_closed", "Persistent Chromium session closed.");
  }
}
