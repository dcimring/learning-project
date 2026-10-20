/** Base class for every reason `verify` rejects a webhook. */
export class WebhookVerificationError extends Error {
  override name = "WebhookVerificationError";
}

/** No signature in the header matches any of the Signing secrets. */
export class InvalidSignatureError extends WebhookVerificationError {
  override name = "InvalidSignatureError";
}

/** `webhook-timestamp` is further from the Receiver's clock than the tolerance allows. */
export class StaleTimestampError extends WebhookVerificationError {
  override name = "StaleTimestampError";
}

/** A `webhook-*` header is missing or not in the Standard Webhooks format. */
export class MalformedHeadersError extends WebhookVerificationError {
  override name = "MalformedHeadersError";
}

/** The body is correctly signed but isn't JSON. */
export class MalformedPayloadError extends WebhookVerificationError {
  override name = "MalformedPayloadError";
}
