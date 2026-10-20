/**
 * The envelope every Event is delivered in. The Sender serialises it once when
 * the Event is accepted; the Receiver parses it back out of the raw body.
 */
export interface Event<TData = unknown> {
  /** The Event type, e.g. `invoice.paid`. */
  type: string;
  /** When the Event was accepted, as an ISO 8601 string. */
  timestamp: string;
  data: TData;
}
