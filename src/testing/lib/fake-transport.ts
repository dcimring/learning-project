import type {
  Transport,
  TransportRequest,
  TransportResult,
} from "../../sender/index.js";

export interface FakeTransport extends Transport {
  /** Every request sent, in order. */
  readonly requests: TransportRequest[];
}

/** A Transport that records each request and answers 200. */
export function createFakeTransport(): FakeTransport {
  const requests: TransportRequest[] = [];
  return {
    requests,
    async send(request): Promise<TransportResult> {
      requests.push(structuredClone(request));
      return { kind: "response", status: 200, body: "" };
    },
  };
}
