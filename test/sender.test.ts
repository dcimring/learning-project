import { describe, expect, it } from "vitest";
import { verify } from "webhook-delivery/receiver";
import {
  createSender,
  EndpointNotFoundError,
  InvalidEndpointUrlError,
  PayloadTooLargeError,
} from "webhook-delivery/sender";
import {
  createFakeClock,
  createFakeTransport,
  createInMemoryStore,
} from "webhook-delivery/testing";

function setup() {
  const clock = createFakeClock(new Date("2026-01-01T00:00:00.000Z"));
  const transport = createFakeTransport();
  const sender = createSender({
    store: createInMemoryStore(),
    transport,
    clock,
  });
  return { clock, transport, sender };
}

describe("Sender: one Event, one successful Delivery", () => {
  it("delivers an Event to a subscribed Endpoint and records the succeeded Delivery", async () => {
    const { transport, sender } = setup();
    const endpoint = sender.createEndpoint({
      url: "https://subscriber.example/webhooks",
      eventTypes: ["invoice.paid"],
    });

    const eventId = sender.send({
      type: "invoice.paid",
      data: { invoiceId: "inv_42" },
    });
    await sender.runDue();

    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0]?.url).toBe(
      "https://subscriber.example/webhooks"
    );
    expect(sender.listDeliveries()).toEqual([
      {
        id: expect.any(String),
        eventId,
        endpointId: endpoint.id,
        status: "succeeded",
        nextAttemptAt: null,
        attempts: [
          {
            startedAt: new Date("2026-01-01T00:00:00.000Z"),
            durationMs: 0,
            outcome: { status: 200 },
          },
        ],
      },
    ]);
  });

  it("signs each Attempt so the Receiver verifies it, with the Event id as webhook-id", async () => {
    const { clock, transport, sender } = setup();
    const endpoint = sender.createEndpoint({
      url: "https://subscriber.example/webhooks",
      eventTypes: ["invoice.paid"],
    });
    const eventId = sender.send({
      type: "invoice.paid",
      data: { invoiceId: "inv_42" },
    });

    // The Attempt happens 10 minutes after the Event was accepted, beyond the
    // Receiver's 5 minute window, so it must be signed with the Attempt's time.
    clock.advance(10 * 60 * 1000);
    await sender.runDue();
    const request = transport.requests[0]!;

    expect(request.headers["webhook-id"]).toBe(eventId);
    expect(
      verify({
        headers: request.headers,
        rawBody: request.body,
        secrets: [endpoint.secret],
        clock,
      })
    ).toEqual({
      type: "invoice.paid",
      timestamp: "2026-01-01T00:00:00.000Z",
      data: { invoiceId: "inv_42" },
    });
  });
});

describe("Sender: fan-out", () => {
  it("creates one Delivery per Endpoint subscribed to the Event type", () => {
    const { sender } = setup();
    const billing = sender.createEndpoint({
      url: "https://billing.example/hooks",
      eventTypes: ["invoice.paid", "invoice.voided"],
    });
    const ledger = sender.createEndpoint({
      url: "https://ledger.example/hooks",
      eventTypes: ["invoice.paid"],
    });
    sender.createEndpoint({
      url: "https://shipping.example/hooks",
      eventTypes: ["order.shipped"],
    });

    const eventId = sender.send({ type: "invoice.paid", data: {} });

    const deliveries = sender.listDeliveries();
    expect(deliveries.map((d) => d.endpointId).sort()).toEqual(
      [billing.id, ledger.id].sort()
    );
    expect(deliveries.every((d) => d.eventId === eventId)).toBe(true);
    expect(deliveries.every((d) => d.status === "pending")).toBe(true);
  });

  it("accepts an Event with no subscribed Endpoints and creates no Deliveries", async () => {
    const { transport, sender } = setup();
    sender.createEndpoint({
      url: "https://shipping.example/hooks",
      eventTypes: ["order.shipped"],
    });

    const eventId = sender.send({ type: "invoice.paid", data: {} });
    await sender.runDue();

    expect(eventId).toMatch(/^evt_/);
    expect(sender.listDeliveries()).toEqual([]);
    expect(transport.requests).toEqual([]);
  });
});

describe("Sender: updating an Endpoint", () => {
  it("applies Subscription changes only to Events accepted afterwards", () => {
    const { sender } = setup();
    const endpoint = sender.createEndpoint({
      url: "https://subscriber.example/hooks",
      eventTypes: ["invoice.paid"],
    });
    const before = sender.send({ type: "invoice.paid", data: {} });

    const updated = sender.updateEndpoint(endpoint.id, {
      eventTypes: ["order.shipped"],
    });
    sender.send({ type: "invoice.paid", data: {} });
    const after = sender.send({ type: "order.shipped", data: {} });

    expect(updated.eventTypes).toEqual(["order.shipped"]);
    expect(
      sender
        .listDeliveries()
        .map((d) => d.eventId)
        .sort()
    ).toEqual([before, after].sort());
  });

  it("rejects an unknown Endpoint id", () => {
    const { sender } = setup();

    let error: unknown;
    try {
      sender.updateEndpoint("ep_missing", { url: "https://a.example" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(EndpointNotFoundError);
  });

  it("sends the next Attempt of an earlier Event to the new URL", async () => {
    const { transport, sender } = setup();
    const endpoint = sender.createEndpoint({
      url: "https://old.example/hooks",
      eventTypes: ["invoice.paid"],
    });
    sender.send({ type: "invoice.paid", data: {} });

    sender.updateEndpoint(endpoint.id, { url: "https://new.example/hooks" });
    await sender.runDue();

    expect(transport.requests.map((r) => r.url)).toEqual([
      "https://new.example/hooks",
    ]);
  });
});

describe("Sender: Endpoint URLs", () => {
  it.each([
    "https://subscriber.example/hooks",
    "http://localhost:3000/hooks",
    "http://127.0.0.1:8080/hooks",
  ])("accepts %s", (url) => {
    const { sender } = setup();

    expect(sender.createEndpoint({ url, eventTypes: [] }).url).toBe(url);
  });

  it.each([
    "http://subscriber.example/hooks",
    "http://localhost.evil.example/hooks",
    "ftp://subscriber.example/hooks",
    "not a url",
  ])("rejects %s", (url) => {
    const { sender } = setup();

    expect(() => sender.createEndpoint({ url, eventTypes: [] })).toThrow(
      InvalidEndpointUrlError
    );
  });

  it("rejects a non-HTTPS URL on update too", () => {
    const { sender } = setup();
    const endpoint = sender.createEndpoint({
      url: "https://subscriber.example/hooks",
      eventTypes: [],
    });

    expect(() =>
      sender.updateEndpoint(endpoint.id, { url: "http://subscriber.example" })
    ).toThrow(InvalidEndpointUrlError);
  });
});

describe("Sender: accepting an Event's payload", () => {
  const subscribed = () => {
    const ctx = setup();
    ctx.sender.createEndpoint({
      url: "https://subscriber.example/hooks",
      eventTypes: ["report.ready"],
    });
    return ctx;
  };

  it("sends null data when the payload's data is undefined", async () => {
    const { transport, sender } = subscribed();

    sender.send({ type: "report.ready", data: undefined });
    await sender.runDue();

    expect(JSON.parse(transport.requests[0]!.body)).toEqual({
      type: "report.ready",
      timestamp: "2026-01-01T00:00:00.000Z",
      data: null,
    });
  });

  it("freezes the payload when the Event is accepted", async () => {
    const { transport, sender } = subscribed();
    const data = { lines: ["first"] };

    sender.send({ type: "report.ready", data });
    data.lines.push("added after send");
    await sender.runDue();

    expect(JSON.parse(transport.requests[0]!.body).data).toEqual({
      lines: ["first"],
    });
  });

  // The envelope around an empty string `data` for this type and clock time:
  // {"type":"report.ready","timestamp":"2026-01-01T00:00:00.000Z","data":""}
  const envelopeOverhead = 72;
  const limit = 256 * 1024;

  it("accepts an envelope of exactly 256 KB", () => {
    const { sender } = subscribed();

    sender.send({
      type: "report.ready",
      data: "x".repeat(limit - envelopeOverhead),
    });

    expect(sender.listDeliveries()).toHaveLength(1);
  });

  it.each([
    ["one byte over 256 KB", "x".repeat(limit - envelopeOverhead + 1)],
    ["over 256 KB in bytes but not in characters", "é".repeat(limit / 2)],
  ])("rejects an envelope %s and records nothing", (_, data) => {
    const { sender } = subscribed();

    expect(() => sender.send({ type: "report.ready", data })).toThrow(
      PayloadTooLargeError
    );
    expect(sender.listDeliveries()).toEqual([]);
  });
});

describe("Sender: listing Deliveries", () => {
  it("filters by Endpoint and by status", async () => {
    const { sender } = setup();
    const billing = sender.createEndpoint({
      url: "https://billing.example/hooks",
      eventTypes: ["invoice.paid"],
    });
    const ledger = sender.createEndpoint({
      url: "https://ledger.example/hooks",
      eventTypes: ["invoice.paid"],
    });
    const delivered = sender.send({ type: "invoice.paid", data: {} });
    await sender.runDue();
    const waiting = sender.send({ type: "invoice.paid", data: {} });

    const summarise = (deliveries: { eventId: string; endpointId: string }[]) =>
      deliveries.map((d) => `${d.eventId}->${d.endpointId}`).sort();

    expect(
      summarise(sender.listDeliveries({ endpointId: billing.id }))
    ).toEqual(
      [`${delivered}->${billing.id}`, `${waiting}->${billing.id}`].sort()
    );
    expect(summarise(sender.listDeliveries({ status: "pending" }))).toEqual(
      [`${waiting}->${billing.id}`, `${waiting}->${ledger.id}`].sort()
    );
    expect(
      summarise(
        sender.listDeliveries({ endpointId: ledger.id, status: "succeeded" })
      )
    ).toEqual([`${delivered}->${ledger.id}`]);
  });
});

describe("Sender: Signing secrets", () => {
  it("generates a distinct whsec_ secret of 32 random bytes per Endpoint", () => {
    const { sender } = setup();
    const create = () =>
      sender.createEndpoint({ url: "https://a.example/hooks", eventTypes: [] });

    const [first, second] = [create().secret, create().secret];

    expect(first).toMatch(/^whsec_[A-Za-z0-9+/]+=*$/);
    expect(Buffer.from(first.slice("whsec_".length), "base64")).toHaveLength(
      32
    );
    expect(second).not.toBe(first);
  });

  it("records no Signing secret or request headers in the Delivery history", async () => {
    const { transport, sender } = setup();
    const endpoint = sender.createEndpoint({
      url: "https://subscriber.example/hooks",
      eventTypes: ["invoice.paid"],
    });
    sender.send({ type: "invoice.paid", data: {} });
    await sender.runDue();

    const history = JSON.stringify(sender.listDeliveries());
    const signature = transport.requests[0]!.headers["webhook-signature"]!;

    expect(history).not.toContain(endpoint.secret);
    expect(history).not.toContain(signature.slice("v1,".length));
    expect(history).not.toContain("webhook-");
  });
});
