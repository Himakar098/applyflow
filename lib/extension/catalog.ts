import { AppWindowMac, Globe, Monitor, type LucideIcon } from "lucide-react";

export const chromiumZip = "/downloads/applyflow-autofill-chromium.zip";
export const safariZip = "/downloads/applyflow-autofill-safari-project.zip";
export const chromeStoreUrl = process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL || "";
export const edgeStoreUrl = process.env.NEXT_PUBLIC_EDGE_EXTENSION_URL || "";
export const safariStoreUrl = process.env.NEXT_PUBLIC_SAFARI_EXTENSION_URL || "";

export const supportedExtensionSites = [
  "Amazon Careers",
  "Meta Careers",
  "Rio Tinto Careers",
  "Workday",
  "Greenhouse",
  "Lever",
  "iCIMS",
  "Taleo",
  "SmartRecruiters",
  "Workable",
  "Government portals",
  "SuccessFactors",
  "Generic fallback",
] as const;

export type BrowserCard = {
  id: "chrome" | "edge" | "safari";
  title: string;
  subtitle: string;
  icon: LucideIcon;
  badge: string;
  description: string;
  installHref?: string;
  installLabel: string;
  downloadHref?: string;
  downloadLabel?: string;
  installMode: "store" | "manual" | "coming_soon";
  steps: string[];
};

export const browserCards: BrowserCard[] = [
  chromeStoreUrl
    ? {
        id: "chrome",
        title: "Chrome",
        subtitle: "Chrome Web Store",
        icon: Monitor,
        badge: "One-click install",
        description: "Install directly from Chrome Web Store and start using Apply Assistant immediately.",
        installHref: chromeStoreUrl,
        installLabel: "Install from Chrome Web Store",
        downloadHref: chromiumZip,
        downloadLabel: "Manual package",
        installMode: "store",
        steps: [
          "Open the Chrome Web Store listing.",
          "Click Add to Chrome.",
          "Pin the extension, then in ApplyFlow open Apply Assistant and click Sync to extension.",
          "Open the employer page and click Start assisted autofill in the extension popup.",
        ],
      }
    : {
        id: "chrome",
        title: "Chrome",
        subtitle: "Manual beta install",
        icon: Monitor,
        badge: "Publishing in progress",
        description:
          "Use the manual beta package for now. We will switch this button to Chrome Web Store once approved.",
        installLabel: "Install package",
        downloadHref: chromiumZip,
        installMode: "manual",
        steps: [
          "Download the Chromium beta package.",
          "Unzip it on your machine.",
          "Open chrome://extensions and enable Developer mode.",
          "Click Load unpacked and choose the extracted folder.",
          "In ApplyFlow, open Apply Assistant, sync the job context, then start assisted autofill on the employer page.",
        ],
      },
  edgeStoreUrl
    ? {
        id: "edge",
        title: "Edge",
        subtitle: "Edge Add-ons",
        icon: Globe,
        badge: "One-click install",
        description: "Install directly from Microsoft Edge Add-ons with one click.",
        installHref: edgeStoreUrl,
        installLabel: "Install from Edge Add-ons",
        downloadHref: chromiumZip,
        downloadLabel: "Manual package",
        installMode: "store",
        steps: [
          "Open the Edge Add-ons listing.",
          "Click Get.",
          "Pin the extension, then in ApplyFlow open Apply Assistant and click Sync to extension.",
          "Open the employer page and click Start assisted autofill in the extension popup.",
        ],
      }
    : {
        id: "edge",
        title: "Edge",
        subtitle: "Manual beta install",
        icon: Globe,
        badge: "Publishing in progress",
        description:
          "Use the manual beta package for now. We will switch this button to Edge Add-ons once approved.",
        installLabel: "Install package",
        downloadHref: chromiumZip,
        installMode: "manual",
        steps: [
          "Download the Chromium beta package.",
          "Unzip it on your machine.",
          "Open edge://extensions and enable Developer mode.",
          "Click Load unpacked and choose the extracted folder.",
          "In ApplyFlow, open Apply Assistant, sync the job context, then start assisted autofill on the employer page.",
        ],
      },
  safariStoreUrl
    ? {
        id: "safari",
        title: "Safari",
        subtitle: "App Store",
        icon: AppWindowMac,
        badge: "One-click install",
        description: "Install from the App Store and enable the extension in Safari settings.",
        installHref: safariStoreUrl,
        installLabel: "Install from App Store",
        installMode: "store",
        steps: [
          "Open the App Store listing.",
          "Install the app and enable the extension in Safari settings.",
        ],
      }
    : {
        id: "safari",
        title: "Safari",
        subtitle: "Coming soon",
        icon: AppWindowMac,
        badge: "Store release pending",
        description:
          "Safari public distribution is in progress. Use Chrome or Edge for the smoothest setup right now.",
        installLabel: "Coming soon",
        installMode: "coming_soon",
        downloadHref: safariZip,
        downloadLabel: "Developer package",
        steps: [
          "Safari one-click install is coming soon.",
          "Use Chrome or Edge in the meantime for instant setup.",
        ],
      },
];
