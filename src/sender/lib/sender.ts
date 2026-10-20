import { systemClock, type Clock } from "../../shared/clock.js";
import type { Event } from "../../shared/event.js";
import {
  decodeSecret,
  generateSecret,
  signedHeaders,
} from "../../shared/signing.js";
import { assertEndpointUrl } from "./endpoint-url.js";
import { EndpointNotFoundError, PayloadTooLargeError } from "./errors.js";
import { newId } from "./ids.js";
import type {
  AttemptOutcome,
  DeliveryFilter,
  DeliveryRecord,
  DeliveryStatus,
  DueDelivery,
  EndpointRecord,
  Store,
} from "./store.js";
import type { Transport } from "./transport.js";

/** The largest serialised envelope `send` accepts, in bytes. */
const MAX_PAYLOAD_BYTES = 256 * 1024;

export interface SenderOptions {
  store: Store;
  transport: Transport;
  clock?: Clock;
}

export interface Endpoint {
  id: string;
  url: string;
  /** The Signing secret to hand to the subscriber, `whsec_<base64>`. */
  secret: string;
  eventTypes: string[];
}

/** One Event bound for one Endpoint, as an operator sees it. */
export interface Delivery {
  id: string;
  eventId: string;
  endpointId: string;
  status: DeliveryStatus;
  /** When the next Attempt is due; null once the Delivery is finished. */
  nextAttemptAt: Date | null;
  attempts: Attempt[];
}

/** One HTTP request carrying a Delivery. No secrets or headers are kept. */
export interface Attempt {
  startedAt: Date;
  durationMs: number;
  outcome: AttemptOutcome;
}

export interface Sender {
  createEndpoint(input: { url: string; eventTypes: string[] }): Endpoint;
  /**
   * Changes an Endpoint's URL and/or Subscriptions. New Subscriptions apply to
   * Events accepted afterwards; a new URL applies from the next Attempt.
   */
  updateEndpoint(
    id: string,
    changes: { url?: string; eventTypes?: string[] }
  ): Endpoint;
  /** Accepts an Event and returns its id. */
  send(input: { type: string; data: unknown }): string;
  /** Makes an Attempt for every Delivery due at the clock's current time. */
  runDue(): Promise<void>;
  /** Deliveries with their Attempts, optionally by Endpoint and/or status. */
  listDeliveries(filter?: DeliveryFilter): Delivery[];
}

export function createSender(options: SenderOptions): Sender {
  const { store, transport } = options;
  const clock = options.clock ?? systemClock;

  async function attempt({ delivery, event, endpoint }: DueDelivery) {
    const startedAt = clock.now();
    const result = await transport.send({
      url: endpoint.url,
      headers: {
        "content-type": "application/json",
        ...signedHeaders([decodeSecret(endpoint.secret)], {
          id: event.id,
          timestamp: Math.floor(startedAt.getTime() / 1000),
          body: event.body,
        }),
      },
      body: event.body,
    });
    const succeeded =
      result.kind === "response" && result.status >= 200 && result.status < 300;
    store.recordAttempt(
      {
        id: newId("att"),
        deliveryId: delivery.id,
        startedAt,
        durationMs: clock.now().getTime() - startedAt.getTime(),
        outcome:
          result.kind === "response"
            ? { status: result.status }
            : { error: result.kind },
      },
      {
        ...delivery,
        status: succeeded ? "succeeded" : delivery.status,
        attemptCount: delivery.attemptCount + 1,
        nextAttemptAt: succeeded ? null : delivery.nextAttemptAt,
      }
    );
  }

  return {
    createEndpoint({ url, eventTypes }) {
      assertEndpointUrl(url);
      const now = clock.now();
      const endpoint: EndpointRecord = {
        id: newId("ep"),
        url,
        secret: generateSecret(),
        eventTypes: [...eventTypes],
        createdAt: now,
        updatedAt: now,
      };
      store.insertEndpoint(endpoint);
      return toEndpoint(endpoint);
    },

    updateEndpoint(id, changes) {
      const existing = store.getEndpoint(id);
      if (!existing)
        throw new EndpointNotFoundError(`No Endpoint with id ${id}`);
      if (changes.url !== undefined) assertEndpointUrl(changes.url);
      const endpoint: EndpointRecord = {
        ...existing,
        url: changes.url ?? existing.url,
        eventTypes: changes.eventTypes
          ? [...changes.eventTypes]
          : existing.eventTypes,
        updatedAt: clock.now(),
      };
      store.updateEndpoint(endpoint);
      return toEndpoint(endpoint);
    },

    send({ type, data }) {
      const acceptedAt = clock.now();
      const envelope: Event = {
        type,
        timestamp: acceptedAt.toISOString(),
        // JSON drops undefined, which would leave the envelope without `data`.
        data: data === undefined ? null : data,
      };
      const body = JSON.stringify(envelope);
      const size = Buffer.byteLength(body);
      if (size > MAX_PAYLOAD_BYTES) {
        throw new PayloadTooLargeError(
          `Event envelope is ${size} bytes; the limit is ${MAX_PAYLOAD_BYTES}`
        );
      }
      const event = { id: newId("evt"), type, body, acceptedAt };
      const deliveries: DeliveryRecord[] = store
        .endpointsSubscribedTo(type)
        .map((endpoint) => ({
          id: newId("dlv"),
          eventId: event.id,
          endpointId: endpoint.id,
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: acceptedAt,
        }));
      store.insertEvent(event, deliveries);
      return event.id;
    },

    async runDue() {
      await Promise.all(store.dueDeliveries(clock.now()).map(attempt));
    },

    listDeliveries(filter = {}) {
      return store.listDeliveries(filter).map((delivery) => ({
        id: delivery.id,
        eventId: delivery.eventId,
        endpointId: delivery.endpointId,
        status: delivery.status,
        nextAttemptAt: delivery.nextAttemptAt,
        attempts: delivery.attempts.map(
          ({ startedAt, durationMs, outcome }) => ({
            startedAt,
            durationMs,
            outcome,
          })
        ),
      }));
    },
  };
}

function toEndpoint(record: EndpointRecord): Endpoint {
  return {
    id: record.id,
    url: record.url,
    secret: record.secret,
    eventTypes: [...record.eventTypes],
  };
}
