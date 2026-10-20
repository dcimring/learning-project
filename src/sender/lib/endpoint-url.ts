import { InvalidEndpointUrlError } from "./errors.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Signed payloads must never travel in cleartext, so Endpoints need HTTPS;
 * plain HTTP is allowed only to localhost for local development.
 */
export function assertEndpointUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new InvalidEndpointUrlError(`Not a URL: ${url}`);
  }
  const allowed =
    parsed.protocol === "https:" ||
    (parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname));
  if (!allowed) {
    throw new InvalidEndpointUrlError(
      `Endpoint URLs must be HTTPS (or HTTP to localhost): ${url}`
    );
  }
}
