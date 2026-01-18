
import { Result } from "../src/result.ts";
import { HttpErrorTuple, errorTupleToResponse } from "../src/http.ts";
import { corsHeaders } from "./cors.ts";

export async function handleJsonResult(
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