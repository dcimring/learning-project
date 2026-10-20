# Webhook Delivery

A lightweight engine for delivering webhooks: a Sender that signs and reliably delivers events over HTTP, and a Receiver kit that verifies and deduplicates them on the other end.

## Roles

**Sender**:
The half of the system, embedded in the host application, that accepts events, signs them, and delivers them to subscribers with retries.
_Avoid_: Producer, publisher, dispatcher

**Receiver**:
The half of the system that runs inside a subscriber's application to verify and deduplicate incoming webhooks before handing them over.
_Avoid_: Consumer, listener, handler

## Language

**Event**:
Something that happened in the host application, identified by a stable id and an event type, sent to the Sender exactly once.
_Avoid_: Message, webhook, notification

**Event type**:
The dotted name classifying an Event, such as `invoice.paid`, used to decide which Endpoints receive it.
_Avoid_: Topic, channel, kind

**Endpoint**:
A subscriber's URL together with its Signing secret and the Event types it subscribes to.
_Avoid_: Subscriber URL, target, destination, webhook

**Signing secret**:
The key shared between the Sender and one Endpoint, used to sign and verify webhooks. An Endpoint has a current secret and, while rotating, a previous one.
_Avoid_: API key, token, shared key

**Subscription**:
An Endpoint's interest in an Event type. Only Endpoints subscribed at the moment an Event is accepted receive it.
_Avoid_: Filter, route

**Delivery**:
One Event bound for one Endpoint, with its own outcome. Created once, when the Event is accepted.
_Avoid_: Job, task, message

**Attempt**:
A single HTTP request carrying a Delivery to its Endpoint. A Delivery has one or more Attempts.
_Avoid_: Try, request, call

**Interrupted** (Attempt):
An Attempt whose outcome was never recorded because the Sender stopped mid-flight. It counts as a failed Attempt; the Endpoint may or may not have received it.
_Avoid_: Lost, orphaned, stuck

**Failed** (Delivery):
A Delivery whose Attempts are all used up without success. It stays failed until it is Replayed.
_Avoid_: Dead, dropped, expired

**Replay**:
A deliberate, manual restart of a Failed Delivery, giving it a fresh set of Attempts under the same webhook id.
_Avoid_: Resend, retry, redrive

**Duplicate**:
An incoming webhook the Receiver has already processed, or is processing right now, for the same Endpoint, recognised by its webhook id rather than by its timestamp or body.
_Avoid_: Repeat, redelivery
