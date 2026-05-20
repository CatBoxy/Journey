import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const result = await execute("SELECT * FROM books ORDER BY created_at DESC");
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, author, description, status } = body;
  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }
  const result = await execute(
    "INSERT INTO books (title, author, description, status) VALUES (?, ?, ?, ?)",
    [title, author || "", description || "", status || "want_to_read"]
  );
  const row = await execute("SELECT * FROM books WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, title, author, description, status } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  await execute(
    "UPDATE books SET title = ?, author = ?, description = ?, status = ? WHERE id = ?",
    [title, author || "", description || "", status || "want_to_read", id]
  );
  const row = await execute("SELECT * FROM books WHERE id = ?", [id]);
  return Response.json(row.rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  await execute("DELETE FROM books WHERE id = ?", [id]);
  return Response.json({ ok: true });
}
