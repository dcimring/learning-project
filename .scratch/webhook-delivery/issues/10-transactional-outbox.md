# 10: Transactional outbox

**What to build:** An Event exists if and only if the host's business change commits (ADR-0003). When the host app uses SQLite, `send(event, { db })` writes the Event and its Deliveries inside the caller's open transaction in the host's database; without a `db`, the Sender uses its own SQLite file.

**Blocked by:** 04 (SQLite Store + Store contract suite)

**Status:** ready-for-agent

- [ ] The Sender creates its tables in the host's database when given one
- [ ] `send` inside a host transaction that commits produces the Event and its Deliveries
- [ ] `send` inside a host transaction that rolls back leaves no Event and no Deliveries
- [ ] `send` without a `db` writes to the Sender's own SQLite file
- [ ] These tests run against real SQLite
