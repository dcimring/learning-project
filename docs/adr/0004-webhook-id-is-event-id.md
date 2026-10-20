# The webhook id is the Event id, deduplicated per Endpoint

The `webhook-id` header carries the Event id, identical across every Delivery, Attempt and Replay of that Event, rather than a per-Delivery id. The Receiver scopes deduplication to the Endpoint (identified by its Signing secret), so two separately configured Endpoints never suppress each other, while retries and Replays to the same Endpoint are recognised as Duplicates. Receivers store these ids, so changing their meaning later would break deduplication in the field.
