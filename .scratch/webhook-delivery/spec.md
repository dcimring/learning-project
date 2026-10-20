# Spec: Webhook delivery engine

Status: ready-for-agent

## Problem Statement

A developer building an application needs to notify other systems when things happen (an invoice is paid, an order ships) by POSTing webhooks to URLs those systems registered. Doing this naively — an HTTP call inline with the business logic — loses Events when the app crashes, sends phantom Events for transactions that roll back, gives up on the first network blip, hammers slow subscribers, and gives the subscriber no way to prove a request is genuine or to tell a retry from a new Event.

On the other side, a developer receiving webhooks needs to verify that a request really came from the Sender, reject captured requests replayed later, and process each Event once even though the Sender will, by design, sometimes deliver it more than once — including concurrently, and including after their own handler crashed halfway.

## Solution

A lightweight TypeScript package with two halves that share one wire contract (Standard Webhooks, see ADR-0001):

- **Sender** — a library embedded in the host application plus a single worker process. The host registers Endpoints with Subscriptions to Event types and calls `send` to hand over an Event. The Sender durably records the Event and fans it out into one Delivery per subscribed Endpoint — inside the host's own SQLite transaction when the host shares the database (ADR-0003). The worker makes Attempts, signs each one, retries with jittered backoff over roughly a day and a half, marks exhausted Deliveries as Failed, and lets an operator Replay them.
- **Receiver kit** — a framework-agnostic `verify` over the raw request body plus a `dedup.once` guard that runs the subscriber's handler at most once per webhook id per Endpoint, safely under concurrency and handler failure, with a Web-standard `Request` adapter.

## User Stories

### Host developer — Endpoints and Subscriptions

1. As a host developer, I want to create an Endpoint with a URL and a set of Event types it subscribes to, so that subscribers receive only the Events they care about.
2. As a host developer, I want a Signing secret generated for me when I create an Endpoint, so that I never have to invent cryptographic material.
3. As a host developer, I want Signing secrets in the Standard Webhooks `whsec_` format, so that subscribers can use any Standard Webhooks library to verify them.
4. As a host developer, I want to update an Endpoint's URL and Subscriptions, so that subscribers can change what they receive without re-registering.
5. As a host developer, I want Subscription changes to affect only Events accepted afterwards, so that the set of Deliveries for an Event never changes after the fact.
6. As a host developer, I want Endpoint creation to reject non-HTTPS URLs except `localhost` and `127.0.0.1`, so that signed payloads never travel in cleartext in production while local development still works.
7. As a host developer, I want to rotate an Endpoint's Signing secret, so that I can respond to a leaked secret or a routine rotation policy.
8. As a host developer, I want the previous secret to keep being used alongside the new one during rotation, so that the subscriber can switch over without dropping webhooks.
9. As a host developer, I want to end a rotation and drop the previous secret, so that a compromised secret stops being valid.

### Host developer — sending Events

10. As a host developer, I want to call `send` with an Event type and data, so that I can emit an Event in one line from my business logic.
11. As a host developer, I want `send` to return the Event's id, so that I can log it and correlate it later.
12. As a host developer, I want `send` to write inside my open SQLite transaction when my app shares the database with the Sender, so that an Event exists if and only if my business change commits.
13. As a host developer, I want an Event sent inside a transaction that rolls back to disappear entirely, so that subscribers never hear about something that didn't happen.
14. As a host developer, I want the Sender to fall back to its own SQLite file when I don't pass a database, so that I can adopt it without restructuring my persistence.
15. As a host developer, I want `send` to reject payloads over 256 KB at the moment the Event is accepted, so that I find out immediately rather than via a stream of failed Attempts.
16. As a host developer, I want the payload serialised once when the Event is accepted, so that later mutation of my objects can't change what subscribers receive.
17. As a host developer, I want the payload wrapped in a `{ type, timestamp, data }` envelope, so that subscribers get a consistent shape across all Event types.
18. As a host developer, I want an Event with no subscribed Endpoints to be accepted without error, so that I can emit Events before anyone subscribes.
19. As a host developer, I want an Event delivered to the in-process worker without waiting for the next poll, so that latency is low in the common case.

### Delivery and retries

20. As a host developer, I want each Delivery to be attempted promptly after the Event is accepted, so that subscribers hear about Events in near real time.
21. As a host developer, I want any 2xx response to count as success, so that subscribers can respond with whatever 2xx code their framework produces.
22. As a host developer, I want non-2xx responses, timeouts, and network errors to be retried, so that transient subscriber outages don't lose Events.
23. As a host developer, I want 4xx responses retried too, so that a subscriber mid-deploy returning 404 still gets the Event.
24. As a host developer, I want 3xx responses treated as failures and redirects not followed, so that signed payloads are never silently sent to an unregistered URL.
25. As a host developer, I want each Attempt to time out after 15 seconds, so that a hung subscriber can't hold a worker slot indefinitely.
26. As a host developer, I want retries spaced by exponential backoff with full jitter (about 5s, 1m, 5m, 30m, 2h, 6h, 12h, 24h), so that a recovering subscriber isn't stampeded.
27. As a host developer, I want a `Retry-After` header on 429 or 503 responses honoured, so that the Sender cooperates with subscribers that signal back-pressure.
28. As a host developer, I want a Delivery marked Failed after its eighth unsuccessful Attempt, so that the system stops spending effort on a hopeless Delivery.
29. As a host developer, I want Failed Deliveries to stay Failed rather than resurrecting automatically, so that their state is predictable.
30. As a host developer, I want every Attempt freshly signed with the current timestamp, so that retries pass the subscriber's replay-window check.
31. As a host developer, I want every Attempt of an Event to carry the same `webhook-id` (the Event id), so that subscribers can recognise retries as Duplicates (ADR-0004).
32. As a host developer, I want each Endpoint limited to 4 in-flight Attempts, so that one slow subscriber can't monopolise the worker or get flooded.
33. As a host developer, I want one failing Endpoint not to delay Deliveries to healthy Endpoints, so that one bad subscriber doesn't degrade everyone.
34. As a subscriber, I want the docs to state plainly that Event order is not guaranteed, so that I don't build logic that relies on it.

### Worker operation and recovery

35. As an operator, I want to run the worker as a single long-lived process, so that deployment is simple.
36. As an operator, I want a second worker against the same database to refuse to start while the first is alive, so that I can't accidentally run two writers (ADR-0002).
37. As an operator, I want a second worker to be able to take over once the first's heartbeat goes stale, so that a crashed worker doesn't block delivery forever.
38. As an operator, I want Attempts left in flight by a crash recorded as Interrupted on startup, so that the history is honest about what is unknown.
39. As an operator, I want Interrupted Attempts to count as failed Attempts and their Deliveries rescheduled immediately, so that crashes delay Deliveries as little as possible.
40. As an operator, I want the worker to stop gracefully on shutdown, letting in-flight Attempts finish or time out, so that deploys don't produce needless Interrupted Attempts.
41. As an operator, I want the worker to poll for due Deliveries roughly every second, so that Events sent from other processes are still picked up promptly.

### Observability, Replay, and retention

42. As an operator, I want to list Deliveries filtered by Endpoint and status, so that I can see what's pending, succeeded, or Failed.
43. As an operator, I want to see each Delivery's Attempts with start time, duration, and outcome, so that I can diagnose why a subscriber is failing.
44. As an operator, I want the first 1 KB of each Attempt's response body recorded, so that I can read the subscriber's error message.
45. As an operator, I want no Signing secrets or request headers stored in Attempt records, so that the history is safe to inspect and export.
46. As an operator, I want to Replay a Failed Delivery, so that I can redeliver after the subscriber fixes their outage.
47. As an operator, I want a Replay to give the Delivery a fresh 8-Attempt budget under the same webhook id, so that a subscriber that did in fact process it recognises a Duplicate.
48. As an operator, I want Replay of a non-Failed Delivery rejected, so that I'm not misled into thinking a succeeded Delivery was resent.
49. As an operator, I want Events with their Deliveries and Attempts pruned 30 days after all their Deliveries finish, so that the database doesn't grow without bound.
50. As an operator, I want pending Deliveries never pruned, so that retention never drops work in progress.

### Subscriber — verification

51. As a subscriber, I want to verify a webhook from its headers, raw body, and my Signing secrets, so that I only act on genuine requests.
52. As a subscriber, I want verification to accept a list of secrets, so that I can follow the Sender through a secret rotation.
53. As a subscriber, I want verification to pass if any signature in the header matches any of my secrets, so that rotation works in both directions.
54. As a subscriber, I want signatures compared in constant time, so that an attacker can't recover a signature by timing.
55. As a subscriber, I want webhooks with a timestamp more than 5 minutes from my clock rejected, so that captured requests can't be replayed later.
56. As a subscriber, I want distinct typed errors for a bad signature, a stale timestamp, and malformed headers, so that I can log and respond appropriately.
57. As a subscriber, I want `verify` to return the parsed Event, so that I don't parse the body separately.
58. As a subscriber, I want the docs to warn that verification needs the raw, unparsed body and show how to capture it in Express, so that I don't hit the classic re-serialisation trap.
59. As a subscriber, I want an adapter that takes a Web-standard `Request`, so that integration in Next, Hono, Bun, or Workers is one call.
60. As a subscriber, I want to verify webhooks from any Standard Webhooks-compliant Sender, so that the Receiver kit isn't tied to this Sender.

### Subscriber — deduplication

61. As a subscriber, I want `dedup.once` to run my handler only for webhooks I haven't processed, so that retries don't double-charge, double-email, or double-ship.
62. As a subscriber, I want Duplicates of webhooks I've already processed answered with a 200 without running my handler, so that the Sender stops retrying.
63. As a subscriber, I want a concurrent Duplicate (arriving while the first is still processing) answered with a 409, so that the Sender retries later rather than both copies running.
64. As a subscriber, I want my handler's failure to release the claim, so that the Sender's retry can process the Event rather than it being lost as a "Duplicate".
65. As a subscriber, I want a claim whose lease expires (because my process died) to be claimable again, so that a crash doesn't lock an Event out forever.
66. As a subscriber, I want deduplication scoped per Endpoint, so that two Endpoints I configured never suppress each other's Deliveries.
67. As a subscriber, I want seen ids remembered for 7 days, so that retries over the Sender's whole schedule and Replays within a week are caught.
68. As a subscriber, I want an in-memory seen-store, so that I can get started or test without a database.
69. As a subscriber, I want a SQLite seen-store, so that deduplication survives restarts.
70. As a subscriber, I want importing the Receiver kit not to pull in the SQLite driver unless I use the SQLite seen-store, so that the kit stays light.

### Developer of this engine

71. As a developer of this engine, I want time, HTTP, and storage injected, so that retry schedules and failure modes are testable without sleeping or real networks.
72. As a developer of this engine, I want a deterministic worker step, so that tests can drive delivery one tick at a time.
73. As a developer of this engine, I want the in-memory Store held to the same contract as the SQLite Store, so that fast tests can't pass against behaviour the real store lacks.

## Implementation Decisions

- **Language and runtime:** TypeScript on Node 22. One package with two subpath entry points, `sender` and `receiver`; the Standard Webhooks signing logic is a shared internal module used by both and is the only place the wire format is encoded.
- **Wire format (ADR-0001):** Standard Webhooks — headers `webhook-id`, `webhook-timestamp` (Attempt time, seconds), `webhook-signature` (space-separated `v1,<base64>` entries). Signature is HMAC-SHA256 over `id.timestamp.body` using the decoded `whsec_` secret.
- **Webhook id (ADR-0004):** `webhook-id` is the Event id, constant across all Deliveries, Attempts, and Replays of that Event.
- **Storage (ADR-0002):** SQLite via `better-sqlite3`, behind a narrow Store interface. Implementations: SQLite (production) and in-memory (tests only).
- **Outbox (ADR-0003):** `send` optionally accepts the host's SQLite database handle and performs its writes within the caller's open transaction. Without one, the Sender uses its own file. The Sender owns its schema and creates/migrates its tables in whichever database it's given.
- **Data model (Sender):**
  - Endpoint: id, URL, current secret, optional previous secret, subscribed Event types, timestamps.
  - Event: id, type, frozen serialised body (the envelope bytes), accepted-at.
  - Delivery: id, Event, Endpoint, status (pending | succeeded | failed), Attempt count, next-due time.
  - Attempt: id, Delivery, started-at, duration, outcome (status code, or error kind: timeout | network | redirect | interrupted), first 1 KB of response body, in-flight marker until finished.
  - Worker lock: owner, heartbeat time.
- **Fan-out:** performed once inside `send` — one Delivery per Endpoint whose Subscriptions include the Event type at that moment.
- **Sender API:** `createEndpoint`, `updateEndpoint`, `rotateSecret` (start and end of a rotation), `send`, `listDeliveries` (with Attempts), `replay`. Library functions only.
- **Worker:** exposes a deterministic step (`runDue`) that claims and attempts every Delivery due at the current clock time, respecting the per-Endpoint cap of 4 in-flight Attempts, and a run loop that calls it about every second and is woken immediately by in-process `send`. Startup takes the lock row (refusing while another heartbeat is fresh), then marks any in-flight Attempts as Interrupted and reschedules their Deliveries for immediate retry. Graceful stop waits for in-flight Attempts.
- **Attempt outcome rules:** 2xx is success. Anything else — non-2xx including 3xx and 4xx, a 15s timeout, or a network error — is a failed Attempt. Redirects are never followed.
- **Backoff:** a schedule of 8 Attempts with nominal delays of about 5s, 1m, 5m, 30m, 2h, 6h, 12h, 24h, each with full jitter. A `Retry-After` on 429/503 overrides the next delay. After the eighth failure the Delivery becomes Failed.
- **Secret rotation:** during rotation the Sender emits one signature per secret (current and previous) in the `webhook-signature` header.
- **Replay:** allowed only on Failed Deliveries. Resets the Delivery to pending with a fresh Attempt budget, due immediately. Earlier Attempts are kept.
- **Retention:** a pruning step deletes Events, with their Deliveries and Attempts, once every Delivery is finished and the last finished more than 30 days ago.
- **Receiver API:**
  - `verify({ headers, rawBody, secrets, clock? })` returns the parsed Event or throws typed errors (invalid signature, stale timestamp, malformed headers). ±5 minute tolerance, constant-time comparison, any-signature-matches-any-secret.
  - `dedup.once(endpointKey, webhookId, handler)` is a three-state guard per (endpointKey, webhookId): absent → claimed (with a lease) → done. It reports one of: processed, duplicate (map to 200), or in-progress (map to 409). Handler failure deletes the claim and rethrows. An expired lease is treated as absent. Done ids are kept for 7 days.
  - Seen-store implementations: in-memory and SQLite. The SQLite one is imported from its own subpath so the driver stays optional.
  - Web `Request` adapter: reads the raw body, verifies, runs the guard, and returns a `Response` with the appropriate status.
- **Injected dependencies:** Clock (Sender worker, Receiver `verify` and dedup), HTTP Transport (Sender), Store (Sender), seen-store (Receiver).

## Testing Decisions

- **What makes a good test:** it drives a public API and asserts on externally observable results — Deliveries and Attempts from `listDeliveries`, requests captured by the fake Transport, and what `verify`/`dedup.once` return or throw. Tests never reach into Store internals or private helpers. Time moves only by advancing the injected Clock; no test sleeps.
- **Seam 1 — Sender public API:** the bulk of the suite. Construct a Sender with a fake Clock, a scripted Transport (per-Attempt outcomes: 2xx, 503 with Retry-After, timeout, redirect, network error, crash mid-flight), and the in-memory Store. Drive delivery by calling `runDue` after advancing the clock. This covers fan-out, the backoff schedule and jitter bounds, Retry-After, Failed after 8 Attempts, Replay, the per-Endpoint concurrency cap, Interrupted recovery, the worker lock, secret rotation signatures, payload freezing and the size cap, and retention.
- **Seam 2 — Receiver public API:** `verify` and `dedup.once` with a fake Clock and the in-memory seen-store. Covers the timestamp window, multiple secrets/signatures, typed errors, the claimed→done guard (including concurrent Duplicates, handler failure, and lease expiry), per-Endpoint scoping, and 7-day retention. The Standard Webhooks published test vectors are run against the shared signing module through this seam.
- **Seam 3 — Store contract suite:** one behavioural suite parameterised over the in-memory and SQLite Stores, and likewise over both seen-stores. The outbox is tested here against real SQLite: `send` inside a host transaction that commits yields the Event, and one that rolls back yields nothing.
- **Seam 4 — one end-to-end test:** a real Sender and worker deliver over real HTTP to a server using the Receiver kit's `Request` adapter, including a forced retry that the Receiver recognises as a Duplicate.
- **Prior art:** none; this is the first code in the repo. Development is test-first (`/tdd`).

## Out of Scope

- Auto-disabling persistently failing Endpoints.
- SSRF protection (blocking private or internal IP targets); Endpoints are created only by trusted host code in v1.
- Any HTTP admin API, UI, or CLI.
- An Express-specific Receiver adapter (docs only).
- Postgres, multiple concurrent workers, or horizontal scaling.
- Ordering guarantees of any kind.
- Replaying succeeded Deliveries, or delivering past Events to newly subscribed Endpoints.
- Metrics, tracing, or alerting integrations.

## Further Notes

- Terms follow `GLOSSARY.md` (Sender, Receiver, Event, Event type, Endpoint, Signing secret, Subscription, Delivery, Attempt, Interrupted, Failed, Replay, Duplicate).
- Decisions with lasting consequences are recorded in `docs/adr/0001`–`0004`.
- `node:sqlite` was considered and deferred until it's stable. The Store interface keeps a later switch confined to one implementation.
- At-least-once delivery is a deliberate property: the Sender may deliver an Event more than once (retries after timeouts, Interrupted Attempts, Replays), and the Receiver kit's deduplication is what makes this safe.
