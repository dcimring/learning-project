# 03: Failed Attempts, backoff and Failed Deliveries

**What to build:** Deliveries survive subscriber outages. Any outcome other than a 2xx is a failed Attempt, the Delivery is retried on a jittered backoff schedule, and after its eighth failed Attempt it becomes Failed and stays Failed.

**Blocked by:** 02 (Sender tracer bullet)

**Status:** ready-for-agent

- [ ] Non-2xx responses (including 3xx and 4xx), timeouts, and network errors each produce a failed Attempt with the right outcome (status code, or error kind timeout / network / redirect)
- [ ] The first 1 KB of the response body is recorded on each Attempt
- [ ] Retries follow nominal delays of about 5s, 1m, 5m, 30m, 2h, 6h, 12h, 24h with full jitter; tests assert the delays fall within the jitter bounds by advancing the injected clock
- [ ] A `Retry-After` header on a 429 or 503 response overrides the next delay
- [ ] A Delivery due in the future is not attempted by `runDue`
- [ ] After the eighth failed Attempt the Delivery is Failed and is never attempted again automatically
- [ ] Every retry Attempt is freshly signed with its own timestamp and keeps the same `webhook-id`
