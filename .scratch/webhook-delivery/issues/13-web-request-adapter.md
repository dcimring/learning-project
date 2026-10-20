# 13: Web `Request` adapter + Express docs

**What to build:** A subscriber on Next, Hono, Bun, or Workers integrates the Receiver kit in one call. The adapter takes a Web-standard `Request`, reads the raw body, verifies it, runs the subscriber's handler through `dedup.once`, and returns a `Response` with the right status.

**Blocked by:** 01 (Package scaffold + Receiver `verify`), 05 (Receiver `dedup.once` with in-memory seen-store)

**Status:** ready-for-agent

- [ ] A valid, new webhook runs the handler and returns 2xx
- [ ] A Duplicate of a processed webhook returns 200 without running the handler
- [ ] A concurrent Duplicate returns 409
- [ ] An invalid signature, stale timestamp, or malformed headers return a 4xx without running the handler
- [ ] A handler failure returns a 5xx and the webhook can be processed on retry
- [ ] Deduplication is scoped per Endpoint
- [ ] The docs warn that verification needs the raw, unparsed body and show how to capture it in Express
