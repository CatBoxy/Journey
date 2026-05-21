const getConfig = () => {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  return {
    apiUrl: `${url.replace("libsql://", "https://")}/v2/pipeline`,
    token,
  };
};

interface Row {
  [key: string]: unknown;
}

interface ExecuteResult {
  rows: Row[];
  lastInsertRowid: bigint | undefined;
}

export async function execute(sql: string, args: unknown[] = []): Promise<ExecuteResult> {
  const { apiUrl, token } = getConfig();
  const stmtArgs = args.map((a) => {
    if (a === null || a === undefined) return { type: "null", value: null };
    if (typeof a === "number") return Number.isInteger(a) ? { type: "integer", value: String(a) } : { type: "float", value: a };
    if (typeof a === "bigint") return { type: "integer", value: String(a) };
    return { type: "text", value: String(a) };
  });

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql, args: stmtArgs } },
        { type: "close" },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Turso error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const result = data.results[0];
  if (result.type === "error") {
    throw new Error(`SQL error: ${result.error.message}`);
  }

  const { cols, rows: rawRows, last_insert_rowid } = result.response.result;
  const rows: Row[] = rawRows.map((row: Array<{ type: string; value: string | null }>) => {
    const obj: Row = {};
    cols.forEach((col: { name: string }, i: number) => {
      const cell = row[i];
      if (cell.type === "null") obj[col.name] = null;
      else if (cell.type === "integer") obj[col.name] = Number(cell.value);
      else if (cell.type === "float") obj[col.name] = Number(cell.value);
      else obj[col.name] = cell.value;
    });
    return obj;
  });

  return {
    rows,
    lastInsertRowid: last_insert_rowid != null ? BigInt(last_insert_rowid) : undefined,
  };
}

/**
 * Build a partial UPDATE query from only the fields that are explicitly provided.
 * Fields with value `undefined` are skipped (not sent = not changed).
 * Fields with value `null`, `""`, or any other value are included (explicit set).
 */
export function buildPartialUpdate(
  table: string,
  id: number,
  fields: Record<string, unknown>
): { sql: string; args: unknown[] } | null {
  const setClauses: string[] = [];
  const args: unknown[] = [];
  for (const [col, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    setClauses.push(`${col} = ?`);
    args.push(val);
  }
  if (setClauses.length === 0) return null;
  args.push(id);
  return { sql: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = ?`, args };
}
