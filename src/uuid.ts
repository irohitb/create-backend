import * as uuidLib from "jsr:@std/uuid";

export type Uuid = string & { readonly __tag: unique symbol };

export function parseUuid(s: string): Uuid | null {
  if (uuidLib.validate(s)) {
    return s as Uuid;
  } else {
    return null;
  }
}
