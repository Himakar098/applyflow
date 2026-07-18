import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { test } from "vitest";

import { LocalPlaywrightBrowserBridge } from "../../packages/browser-bridge/src/bridge";
import { BrowserSafetyError } from "../../packages/browser-bridge/src/safety";
import { LocalPlaywrightWorker } from "../../packages/browser-bridge/src/worker";
import type {
  AutofillAuthorization,
  CandidateAutofillProfile,
} from "../../packages/browser-bridge/src/types";

const fixtureRoot = path.join(process.cwd(), "public/job-agent-fixtures");

test(
  "headless fixture path fills approved fields, stops, then submits after a separate verified approval",
  async () => {
    const temporaryRoot = await mkdtemp(
      path.join(tmpdir(), "applyflow-browser-bridge-"),
    );
    const server = createServer(async (request, response) => {
      const fileName = request.url?.endsWith("/fixture.css")
        ? "fixture.css"
        : "generic.html";
      try {
        const body = await readFile(path.join(fixtureRoot, fileName));
        response.writeHead(200, {
          "content-type": fileName.endsWith(".css")
            ? "text/css; charset=utf-8"
            : "text/html; charset=utf-8",
        });
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end("Not found");
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/generic.html`;

    const worker = new LocalPlaywrightWorker({
      headless: true,
      profileDirectory: path.join(temporaryRoot, "profile"),
      screenshotDirectory: path.join(temporaryRoot, "screenshots"),
    });
    const bridge = new LocalPlaywrightBrowserBridge({ worker });

    try {
      await bridge.open(url);
      const profile: CandidateAutofillProfile = {
        values: [
          {
            key: "firstName",
            value: "Himakar",
            sourceLabel: "Verified profile",
            provenance: "verified",
          },
          {
            key: "lastName",
            value: "Fixture",
            sourceLabel: "Private profile",
            provenance: "user-entered",
          },
          {
            key: "email",
            value: "browser-fixture@example.test",
            sourceLabel: "Private profile",
            provenance: "user-entered",
          },
          {
            key: "phone",
            value: "+61 400 000 000",
            sourceLabel: "Private profile",
            provenance: "user-entered",
          },
          {
            key: "location",
            value: "Perth, Western Australia",
            sourceLabel: "Verified profile",
            provenance: "verified",
          },
          {
            key: "linkedinUrl",
            value: "https://www.linkedin.com/in/local-fixture",
            sourceLabel: "Private profile",
            provenance: "user-entered",
          },
        ],
      };
      const plan = await bridge.requestAutofillPlan("application-fixture", profile);
      const approvedFieldIds = plan.mappings
        .filter((mapping) => mapping.status === "ready")
        .map((mapping) => mapping.field.id);
      const approvedAt = new Date();
      const authorization: AutofillAuthorization = {
        scope: "single_application_autofill",
        applicationId: plan.applicationId,
        planId: plan.id,
        approvedFieldIds,
        reviewedFieldIds: [],
        approvedBy: "local-fixture-user",
        approvedAt: approvedAt.toISOString(),
        expiresAt: new Date(approvedAt.getTime() + 60_000).toISOString(),
        userInitiated: true,
      };

      const fillResult = await bridge.fillApprovedFields(plan, authorization);
      assert.equal(fillResult.state, "READY_TO_SUBMIT");
      assert.equal(fillResult.filledFieldIds.length, 6);
      assert.equal((await stat(worker.profileDirectory)).mode & 0o777, 0o700);
      assert.equal((await stat(worker.screenshotDirectory)).mode & 0o777, 0o700);
      assert.ok(fillResult.screenshotPath);
      assert.equal((await stat(fillResult.screenshotPath)).mode & 0o777, 0o600);
      const page = await worker.page();
      assert.equal(
        await page.evaluate(
          "document.querySelector('#email').value",
        ),
        "browser-fixture@example.test",
      );

      await assert.rejects(
        () => bridge.submitApprovedApplication(plan),
        (error: unknown) =>
          error instanceof BrowserSafetyError &&
          error.code === "SUBMISSION_APPROVAL_REQUIRED",
      );
      assert.notEqual(
        await page.evaluate("document.body.dataset.submitted"),
        "true",
      );

      const submitted = await bridge.submitApprovedApplication(
        plan,
        async (request) => {
          const verifiedAt = new Date();
          return {
            ...request,
            approvedBy: "local-fixture-user",
            approvedAt: verifiedAt.toISOString(),
            expiresAt: new Date(verifiedAt.getTime() + 60_000).toISOString(),
            verificationId: "fixture-verification",
            verified: true,
          };
        },
      );
      assert.equal(submitted.state, "SUBMITTED");
      assert.equal(
        await page.evaluate("document.body.dataset.submitted"),
        "true",
      );

      await bridge.open(`${url}?unconfirmed=1&preexisting=1`);
      const unconfirmedPlan = await bridge.requestAutofillPlan(
        "application-unconfirmed-fixture",
        profile,
      );
      const unconfirmedFieldIds = unconfirmedPlan.mappings
        .filter((mapping) => mapping.status === "ready")
        .map((mapping) => mapping.field.id);
      const unconfirmedApprovedAt = new Date();
      const unconfirmedFill = await bridge.fillApprovedFields(unconfirmedPlan, {
        scope: "single_application_autofill",
        applicationId: unconfirmedPlan.applicationId,
        planId: unconfirmedPlan.id,
        approvedFieldIds: unconfirmedFieldIds,
        reviewedFieldIds: [],
        approvedBy: "local-fixture-user",
        approvedAt: unconfirmedApprovedAt.toISOString(),
        expiresAt: new Date(unconfirmedApprovedAt.getTime() + 60_000).toISOString(),
        userInitiated: true,
      });
      assert.equal(unconfirmedFill.state, "READY_TO_SUBMIT");

      const unconfirmed = await bridge.submitApprovedApplication(
        unconfirmedPlan,
        async (request) => {
          const verifiedAt = new Date();
          return {
            ...request,
            approvedBy: "local-fixture-user",
            approvedAt: verifiedAt.toISOString(),
            expiresAt: new Date(verifiedAt.getTime() + 60_000).toISOString(),
            verificationId: "fixture-unconfirmed-verification",
            verified: true,
          };
        },
      );
      assert.equal(unconfirmed.state, "SUBMISSION_UNCONFIRMED");
      assert.deepEqual(unconfirmed.confirmationEvidence, []);
      assert.equal(await page.evaluate("document.body.dataset.submitted"), "true");
    } finally {
      await worker.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  },
  30_000,
);
