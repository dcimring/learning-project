import { createHmac } from "node:crypto";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  InvalidSignatureError,
  MalformedHeadersError,
  MalformedPayloadError,
  StaleTimestampError,
  verify,
  type Event,
  WebhookVerificationError,
} from "webhook-delivery/receiver";

// Fixed vector shared by the Standard Webhooks reference libraries
// (go/webhook_test.go TestWebhookSign, csharp WebhookTest, java TestScenario).
const vector = {
  secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestamp: 1614265330,
  body: `{"test": 2432232314}`,
  signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};

const atSeconds = (seconds: number) => ({ now: () => new Date(seconds * 1000) });

function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

/** Signs with node:crypto directly, independently of the package. */
function signedHeaders(input: { id: string; timestamp: number; body: string; secret: string }) {
  const key = Buffer.from(input.secret.slice("whsec_".length), "base64");
  const signature = createHmac("sha256", key)
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest("base64");
  return {
    "webhook-id": input.id,
    "webhook-timestamp": String(input.timestamp),
    "webhook-signature": `v1,${signature}`,
  };
}

const vectorHeaders = () => ({
  "webhook-id": vector.id,
  "webhook-timestamp": String(vector.timestamp),
  "webhook-signature": vector.signature,
});

describe("verify: Standard Webhooks test vectors", () => {
  it("accepts the published vector and returns the parsed body", () => {
    const result = verify({
      headers: vectorHeaders(),
      rawBody: vector.body,
      secrets: [vector.secret],
      clock: atSeconds(vector.timestamp),
    });

    expect(result).toEqual({ test: 2432232314 });
  });
});

describe("verify: signatures", () => {
  it("rejects a body that differs from the signed one", () => {
    const error = thrownBy(() =>
      verify({
        headers: vectorHeaders(),
        rawBody: `{"test": 2432232315}`,
        secrets: [vector.secret],
        clock: atSeconds(vector.timestamp),
      }),
    );

    expect(error).toBeInstanceOf(InvalidSignatureError);
    expect(error).toBeInstanceOf(WebhookVerificationError);
  });

  // Negative cases from the reference libraries' suites.
  it.each([
    ["a garbage signature", "v1,dawfeoifkpqwoekfpqoekf"],
    ["a truncated signature", vector.signature.slice(0, 8)],
    ["an empty signature", "v1,"],
    ["the right signature under an unknown version", vector.signature.replace("v1,", "v2,")],
  ])("rejects %s", (_, signature) => {
    const error = thrownBy(() =>
      verify({
        headers: { ...vectorHeaders(), "webhook-signature": signature },
        rawBody: vector.body,
        secrets: [vector.secret],
        clock: atSeconds(vector.timestamp),
      }),
    );

    expect(error).toBeInstanceOf(InvalidSignatureError);
  });

  it("passes when any signature in the header matches any Signing secret", () => {
    const otherSecret = "whsec_c2VjcmV0LW9mLWFub3RoZXItZW5kcG9pbnQ=";
    const unrelatedSignature = "v1,Ceo5qEr07ixe2NLpvHk3FH9bwy/WavXrAFQ/9tdO6mc=";

    const result = verify({
      headers: {
        ...vectorHeaders(),
        "webhook-signature": `${unrelatedSignature} ${vector.signature}`,
      },
      rawBody: vector.body,
      secrets: [otherSecret, vector.secret],
      clock: atSeconds(vector.timestamp),
    });

    expect(result).toEqual({ test: 2432232314 });
  });
});

describe("verify: timestamp window", () => {
  const verifyVectorAt = (clockSeconds: number) =>
    verify({
      headers: vectorHeaders(),
      rawBody: vector.body,
      secrets: [vector.secret],
      clock: atSeconds(clockSeconds),
    });

  it.each([
    ["more than 5 minutes old", vector.timestamp + 301],
    ["more than 5 minutes in the future", vector.timestamp - 301],
  ])("rejects a timestamp %s", (_, clockSeconds) => {
    const error = thrownBy(() => verifyVectorAt(clockSeconds));

    expect(error).toBeInstanceOf(StaleTimestampError);
    expect(error).toBeInstanceOf(WebhookVerificationError);
  });

  it.each([
    ["5 minutes old", vector.timestamp + 300],
    ["5 minutes in the future", vector.timestamp - 300],
  ])("accepts a timestamp exactly %s", (_, clockSeconds) => {
    expect(verifyVectorAt(clockSeconds)).toEqual({ test: 2432232314 });
  });
});

describe("verify: malformed headers", () => {
  const verifyWithHeaders = (headers: Record<string, string | string[] | undefined>) =>
    verify({
      headers,
      rawBody: vector.body,
      secrets: [vector.secret],
      clock: atSeconds(vector.timestamp),
    });

  it.each(["webhook-id", "webhook-timestamp", "webhook-signature"])(
    "rejects a webhook missing %s",
    (name) => {
      const error = thrownBy(() => verifyWithHeaders({ ...vectorHeaders(), [name]: undefined }));

      expect(error).toBeInstanceOf(MalformedHeadersError);
      expect(error).toBeInstanceOf(WebhookVerificationError);
    },
  );

  it.each(["hello", "", "1614265330.5", "1e9", "01614265330"])(
    "rejects a webhook-timestamp of %j",
    (timestamp) => {
      const error = thrownBy(() =>
        verifyWithHeaders({ ...vectorHeaders(), "webhook-timestamp": timestamp }),
      );

      expect(error).toBeInstanceOf(MalformedHeadersError);
    },
  );

  it("rejects a repeated webhook-id header", () => {
    const error = thrownBy(() =>
      verifyWithHeaders({ ...vectorHeaders(), "webhook-id": [vector.id, vector.id] }),
    );

    expect(error).toBeInstanceOf(MalformedHeadersError);
  });
});

describe("verify: header input", () => {
  it("accepts a Web-standard Headers object", () => {
    const result = verify({
      headers: new Headers(vectorHeaders()),
      rawBody: vector.body,
      secrets: [vector.secret],
      clock: atSeconds(vector.timestamp),
    });

    expect(result).toEqual({ test: 2432232314 });
  });

  it("matches header names case-insensitively in a plain object", () => {
    const result = verify({
      headers: {
        "Webhook-Id": vector.id,
        "WEBHOOK-TIMESTAMP": String(vector.timestamp),
        "Webhook-Signature": vector.signature,
      },
      rawBody: vector.body,
      secrets: [vector.secret],
      clock: atSeconds(vector.timestamp),
    });

    expect(result).toEqual({ test: 2432232314 });
  });
});

describe("verify: the Event envelope", () => {
  it("returns the parsed { type, timestamp, data } envelope", () => {
    const id = "evt_01JABCDEF";
    const timestamp = 1700000000;
    const body = JSON.stringify({
      type: "invoice.paid",
      timestamp: "2023-11-14T22:13:20.000Z",
      data: { invoiceId: "inv_42", amount: 1999 },
    });

    const event = verify<{ invoiceId: string; amount: number }>({
      headers: signedHeaders({ id, timestamp, body, secret: vector.secret }),
      rawBody: new TextEncoder().encode(body),
      secrets: [vector.secret],
      clock: atSeconds(timestamp),
    });

    expect(event).toEqual({
      type: "invoice.paid",
      timestamp: "2023-11-14T22:13:20.000Z",
      data: { invoiceId: "inv_42", amount: 1999 },
    });
    expectTypeOf(event).toEqualTypeOf<Event<{ invoiceId: string; amount: number }>>();
  });

  it("rejects a correctly signed body that isn't JSON", () => {
    const body = "not json";
    const timestamp = 1700000000;

    const error = thrownBy(() =>
      verify({
        headers: signedHeaders({ id: "evt_01JABCDEF", timestamp, body, secret: vector.secret }),
        rawBody: body,
        secrets: [vector.secret],
        clock: atSeconds(timestamp),
      }),
    );

    expect(error).toBeInstanceOf(MalformedPayloadError);
    expect(error).toBeInstanceOf(WebhookVerificationError);
  });
});

describe("verify: Signing secret configuration", () => {
  it.each([
    ["an empty list of secrets", []],
    ["an empty whsec_ secret", ["whsec_"]],
    ["an empty secret", [""]],
    ["a secret that isn't base64", ["whsec_MfKQ9r8GKYqrTwjUPD8I*PZIo2LaLaSw"]],
  ])("throws a TypeError, not a verification error, for %s", (_, secrets) => {
    const error = thrownBy(() =>
      verify({
        headers: vectorHeaders(),
        rawBody: vector.body,
        secrets,
        clock: atSeconds(vector.timestamp),
      }),
    );

    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(WebhookVerificationError);
  });

  it("accepts a raw base64 secret without the whsec_ prefix", () => {
    const result = verify({
      headers: vectorHeaders(),
      rawBody: vector.body,
      secrets: ["MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"],
      clock: atSeconds(vector.timestamp),
    });

    expect(result).toEqual({ test: 2432232314 });
  });
});
