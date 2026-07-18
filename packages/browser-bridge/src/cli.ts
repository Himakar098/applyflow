#!/usr/bin/env node

import { LocalPlaywrightBrowserBridge } from "./bridge";
import {
  AuthenticatedJobAgentClient,
  runSupervisedApplication,
} from "./authenticated-client";

const usage = `
ApplyFlow local browser bridge

Usage:
  tsx packages/browser-bridge/src/cli.ts run <application-id>
  tsx packages/browser-bridge/src/cli.ts open <url>
  tsx packages/browser-bridge/src/cli.ts inspect <url>
  tsx packages/browser-bridge/src/cli.ts extract <url>
  tsx packages/browser-bridge/src/cli.ts capture <url>

The browser is visible and uses .local/job-agent-browser by default.
The run command requires JOB_AGENT_FIREBASE_ID_TOKEN and JOB_AGENT_WORKER_TOKEN.
It prepares a plan, but writes fields only after Start in the authenticated UI
and consumes a separate one-use approval immediately before final submission.
`.trim();

async function waitForSignal(close: () => Promise<void>) {
  await new Promise<void>((resolve) => {
    const finish = () => {
      process.off("SIGINT", finish);
      process.off("SIGTERM", finish);
      resolve();
    };
    process.on("SIGINT", finish);
    process.on("SIGTERM", finish);
  });
  await close();
}

async function main() {
  const [command, target] = process.argv.slice(2);
  if (!command || !target || !["run", "open", "inspect", "extract", "capture"].includes(command)) {
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  const bridge = new LocalPlaywrightBrowserBridge({
    headless: process.env.BROWSER_HEADLESS?.trim().toLowerCase() === "true",
    activitySink(event) {
      console.error(`[${event.timestamp}] ${event.action}: ${event.message}`);
    },
  });

  if (command === "run") {
    const client = new AuthenticatedJobAgentClient({
      baseUrl: process.env.JOB_AGENT_BASE_URL?.trim() || "http://127.0.0.1:3000",
      firebaseIdToken: process.env.JOB_AGENT_FIREBASE_ID_TOKEN ?? "",
      workerToken: process.env.JOB_AGENT_WORKER_TOKEN ?? "",
    });
    try {
      const result = await runSupervisedApplication({
        applicationId: target,
        client,
        bridge,
        onProgress(progress) {
          console.error(`[job-agent] ${progress.stage}: ${progress.message}`);
        },
      });
      if (result.state === "AUTOFILL_PAUSED") {
        console.error("The visible browser is paused for manual action. Press Ctrl+C when finished, then rerun this application after selecting Resume in ApplyFlow.");
        await waitForSignal(() => bridge.worker.close());
        return;
      }
      console.error(`[job-agent] complete: recorded state ${result.state}`);
    } finally {
      await bridge.worker.close();
    }
    return;
  }

  await bridge.open(target);

  if (command === "open") {
    console.error("Browser session is ready. Press Ctrl+C to close it.");
    await waitForSignal(() => bridge.worker.close());
    return;
  }

  try {
    const result =
      command === "inspect"
        ? await bridge.inspectForm()
        : command === "extract"
          ? await bridge.extractVisibleJob()
          : await bridge.captureCurrentPage();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await bridge.worker.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
