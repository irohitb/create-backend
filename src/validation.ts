import { Result, fail, success } from "./result.ts";

export type Potential<T> = {
  [key in keyof T]: unknown;
};

export async function validateJson<T>(
  pendingInputs: Promise<unknown>,
): Promise<Result<Potential<T>, string>> {
  let inputs: unknown;
  try {
    inputs = await pendingInputs;
  } catch {
    return fail("Request body must be JSON");
  }

  if (!inputs || typeof inputs !== "object") {
    return fail("Request payload must be an object");
  }

  return success(inputs as Potential<T>);
}

export const isArray: (arg: unknown) => arg is unknown[] = Array.isArray;
