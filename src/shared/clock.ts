/** The source of "now", injected everywhere so tests move time without sleeping. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
