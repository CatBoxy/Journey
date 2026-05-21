import { execute, buildPartialUpdate } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  let sql = "SELECT * FROM projects";
  const args: unknown[] = [];
  if (status) {
    sql += " WHERE status = ?";
    args.push(status);
  }
  sql += " ORDER BY created_at DESC";
  const result = await execute(sql, args);
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, status } = body;
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const result = await execute(
    "INSERT INTO projects (name, description, status) VALUES (?, ?, ?)",
    [name, description || "", status || "planned"]
  );
  const row = await execute("SELECT * FROM projects WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, description, status } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const update = buildPartialUpdate("projects", id, { name, description, status });
  if (update) await execute(update.sql, update.args);
  const row = await execute("SELECT * FROM projects WHERE id = ?", [id]);
  return Response.json(row.rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  // Delete Cloudinary images before cascade
  const entryImages = await execute(
    `SELECT pei.filename FROM project_entry_images pei
     JOIN project_entries pe ON pe.id = pei.entry_id
     WHERE pe.project_id = ?`,
    [id]
  );
  const projectImages = await execute(
    "SELECT filename FROM project_images WHERE project_id = ?",
    [id]
  );
  const { deleteImage } = await import("@/lib/cloudinary");
  for (const img of [...entryImages.rows, ...projectImages.rows]) {
    try { await deleteImage(img.filename as string); } catch { /* already gone */ }
  }
  await execute("DELETE FROM projects WHERE id = ?", [id]);
  return Response.json({ ok: true });
}
