# 05: Receiver `dedup.once` with in-memory seen-store

**What to build:** A subscriber's handler runs at most once per webhook id per Endpoint, even with concurrent Duplicates and handler failures. `dedup.once(endpointKey, webhookId, handler)` implements a three-state guard (absent → claimed with a lease → done) over an injected seen-store, with an in-memory implementation.

**Blocked by:** 01 (Package scaffold + Receiver `verify`)

**Status:** ready-for-agent

- [ ] The first call runs the handler and reports processed
- [ ] A call for an id already done reports duplicate (maps to 200) without running the handler
- [ ] A concurrent call while the id is claimed reports in-progress (maps to 409) without running the handler
- [ ] If the handler throws, the claim is released and the error is rethrown; a later call runs the handler again
- [ ] A claim whose lease has expired (by the injected clock) can be claimed again
- [ ] Ids are scoped per endpointKey, so the same id under two Endpoints is processed by both
- [ ] Done ids are remembered for 7 days and forgotten after that
