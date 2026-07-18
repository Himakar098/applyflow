import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function resolveKey() {
  const configured = process.env.ENCRYPTION_KEY?.trim();
  if (!configured) return null;

  if (/^[a-fA-F0-9]{64}$/.test(configured)) {
    return Buffer.from(configured, "hex");
  }

  const decoded = Buffer.from(configured, "base64");
  if (decoded.length === 32 && decoded.toString("base64").replace(/=+$/, "") === configured.replace(/=+$/, "")) {
    return decoded;
  }

  throw new Error("ENCRYPTION_KEY must be a random 32-byte base64 value or 64-character hex value");
}

export function isEncryptionConfigured() {
  return resolveKey() !== null;
}

export function encryptJson(value: unknown) {
  const key = resolveKey();
  if (!key) {
    throw new Error("ENCRYPTION_KEY is required before storing private candidate details");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptJson<T>(payload: string): T {
  const key = resolveKey();
  if (!key) {
    throw new Error("ENCRYPTION_KEY is required before reading private candidate details");
  }

  const [version, ivValue, tagValue, ciphertextValue] = payload.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Encrypted candidate data has an invalid format");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as T;
}
