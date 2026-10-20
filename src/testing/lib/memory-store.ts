import type {
  AttemptRecord,
  DeliveryRecord,
  EndpointRecord,
  EventRecord,
  Store,
} from "../../sender/index.js";

/**
 * A Store held in memory, for tests only. Records are copied on the way in and
 * out so callers can't change stored state by mutating what they hold.
 */
export function createInMemoryStore(): Store {
  const endpoints = new Map<string, EndpointRecord>();
  const events = new Map<string, EventRecord>();
  const deliveries = new Map<string, DeliveryRecord>();
  const attempts: AttemptRecord[] = [];

  return {
    insertEndpoint(endpoint) {
      endpoints.set(endpoint.id, structuredClone(endpoint));
    },

    getEndpoint(id) {
      const endpoint = endpoints.get(id);
      return endpoint && structuredClone(endpoint);
    },

    updateEndpoint(endpoint) {
      endpoints.set(endpoint.id, structuredClone(endpoint));
    },

    endpointsSubscribedTo(eventType) {
      return [...endpoints.values()]
        .filter((endpoint) => endpoint.eventTypes.includes(eventType))
        .map((endpoint) => structuredClone(endpoint));
    },

    insertEvent(event, newDeliveries) {
      events.set(event.id, structuredClone(event));
      for (const delivery of newDeliveries) {
        deliveries.set(delivery.id, structuredClone(delivery));
      }
    },

    dueDeliveries(now) {
      return [...deliveries.values()]
        .filter(
          (delivery) =>
            delivery.status === "pending" &&
            delivery.nextDueAt !== null &&
            delivery.nextDueAt <= now
        )
        .map((delivery) => ({
          delivery: structuredClone(delivery),
          event: structuredClone(events.get(delivery.eventId)!),
          endpoint: structuredClone(endpoints.get(delivery.endpointId)!),
        }));
    },

    recordAttempt(attempt, delivery) {
      attempts.push(structuredClone(attempt));
      deliveries.set(delivery.id, structuredClone(delivery));
    },

    listDeliveries(filter) {
      return [...deliveries.values()]
        .filter(
          (delivery) =>
            (filter.endpointId === undefined ||
              delivery.endpointId === filter.endpointId) &&
            (filter.status === undefined || delivery.status === filter.status)
        )
        .map((delivery) => ({
          ...structuredClone(delivery),
          attempts: attempts
            .filter((attempt) => attempt.deliveryId === delivery.id)
            .map((attempt) => structuredClone(attempt)),
        }));
    },
  };
}
