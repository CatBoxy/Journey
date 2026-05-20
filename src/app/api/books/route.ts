import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const client = await db();
  const result = await client.execute("SELECT * FROM books ORDER BY created_at DESC");
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, author, description, status } = body;
  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }
  const client = await db();
  const result = await client.execute({
    sql: "INSERT INTO books (title, author, description, status) VALUES (?, ?, ?, ?)",
    args: [title, author || "", description || "", status || "want_to_read"],
  });
  const row = await client.execute({ sql: "SELECT * FROM books WHERE id = ?", args: [result.lastInsertRowid!] });
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, title, author, description, status } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const client = await db();
  await client.execute({
    sql: "UPDATE books SET title = ?, author = ?, description = ?, status = ? WHERE id = ?",
    args: [title, author || "", description || "", status || "want_to_read", id],
  });
  const row = await client.execute({ sql: "SELECT * FROM books WHERE id = ?", args: [id] });
  return Response.json(row.rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const client = await db();
  await client.execute({ sql: "DELETE FROM books WHERE id = ?", args: [id] });
  return Response.json({ ok: true });
}
