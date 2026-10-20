import { describe, expect, it } from "vitest";
import { verify } from "webhook-delivery/receiver";
import { createSender } from "webhook-delivery/sender";
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
