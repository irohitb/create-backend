import { Environment, loadEnv } from "../src/env.ts";
import * as postgres from "postgres";
import { corsHeaders } from "../src/cors.ts";
import * as example from "./api/example.ts";
import * as scaffold from "./api/scaffold.ts";
type Split<
  T extends string,
  Separator extends string,
> = T extends `${infer Head}${Separator}${infer Tail}`
  ? [Head, ...Split<Tail, Separator>]
  : [T];

type ExtractPathParams<
  Path extends string,
  Items = Split<Path, "/">,
> = Items extends [infer Head, ...infer Tail]
  ? Head extends `:${infer Name}`
    ? { [K in Name]: string } & ExtractPathParams<Path, Tail>
    : ExtractPathParams<Path, Tail>
  : Record<string | number | symbol, never>;

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS";

const env = await loadEnv(Deno.env);
const pool = new postgres.Pool(env.databaseUrl, env.maxDbConnections, true);

function makeRoute<S extends string>(
  method: HttpMethod,
  pathName: S,
  handler: (
    req: Request,
    matches: ExtractPathParams<S>,
    e: Environment,
    d: postgres.Pool,
  ) => Promise<Response>,
): (r: Request) => null | Promise<Response> {
  return (r: Request) => {
    if (method != r.method) {
      return null;
    }
    const pattern = new URLPattern({ pathname: pathName });
    const match = pattern.exec(r.url);
    if (match) {
      return handler(
        r,
        match.pathname.groups as ExtractPathParams<S>,
        env,
        pool,
      );
    }
    return null;
  };
}

const argPort = +(Deno.env.get("PORT") ?? "") || 8000;

function allowCorsOptionsHandler(
  _req: Request,
  _matches: unknown,
  _env: Environment,

  _dbPool: postgres.Pool,
): Promise<Response> {
  return Promise.resolve(new Response("ok", { headers: corsHeaders }));
}

const routes = [
  makeRoute("OPTIONS", "/phonemize", allowCorsOptionsHandler),
  makeRoute("GET", "/hello-world", example.handleGetRequest),
  makeRoute("OPTIONS", "/scaffold-project", allowCorsOptionsHandler),
  makeRoute("POST", "/scaffold-project", scaffold.handleScaffoldRequest),
];

Deno.serve({ port: argPort }, (req): Promise<Response> => {
  for (const route of routes) {
    const didMatch = route(req);
    if (didMatch) {
      return didMatch;
    }
  }

  return Promise.resolve(new Response(null, { status: 404 }));
});
