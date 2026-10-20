# 11: Worker process: lock, loop, recovery

**What to build:** An operator runs the Sender's worker as one long-lived process. It takes a single-worker lock, runs `runDue` about once a second (and immediately when `send` is called in the same process), recovers from a crash by marking in-flight Attempts as Interrupted, and stops gracefully.

**Blocked by:** 03 (Failed Attempts, backoff and Failed Deliveries), 04 (SQLite Store + Store contract suite)

**Status:** ready-for-agent

- [ ] A worker takes a lock row with a heartbeat; a second worker against the same database refuses to start while the heartbeat is fresh
- [ ] A second worker can take over once the first's heartbeat is stale
- [ ] The run loop calls `runDue` about every second, and an in-process `send` wakes it immediately
- [ ] On startup, Attempts left in flight are recorded as Interrupted, count as failed Attempts, and their Deliveries are rescheduled for immediate retry
- [ ] Graceful stop lets in-flight Attempts finish or time out before returning, without producing Interrupted Attempts
- [ ] Lock and recovery behaviour is in the Store contract suite for both Stores

## Comments

From ticket 02's code review:

- `runDue` has no claiming step: two overlapping calls (e.g. a timer tick while Attempts are in flight) both read the same due Delivery and attempt it twice. The in-flight marker should double as the claim.
- `attempt()` writes back a Delivery snapshot taken before the `await`, so a change made meanwhile (e.g. a Replay) would be overwritten. Record Attempt results as targeted updates rather than whole-record writes.
