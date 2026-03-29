const WEB_BRIDGE_SOURCE = "applyflow-web";
const EXTENSION_BRIDGE_SOURCE = "applyflow-extension";

type BridgePayload = Record<string, unknown> | null | undefined;

type PingResult = {
  ok: boolean;
  installed?: boolean;
  version?: string;
  error?: string | null;
};

type SetContextResult = {
  ok: boolean;
  error?: string | null;
};

function ensureBrowser() {
  if (typeof window === "undefined") {
    throw new Error("extension_bridge_unavailable");
  }
}

function bridgeRequest<T>(
  type: string,
  payload?: BridgePayload,
  timeoutMs = 1200,
): Promise<T> {
  ensureBrowser();

  return new Promise((resolve, reject) => {
    const requestId = `${type}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const resultType = `${type}_RESULT`;
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
    };

    const fail = (error: string) => {
      cleanup();
      reject(new Error(error));
    };

    const succeed = (value: T) => {
      cleanup();
      resolve(value);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (!data || data.source !== EXTENSION_BRIDGE_SOURCE) return;
      if (data.requestId !== requestId || data.type !== resultType) return;

      succeed(data.payload as T);
    };

    const timeoutId = window.setTimeout(() => {
      fail("extension_not_detected");
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    window.postMessage(
      {
        source: WEB_BRIDGE_SOURCE,
        requestId,
        type,
        payload,
      },
      window.location.origin,
    );
  });
}

export async function pingApplyFlowExtension() {
  return bridgeRequest<PingResult>("APPLYFLOW_EXTENSION_PING");
}

export async function setApplyFlowExtensionContext(payload: Record<string, unknown>) {
  return bridgeRequest<SetContextResult>("APPLYFLOW_EXTENSION_SET_CONTEXT", payload, 1600);
}

