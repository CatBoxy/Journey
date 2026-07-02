import { execute, buildPartialUpdate } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  let sql = "SELECT * FROM expenses";
  const args: unknown[] = [];
  if (category) {
    sql += " WHERE category = ?";
    args.push(category);
  }
  sql += " ORDER BY date DESC";
  const result = await execute(sql, args);
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { description, amount, currency, category, date, notes } = body;
  if (!description || amount == null) {
    return Response.json({ error: "Description and amount are required" }, { status: 400 });
  }
  const result = await execute(
    "INSERT INTO expenses (description, amount, currency, category, date, notes) VALUES (?, ?, ?, ?, ?, ?)",
    [description, amount, currency || "ARS", category || "other", date || new Date().toISOString().split("T")[0], notes || ""]
  );
  const row = await execute("SELECT * FROM expenses WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, description, amount, currency, category, date, notes } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const update = buildPartialUpdate("expenses", id, { description, amount, currency, category, date, notes });
  if (update) await execute(update.sql, update.args);
  const row = await execute("SELECT * FROM expenses WHERE id = ?", [id]);
  return Response.json(row.rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  await execute("DELETE FROM expenses WHERE id = ?", [id]);
  return Response.json({ ok: true });
}
