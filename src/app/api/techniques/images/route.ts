import getDb from "@/lib/db";
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
  const db = getDb();
  const images = db
    .prepare("SELECT * FROM technique_images WHERE technique_id = ? ORDER BY created_at DESC")
    .all(techniqueId);
  return Response.json(images);
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

  const db = getDb();
  const result = db
    .prepare("INSERT INTO technique_images (technique_id, filename, original_name) VALUES (?, ?, ?)")
    .run(techniqueId, filename, file.name);
  const row = db.prepare("SELECT * FROM technique_images WHERE id = ?").get(result.lastInsertRowid);
  return Response.json(row, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  const db = getDb();
  const image = db.prepare("SELECT * FROM technique_images WHERE id = ?").get(id) as
    | { filename: string }
    | undefined;
  if (image) {
    db.prepare("DELETE FROM technique_images WHERE id = ?").run(id);
    try {
      await unlink(path.join(UPLOAD_DIR, image.filename));
    } catch {
      // file may already be gone
    }
  }
  return Response.json({ ok: true });
}
