# 08: Secret rotation

**What to build:** A host developer can rotate an Endpoint's Signing secret without the subscriber dropping webhooks. `rotateSecret` starts a rotation (new current secret, old one kept as previous) and can end it (previous dropped). While rotating, every Attempt carries a signature for each secret.

**Blocked by:** 02 (Sender tracer bullet)

**Status:** ready-for-agent

- [ ] Starting a rotation generates a new current secret and keeps the old one as previous
- [ ] While rotating, the `webhook-signature` header contains two `v1,` signatures, one per secret
- [ ] A Receiver holding only the old secret, only the new secret, or both, verifies the request
- [ ] Ending the rotation drops the previous secret; subsequent Attempts carry one signature, and a Receiver holding only the old secret rejects them
- [ ] Both Stores and the Store contract suite cover the new behaviour
