const FIELD_RULES = [
  { key: "fullName", patterns: ["full name", "name"] },
  { key: "email", patterns: ["email", "e-mail"] },
  { key: "phone", patterns: ["phone", "mobile", "contact number"] },
  { key: "location", patterns: ["location", "city", "address"] },
  { key: "linkedin", patterns: ["linkedin"] },
  { key: "github", patterns: ["github"] },
  { key: "portfolio", patterns: ["portfolio", "website", "personal site"] },
  { key: "visaStatus", patterns: ["visa", "work authorization", "right to work", "sponsorship"] },
];

const STOP_WORDS = new Set([
  "what",
  "why",
  "how",
  "the",
  "and",
  "for",
  "your",
  "you",
  "are",
  "is",
  "this",
  "that",
  "with",
  "about",
  "role",
  "job",
  "position",
  "company",
]);

const WEB_BRIDGE_SOURCE = "applyflow-web";
const EXTENSION_BRIDGE_SOURCE = "applyflow-extension";
const ALLOWED_APPLYFLOW_HOSTS = new Set([
  "applyflow.com",
  "www.applyflow.com",
  "localhost:3000",
  "127.0.0.1:3000",
]);
const extensionApi = globalThis.browser ?? globalThis.chrome;
const APPLYFLOW_BANNER_ID = "applyflow-extension-banner";
let heldAutofillSession = null;
let heldAutofillObserver = null;
let heldAutofillTimer = null;

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

function notifyBackground(message) {
  sendRuntimeMessage(message).catch(() => null);
}

function ensureAssistBanner() {
  let banner = document.getElementById(APPLYFLOW_BANNER_ID);
  if (banner) return banner;

  banner = document.createElement("div");
  banner.id = APPLYFLOW_BANNER_ID;
  banner.style.position = "fixed";
  banner.style.right = "16px";
  banner.style.bottom = "16px";
  banner.style.zIndex = "2147483647";
  banner.style.maxWidth = "360px";
  banner.style.padding = "12px 14px";
  banner.style.borderRadius = "14px";
  banner.style.border = "1px solid rgba(148, 163, 184, 0.35)";
  banner.style.boxShadow = "0 18px 40px rgba(15, 23, 42, 0.2)";
  banner.style.backdropFilter = "blur(12px)";
  banner.style.fontFamily =
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  banner.style.fontSize = "13px";
  banner.style.lineHeight = "1.45";
  banner.style.color = "#0f172a";
  document.documentElement.appendChild(banner);
  return banner;
}

function showAssistBanner(message, tone = "info") {
  const banner = ensureAssistBanner();
  const themes = {
    info: {
      background: "rgba(239, 246, 255, 0.96)",
      border: "rgba(59, 130, 246, 0.35)",
      color: "#1d4ed8",
    },
    paused: {
      background: "rgba(255, 247, 237, 0.97)",
      border: "rgba(249, 115, 22, 0.35)",
      color: "#c2410c",
    },
    success: {
      background: "rgba(240, 253, 244, 0.97)",
      border: "rgba(34, 197, 94, 0.35)",
      color: "#15803d",
    },
    error: {
      background: "rgba(254, 242, 242, 0.97)",
      border: "rgba(239, 68, 68, 0.35)",
      color: "#b91c1c",
    },
  };

  const theme = themes[tone] ?? themes.info;
  banner.style.background = theme.background;
  banner.style.borderColor = theme.border;
  banner.style.color = theme.color;
  banner.textContent = message;
}

function clearAssistBanner(delayMs = 0) {
  const remove = () => {
    const banner = document.getElementById(APPLYFLOW_BANNER_ID);
    if (banner) banner.remove();
  };

  if (delayMs > 0) {
    window.setTimeout(remove, delayMs);
    return;
  }
  remove();
}

function clearHeldAutofillSession() {
  heldAutofillSession = null;
  if (heldAutofillObserver) {
    heldAutofillObserver.disconnect();
    heldAutofillObserver = null;
  }
  if (heldAutofillTimer) {
    window.clearInterval(heldAutofillTimer);
    heldAutofillTimer = null;
  }
  notifyBackground({ type: "CLEAR_ACTIVE_SESSION" });
}

function isApplyFlowHost() {
  return ALLOWED_APPLYFLOW_HOSTS.has(window.location.host.toLowerCase());
}

function postBridgeResponse(requestId, type, payload) {
  window.postMessage(
    {
      source: EXTENSION_BRIDGE_SOURCE,
      requestId,
      type,
      payload,
    },
    window.location.origin,
  );
}

function setupApplyFlowBridge() {
  if (!isApplyFlowHost()) return;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (!data || data.source !== WEB_BRIDGE_SOURCE || typeof data.type !== "string") {
      return;
    }

    const requestId = data.requestId ?? "";
    const type = data.type;

    (async () => {
      if (type === "APPLYFLOW_EXTENSION_PING") {
        postBridgeResponse(requestId, "APPLYFLOW_EXTENSION_PING_RESULT", {
          ok: true,
          installed: true,
          version: extensionApi.runtime.getManifest?.().version ?? "unknown",
        });
        return;
      }

      if (type === "APPLYFLOW_EXTENSION_SET_CONTEXT") {
        const response = await sendRuntimeMessage({
          type: "SET_CONTEXT",
          payload: data.payload,
        });
        postBridgeResponse(requestId, "APPLYFLOW_EXTENSION_SET_CONTEXT_RESULT", {
          ok: Boolean(response?.ok),
          error: response?.error ?? null,
        });
        return;
      }

      if (type === "APPLYFLOW_EXTENSION_GET_CONTEXT") {
        const response = await sendRuntimeMessage({ type: "GET_CONTEXT" });
        postBridgeResponse(requestId, "APPLYFLOW_EXTENSION_GET_CONTEXT_RESULT", {
          ok: Boolean(response?.ok),
          context: response?.context ?? null,
          error: response?.error ?? null,
        });
        return;
      }

      if (type === "APPLYFLOW_EXTENSION_CLEAR_CONTEXT") {
        const response = await sendRuntimeMessage({ type: "CLEAR_CONTEXT" });
        postBridgeResponse(requestId, "APPLYFLOW_EXTENSION_CLEAR_CONTEXT_RESULT", {
          ok: Boolean(response?.ok),
          error: response?.error ?? null,
        });
      }
    })().catch((error) => {
      postBridgeResponse(requestId, `${type}_RESULT`, {
        ok: false,
        error: error instanceof Error ? error.message : "extension_bridge_failed",
      });
    });
  });
}

function normalize(value) {
  return (value || "").toString().trim().toLowerCase();
}

function trimString(value) {
  return (value || "").toString().trim();
}

function collectHints(element) {
  return normalize(
    [
      element.getAttribute("name"),
      element.getAttribute("id"),
      element.getAttribute("aria-label"),
      element.getAttribute("placeholder"),
      element.getAttribute("autocomplete"),
      element.getAttribute("data-automation-id"),
      element.dataset?.testid,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getLabelTextForControl(control) {
  const id = control.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) return normalize(label.textContent);
  }
  const wrappedLabel = control.closest("label");
  if (wrappedLabel) return normalize(wrappedLabel.textContent);
  return "";
}

function setNativeValue(element, value) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function tryFillSelect(element, value) {
  const lowerValue = normalize(value);
  const option = Array.from(element.options).find((opt) => normalize(opt.textContent).includes(lowerValue));
  if (!option) return false;
  element.value = option.value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function isVisible(control) {
  if (!(control instanceof Element)) return false;
  const style = window.getComputedStyle(control);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }
  return true;
}

function fillControl(control, value, filledControls) {
  if (!value) return false;
  if (!isVisible(control)) return false;
  if (filledControls?.has(control)) return false;
  if (control instanceof HTMLSelectElement) {
    const success = tryFillSelect(control, value);
    if (success) filledControls?.add(control);
    return success;
  }
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    if (control.readOnly || control.disabled) return false;
    const inputType = normalize(control.getAttribute("type") || "text");
    if (inputType === "file" || inputType === "password" || inputType === "hidden") return false;
    setNativeValue(control, value);
    filledControls?.add(control);
    return true;
  }
  return false;
}

function findCandidateControls(patterns, onlyEmpty = true) {
  const controls = Array.from(document.querySelectorAll("input, textarea, select"));
  return controls.filter((control) => {
    if (!isVisible(control)) return false;
    if (onlyEmpty && control instanceof HTMLInputElement && trimString(control.value)) return false;
    if (onlyEmpty && control instanceof HTMLTextAreaElement && trimString(control.value)) return false;
    const labelText = getLabelTextForControl(control);
    const hints = collectHints(control);
    const haystack = `${labelText} ${hints}`;
    return patterns.some((pattern) => haystack.includes(pattern));
  });
}

function fillBySelectorList(selectors, value, filledControls) {
  if (!value) return 0;
  let count = 0;
  selectors.forEach((selector) => {
    const controls = Array.from(document.querySelectorAll(selector));
    controls.forEach((control) => {
      if (fillControl(control, value, filledControls)) {
        count += 1;
      }
    });
  });
  return count;
}

function getActionLabel(control) {
  if (!(control instanceof Element)) return "";
  if (control instanceof HTMLInputElement) {
    return normalize(control.value || control.getAttribute("aria-label") || control.getAttribute("title"));
  }
  return normalize(
    control.textContent ||
      control.getAttribute("aria-label") ||
      control.getAttribute("title") ||
      control.getAttribute("data-automation-id"),
  );
}

function findSubmitButton() {
  const directMatch = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]')).find(
    (control) =>
      isVisible(control) &&
      !(control instanceof HTMLButtonElement && control.disabled) &&
      !(control instanceof HTMLInputElement && control.disabled),
  );
  if (directMatch) return directMatch;

  const actionLabels = ["submit", "apply", "send application", "submit application", "complete application"];
  const candidates = Array.from(document.querySelectorAll('button, input[type="button"], [role="button"]'));

  return (
    candidates.find((control) => {
      if (!isVisible(control)) return false;
      if (control instanceof HTMLButtonElement && control.disabled) return false;
      if (control instanceof HTMLInputElement && control.disabled) return false;
      const label = getActionLabel(control);
      return actionLabels.some((actionLabel) => label.includes(actionLabel));
    }) ?? null
  );
}

function splitFullName(fullName) {
  const tokens = trimString(fullName).split(/\s+/).filter(Boolean);
  if (!tokens.length) return { firstName: "", lastName: "" };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: "" };
  return {
    firstName: tokens[0],
    lastName: tokens.slice(1).join(" "),
  };
}

function bestAnswerForField(questionText, answerBank) {
  const normalizedQuestion = normalize(questionText);
  if (!normalizedQuestion) return null;

  let best = null;
  let bestScore = 0;

  for (const entry of answerBank) {
    const tokens = normalize(entry.question)
      .split(/\s+/)
      .filter((token) => token && !STOP_WORDS.has(token));
    const score = tokens.reduce(
      (count, token) => (normalizedQuestion.includes(token) ? count + 1 : count),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = entry.answer;
    }
  }

  return bestScore >= 2 ? best : null;
}

function fillAnswerBank(answerBank, filledControls) {
  if (!Array.isArray(answerBank) || !answerBank.length) return 0;
  let filled = 0;

  const textareaControls = Array.from(document.querySelectorAll("textarea"));
  textareaControls.forEach((textarea) => {
    if (!isVisible(textarea)) return;
    const questionText = [getLabelTextForControl(textarea), collectHints(textarea)].join(" ");
    const answer = bestAnswerForField(questionText, answerBank);
    if (!answer) return;
    if (fillControl(textarea, answer, filledControls)) {
      filled += 1;
    }
  });

  return filled;
}

function detectAtsProvider() {
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();

  if (host.includes("amazon.jobs")) {
    return "amazon";
  }
  if (host.includes("metacareers.com")) {
    return "meta";
  }
  if (host.includes("riotinto")) {
    return "rio_tinto";
  }
  if (
    host.includes("myworkdayjobs.com") ||
    host.includes("wd5.myworkdayjobs.com") ||
    document.querySelector("[data-automation-id]")
  ) {
    return "workday";
  }
  if (
    host.includes("greenhouse.io") ||
    host.includes("boards.greenhouse.io") ||
    document.querySelector("form#application_form")
  ) {
    return "greenhouse";
  }
  if (
    host.includes("jobs.lever.co") ||
    document.querySelector("form#application-form,[data-qa='application-form']")
  ) {
    return "lever";
  }
  if (host.includes("icims.com")) {
    return "icims";
  }
  if (host.includes("smartrecruiters.com")) {
    return "smartrecruiters";
  }
  if (host.includes("workable.com")) {
    return "workable";
  }
  if (host.includes("taleo.net") || path.includes("careersection")) {
    return "taleo";
  }
  if (
    host.includes("successfactors.com") ||
    host.includes("jobs.sap.com")
  ) {
    return "successfactors";
  }
  if (
    host.includes("governmentjobs.com") ||
    host.endsWith(".gov.au") ||
    host.endsWith(".gov") ||
    host.includes(".gov.")
  ) {
    return "gov_portal";
  }
  return "generic";
}

function runAmazonAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  count += fillBySelectorList(
    ["input[name*='firstName']", "input[id*='firstName']", "input[aria-label*='First name']"],
    firstName,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[name*='lastName']", "input[id*='lastName']", "input[aria-label*='Last name']"],
    lastName,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[name*='email']", "input[type='email']", "input[aria-label*='Email']"],
    profile.email,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[name*='phone']", "input[type='tel']", "input[aria-label*='Phone']"],
    profile.phone,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[name*='location']", "input[name*='city']", "input[aria-label*='Location']"],
    profile.location,
    filledControls,
  );
  count += fillBySelectorList(["input[name*='linkedin']"], profile.linkedin, filledControls);
  count += fillBySelectorList(["input[name*='visa']", "input[name*='authorization']"], profile.visaStatus, filledControls);
  return count;
}

function runMetaAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  count += fillBySelectorList(
    ["input[name*='first']", "input[id*='first']", "input[aria-label*='First']"],
    firstName,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[name*='last']", "input[id*='last']", "input[aria-label*='Last']"],
    lastName,
    filledControls,
  );
  count += fillBySelectorList(["input[name*='email']", "input[type='email']"], profile.email, filledControls);
  count += fillBySelectorList(["input[name*='phone']", "input[type='tel']"], profile.phone, filledControls);
  count += fillBySelectorList(["input[name*='location']", "input[name*='city']"], profile.location, filledControls);
  count += fillBySelectorList(["input[name*='linkedin']"], profile.linkedin, filledControls);
  count += fillBySelectorList(["input[name*='website']", "input[name*='portfolio']"], profile.portfolio, filledControls);
  return count;
}

function runRioTintoAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  // Many Rio Tinto roles route to Workday variants; include both specific + generic selectors.
  count += fillBySelectorList(
    [
      "input[data-automation-id*='firstName']",
      "input[name*='firstName']",
      "input[id*='firstName']",
      "input[name*='first']",
    ],
    firstName,
    filledControls,
  );
  count += fillBySelectorList(
    [
      "input[data-automation-id*='lastName']",
      "input[name*='lastName']",
      "input[id*='lastName']",
      "input[name*='last']",
    ],
    lastName,
    filledControls,
  );
  count += fillBySelectorList(["input[name*='email']", "input[type='email']"], profile.email, filledControls);
  count += fillBySelectorList(["input[name*='phone']", "input[type='tel']"], profile.phone, filledControls);
  count += fillBySelectorList(["input[name*='city']", "input[name*='location']"], profile.location, filledControls);
  count += fillBySelectorList(["input[name*='linkedin']"], profile.linkedin, filledControls);
  return count;
}

function runWorkdayAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  count += fillBySelectorList(
    ["input[data-automation-id*='firstName']", "input[name*='firstName']", "input[id*='firstName']"],
    firstName,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[data-automation-id*='lastName']", "input[name*='lastName']", "input[id*='lastName']"],
    lastName,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[data-automation-id*='email']", "input[type='email']"],
    profile.email,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[data-automation-id*='phone']", "input[type='tel']"],
    profile.phone,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[data-automation-id*='city']", "input[data-automation-id*='location']"],
    profile.location,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[data-automation-id*='linkedin']", "input[name*='linkedin']"],
    profile.linkedin,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[data-automation-id*='website']", "input[name*='portfolio']"],
    profile.portfolio,
    filledControls,
  );
  return count;
}

function runGreenhouseAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  count += fillBySelectorList(["#first_name", "input[name='first_name']"], firstName, filledControls);
  count += fillBySelectorList(["#last_name", "input[name='last_name']"], lastName, filledControls);
  count += fillBySelectorList(["#email", "input[name='email']"], profile.email, filledControls);
  count += fillBySelectorList(["#phone", "input[name='phone']"], profile.phone, filledControls);
  count += fillBySelectorList(
    ["#auto_complete_input", "#location", "input[name='location']"],
    profile.location,
    filledControls,
  );
  count += fillBySelectorList(
    ["#linkedin_url", "#linkedin", "input[name*='linkedin']"],
    profile.linkedin,
    filledControls,
  );
  count += fillBySelectorList(
    ["#github_url", "#github", "input[name*='github']"],
    profile.github,
    filledControls,
  );
  count += fillBySelectorList(
    ["#website", "#portfolio", "input[name*='portfolio']"],
    profile.portfolio,
    filledControls,
  );
  return count;
}

function runLeverAdapter(profile, filledControls) {
  let count = 0;
  count += fillBySelectorList(["input[name='name']", "input[data-qa='name']"], profile.fullName, filledControls);
  count += fillBySelectorList(["input[name='email']", "input[data-qa='email']"], profile.email, filledControls);
  count += fillBySelectorList(["input[name='phone']", "input[data-qa='phone']"], profile.phone, filledControls);
  count += fillBySelectorList(["input[name='location']", "input[data-qa='location']"], profile.location, filledControls);
  count += fillBySelectorList(["input[name='urls[LinkedIn]']", "input[name*='linkedin']"], profile.linkedin, filledControls);
  count += fillBySelectorList(["input[name='urls[GitHub]']", "input[name*='github']"], profile.github, filledControls);
  count += fillBySelectorList(["input[name='urls[Portfolio]']", "input[name*='portfolio']"], profile.portfolio, filledControls);
  return count;
}

function runSuccessFactorsAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  count += fillBySelectorList(["input[name*='firstName']", "input[id*='firstName']"], firstName, filledControls);
  count += fillBySelectorList(["input[name*='lastName']", "input[id*='lastName']"], lastName, filledControls);
  count += fillBySelectorList(["input[name*='email']", "input[type='email']"], profile.email, filledControls);
  count += fillBySelectorList(["input[name*='phone']", "input[type='tel']"], profile.phone, filledControls);
  count += fillBySelectorList(["input[name*='city']", "input[name*='location']"], profile.location, filledControls);
  count += fillBySelectorList(["input[name*='linkedin']"], profile.linkedin, filledControls);
  count += fillBySelectorList(["input[name*='portfolio']", "input[name*='website']"], profile.portfolio, filledControls);
  return count;
}

function runIcimsAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  count += fillBySelectorList(["#firstName", "input[name='firstName']", "input[name*='first']"], firstName, filledControls);
  count += fillBySelectorList(["#lastName", "input[name='lastName']", "input[name*='last']"], lastName, filledControls);
  count += fillBySelectorList(["#email", "input[name='email']", "input[type='email']"], profile.email, filledControls);
  count += fillBySelectorList(["#phone", "input[name='phone']", "input[type='tel']"], profile.phone, filledControls);
  count += fillBySelectorList(["#city", "input[name='city']", "input[name*='location']"], profile.location, filledControls);
  count += fillBySelectorList(["input[name*='linkedin']"], profile.linkedin, filledControls);
  count += fillBySelectorList(["input[name*='website']", "input[name*='portfolio']"], profile.portfolio, filledControls);
  count += fillBySelectorList(["input[name*='visa']", "input[name*='authorization']"], profile.visaStatus, filledControls);
  return count;
}

function runTaleoAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  count += fillBySelectorList(["input[name*='firstName']", "input[id*='firstName']"], firstName, filledControls);
  count += fillBySelectorList(["input[name*='lastName']", "input[id*='lastName']"], lastName, filledControls);
  count += fillBySelectorList(["input[name*='email']", "input[type='email']"], profile.email, filledControls);
  count += fillBySelectorList(["input[name*='phone']", "input[type='tel']"], profile.phone, filledControls);
  count += fillBySelectorList(["input[name*='city']", "input[name*='address']", "input[name*='location']"], profile.location, filledControls);
  count += fillBySelectorList(["input[name*='linkedin']"], profile.linkedin, filledControls);
  count += fillBySelectorList(["input[name*='website']", "input[name*='portfolio']"], profile.portfolio, filledControls);
  count += fillBySelectorList(["input[name*='visa']", "input[name*='workauth']", "input[name*='authorization']"], profile.visaStatus, filledControls);
  return count;
}

function runSmartRecruitersAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  count += fillBySelectorList(["input[name='firstName']", "input[name*='first']"], firstName, filledControls);
  count += fillBySelectorList(["input[name='lastName']", "input[name*='last']"], lastName, filledControls);
  count += fillBySelectorList(["input[name='email']", "input[type='email']"], profile.email, filledControls);
  count += fillBySelectorList(["input[name='phoneNumber']", "input[name*='phone']", "input[type='tel']"], profile.phone, filledControls);
  count += fillBySelectorList(["input[name='city']", "input[name*='location']"], profile.location, filledControls);
  count += fillBySelectorList(["input[name*='linkedin']"], profile.linkedin, filledControls);
  count += fillBySelectorList(["input[name*='website']", "input[name*='portfolio']"], profile.portfolio, filledControls);
  return count;
}

function runWorkableAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  count += fillBySelectorList(["input[name='firstname']", "input[name*='first']"], firstName, filledControls);
  count += fillBySelectorList(["input[name='lastname']", "input[name*='last']"], lastName, filledControls);
  count += fillBySelectorList(["input[name='name']"], profile.fullName, filledControls);
  count += fillBySelectorList(["input[name='email']", "input[type='email']"], profile.email, filledControls);
  count += fillBySelectorList(["input[name='phone']", "input[type='tel']"], profile.phone, filledControls);
  count += fillBySelectorList(["input[name='location']", "input[name*='city']"], profile.location, filledControls);
  count += fillBySelectorList(["input[name*='linkedin']"], profile.linkedin, filledControls);
  count += fillBySelectorList(["input[name*='website']", "input[name*='portfolio']"], profile.portfolio, filledControls);
  return count;
}

function runGovPortalAdapter(profile, filledControls) {
  const { firstName, lastName } = splitFullName(profile.fullName);
  let count = 0;
  count += fillBySelectorList(
    ["input[name*='first']", "input[id*='first']", "input[aria-label*='First']"],
    firstName,
    filledControls,
  );
  count += fillBySelectorList(
    ["input[name*='last']", "input[id*='last']", "input[aria-label*='Last']"],
    lastName,
    filledControls,
  );
  count += fillBySelectorList(["input[name*='email']", "input[type='email']"], profile.email, filledControls);
  count += fillBySelectorList(["input[name*='phone']", "input[type='tel']"], profile.phone, filledControls);
  count += fillBySelectorList(["input[name*='address']", "input[name*='city']", "input[name*='location']"], profile.location, filledControls);
  count += fillBySelectorList(["input[name*='linkedin']"], profile.linkedin, filledControls);
  count += fillBySelectorList(["input[name*='website']", "input[name*='portfolio']"], profile.portfolio, filledControls);
  count += fillBySelectorList(["input[name*='visa']", "input[name*='workauth']", "input[name*='authorization']"], profile.visaStatus, filledControls);
  return count;
}

function runAtsAdapter(adapter, profile, filledControls) {
  if (adapter === "amazon") return runAmazonAdapter(profile, filledControls);
  if (adapter === "meta") return runMetaAdapter(profile, filledControls);
  if (adapter === "rio_tinto") return runRioTintoAdapter(profile, filledControls);
  if (adapter === "workday") return runWorkdayAdapter(profile, filledControls);
  if (adapter === "greenhouse") return runGreenhouseAdapter(profile, filledControls);
  if (adapter === "lever") return runLeverAdapter(profile, filledControls);
  if (adapter === "icims") return runIcimsAdapter(profile, filledControls);
  if (adapter === "taleo") return runTaleoAdapter(profile, filledControls);
  if (adapter === "smartrecruiters") return runSmartRecruitersAdapter(profile, filledControls);
  if (adapter === "workable") return runWorkableAdapter(profile, filledControls);
  if (adapter === "gov_portal") return runGovPortalAdapter(profile, filledControls);
  if (adapter === "successfactors") return runSuccessFactorsAdapter(profile, filledControls);
  return 0;
}

function runAutofill(payload) {
  const profile = payload?.profile ?? {};
  const answerBank = payload?.answers ?? [];
  const adapter = detectAtsProvider();
  const filledControls = new WeakSet();

  let filled = 0;
  const adapterFilled = runAtsAdapter(adapter, profile, filledControls);
  filled += adapterFilled;

  FIELD_RULES.forEach((rule) => {
    const value = trimString(profile?.[rule.key] ?? "");
    if (!value) return;

    const candidates = findCandidateControls(rule.patterns);
    candidates.forEach((control) => {
      if (fillControl(control, value, filledControls)) {
        filled += 1;
      }
    });
  });

  const answerCount = fillAnswerBank(answerBank, filledControls);
  filled += answerCount;

  return {
    ok: true,
    adapter,
    filled,
    adapterFilled,
    answerCount,
    timestamp: new Date().toISOString(),
  };
}

setupApplyFlowBridge();

/**
 * Detect file input fields in the form
 */
function detectFileInputs() {
  const fileInputs = [];
  const inputs = document.querySelectorAll('input[type="file"]');

  inputs.forEach((input) => {
    if (!isVisible(input)) return;

    const hints = collectHints(input);
    const label = getLabelTextForControl(input);
    const fullLabel = `${hints} ${label}`.toLowerCase();

    let documentType = "document";
    if (fullLabel.includes("resume") || fullLabel.includes("cv")) documentType = "resume";
    else if (fullLabel.includes("cover")) documentType = "cover_letter";
    else if (fullLabel.includes("transcript")) documentType = "transcript";
    else if (fullLabel.includes("portfolio")) documentType = "portfolio";
    else if (fullLabel.includes("certificate")) documentType = "certificate";

    fileInputs.push({
      type: documentType,
      documentType,
      fieldName: input.name || input.id || "unknown",
      selector: input.name ? `input[name="${input.name}"]` : `input[id="${input.id}"]`,
      label: fullLabel || documentType,
      element: input,
    });
  });

  return fileInputs;
}

/**
 * Detect CAPTCHA challenges
 */
function detectChallenges() {
  const challenges = {
    captcha: false,
    mfa: false,
    reCaptcha: false,
    hCaptcha: false,
    phone: false,
    email: false,
  };

  const hasRecaptchaResponse = Boolean(
    trimString(
      document.querySelector('textarea[name="g-recaptcha-response"], input[name="g-recaptcha-response"]')?.value,
    ),
  );
  const hasHcaptchaResponse = Boolean(
    trimString(
      document.querySelector(
        'textarea[name="h-captcha-response"], input[name="h-captcha-response"], textarea[name="hcaptcha-response"], input[name="hcaptcha-response"]',
      )?.value,
    ),
  );
  const hasCheckedCaptchaBox = Boolean(
    document.querySelector(
      '.recaptcha-checkbox[aria-checked="true"], [role="checkbox"][aria-checked="true"][id*="captcha" i], [role="checkbox"][aria-checked="true"][class*="captcha" i]',
    ),
  );

  // Look for common CAPTCHA indicators
  const recaptchaPresent = Boolean(document.querySelector('[data-sitekey], #g-recaptcha, iframe[src*="recaptcha" i]'));
  const hcaptchaPresent = Boolean(document.querySelector('.h-captcha, iframe[src*="hcaptcha" i]'));
  const genericCaptchaPresent = Boolean(
    document.querySelector('iframe[src*="captcha" i], iframe[title*="captcha" i], [data-captcha], [data-testid*="captcha" i]'),
  );

  challenges.reCaptcha = recaptchaPresent && !hasRecaptchaResponse && !hasCheckedCaptchaBox;
  challenges.hCaptcha = hcaptchaPresent && !hasHcaptchaResponse;
  challenges.captcha = genericCaptchaPresent && !hasRecaptchaResponse && !hasHcaptchaResponse && !hasCheckedCaptchaBox;

  // Look for MFA/2FA indicators
  if (document.querySelector('input[name*="code"]') && document.title.toLowerCase().includes("verify")) {
    challenges.mfa = true;
  }
  if (document.querySelector('input[name*="otp"]') || document.querySelector('input[placeholder*="code"]')) {
    challenges.mfa = true;
  }

  // Look for phone/email verification
  if (document.querySelector('input[type="tel"]') && document.body.textContent.includes("phone")) {
    challenges.phone = true;
  }
  if (document.querySelector('input[type="email"]') && document.body.textContent.includes("verify")) {
    challenges.email = true;
  }

  return challenges;
}

function detectLoginWall() {
  const host = window.location.hostname.toLowerCase();
  const pageText = (document.body?.innerText || "").toLowerCase();
  const hasPasswordField = Boolean(document.querySelector('input[type="password"]'));
  const hasEmailField = Boolean(
    document.querySelector('input[type="email"], input[name*="email"], input[autocomplete="username"]'),
  );
  const authHost =
    host.includes("okta") ||
    host.includes("auth0") ||
    host.includes("login.microsoftonline.com") ||
    host.includes("accounts.google.com") ||
    host.includes("sso");
  const loginText =
    pageText.includes("sign in") ||
    pageText.includes("log in") ||
    pageText.includes("login") ||
    pageText.includes("continue with email") ||
    pageText.includes("enter your password");

  return authHost || (hasPasswordField && (hasEmailField || loginText));
}

function detectAntiBotWall() {
  const pageText = (document.body?.innerText || "").toLowerCase();
  return (
    pageText.includes("verify you are human") ||
    pageText.includes("unusual traffic") ||
    pageText.includes("access denied") ||
    pageText.includes("security check") ||
    pageText.includes("bot detection") ||
    pageText.includes("press and hold") ||
    pageText.includes("complete the security check")
  );
}

function detectBlockingState() {
  const challenges = detectChallenges();
  const loginWall = detectLoginWall();
  const antiBot = detectAntiBotWall();

  if (challenges.reCaptcha || challenges.hCaptcha || challenges.captcha) {
    return {
      blocked: true,
      blocker: "captcha",
      taskType: "captcha",
      message: "CAPTCHA detected. Complete it and ApplyFlow will resume autofill automatically.",
      challenges,
    };
  }

  if (loginWall) {
    return {
      blocked: true,
      blocker: "login_wall",
      taskType: "mfa",
      message: "Login wall detected. Sign in to the employer site and ApplyFlow will resume autofill automatically.",
      challenges,
    };
  }

  if (challenges.mfa) {
    return {
      blocked: true,
      blocker: "mfa",
      taskType: "mfa",
      message: "Verification step detected. Complete MFA and ApplyFlow will resume autofill automatically.",
      challenges,
    };
  }

  if (challenges.phone) {
    return {
      blocked: true,
      blocker: "phone_verification",
      taskType: "phone_verification",
      message: "Phone verification is blocking the form. Complete it and autofill will continue automatically.",
      challenges,
    };
  }

  if (challenges.email) {
    return {
      blocked: true,
      blocker: "email_verification",
      taskType: "email_verification",
      message: "Email verification is blocking the form. Complete it and autofill will continue automatically.",
      challenges,
    };
  }

  if (antiBot) {
    return {
      blocked: true,
      blocker: "anti_bot",
      taskType: "form_review",
      message: "Anti-bot checks detected. Clear them manually and ApplyFlow will resume autofill automatically.",
      challenges,
    };
  }

  return {
    blocked: false,
    blocker: null,
    taskType: null,
    message: "",
    challenges,
  };
}

/**
 * Enhanced autofill with file upload detection and challenge detection
 */
function runAutoFillEnhanced(payload) {
  const { profile } = payload;

  if (!profile) {
    return {
      ok: false,
      error: "No profile provided",
    };
  }

  const adapter = detectAtsProvider();

  // Detect challenges before attempting to fill
  const challenges = detectChallenges();
  const fileInputs = detectFileInputs();

  // If major challenges detected, don't proceed with filling
  if (challenges.captcha || challenges.reCaptcha || challenges.hCaptcha) {
    return {
      ok: false,
      adapter,
      challenges: challenges,
      error: "captcha_detected",
      message: "CAPTCHA challenge detected - manual review required",
      formsFilled: { basicInfo: 0, answers: 0 },
      filesToUpload: fileInputs,
      captchaDetected: true,
      mfaDetected: challenges.mfa,
      timestamp: new Date().toISOString(),
    };
  }

  // Run standard autofill
  const filledControls = new Set();
  const basicInfoFilled = runAtsAdapter(adapter, profile, filledControls);

  // Count answer fields filled
  let answerCount = 0;
  const textareas = document.querySelectorAll("textarea");
  for (const ta of textareas) {
    if (filledControls.has(ta)) answerCount++;
  }

  return {
    ok: true,
    adapter,
    challenges,
    formsFilled: {
      basicInfo: basicInfoFilled,
      answers: answerCount,
    },
    filesToUpload: fileInputs,
    fileUploadRequired: fileInputs.length > 0,
    captchaDetected: false,
    mfaDetected: challenges.mfa,
    timestamp: new Date().toISOString(),
  };
}

function startHeldAutofillSession(payload, blockState) {
  heldAutofillSession = {
    payload,
    blockState,
    startedAt: new Date().toISOString(),
  };

  showAssistBanner(blockState.message, "paused");
  notifyBackground({
    type: "SET_ACTIVE_SESSION",
    payload: {
      holdActive: true,
      blocker: blockState.blocker,
      taskType: blockState.taskType,
      message: blockState.message,
    },
  });

  if (heldAutofillObserver) {
    heldAutofillObserver.disconnect();
  }
  if (heldAutofillTimer) {
    window.clearInterval(heldAutofillTimer);
  }

  const maybeResume = () => {
    if (!heldAutofillSession) return;
    const currentBlockState = detectBlockingState();
    if (currentBlockState.blocked) {
      if (currentBlockState.message !== heldAutofillSession.blockState.message) {
        heldAutofillSession.blockState = currentBlockState;
        showAssistBanner(currentBlockState.message, "paused");
        notifyBackground({
          type: "SET_ACTIVE_SESSION",
          payload: {
            holdActive: true,
            blocker: currentBlockState.blocker,
            taskType: currentBlockState.taskType,
            message: currentBlockState.message,
          },
        });
      }
      return;
    }

    const result = runAutoFillEnhanced(heldAutofillSession.payload);

    if (result.ok) {
      clearHeldAutofillSession();
      const totalFilled = (result.formsFilled?.basicInfo ?? 0) + (result.formsFilled?.answers ?? 0);
      const followUp =
        result.fileUploadRequired
          ? ` Autofill resumed. ${totalFilled} fields filled. Upload the required files, then review and submit.`
          : ` Autofill resumed. ${totalFilled} fields filled. Review the form and submit when ready.`;
      showAssistBanner(followUp.trim(), "success");
      clearAssistBanner(9000);
      return;
    }

    if (result.captchaDetected || result.mfaDetected) {
      startHeldAutofillSession(heldAutofillSession.payload, detectBlockingState());
      return;
    }

    clearHeldAutofillSession();
    showAssistBanner("ApplyFlow resumed but could not finish autofill. Please review the page manually.", "error");
  };

  heldAutofillObserver = new MutationObserver(() => {
    maybeResume();
  });
  heldAutofillObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  heldAutofillTimer = window.setInterval(maybeResume, 1500);
}

/**
 * Auto-apply flow: Check if we should auto-apply, then autofill and potentially submit
 */
function runAutoApplyFlow(payload) {
  const { autoApplyConfig = {}, autoSubmit = false } = payload;

  // Step 1: Detect form structure and challenges
  const blockingState = detectBlockingState();
  const challenges = blockingState.challenges;
  const fileInputs = detectFileInputs();

  if (blockingState.blocked) {
    startHeldAutofillSession(payload, blockingState);
    return {
      success: false,
      status: "manual_action_needed",
      holdActive: true,
      blocker: blockingState.blocker,
      reason: blockingState.message,
      taskType: blockingState.taskType,
      requiresManualAction: true,
      message: blockingState.message,
    };
  }

  // Step 2: If file upload required and we don't auto-attach, mark task
  // Step 3: Proceed with standard autofill (if profile provided in payload)
  if (payload.profile) {
    const autofillResult = runAutoFillEnhanced(payload);

    if (!autofillResult.ok) {
      if (autofillResult.captchaDetected || autofillResult.mfaDetected) {
        startHeldAutofillSession(payload, detectBlockingState());
      }
      return {
        success: false,
        status: "manual_action_needed",
        holdActive: Boolean(autofillResult.captchaDetected || autofillResult.mfaDetected),
        reason: autofillResult.message || "Autofill failed",
        blocker: autofillResult.captchaDetected ? "captcha" : autofillResult.mfaDetected ? "mfa" : "form_review",
        taskType: autofillResult.captchaDetected ? "captcha" : autofillResult.mfaDetected ? "mfa" : "form_review",
        requiresManualAction: true,
      };
    }

    clearHeldAutofillSession();

    if (fileInputs.length > 0 && !autoApplyConfig.attachResume) {
      return {
        success: false,
        status: "manual_action_needed",
        holdActive: false,
        reason: "File upload required",
        taskType: "file_upload",
        requiresManualAction: true,
        filesToUpload: fileInputs,
        message:
          "Required files still need to be uploaded: " +
          fileInputs.map((file) => file.documentType || file.type).join(", "),
      };
    }
  }

  // Step 4: If auto-submit enabled and no challenges, submit form
  if (autoSubmit && !challenges.captcha && !challenges.mfa) {
    const submitButton = findSubmitButton();

    if (submitButton && isVisible(submitButton)) {
      try {
        submitButton.click();
        clearHeldAutofillSession();
        showAssistBanner("ApplyFlow submitted the form automatically.", "success");
        clearAssistBanner(7000);
        return {
          success: true,
          status: "submitted",
          holdActive: false,
          message: "Form auto-submitted successfully",
        };
      } catch {
        return {
          success: false,
          status: "manual_action_needed",
          holdActive: false,
          reason: "Could not auto-submit form",
          taskType: "form_review",
          message: "Please review and submit the form manually",
        };
      }
    }
  }

  // Default: Form filled, awaiting manual submission
  return {
    success: true,
    status: "pending_manual_action",
    holdActive: false,
    formFilled: true,
    message:
      fileInputs.length > 0
        ? "Form pre-filled. Upload the required files, then review and submit."
        : "Form pre-filled. Please review and submit.",
    filesToUpload: fileInputs,
  };
}

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message?.type === "AUTOFILL_FORM") {
      const result = runAutofill(message.payload);
      sendResponse(result);
      return;
    }

    if (message?.type === "AUTOFILL_ENHANCED") {
      const result = runAutoFillEnhanced(message.payload);
      sendResponse(result);
      return;
    }

    if (message?.type === "AUTO_APPLY_FLOW") {
      const result = runAutoApplyFlow(message.payload);
      sendResponse(result);
      return;
    }

    if (message?.type === "AUTO_APPLY_FLOW_RESUME") {
      const result = runAutoApplyFlow(message.payload);
      sendResponse(result);
      return;
    }

    if (message?.type === "DETECT_CHALLENGES") {
      const challenges = detectChallenges();
      const fileInputs = detectFileInputs();
      sendResponse({
        ok: true,
        challenges,
        fileInputs,
      });
      return;
    }
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "extension_error",
    });
  }
  return true;
});
