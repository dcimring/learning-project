# 01: Package scaffold + Receiver `verify`

**What to build:** A subscriber can verify an incoming webhook. Set up the TypeScript package (Node 22) with `sender` and `receiver` subpath entry points and a test runner, plus a shared Standard Webhooks signing module (ADR-0001) used by both halves. Expose `verify({ headers, rawBody, secrets, clock? })` from the Receiver, which returns the parsed Event or throws a typed error.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Package builds and exposes `sender` and `receiver` entry points; the test runner runs through the public entry points
- [x] The shared signing module is the only place the wire format is encoded (`webhook-id`, `webhook-timestamp`, `webhook-signature`; HMAC-SHA256 over `id.timestamp.body` with the decoded `whsec_` secret; `v1,<base64>` entries)
- [x] The Standard Webhooks published test vectors pass
- [x] `verify` accepts a list of Signing secrets and passes if any signature in the header matches any secret
- [x] Signatures are compared in constant time
- [x] A timestamp more than 5 minutes from the injected clock is rejected with a stale-timestamp error
- [x] Distinct typed errors for an invalid signature, a stale timestamp, and malformed or missing headers
- [x] `verify` returns the parsed Event envelope (`{ type, timestamp, data }`)
