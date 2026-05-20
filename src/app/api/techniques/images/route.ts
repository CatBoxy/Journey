import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const techniqueId = searchParams.get("techniqueId");
  if (!techniqueId) {
    return Response.json({ error: "techniqueId is required" }, { status: 400 });
  }
  const client = await db();
  const result = await client.execute({
    sql: "SELECT * FROM technique_images WHERE technique_id = ? ORDER BY created_at DESC",
    args: [techniqueId],
  });
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const techniqueId = formData.get("techniqueId") as string;
  const file = formData.get("file") as File;
  if (!techniqueId || !file) {
    return Response.json({ error: "techniqueId and file are required" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name) || ".jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  const client = await db();
  const result = await client.execute({
    sql: "INSERT INTO technique_images (technique_id, filename, original_name) VALUES (?, ?, ?)",
    args: [techniqueId, filename, file.name],
  });
  const row = await client.execute({ sql: "SELECT * FROM technique_images WHERE id = ?", args: [result.lastInsertRowid!] });
  return Response.json(row.rows[0], { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  const client = await db();
  const result = await client.execute({ sql: "SELECT filename FROM technique_images WHERE id = ?", args: [id] });
  if (result.rows.length > 0) {
    await client.execute({ sql: "DELETE FROM technique_images WHERE id = ?", args: [id] });
    try {
      await unlink(path.join(UPLOAD_DIR, result.rows[0].filename as string));
    } catch {
      // file may already be gone
    }
  }
  return Response.json({ ok: true });
}
