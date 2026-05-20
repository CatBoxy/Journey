import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const result = await execute("SELECT * FROM techniques ORDER BY created_at DESC");
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, difficulty, status } = body;
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const result = await execute(
    "INSERT INTO techniques (name, description, difficulty, status) VALUES (?, ?, ?, ?)",
    [name, description || "", difficulty || "beginner", status || "want_to_learn"]
  );
  const row = await execute("SELECT * FROM techniques WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, description, difficulty, status } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  await execute(
    "UPDATE techniques SET name = ?, description = ?, difficulty = ?, status = ? WHERE id = ?",
    [name, description || "", difficulty || "beginner", status || "want_to_learn", id]
  );
  const row = await execute("SELECT * FROM techniques WHERE id = ?", [id]);
  return Response.json(row.rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  await execute("DELETE FROM techniques WHERE id = ?", [id]);
  return Response.json({ ok: true });
}
