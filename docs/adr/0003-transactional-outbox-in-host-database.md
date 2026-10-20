# Sender tables may live in the host's database

When the host application uses SQLite, the Sender's tables live in the host's own database and `send(event, { db })` writes inside the caller's open transaction (a transactional outbox). Otherwise the Sender falls back to its own SQLite file. This closes the gap where the host commits and crashes before sending (a lost Event) or sends and then rolls back (a phantom Event). The cost is that the Sender's schema shares a database it doesn't own.
