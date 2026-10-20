# `verify` types the Event envelope but does not validate it

The Receiver's `verify` returns the body parsed as `Event<TData>` (`{ type, timestamp, data }`) without checking that shape at runtime. A matching signature already proves the body came from a Sender holding the Signing secret, and the Receiver kit must work with any Standard Webhooks Sender (spec story 60), including ones whose bodies aren't our envelope, such as the published test vectors. Subscribers who need runtime guarantees about `data` validate it themselves (e.g. with a schema library).

## Consequences

- The `Event` type is a promise about our own Sender, not something `verify` enforces; a non-envelope body from another Sender comes back as whatever JSON it was.
- Adding shape validation later would be a breaking change for subscribers of third-party Senders, so it would arrive as an opt-in, not a default.
- A correctly signed body that isn't JSON at all is rejected with `MalformedPayloadError`, a `WebhookVerificationError`, so a catch-all handler answers 4xx rather than 500.
- In the same spirit of working with any Standard Webhooks Sender, `verify` accepts Signing secrets as bare base64 as well as `whsec_<base64>`, as the reference libraries do. Our own Sender always issues the `whsec_` form.
