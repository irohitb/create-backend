import { load } from "https://deno.land/std/dotenv/mod.ts";
import { userInfo } from "node:os";

export type Environment = {
  databaseUrl: string | undefined;
  maxDbConnections: number;
  environment: "test" | "prod";
};



export const loadEnv = async (systemEnv: Deno.Env): Promise<Environment> => {
  if (systemEnv.get("ENV_FROM_FILE")) {
    const fileEnv = await load();
    for (const key in fileEnv) {
      systemEnv.set(key, fileEnv[key]);
    }
  }

  const maxDbConnections = +(systemEnv.get("MAX_DB_CONNECTIONS") || "");

  if (isNaN(maxDbConnections)) {
    throw new Error("MAX_DB_CONNECTIONS must be a number");
  }

  return {
    maxDbConnections,
    databaseUrl: systemEnv.get("DATABASE_URL"),
    environment: "prod",
  };
};

export function loadTestEnv(): Environment {
  return {
    maxDbConnections: 2,
    databaseUrl: `postgresql://${userInfo().username}@127.0.0.1:5432/test_postgres`,
    environment: "test",
  };
}
