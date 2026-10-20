// The Standard Webhooks wire format (ADR-0001). This module is the only place
// the header names, the signed content and the signature encoding are defined;
// the Sender and the Receiver both go through it.
import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_ID_HEADER = "webhook-id";
export const WEBHOOK_TIMESTAMP_HEADER = "webhook-timestamp";
export const WEBHOOK_SIGNATURE_HEADER = "webhook-signature";

const SECRET_PREFIX = "whsec_";
const SIGNATURE_VERSION = "v1";

export interface SignedContent {
  id: string;
  /** Unix seconds, as carried in `webhook-timestamp`. */
  timestamp: number;
  body: string | Uint8Array;
}

/**
 * Parses `webhook-timestamp` (integer Unix seconds); undefined if malformed.
 * Leading zeros are rejected so the number signed is the header as sent.
 */
export function parseTimestamp(value: string): number | undefined {
  return /^(0|[1-9]\d*)$/.test(value) ? Number(value) : undefined;
}

/** A Signing secret decoded from its `whsec_<base64>` form into HMAC key bytes. */
export type SigningKey = Buffer & { readonly __brand: "SigningKey" };

/**
 * Decodes a Signing secret, `whsec_<base64>` or bare base64 as some Standard
 * Webhooks Senders issue it. Throws a TypeError if it isn't non-empty base64.
 */
export function decodeSecret(secret: string): SigningKey {
  const encoded = secret.startsWith(SECRET_PREFIX)
    ? secret.slice(SECRET_PREFIX.length)
    : secret;
  const key = Buffer.from(encoded, "base64");
  // Node's decoder skips characters it doesn't recognise, so a typo would
  // silently yield a different key; round-tripping catches that.
  const unpadded = (base64: string) => base64.replace(/=+$/, "");
  if (
    key.length === 0 ||
    unpadded(key.toString("base64")) !== unpadded(encoded)
  ) {
    throw new TypeError(
      "Signing secrets must be base64, optionally prefixed with whsec_"
    );
  }
  return key as SigningKey;
}

/**
 * True when any `v1` signature in a `webhook-signature` header matches any of
 * the keys. Entries with other versions are ignored. Comparison is constant
 * time per candidate.
 */
export function signatureMatches(
  header: string,
  keys: readonly SigningKey[],
  content: SignedContent
): boolean {
  const candidates = parseSignatureHeader(header);
  return keys.some((key) => {
    const expected = hmac(key, content);
    return candidates.some(
      (candidate) =>
        candidate.length === expected.length &&
        timingSafeEqual(candidate, expected)
    );
  });
}

function parseSignatureHeader(header: string): Buffer[] {
  return header
    .split(" ")
    .map((entry) => entry.split(","))
    .filter(([version, value]) => version === SIGNATURE_VERSION && value)
    .map(([, value]) => Buffer.from(value!, "base64"));
}

function hmac(key: SigningKey, content: SignedContent): Buffer {
  return createHmac("sha256", key)
    .update(`${content.id}.${content.timestamp}.`)
    .update(content.body)
    .digest();
}
