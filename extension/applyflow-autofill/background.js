const CONTEXT_KEY = "applyflow_context_v1";
const ACTIVE_SESSION_KEY = "applyflow_active_session_v1";
const extensionApi = globalThis.browser ?? globalThis.chrome;

function getLastError() {
  const message = globalThis.chrome?.runtime?.lastError?.message;
  return message ? new Error(message) : null;
}

function callApi(fn, context, ...args) {
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
      const maybePromise = fn.call(context, ...args, (value) => {
        const runtimeError = getLastError();
        if (runtimeError) {
          finish(runtimeError, true);
          return;
        }
        finish(value);
      });

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(
          (value) => finish(value),
          (error) => finish(error, true),
        );
      }
    } catch (error) {
      finish(error, true);
    }
  });
}

async function getStoredValue(key) {
  const data = await callApi(extensionApi.storage.local.get, extensionApi.storage.local, [key]);
  return data[key] ?? null;
}

async function setStoredValue(key, payload) {
  await callApi(extensionApi.storage.local.set, extensionApi.storage.local, { [key]: payload });
}

async function removeStoredValue(key) {
  await callApi(extensionApi.storage.local.remove, extensionApi.storage.local, [key]);
}

async function getStoredContext() {
  return getStoredValue(CONTEXT_KEY);
}

async function setStoredContext(payload) {
  await setStoredValue(CONTEXT_KEY, payload);
}

async function clearStoredContext() {
  await removeStoredValue(CONTEXT_KEY);
}

async function getActiveSession() {
  return getStoredValue(ACTIVE_SESSION_KEY);
}

async function setActiveSession(payload) {
  await setStoredValue(ACTIVE_SESSION_KEY, payload);
  await syncActionBadge(payload);
}

async function clearActiveSession() {
  await removeStoredValue(ACTIVE_SESSION_KEY);
  await syncActionBadge(null);
}

async function getActiveTab() {
  const tabs = await callApi(extensionApi.tabs.query, extensionApi.tabs, {
    active: true,
    currentWindow: true,
  });
  return tabs?.[0] ?? null;
}

async function syncActionBadge(session) {
  if (!extensionApi.action?.setBadgeText) return;

  if (session?.holdActive) {
    await Promise.all([
      callApi(extensionApi.action.setBadgeText, extensionApi.action, { text: "PAUSE" }),
      callApi(extensionApi.action.setBadgeBackgroundColor, extensionApi.action, {
        color: "#f59e0b",
      }),
      callApi(extensionApi.action.setTitle, extensionApi.action, {
        title: `ApplyFlow paused: ${session.message || session.blocker || "Manual step required"}`,
      }),
    ]).catch(() => {});
    return;
  }

  await Promise.all([
    callApi(extensionApi.action.setBadgeText, extensionApi.action, { text: "" }),
    callApi(extensionApi.action.setTitle, extensionApi.action, {
      title: "ApplyFlow Assistant",
    }),
  ]).catch(() => {});
}

async function sendMessageToTab(tabId, message) {
  return callApi(extensionApi.tabs.sendMessage, extensionApi.tabs, tabId, message);
}

async function startAssistedAutofill(tab, context) {
  const response = await sendMessageToTab(tab.id, {
    type: "AUTO_APPLY_FLOW",
    payload: context,
  });

  const result = response ?? null;
  if (result?.holdActive) {
    await setActiveSession({
      holdActive: true,
      tabId: tab.id,
      tabUrl: tab.url ?? "",
      blocker: result.blocker ?? "manual_action_needed",
      taskType: result.taskType ?? "form_review",
      message: result.message ?? "",
      context,
      updatedAt: new Date().toISOString(),
    });
  } else {
    await clearActiveSession();
  }

  return result;
}

async function resumeHeldSession(tabId) {
  const session = await getActiveSession();
  if (!session?.holdActive || session.tabId !== tabId || !session.context) return;

  try {
    const result = await sendMessageToTab(tabId, {
      type: "AUTO_APPLY_FLOW_RESUME",
      payload: session.context,
    });

    if (result?.holdActive) {
      await setActiveSession({
        ...session,
        blocker: result.blocker ?? session.blocker,
        taskType: result.taskType ?? session.taskType,
        message: result.message ?? session.message,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    await clearActiveSession();
  } catch {
    // Ignore transient tab/content-script errors during navigation.
  }
}

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (!message?.type) {
        sendResponse({ ok: false, error: "invalid_message" });
        return;
      }

      if (message.type === "SET_CONTEXT") {
        await setStoredContext(message.payload);
        await clearActiveSession();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "GET_CONTEXT") {
        const context = await getStoredContext();
        sendResponse({ ok: true, context });
        return;
      }

      if (message.type === "CLEAR_CONTEXT") {
        await clearStoredContext();
        await clearActiveSession();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "GET_AUTOFILL_STATUS") {
        const [context, session] = await Promise.all([getStoredContext(), getActiveSession()]);
        sendResponse({
          ok: true,
          hasContext: Boolean(context),
          session,
        });
        return;
      }

      if (message.type === "SET_ACTIVE_SESSION") {
        const existingContext = message.payload?.context ?? (await getStoredContext());
        await setActiveSession({
          ...message.payload,
          context: existingContext,
          updatedAt: new Date().toISOString(),
        });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "CLEAR_ACTIVE_SESSION") {
        await clearActiveSession();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "RUN_AUTOFILL") {
        const tab = await getActiveTab();
        if (!tab?.id) {
          sendResponse({ ok: false, error: "active_tab_missing" });
          return;
        }

        const context = message.payload ?? (await getStoredContext());
        if (!context) {
          sendResponse({ ok: false, error: "context_missing" });
          return;
        }

        const response = await sendMessageToTab(tab.id, {
          type: "AUTOFILL_FORM",
          payload: context,
        });
        sendResponse({ ok: true, result: response ?? null });
        return;
      }

      if (message.type === "START_ASSISTED_AUTOFILL") {
        const tab = await getActiveTab();
        if (!tab?.id) {
          sendResponse({ ok: false, error: "active_tab_missing" });
          return;
        }

        const context = message.payload ?? (await getStoredContext());
        if (!context) {
          sendResponse({ ok: false, error: "context_missing" });
          return;
        }

        const result = await startAssistedAutofill(tab, context);
        sendResponse({ ok: true, result });
        return;
      }

      sendResponse({ ok: false, error: "unsupported_type" });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  })();

  return true;
});

extensionApi.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    void resumeHeldSession(tabId);
  }
});

extensionApi.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const session = await getActiveSession();
    if (session?.tabId === tabId) {
      await clearActiveSession();
    }
  })();
});
