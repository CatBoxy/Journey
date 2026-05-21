import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  let sql = "SELECT * FROM techniques";
  const args: unknown[] = [];
  if (category) {
    sql += " WHERE category = ?";
    args.push(category);
  }
  sql += " ORDER BY created_at DESC";
  const result = await execute(sql, args);
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, difficulty, status, category } = body;
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const result = await execute(
    "INSERT INTO techniques (name, description, difficulty, status, category) VALUES (?, ?, ?, ?, ?)",
    [name, description || "", difficulty || "beginner", status || "want_to_learn", category || ""]
  );
  const row = await execute("SELECT * FROM techniques WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, description, difficulty, status, category } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  await execute(
    "UPDATE techniques SET name = ?, description = ?, difficulty = ?, status = ?, category = ? WHERE id = ?",
    [name, description || "", difficulty || "beginner", status || "want_to_learn", category || "", id]
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
