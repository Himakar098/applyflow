import { describe, expect, it } from "vitest";

import { parseJobCsv } from "@/lib/job-import/csv";
import { isPublicIpAddress } from "@/lib/security/job-agent-request";
import { isCredentialFreeHttpUrl } from "@/lib/security/url-policy";

describe("job import address policy", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.2.1",
    "192.168.1.10",
    "198.18.0.1",
    "198.51.100.3",
    "203.0.113.8",
    "224.0.0.1",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::7f00:1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2002:7f00:1::",
    "ff02::1",
  ])("rejects non-public or address-translation target %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each([
    "1.1.1.1",
    "8.8.8.8",
    "142.250.70.14",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
  ])("allows ordinary global unicast target %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });

  it("accepts only credential-free HTTP(S) URLs across CSV imports", () => {
    expect(isCredentialFreeHttpUrl("https://jobs.example.com/apply?ref=123")).toBe(true);
    expect(isCredentialFreeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isCredentialFreeHttpUrl("https://user:password@jobs.example.com/apply")).toBe(false);
    expect(() => parseJobCsv([
      "company,title,description,applicationUrl",
      "Example,Analyst,This description is intentionally long enough for import validation,https://user:password@jobs.example.com/apply",
    ].join("\n"))).toThrow("credential-free");
  });
});
