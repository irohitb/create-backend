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

export async function handleJsonResponse(
  handlerResponse: Promise<Result<unknown, HttpErrorTuple>>,
): Promise<Response> {
  const result = await handlerResponse;
  switch (result.type) {
    case "FAILURE":
      return errorTupleToResponse(result.error);
    case "SUCCESS":
      return new Response(JSON.stringify(result.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
  }
}

export async function handleZipReponse(
  handlerResponse: Promise<Result<unknown, HttpErrorTuple>>,
): Promise<Response> {
  const result = await handlerResponse;
  switch (result.type) {
    case "FAILURE":
      return errorTupleToResponse(result.error);
    case "SUCCESS":
      return new Response(JSON.stringify(result.data), {
        headers: { ...corsHeaders, "Content-Type": "application/gzip" },
        status: 200,
      });
  }
}
