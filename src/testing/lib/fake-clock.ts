import type { Clock } from "../../shared/clock.js";

export interface FakeClock extends Clock {
  /** Moves time forward; nothing happens until the code under test asks. */
  advance(ms: number): void;
}

export function createFakeClock(start: Date): FakeClock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(ms) {
      current += ms;
    },
  };
}
