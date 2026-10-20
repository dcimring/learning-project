# 14: Real HTTP Transport + end-to-end test

**What to build:** The Sender delivers over the real network. Add a `fetch`-based Transport, then prove the whole system end to end: a real Sender and worker deliver to a real HTTP server using the Receiver kit's `Request` adapter.

**Blocked by:** 11 (Worker process: lock, loop, recovery), 13 (Web `Request` adapter + Express docs)

**Status:** ready-for-agent

- [ ] The real Transport times out after 15 seconds and reports a timeout outcome
- [ ] The real Transport does not follow redirects; a 3xx is reported as a redirect outcome
- [ ] Network errors (e.g. connection refused) are reported as network outcomes
- [ ] The first 1 KB of the response body is captured
- [ ] End to end: an Event sent through the Sender is verified and handled exactly once by the Receiver server
- [ ] End to end: a forced retry of the same Delivery reaches the Receiver and is recognised as a Duplicate (handler not run twice)
