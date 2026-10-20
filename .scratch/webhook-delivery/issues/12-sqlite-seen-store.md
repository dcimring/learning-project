# 12: SQLite seen-store

**What to build:** A subscriber's deduplication survives restarts. Add a SQLite seen-store, imported from its own subpath so the Receiver kit doesn't pull in the SQLite driver unless it's used, held to the same contract as the in-memory seen-store.

**Blocked by:** 05 (Receiver `dedup.once` with in-memory seen-store)

**Status:** ready-for-agent

- [ ] A seen-store contract suite runs against both the in-memory and SQLite seen-stores
- [ ] Claimed and done state survives closing and reopening the database
- [ ] Importing the main `receiver` entry point does not load `better-sqlite3`
- [ ] 7-day retention and lease expiry behave the same as in-memory
