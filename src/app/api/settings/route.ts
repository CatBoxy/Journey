import { execute } from "@/lib/db";
import { NextRequest } from "next/server";
import { QUOTE_SETTING_KEYS } from "@/lib/workshop";

const VALID_KEYS: string[] = [
  "default_currency",
  "current_fx_rate",
  "hourly_labor_rate",
  "transaction_fee_pct",
  "packaging_cost_per_sale",
  "shipping_cost_per_sale",
  ...QUOTE_SETTING_KEYS,
];

export async function GET() {
  const result = await execute("SELECT key, value FROM settings ORDER BY key");
  const settings: Record<string, string> = {};
  for (const row of result.rows) {
    settings[row.key as string] = row.value as string;
  }
  return Response.json(settings);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { key, value } = body;
  if (!key || value == null) {
    return Response.json({ error: "key and value are required" }, { status: 400 });
  }
  if (!VALID_KEYS.includes(key)) {
    return Response.json({ error: `Invalid key. Valid keys: ${VALID_KEYS.join(", ")}` }, { status: 400 });
  }
  await execute(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, String(value)]
  );
  return Response.json({ [key]: String(value) });
}
