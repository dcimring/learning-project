# `verify` types the Event envelope but does not validate it

The Receiver's `verify` returns the body parsed as `Event<TData>` (`{ type, timestamp, data }`) without checking that shape at runtime. A matching signature already proves the body came from a Sender holding the Signing secret, and the Receiver kit must work with any Standard Webhooks Sender (spec story 60), including ones whose bodies aren't our envelope, such as the published test vectors. Subscribers who need runtime guarantees about `data` validate it themselves (e.g. with a schema library).

## Consequences

- The `Event` type is a promise about our own Sender, not something `verify` enforces; a non-envelope body from another Sender comes back as whatever JSON it was.
- Adding shape validation later would be a breaking change for subscribers of third-party Senders, so it would arrive as an opt-in, not a default.
