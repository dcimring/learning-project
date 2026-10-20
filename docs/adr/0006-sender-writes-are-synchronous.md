# The Sender's writes and Store are synchronous

`createEndpoint`, `updateEndpoint`, `send`, `listDeliveries` and every `Store` method are synchronous; only `runDue`, which makes HTTP requests, is async. better-sqlite3 is synchronous and its transactions cannot span an `await`, so a synchronous `send` is what lets the Sender write inside the host's open transaction (ADR-0003). An async API would need a separate synchronous path for the outbox, or would give it up.

## Consequences

- Store implementations must be synchronous. The in-memory and SQLite Stores both are; a future Postgres Store (ADR-0002) would need an async Store and a different outbox story, not just a driver swap.
- Host code calls `send` without `await`, which reads naturally inside a `db.transaction(() => …)` callback.
