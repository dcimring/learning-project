# 02: Sender tracer bullet: one Event → one successful Delivery

**What to build:** The happy path through the Sender's public API. A host developer creates an Endpoint subscribed to some Event types, calls `send`, and a deterministic worker step (`runDue`) makes one signed Attempt that succeeds; `listDeliveries` shows the succeeded Delivery and its Attempt. The Sender is built with an injected Clock, HTTP Transport, and Store; this ticket introduces the Store interface, its in-memory implementation, and the fake Transport and Clock used by tests.

**Blocked by:** 01 (Package scaffold + Receiver `verify`)

**Status:** ready-for-agent

- [ ] `createEndpoint` takes a URL and Event types, generates a `whsec_` Signing secret (32 random bytes), and rejects non-HTTPS URLs except `localhost` and `127.0.0.1`
- [ ] `updateEndpoint` changes the URL and Subscriptions; changes affect only Events accepted afterwards
- [ ] `send` returns the Event id and creates one Delivery per Endpoint subscribed to the Event type at that moment
- [ ] An Event with no subscribed Endpoints is accepted without error and creates no Deliveries
- [ ] The payload is serialised once into a `{ type, timestamp, data }` envelope when the Event is accepted; later mutation of the caller's objects doesn't change what is sent
- [ ] Payloads over 256 KB are rejected by `send`
- [ ] `runDue` attempts every Delivery due at the clock's current time; each Attempt is signed with the Attempt's timestamp and carries the Event id as `webhook-id` (ADR-0004)
- [ ] A 2xx response marks the Delivery succeeded
- [ ] `listDeliveries` (filterable by Endpoint and status) returns Deliveries with their Attempts (start time, duration, outcome); no secrets or request headers are recorded
- [ ] A Receiver's `verify` accepts the request captured by the fake Transport
