# 09: Retention pruning

**What to build:** The Sender's database doesn't grow without bound. A pruning step deletes Events, with their Deliveries and Attempts, once every Delivery for the Event has finished and the last finished more than 30 days ago.

**Blocked by:** 03 (Failed Attempts, backoff and Failed Deliveries)

**Status:** ready-for-agent

- [ ] An Event whose Deliveries all finished (succeeded or Failed) more than 30 days ago is pruned along with its Deliveries and Attempts
- [ ] An Event with any pending Delivery is never pruned, however old
- [ ] An Event whose last Delivery finished less than 30 days ago is kept
- [ ] Both Stores and the Store contract suite cover the new behaviour
