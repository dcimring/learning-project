import { randomUUID } from "node:crypto";

/** A random id with a readable type prefix, e.g. `evt_3f1c…`. */
export function newId(prefix: "ep" | "evt" | "dlv" | "att"): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}
