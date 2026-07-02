import { execute, buildPartialUpdate } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const result = await execute(
    `SELECT s.*, p.name as product_name
     FROM sales s
     LEFT JOIN products p ON s.product_id = p.id
     ORDER BY s.date DESC`
  );
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { description, amount, currency, product_id, customer, notes, date } = body;
  if (!description || amount == null) {
    return Response.json({ error: "Description and amount are required" }, { status: 400 });
  }
  const result = await execute(
    "INSERT INTO sales (description, amount, currency, product_id, customer, notes, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [description, amount, currency || "ARS", product_id || null, customer || "", notes || "", date || new Date().toISOString().split("T")[0]]
  );
  const row = await execute(
    `SELECT s.*, p.name as product_name
     FROM sales s
     LEFT JOIN products p ON s.product_id = p.id
     WHERE s.id = ?`,
    [result.lastInsertRowid!]
  );
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, description, amount, currency, product_id, customer, notes, date } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const update = buildPartialUpdate("sales", id, {
    description, amount, currency,
    product_id: product_id !== undefined ? (product_id || null) : undefined,
    customer, notes, date,
  });
  if (update) await execute(update.sql, update.args);
  const row = await execute(
    `SELECT s.*, p.name as product_name
     FROM sales s
     LEFT JOIN products p ON s.product_id = p.id
     WHERE s.id = ?`,
    [id]
  );
  return Response.json(row.rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  await execute("DELETE FROM sales WHERE id = ?", [id]);
  return Response.json({ ok: true });
}
