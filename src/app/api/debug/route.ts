export async function GET() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  // Test raw fetch to Turso HTTP API
  const apiUrl = url?.replace("libsql://", "https://");
  let fetchResult = "not attempted";

  if (apiUrl && token) {
    try {
      const res = await fetch(`${apiUrl}/v2/pipeline`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            { type: "execute", stmt: { sql: "SELECT 1 as test" } },
            { type: "close" },
          ],
        }),
      });
      fetchResult = `status=${res.status} body=${await res.text()}`;
    } catch (e: unknown) {
      fetchResult = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return Response.json({
    hasUrl: !!url,
    urlPrefix: url?.substring(0, 15) || "MISSING",
    hasToken: !!token,
    tokenPrefix: token?.substring(0, 10) || "MISSING",
    fetchResult,
  });
}
