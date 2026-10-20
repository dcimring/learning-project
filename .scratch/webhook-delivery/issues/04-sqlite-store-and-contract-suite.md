# 04: SQLite Store + Store contract suite

**What to build:** The Sender runs on real, durable persistence. Add a `better-sqlite3` Store (ADR-0002) that creates its own schema and satisfies the same behavioural contract as the in-memory Store, enforced by one suite run against both.

**Blocked by:** 02 (Sender tracer bullet)

**Status:** ready-for-agent

- [ ] A Store contract suite, parameterised over the in-memory and SQLite Stores, covers every Store operation the Sender uses so far
- [ ] The SQLite Store creates its tables in whichever database file it's given
- [ ] The Sender's existing public-API tests pass when constructed with the SQLite Store
- [ ] State survives closing and reopening the database file
- [ ] Note for later tickets: any ticket adding Store behaviour must extend both Stores and this suite
