import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { getDatabaseEnv } from "@/shared/config/env";

let pool: Pool | null = null;

export const getPostgresPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseEnv().databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return pool;
};

export const query = async <T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> => {
  const result = await getPostgresPool().query<T>(text, values);

  return result.rows;
};

export const withTransaction = async <T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await getPostgresPool().connect();

  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");

    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
