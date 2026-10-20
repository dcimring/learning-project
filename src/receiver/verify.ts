import {
  InvalidSignatureError,
  MalformedHeadersError,
  MalformedPayloadError,
  StaleTimestampError,
} from "./errors.js";
import {
  decodeSecret,
  parseTimestamp,
  signatureMatches,
  WEBHOOK_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "../shared/signing.js";
import { systemClock, type Clock } from "../shared/clock.js";
import type { Event } from "../shared/event.js";

/** How far `webhook-timestamp` may be from the Receiver's clock, either way. */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Request headers: a Web-standard `Headers`, or a plain object such as Node's
 * `IncomingHttpHeaders`. Names are matched case-insensitively.
 */
export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>;

export interface VerifyInput {
  headers: WebhookHeaders;
  rawBody: string | Uint8Array;
  secrets: readonly string[];
  clock?: Clock;
}

/**
 * Verifies an incoming webhook and returns its Event. The body must be the raw,
 * unparsed bytes as received. The envelope's shape is typed but not checked:
 * a matching signature already proves it came from a trusted Sender.
 */
export function verify<TData = unknown>(input: VerifyInput): Event<TData> {
  if (input.secrets.length === 0) throw new TypeError("verify needs at least one Signing secret");
  const keys = input.secrets.map(decodeSecret);

  const id = requireHeader(input.headers, WEBHOOK_ID_HEADER);
  const timestamp = parseTimestamp(requireHeader(input.headers, WEBHOOK_TIMESTAMP_HEADER));
  if (timestamp === undefined) {
    throw new MalformedHeadersError(`${WEBHOOK_TIMESTAMP_HEADER} is not an integer of seconds`);
  }
  const signatureHeader = requireHeader(input.headers, WEBHOOK_SIGNATURE_HEADER);

  const nowSeconds = Math.floor((input.clock ?? systemClock).now().getTime() / 1000);
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) {
    throw new StaleTimestampError(
      `${WEBHOOK_TIMESTAMP_HEADER} is more than ${TOLERANCE_SECONDS}s from the current time`,
    );
  }
  if (!signatureMatches(signatureHeader, keys, { id, timestamp, body: input.rawBody })) {
    throw new InvalidSignatureError("No signature matches any Signing secret");
  }
  try {
    return JSON.parse(Buffer.from(input.rawBody).toString("utf8")) as Event<TData>;
  } catch {
    throw new MalformedPayloadError("Body is not JSON");
  }
}

function requireHeader(headers: WebhookHeaders, name: string): string {
  const value = headers instanceof Headers ? headers.get(name) : lookup(headers, name);
  if (value === null || value === undefined) {
    throw new MalformedHeadersError(`Missing ${name} header`);
  }
  if (Array.isArray(value)) throw new MalformedHeadersError(`Repeated ${name} header`);
  return value;
}

function lookup(headers: Record<string, string | string[] | undefined>, name: string) {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) return value;
  }
  return undefined;
}
