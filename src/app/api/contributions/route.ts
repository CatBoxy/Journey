import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const result = await execute("SELECT * FROM contributions ORDER BY date DESC");
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { amount, currency, date, description, fx_rate } = body;
  if (amount == null) {
    return Response.json({ error: "Amount is required" }, { status: 400 });
  }
  const result = await execute(
    "INSERT INTO contributions (amount, currency, date, description, fx_rate) VALUES (?, ?, ?, ?, ?)",
    [amount, currency || "ARS", date || new Date().toISOString().split("T")[0], description || "", fx_rate ?? null]
  );
  const row = await execute("SELECT * FROM contributions WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}
