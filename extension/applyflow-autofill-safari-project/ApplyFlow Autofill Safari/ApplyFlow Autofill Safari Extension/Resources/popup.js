const contextEl = document.getElementById("context");
const saveBtn = document.getElementById("save");
const assistBtn = document.getElementById("assist");
const runBtn = document.getElementById("run");
const clearBtn = document.getElementById("clear");
const summaryEl = document.getElementById("summary");
const holdEl = document.getElementById("hold");
const statusEl = document.getElementById("status");
const extensionApi = globalThis.browser ?? globalThis.chrome;

function getLastError() {
  const message = globalThis.chrome?.runtime?.lastError?.message;
  return message ? new Error(message) : null;
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (value, isError = false) => {
      if (settled) return;
      settled = true;
      if (isError) {
        reject(value instanceof Error ? value : new Error(String(value)));
        return;
      }
      resolve(value);
    };

    try {
      const maybePromise = extensionApi.runtime.sendMessage(message, (response) => {
        const runtimeError = getLastError();
        if (runtimeError) {
          finish(runtimeError, true);
          return;
        }
        finish(response);
      });

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(
          (response) => finish(response),
          (error) => finish(error, true),
        );
      }
    } catch (error) {
      finish(error, true);
    }
  });
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#6b7280";
}

function summarize(context) {
  if (!context) {
    summaryEl.textContent = "No ApplyFlow context saved yet. In ApplyFlow, open Apply Assistant and click Sync to extension.";
    return;
  }
  const job = context.job ?? {};
  const profile = context.profile ?? {};
  const name = profile.fullName || "Unknown profile";
  summaryEl.textContent = `${job.title || "Role"} @ ${job.company || "Company"} • ${name}`;
}

function renderHold(session) {
  if (!session?.holdActive) {
    holdEl.textContent = "";
    return;
  }

  const blocker = (session.blocker || "manual_step").replace(/_/g, " ");
  holdEl.textContent = `Paused on ${blocker}: ${session.message || "Clear the blocker on the page and ApplyFlow will resume automatically."}`;
}

async function getContext() {
  const response = await sendRuntimeMessage({ type: "GET_CONTEXT" });
  return response?.context ?? null;
}

async function getAutofillStatus() {
  const response = await sendRuntimeMessage({ type: "GET_AUTOFILL_STATUS" });
  return response?.ok ? response : { ok: false, hasContext: false, session: null };
}

async function saveContext(payload) {
  const response = await sendRuntimeMessage({ type: "SET_CONTEXT", payload });
  return Boolean(response?.ok);
}

async function clearContext() {
  const response = await sendRuntimeMessage({ type: "CLEAR_CONTEXT" });
  return Boolean(response?.ok);
}

async function runAutofill() {
  return sendRuntimeMessage({ type: "RUN_AUTOFILL" });
}

async function startAssistedAutofill() {
  return sendRuntimeMessage({ type: "START_ASSISTED_AUTOFILL" });
}

function describeRunResult(result) {
  if (!result) {
    return { message: "No response from the page.", isError: true };
  }

  if (result.holdActive) {
    return {
      message:
        result.message ||
        "Paused for login, CAPTCHA, or verification. Clear it on the page and ApplyFlow will resume automatically.",
      isError: false,
    };
  }

  if (result.status === "submitted") {
    return {
      message: "Form submitted automatically. Review the result in ApplyFlow.",
      isError: false,
    };
  }

  if (result.status === "pending_manual_action") {
    const fileCount = result.filesToUpload?.length || 0;
    return {
      message:
        fileCount > 0
          ? `Form filled. Upload ${fileCount} required file${fileCount === 1 ? "" : "s"}, then review and submit.`
          : result.message || "Form filled. Review and submit when ready.",
      isError: false,
    };
  }

  if (result.ok) {
    const filled = result.filled ?? 0;
    const answers = result.answerCount ?? 0;
    const adapter = result.adapter ?? "generic";
    const adapterFilled = result.adapterFilled ?? 0;
    return {
      message: `Done. Adapter: ${adapter}. Filled ${filled} fields (${answers} long-answer; ${adapterFilled} ATS-targeted).`,
      isError: false,
    };
  }

  return {
    message: result.error || result.message || "Autofill failed.",
    isError: true,
  };
}

async function refreshUi() {
  const [context, autofillStatus] = await Promise.all([getContext(), getAutofillStatus()]);
  if (context) {
    contextEl.value = JSON.stringify(context, null, 2);
  }
  summarize(context);
  renderHold(autofillStatus?.session ?? null);
}

saveBtn.addEventListener("click", async () => {
  try {
    const raw = contextEl.value.trim();
    if (!raw) {
      setStatus("Paste context JSON first.", true);
      return;
    }
    const parsed = JSON.parse(raw);
    const ok = await saveContext(parsed);
    if (!ok) {
      setStatus("Unable to save context.", true);
      return;
    }
    await refreshUi();
    setStatus("Context saved.");
  } catch {
    setStatus("Invalid JSON.", true);
  }
});

assistBtn.addEventListener("click", async () => {
  setStatus("Starting assisted autofill...");
  try {
    const response = await startAssistedAutofill();
    if (!response?.ok) {
      setStatus(response?.error || "Unable to start assisted autofill.", true);
      return;
    }
    const result = describeRunResult(response.result);
    await refreshUi();
    setStatus(result.message, result.isError);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to start assisted autofill.", true);
  }
});

runBtn.addEventListener("click", async () => {
  setStatus("Running autofill...");
  try {
    const response = await runAutofill();
    if (!response?.ok) {
      setStatus(response?.error || "Autofill failed.", true);
      return;
    }
    const result = describeRunResult(response.result);
    await refreshUi();
    setStatus(result.message, result.isError);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Autofill failed.", true);
  }
});

clearBtn.addEventListener("click", async () => {
  contextEl.value = "";
  const ok = await clearContext();
  if (ok) {
    await refreshUi();
    setStatus("Saved context cleared.");
  } else {
    setStatus("Unable to clear context.", true);
  }
});

(async () => {
  await refreshUi();
  setStatus("Ready. Open the employer page, then click Start assisted autofill.");
})();
