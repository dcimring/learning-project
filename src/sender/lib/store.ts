// The Sender's persistence boundary (ADR-0002). Every method is synchronous so
// that `send` can run inside a host's better-sqlite3 transaction (ADR-0003).

export interface EndpointRecord {
  id: string;
  url: string;
  /** The current Signing secret, `whsec_<base64>`. */
  secret: string;
  eventTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRecord {
  id: string;
  type: string;
  /** The envelope, serialised once when the Event was accepted. */
  body: string;
  acceptedAt: Date;
}

export type DeliveryStatus = "pending" | "succeeded" | "failed";

export interface DeliveryRecord {
  id: string;
  eventId: string;
  endpointId: string;
  status: DeliveryStatus;
  attemptCount: number;
  /** When the next Attempt is due; null once the Delivery is finished. */
  nextAttemptAt: Date | null;
}

export type AttemptOutcome =
  | { status: number }
  | { error: "timeout" | "network" | "redirect" | "interrupted" };

export interface AttemptRecord {
  id: string;
  deliveryId: string;
  startedAt: Date;
  durationMs: number;
  outcome: AttemptOutcome;
}

/** A Delivery that is due, with what an Attempt needs to make the request. */
export interface DueDelivery {
  delivery: DeliveryRecord;
  event: EventRecord;
  endpoint: EndpointRecord;
}

export interface DeliveryWithAttempts extends DeliveryRecord {
  attempts: AttemptRecord[];
}

export interface DeliveryFilter {
  endpointId?: string;
  status?: DeliveryStatus;
}

export interface Store {
  insertEndpoint(endpoint: EndpointRecord): void;
  getEndpoint(id: string): EndpointRecord | undefined;
  /** Replaces a stored Endpoint with the same id. */
  updateEndpoint(endpoint: EndpointRecord): void;
  /** Endpoints whose Subscriptions include the Event type right now. */
  endpointsSubscribedTo(eventType: string): EndpointRecord[];
  /** Records an accepted Event and its Deliveries together, atomically. */
  insertEvent(event: EventRecord, deliveries: DeliveryRecord[]): void;
  /** Pending Deliveries whose next Attempt is due at or before `now`. */
  dueDeliveries(now: Date): DueDelivery[];
  /** Records a finished Attempt and the Delivery's resulting state. */
  recordAttempt(attempt: AttemptRecord, delivery: DeliveryRecord): void;
  listDeliveries(filter: DeliveryFilter): DeliveryWithAttempts[];
}
