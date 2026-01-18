import { Environment } from "../../src/env.ts";
import * as postgres from "postgres";
import { Result, success } from "../../src/result.ts";
import { HttpErrorTuple, httpFailure } from "../../src/http.ts";
import { handleJsonResult } from "../../src/json.ts";
import { validateJson } from "../../src/validation.ts";

type ScaffoldProjectRequest = {
  techStack: string;
  aboutProject: string;
};

type ScaffoldProjectResponse = {
  message: string;
  techStack: string;
  aboutProject: string;
};

export async function scaffoldProject(
  req: Request,
  _env: Environment,
  _db: postgres.Pool,
): Promise<Result<ScaffoldProjectResponse, HttpErrorTuple>> {
  const parseResult = await validateJson<ScaffoldProjectRequest>(req.json());

  if (parseResult.type === "FAILURE") {
    return httpFailure(400, parseResult.error);
  }

  const { techStack, aboutProject } = parseResult.data;

  if (typeof techStack !== "string" || techStack.trim().length === 0) {
    return httpFailure(
      400,
      "techStack is required and must be a non-empty string",
    );
  }

  if (typeof aboutProject !== "string" || aboutProject.trim().length === 0) {
    return httpFailure(
      400,
      "aboutProject is required and must be a non-empty string",
    );
  }

  const response: ScaffoldProjectResponse = {
    message: "Project scaffolding initiated successfully",
    techStack: techStack.trim(),
    aboutProject: aboutProject.trim(),
  };

  return success(response);
}

export async function handleScaffoldRequest(
  req: Request,
  _matches: unknown,
  env: Environment,
  db: postgres.Pool,
): Promise<Response> {
  return await handleJsonResult(scaffoldProject(req, env, db));
}
