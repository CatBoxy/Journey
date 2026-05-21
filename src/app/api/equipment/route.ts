import { execute, buildPartialUpdate } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const result = await execute("SELECT * FROM equipment ORDER BY created_at DESC");
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, priority, purchased, url, price } = body;
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const result = await execute(
    "INSERT INTO equipment (name, description, priority, purchased, url, price) VALUES (?, ?, ?, ?, ?, ?)",
    [name, description || "", priority || "medium", purchased ? 1 : 0, url || "", price ?? null]
  );
  const row = await execute("SELECT * FROM equipment WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, description, priority, purchased, url, price } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const update = buildPartialUpdate("equipment", id, {
    name,
    description,
    priority,
    purchased: purchased !== undefined ? (purchased ? 1 : 0) : undefined,
    url,
    price: price !== undefined ? (price ?? null) : undefined,
  });
  if (update) await execute(update.sql, update.args);
  const row = await execute("SELECT * FROM equipment WHERE id = ?", [id]);
  return Response.json(row.rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  await execute("DELETE FROM equipment WHERE id = ?", [id]);
  return Response.json({ ok: true });
}
