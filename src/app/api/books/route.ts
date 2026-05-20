import getDb from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM books ORDER BY created_at DESC").all();
  return Response.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, author, description, status } = body;
  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare("INSERT INTO books (title, author, description, status) VALUES (?, ?, ?, ?)")
    .run(title, author || "", description || "", status || "want_to_read");
  const row = db.prepare("SELECT * FROM books WHERE id = ?").get(result.lastInsertRowid);
  return Response.json(row, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, title, author, description, status } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const db = getDb();
  db.prepare(
    "UPDATE books SET title = ?, author = ?, description = ?, status = ? WHERE id = ?"
  ).run(title, author || "", description || "", status || "want_to_read", id);
  const row = db.prepare("SELECT * FROM books WHERE id = ?").get(id);
  return Response.json(row);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const db = getDb();
  db.prepare("DELETE FROM books WHERE id = ?").run(id);
  return Response.json({ ok: true });
}
