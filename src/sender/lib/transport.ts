// How the Sender makes an Attempt's HTTP request. Expected failures are
// results, not exceptions, so the Sender can record them as outcomes.

export interface TransportRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export type TransportResult =
  | { kind: "response"; status: number; body: string }
  | { kind: "timeout" }
  | { kind: "network"; message: string };

export interface Transport {
  send(request: TransportRequest): Promise<TransportResult>;
}
