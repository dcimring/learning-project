# Adopt the Standard Webhooks wire format

Signing and headers follow the open [Standard Webhooks](https://www.standardwebhooks.com/) spec (`webhook-id`, `webhook-timestamp`, `webhook-signature`; HMAC-SHA256 over `id.timestamp.body`, `v1,`-prefixed base64) rather than a home-grown or Stripe-style scheme. Receivers depend on the wire format, so changing it later is costly. The spec gives us a stable deduplication key, replay protection, multi-signature secret rotation, and published test vectors to prove interoperability with third-party receivers.
