import { db } from "@/lib/db";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const techniqueId = searchParams.get("techniqueId");
  if (!techniqueId) {
    return Response.json({ error: "techniqueId is required" }, { status: 400 });
  }
  const client = db();
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const { public_id, url } = await uploadImage(buffer, "journey/techniques");

  const client = db();
  const result = await client.execute({
    sql: "INSERT INTO technique_images (technique_id, filename, original_name, url) VALUES (?, ?, ?, ?)",
    args: [techniqueId, public_id, file.name, url],
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
  const client = db();
  const result = await client.execute({ sql: "SELECT filename FROM technique_images WHERE id = ?", args: [id] });
  if (result.rows.length > 0) {
    await deleteImage(result.rows[0].filename as string);
    await client.execute({ sql: "DELETE FROM technique_images WHERE id = ?", args: [id] });
  }
  return Response.json({ ok: true });
}
