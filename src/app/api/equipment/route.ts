import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const client = db();
  const result = await client.execute("SELECT * FROM equipment ORDER BY created_at DESC");
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, priority, purchased, url } = body;
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const client = db();
  const result = await client.execute({
    sql: "INSERT INTO equipment (name, description, priority, purchased, url) VALUES (?, ?, ?, ?, ?)",
    args: [name, description || "", priority || "medium", purchased ? 1 : 0, url || ""],
  });
  const row = await client.execute({ sql: "SELECT * FROM equipment WHERE id = ?", args: [result.lastInsertRowid!] });
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, description, priority, purchased, url } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const client = db();
  await client.execute({
    sql: "UPDATE equipment SET name = ?, description = ?, priority = ?, purchased = ?, url = ? WHERE id = ?",
    args: [name, description || "", priority || "medium", purchased ? 1 : 0, url || "", id],
  });
  const row = await client.execute({ sql: "SELECT * FROM equipment WHERE id = ?", args: [id] });
  return Response.json(row.rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const client = db();
  await client.execute({ sql: "DELETE FROM equipment WHERE id = ?", args: [id] });
  return Response.json({ ok: true });
}
