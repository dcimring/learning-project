# 07: Per-Endpoint concurrency cap

**What to build:** One slow subscriber can't monopolise the worker or get flooded. At most 4 Attempts are in flight per Endpoint, and Deliveries to other Endpoints proceed regardless.

**Blocked by:** 02 (Sender tracer bullet)

**Status:** ready-for-agent

- [ ] With many due Deliveries for one Endpoint and a Transport that holds requests open, no more than 4 Attempts to that Endpoint are in flight at once
- [ ] Deliveries beyond the cap are attempted as earlier Attempts finish
- [ ] A slow or failing Endpoint doesn't delay Attempts to a healthy Endpoint
- [ ] The docs state plainly that Event order is not guaranteed
