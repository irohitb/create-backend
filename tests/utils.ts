import * as postgres from "postgres";
import { loadTestEnv } from "../src/env.ts"

export const testEnv = loadTestEnv();

export async function makeAppDbClient() {
  const c = new postgres.Client(testEnv.databaseUrl);
  await c.connect();
  return c;
}
