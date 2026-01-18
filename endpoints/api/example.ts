import { Environment } from "../../src/env.ts";
import * as postgres from "postgres";
import { Result, success } from "../../src/result.ts";
import { HttpErrorTuple, httpFailure } from "../../src/http.ts";
import { handleJsonResult } from "../../src/json.ts";
import { validateJson } from "../../src/validation.ts";


type SamplePostRequest = {
  word: string
}

// _req and _env here are for illustration purpose
export function getHelloWorldResponse(_req: Request, _env: Environment): Promise<Result<string, HttpErrorTuple>> {
  return Promise.resolve(success("Hello world"))
}

export async function handleGetRequest(
  req: Request,
  _matches: unknown,
  env: Environment,
  _db: postgres.Pool,
): Promise<Response> {
    return await handleJsonResult(
      getHelloWorldResponse(req, env, ),
    );
  
}


export async function manageSamplePostRequest(req: Request):  Promise<Result<string, HttpErrorTuple>> {
  const parseResult = await validateJson<SamplePostRequest>(req.json());
  if (parseResult.type === "FAILURE") {
    return httpFailure(400, parseResult.error);
  }
  const word = parseResult.data.word
  if (typeof word !== 'string') {
    return httpFailure(400, 'word should be of type string')
  }

  return success(word)
}

export async function handlePostRequest(
  req: Request,
  _matches: unknown,
  env: Environment,
  _db: postgres.Pool,
): Promise<Response> {
    return await handleJsonResult(
      getHelloWorldResponse(req, env, ),
    );
  
}