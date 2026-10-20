/** An Endpoint URL that isn't HTTPS (plain HTTP is allowed only to localhost). */
export class InvalidEndpointUrlError extends Error {
  override name = "InvalidEndpointUrlError";
}

/** An Event whose serialised envelope is over the 256 KB limit. */
export class PayloadTooLargeError extends Error {
  override name = "PayloadTooLargeError";
}

/** No Endpoint exists with the given id. */
export class EndpointNotFoundError extends Error {
  override name = "EndpointNotFoundError";
}
