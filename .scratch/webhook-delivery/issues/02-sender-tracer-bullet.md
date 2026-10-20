# 02: Sender tracer bullet: one Event → one successful Delivery

**What to build:** The happy path through the Sender's public API. A host developer creates an Endpoint subscribed to some Event types, calls `send`, and a deterministic worker step (`runDue`) makes one signed Attempt that succeeds; `listDeliveries` shows the succeeded Delivery and its Attempt. The Sender is built with an injected Clock, HTTP Transport, and Store; this ticket introduces the Store interface, its in-memory implementation, and the fake Transport and Clock used by tests.

**Blocked by:** 01 (Package scaffold + Receiver `verify`)

**Status:** done

- [x] `createEndpoint` takes a URL and Event types, generates a `whsec_` Signing secret (32 random bytes), and rejects non-HTTPS URLs except `localhost` and `127.0.0.1`
- [x] `updateEndpoint` changes the URL and Subscriptions; Subscription changes affect only Events accepted afterwards, and a new URL applies from the next Attempt (see GLOSSARY: Endpoint)
- [x] `send` returns the Event id and creates one Delivery per Endpoint subscribed to the Event type at that moment
- [x] An Event with no subscribed Endpoints is accepted without error and creates no Deliveries
- [x] The payload is serialised once into a `{ type, timestamp, data }` envelope when the Event is accepted; later mutation of the caller's objects doesn't change what is sent
- [x] Payloads over 256 KB are rejected by `send`
- [x] `runDue` attempts every Delivery due at the clock's current time; each Attempt is signed with the Attempt's timestamp and carries the Event id as `webhook-id` (ADR-0004)
- [x] A 2xx response marks the Delivery succeeded
- [x] `listDeliveries` (filterable by Endpoint and status) returns Deliveries with their Attempts (start time, duration, outcome); no secrets or request headers are recorded
- [x] A Receiver's `verify` accepts the request captured by the fake Transport
