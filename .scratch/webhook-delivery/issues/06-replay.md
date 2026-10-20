# 06: Replay

**What to build:** An operator can Replay a Failed Delivery after the subscriber fixes their outage. `replay(deliveryId)` puts the same Delivery back to pending, due immediately, with a fresh 8-Attempt budget under the same webhook id.

**Blocked by:** 03 (Failed Attempts, backoff and Failed Deliveries)

**Status:** ready-for-agent

- [ ] Replaying a Failed Delivery makes it pending and due now; the next `runDue` attempts it
- [ ] The Replayed Delivery gets a fresh budget of 8 Attempts on the normal backoff schedule
- [ ] Attempts carry the same `webhook-id` as before the Replay
- [ ] Earlier Attempts are kept in the Delivery's history
- [ ] Replaying a pending or succeeded Delivery is rejected with a clear error
- [ ] Both Stores and the Store contract suite cover the new behaviour
