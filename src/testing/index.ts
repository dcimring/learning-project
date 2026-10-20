// Test doubles for the Sender: an in-memory Store, a fake Clock and a
// recording fake Transport. For tests only.
export { createFakeClock, type FakeClock } from "./lib/fake-clock.js";
export {
  createFakeTransport,
  type FakeTransport,
} from "./lib/fake-transport.js";
export { createInMemoryStore } from "./lib/memory-store.js";
