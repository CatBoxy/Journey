import getDb from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM equipment ORDER BY created_at DESC").all();
  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, priority, purchased, url } = body;
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare("INSERT INTO equipment (name, description, priority, purchased, url) VALUES (?, ?, ?, ?, ?)")
    .run(name, description || "", priority || "medium", purchased ? 1 : 0, url || "");
  const row = db.prepare("SELECT * FROM equipment WHERE id = ?").get(result.lastInsertRowid);
  return Response.json(row, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, description, priority, purchased, url } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const db = getDb();
  db.prepare(
    "UPDATE equipment SET name = ?, description = ?, priority = ?, purchased = ?, url = ? WHERE id = ?"
  ).run(name, description || "", priority || "medium", purchased ? 1 : 0, url || "", id);
  const row = db.prepare("SELECT * FROM equipment WHERE id = ?").get(id);
  return Response.json(row);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const db = getDb();
  db.prepare("DELETE FROM equipment WHERE id = ?").run(id);
  return Response.json({ ok: true });
}
