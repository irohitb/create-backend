import { Environment } from "../../src/env.ts";
import * as postgres from "postgres";
import { validateJson } from "../../src/validation.ts";
import { generateProjectStructure } from "../../src/ai-service.ts";
import { createZipFromProject } from "../../src/file-system.ts";
import { Result, success } from "../../src/result.ts";
import {
  handleZipReponse,
  HttpErrorTuple,
  httpFailure,
} from "../../src/http.ts";

type ScaffoldProjectRequest = {
  techStack: string;
  aboutProject: string;
};

const scaffoldProject = async (
  req: Request,
  env: Environment,
): Promise<Result<Uint8Array, HttpErrorTuple>> => {
  const parseResult = await validateJson<ScaffoldProjectRequest>(req.json());

  if (parseResult.type === "FAILURE") {
    return httpFailure(400, parseResult.error);
  }

  const { techStack, aboutProject } = parseResult.data;

  // Validate inputs
  if (typeof techStack !== "string" || techStack.trim().length === 0) {
    return httpFailure(
      400,
      "techStack is required and should be o type string",
    );
  }

  if (typeof aboutProject !== "string" || aboutProject.trim().length === 0) {
    return httpFailure(
      400,
      "about project is required and should be of type string",
    );
  }

  // Generate project structure using AI
  const projectResult = await generateProjectStructure(
    techStack.trim(),
    aboutProject.trim(),
    env,
  );

  if (projectResult.type === "FAILURE") {
    return httpFailure(500, projectResult.error);
  }

  const zipResult = await createZipFromProject(projectResult.data);

  if (zipResult.type === "FAILURE") {
    return httpFailure(500, zipResult.error);
  }

  return success(zipResult.data);
};

export async function handleScaffoldRequest(
  req: Request,
  _matches: unknown,
  env: Environment,
  // _db: postgres.Pool,
): Promise<Response> {
  return await handleZipReponse(scaffoldProject(req, env));
}
