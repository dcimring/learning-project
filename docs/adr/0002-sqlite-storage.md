# SQLite for durable state

The Sender stores Events, Deliveries and Attempts in SQLite, and the Receiver kit's seen-store has a SQLite adapter, rather than Postgres or a store-agnostic design. SQLite keeps the engine lightweight (one file, no server) while still giving durable, transactional state, which is the production-shaped property we care about.

## Consequences

- Only one Sender worker process may run at a time, since SQLite has a single writer; concurrency comes from in-flight Attempts within that process, not from multiple workers.
- Accepting an Event atomically with the host application's own change (a transactional outbox) is possible only when the host uses the same SQLite database.
- Moving to Postgres later means a new store implementation and a worker-claiming strategy (e.g. `SKIP LOCKED`), not just a driver swap.
