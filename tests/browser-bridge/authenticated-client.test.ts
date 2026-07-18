import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, test } from "vitest";

import { himakarCandidateProfile } from "../../lib/job-agent/candidate";
import {
  AuthenticatedJobAgentClient,
  normalizeWorkerBaseUrl,
  runSupervisedApplication,
} from "../../packages/browser-bridge/src/authenticated-client";
import type { BridgeAutofillPlan } from "../../packages/browser-bridge/src/runtime-schemas";
import type {
  SubmissionApprovalProvider,
  SubmissionResult,
} from "../../packages/browser-bridge/src/types";

const applicationId = "application-fixture";
const applicationUrl = "http://127.0.0.1:3000/job-agent-fixtures/generic.html";
const planHash = "a".repeat(64);
const firebaseToken = "firebase-id-token-private";
const workerToken = "worker-token-that-is-at-least-thirty-two-characters";
const now = "2026-07-18T08:00:00.000Z";
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

function application(status: string, autofillPlanHash: string | null = null) {
  return {
    id: applicationId,
    jobId: "job-fixture",
    candidateProfileId: "himakar-candidate-profile",
    company: "Fixture Company",
    role: "Applied AI Engineer",
    source: "local fixture",
    jobUrl: applicationUrl,
    applicationUrl,
    fitScore: 88,
    eligibility: "eligible",
    status,
    submissionMode: "review_before_submit",
    autofillPlanHash,
    dateDiscovered: now,
    dateApplied: null,
    closingDate: null,
    createdAt: now,
    updatedAt: now,
  };
}

function workerPlan(id: string, hasValue: boolean): BridgeAutofillPlan {
  return {
    id,
    applicationId,
    url: applicationUrl,
    portal: "generic",
    createdAt: now,
    state: "READY_FOR_REVIEW",
    mappings: [
      {
        field: {
          id: "field-first-name",
          selector: "#first-name",
          label: "First name",
          name: "first_name",
          kind: "text",
          required: true,
          disabled: false,
          visible: true,
          hasValue,
          sensitiveCategory: "none",
          reviewRequired: false,
        },
        profileKey: "firstName",
        proposedValue: "Himakar",
        sourceLabel: "Confirmed candidate profile claim",
        provenance: "user-entered",
        confidence: 0.99,
        reviewRequired: false,
        status: "ready",
      },
      {
        field: {
          id: "field-email",
          selector: "#email",
          label: "Email address",
          name: "email",
          kind: "email",
          required: true,
          disabled: false,
          visible: true,
          hasValue,
          sensitiveCategory: "none",
          reviewRequired: false,
        },
        profileKey: "email",
        proposedValue: "fixture@example.test",
        sourceLabel: "Encrypted private contact",
        provenance: "user-entered",
        confidence: 0.99,
        reviewRequired: false,
        status: "ready",
      },
    ],
    pauses: [],
    submitControls: [{
      id: "submit",
      selector: "button[type=submit]",
      label: "Submit application",
      visible: true,
      disabled: false,
    }],
  };
}

const storedPlan = {
  id: "stored-plan",
  applicationId,
  fields: [
    {
      id: "field-first-name",
      label: "First name",
      detectedFieldType: "text",
      proposedValue: "Himakar",
      source: "Confirmed candidate profile claim | #first-name",
      confidence: 0.99,
      requiresUserReview: false,
      approved: true,
      sensitive: false,
    },
    {
      id: "field-email",
      label: "Email address",
      detectedFieldType: "email",
      proposedValue: "fixture@example.test",
      source: "Encrypted private contact | #email",
      confidence: 0.99,
      requiresUserReview: false,
      approved: true,
      sensitive: false,
    },
  ],
  documentUploads: [],
  unknownQuestions: [],
  detectedChallenges: [],
  createdAt: now,
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createTransport(options: { submitThrowsAfterConsume?: boolean; approvalGranted?: boolean } = {}) {
  const calls: Array<{ url: URL; method: string; headers: Headers; body: unknown }> = [];
  let planSaved = false;
  let ready = false;
  let submitted = false;
  let receipt: Record<string, unknown> | null = null;

  const fetchImplementation = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : null;
    const method = init?.method ?? "GET";
    calls.push({ url, method, headers, body });
    assert.equal(headers.get("authorization"), `Bearer ${firebaseToken}`);
    if (!url.pathname.endsWith("/documents/export")) assert.equal(url.search, "");
    assert.equal(url.toString().includes(firebaseToken), false);
    assert.equal(url.toString().includes(workerToken), false);

    if (url.pathname === "/api/job-agent/profile" && method === "GET") {
      return json({
        ok: true,
        profile: {
          ...himakarCandidateProfile,
          claims: [
            ...himakarCandidateProfile.claims,
            {
              id: "personal-given-name-test",
              category: "personal",
              field: "firstName",
              value: "Himakar",
              status: "user-entered",
              source: "test",
              sensitive: true,
            },
          ],
        },
        privateContact: { email: "fixture@example.test", phone: "+61 400 000 000" },
      });
    }

    if (url.pathname === `/api/job-agent/applications/${applicationId}` && method === "GET") {
      return json({
        ok: true,
        application: application("READY_FOR_REVIEW"),
        documents: [{
          id: "document-fixture",
          availableKinds: ["resumePdf", "coverLetterPdf"],
        }],
      });
    }

    if (url.pathname.endsWith("/documents/export") && method === "GET") {
      assert.equal(url.searchParams.get("documentId"), "document-fixture");
      assert.ok(["resumePdf", "coverLetterPdf"].includes(url.searchParams.get("kind") ?? ""));
      return new Response("private fixture document", {
        status: 200,
        headers: { "content-type": "application/pdf", "content-length": "24" },
      });
    }

    if (url.pathname.endsWith("/autofill") && method === "GET") {
      if (!planSaved) return json({ ok: true, application: application("READY_FOR_REVIEW"), plan: null, workerPlan: null, planHash: null });
      if (!ready) return json({ ok: true, application: application("AUTOFILL_IN_PROGRESS", planHash), plan: storedPlan, workerPlan: workerPlan("worker-plan", false), planHash });
      return json({ ok: true, application: application("READY_TO_SUBMIT", planHash), plan: storedPlan, workerPlan: workerPlan("worker-plan-final", true), planHash });
    }

    if (url.pathname.endsWith("/autofill") && method === "POST") {
      const action = (body as { action?: string }).action;
      if (action === "save_plan") {
        planSaved = true;
        return json({ ok: true, application: application("READY_FOR_REVIEW", planHash) });
      }
      if (action === "ready_to_submit") {
        ready = true;
        return json({ ok: true, application: application("READY_TO_SUBMIT", planHash), planHash });
      }
      throw new Error(`Unexpected autofill action ${action}`);
    }

    if (url.pathname.endsWith("/approval") && method === "GET") {
      return json({
        ok: true,
        approval: options.approvalGranted === false ? null : {
          id: `submission-${applicationId}`,
          applicationId,
          action: "final_submission",
          planHash,
          status: "granted",
          grantedBy: "fixture-user",
          grantedAt: now,
          expiresAt: "2026-07-18T08:15:00.000Z",
          consumedAt: null,
        },
      });
    }

    if (url.pathname.endsWith("/approval") && method === "PUT") {
      assert.equal(headers.get("x-job-agent-worker-token"), workerToken);
      return json({
        ok: true,
        application: application("SUBMISSION_APPROVED", planHash),
        approval: {
          id: `submission-${applicationId}`,
          applicationId,
          action: "final_submission",
          planHash,
          status: "consumed",
          grantedBy: "fixture-user",
          grantedAt: now,
          expiresAt: "2026-07-18T08:15:00.000Z",
          consumedAt: now,
        },
        attempt: {
          id: "attempt-fixture",
          applicationId,
          approvalId: `submission-${applicationId}`,
          planHash,
          status: "pending",
          issuedAt: now,
          expiresAt: "2026-07-18T08:05:00.000Z",
          completedAt: null,
          result: null,
          completionToken: "x".repeat(43),
        },
      });
    }

    if (url.pathname.endsWith("/submission-result") && method === "POST") {
      assert.equal(headers.get("x-job-agent-worker-token"), workerToken);
      receipt = body as Record<string, unknown>;
      const outcome = receipt.outcome;
      submitted = outcome === "confirmed";
      return json({
        ok: true,
        application: application(submitted ? "SUBMITTED" : "SUBMISSION_APPROVED", planHash),
        attempt: {
          id: "attempt-fixture",
          applicationId,
          planHash,
          status: outcome,
        },
      });
    }

    return json({ error: "not_found" }, 404);
  }) as typeof fetch;

  return {
    calls,
    fetchImplementation,
    receipt: () => receipt,
    submitted: () => submitted,
    submitThrowsAfterConsume: options.submitThrowsAfterConsume === true,
  };
}

async function createBridge(transport: ReturnType<typeof createTransport>) {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "applyflow-auth-worker-"));
  temporaryDirectories.push(temporaryDirectory);
  const screenshotPath = path.join(temporaryDirectory, "submitted.png");
  await writeFile(screenshotPath, "fixture screenshot", { mode: 0o600 });
  let requestCount = 0;
  let submitCalled = false;
  return {
    submitCalled: () => submitCalled,
    bridge: {
      async open(url: string) {
        assert.equal(url, applicationUrl);
      },
      async requestAutofillPlan(_applicationId: string, profile: { documents?: { resumePath?: string; coverLetterPath?: string } }) {
        assert.ok(profile.documents?.resumePath);
        assert.ok(profile.documents?.coverLetterPath);
        assert.equal(await readFile(profile.documents.resumePath, "utf8"), "private fixture document");
        assert.equal(await readFile(profile.documents.coverLetterPath, "utf8"), "private fixture document");
        requestCount += 1;
        return requestCount === 1
          ? workerPlan("worker-plan", false)
          : workerPlan("worker-plan-final", true);
      },
      async fillApprovedFields(_plan: BridgeAutofillPlan, authorization: { approvedFieldIds: string[]; userInitiated: true }) {
        assert.deepEqual(authorization.approvedFieldIds.sort(), ["field-email", "field-first-name"]);
        assert.equal(authorization.userInitiated, true);
        return { state: "READY_TO_SUBMIT" as const, pauses: [] };
      },
      async submitApprovedApplication(plan: BridgeAutofillPlan, provider?: SubmissionApprovalProvider): Promise<SubmissionResult> {
        submitCalled = true;
        assert.equal(plan.id, "worker-plan-final");
        const approval = await provider?.({
          scope: "single_application_submit",
          applicationId,
          planId: plan.id,
          url: plan.url,
          requestedAt: now,
        });
        assert.equal(approval?.verified, true);
        if (transport.submitThrowsAfterConsume) throw new Error("ambiguous browser failure");
        return {
          applicationId,
          planId: plan.id,
          portal: "generic" as const,
          state: "SUBMITTED" as const,
          verificationId: approval?.verificationId ?? "missing",
          attemptedAt: now,
          submittedAt: now,
          confirmationEvidence: ["[role=status]: Mock application submitted"],
          confirmation: {
            confirmed: true,
            finalUrl: `${applicationUrl}?private=query#secret-fragment`,
            evidence: ["[role=status]: Mock application submitted"],
            matchedSignals: ["confirmation_heading", "submit_control_absent", "no_validation_errors"],
            noValidationErrors: true,
          },
          screenshotPath,
        };
      },
      async reportPageState() {
        return { url: `${applicationUrl}?private=query#secret-fragment` };
      },
    },
  };
}

describe("authenticated browser worker transport", () => {
  test("rejects credentials over non-loopback plaintext HTTP", () => {
    assert.throws(() => normalizeWorkerBaseUrl("http://example.com"), /HTTPS origin/);
    assert.throws(() => normalizeWorkerBaseUrl("https://user:pass@example.com"), /HTTPS origin/);
    assert.equal(normalizeWorkerBaseUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  });

  test("runs plan, explicit start, fill, separate approval, submit and receipt without leaking credentials", async () => {
    const transport = createTransport();
    const { bridge, submitCalled } = await createBridge(transport);
    const client = new AuthenticatedJobAgentClient({
      baseUrl: "http://127.0.0.1:3000",
      firebaseIdToken: firebaseToken,
      workerToken,
      fetchImplementation: transport.fetchImplementation,
    });
    const result = await runSupervisedApplication({
      applicationId,
      client,
      bridge,
      maximumPolls: 4,
      sleep: async () => undefined,
      now: () => new Date(now),
      onProgress() {
        throw new Error("display failure must not alter state");
      },
    });

    assert.equal(result.state, "SUBMITTED");
    assert.equal(submitCalled(), true);
    assert.equal(transport.submitted(), true);
    const receipt = transport.receipt();
    assert.equal(receipt?.outcome, "confirmed");
    assert.equal(String(receipt?.observedUrl).includes("private=query"), false);
    assert.equal(String(receipt?.observedUrl).includes("secret-fragment"), false);
    assert.equal(JSON.stringify(transport.calls).includes(firebaseToken), false);
    assert.equal(JSON.stringify(transport.calls).includes(workerToken), false);
    const workerAuthenticatedCalls = transport.calls.filter((call) =>
      call.headers.has("x-job-agent-worker-token"),
    );
    assert.deepEqual(workerAuthenticatedCalls.map((call) => call.method), ["PUT", "POST"]);
  });

  test("never submits while final approval is absent", async () => {
    const transport = createTransport({ approvalGranted: false });
    const { bridge, submitCalled } = await createBridge(transport);
    const client = new AuthenticatedJobAgentClient({
      baseUrl: "http://127.0.0.1:3000",
      firebaseIdToken: firebaseToken,
      workerToken,
      fetchImplementation: transport.fetchImplementation,
    });
    await assert.rejects(
      runSupervisedApplication({
        applicationId,
        client,
        bridge,
        maximumPolls: 1,
        sleep: async () => undefined,
        now: () => new Date(now),
      }),
      /Timed out waiting for final submission approval/,
    );
    assert.equal(submitCalled(), false);
  });

  test("reports unknown, never failed, when an error occurs after approval consumption", async () => {
    const transport = createTransport({ submitThrowsAfterConsume: true });
    const { bridge } = await createBridge(transport);
    const client = new AuthenticatedJobAgentClient({
      baseUrl: "http://127.0.0.1:3000",
      firebaseIdToken: firebaseToken,
      workerToken,
      fetchImplementation: transport.fetchImplementation,
    });
    await assert.rejects(
      runSupervisedApplication({
        applicationId,
        client,
        bridge,
        maximumPolls: 4,
        sleep: async () => undefined,
        now: () => new Date(now),
      }),
      /ambiguous browser failure/,
    );
    assert.equal(transport.receipt()?.outcome, "unknown");
    assert.equal(transport.submitted(), false);
  });
});
