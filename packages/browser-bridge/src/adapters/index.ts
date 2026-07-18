import type { BrowserPage } from "../runtime-types";
import { genericPortalAdapter } from "./generic";
import { greenhousePortalAdapter } from "./greenhouse";
import { leverPortalAdapter } from "./lever";
import { stubPortalAdapters } from "./stubs";
import type { PortalAdapter } from "./types";

export * from "./types";
export * from "./generic";
export * from "./greenhouse";
export * from "./lever";
export * from "./stubs";

export const portalAdapters: PortalAdapter[] = [
  greenhousePortalAdapter,
  leverPortalAdapter,
  ...stubPortalAdapters,
  genericPortalAdapter,
];

export async function resolvePortalAdapter(
  page: BrowserPage,
  adapters: PortalAdapter[] = portalAdapters,
): Promise<PortalAdapter> {
  for (const adapter of adapters) {
    if (await adapter.matches(page)) return adapter;
  }
  return genericPortalAdapter;
}
