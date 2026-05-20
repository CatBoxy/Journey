import getDb from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM techniques ORDER BY created_at DESC").all();
  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, difficulty, status } = body;
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare("INSERT INTO techniques (name, description, difficulty, status) VALUES (?, ?, ?, ?)")
    .run(name, description || "", difficulty || "beginner", status || "want_to_learn");
  const row = db.prepare("SELECT * FROM techniques WHERE id = ?").get(result.lastInsertRowid);
  return Response.json(row, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, description, difficulty, status } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const db = getDb();
  db.prepare(
    "UPDATE techniques SET name = ?, description = ?, difficulty = ?, status = ? WHERE id = ?"
  ).run(name, description || "", difficulty || "beginner", status || "want_to_learn", id);
  const row = db.prepare("SELECT * FROM techniques WHERE id = ?").get(id);
  return Response.json(row);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const db = getDb();
  db.prepare("DELETE FROM techniques WHERE id = ?").run(id);
  return Response.json({ ok: true });
}
