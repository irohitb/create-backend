import { fail } from "https://deno.land/std@0.219.0/assert/mod.ts";
import { Result } from "../src/result.ts";

export function assertIsFailure<T, U>(
  v: Result<T, U>,
  s?: string,
): asserts v is Result<never, U> & { type: "FAILURE" } {
  if (v.type == "SUCCESS") {
    fail('expected `.type` to be "FAILURE". ' + (s ?? ""));
  }
}

export function assertIsSuccess<T, U>(
  v: Result<T, U>,
  s?: string,
): asserts v is Result<T, never> & { type: "SUCCESS" } {
  if (v.type == "FAILURE") {
    fail('expected `.type` to be "SUCCESS". ' + (s ?? ""));
  }
}
