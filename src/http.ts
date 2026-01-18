import { corsHeaders } from "./cors.ts";
import { fail, Result } from "./result.ts";

export type HttpErrorTuple = {
  code: number;
  message: string;
};

export function httpFailure<S>(
  code: number,
  message: string,
): Result<S, HttpErrorTuple> {
  return fail({ code, message });
}

export function errorTupleToResponse(t: HttpErrorTuple): Response {
  return new Response(t.message, {
    headers: corsHeaders,
    status: t.code,
  });
}
