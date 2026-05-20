import { createClient, type Client } from "@libsql/client/http";

let client: Client | null = null;

export function db(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN env vars");
    }
    client = createClient({
      url: url.replace("libsql://", "https://"),
      authToken,
    });
  }
  return client;
}
