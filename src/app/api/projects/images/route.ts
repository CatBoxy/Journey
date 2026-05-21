import { execute } from "@/lib/db";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }
  const result = await execute(
    "SELECT * FROM project_images WHERE project_id = ? ORDER BY created_at DESC",
    [projectId]
  );
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const projectId = formData.get("projectId") as string;
  const file = formData.get("file") as File;
  if (!projectId || !file) {
    return Response.json({ error: "projectId and file are required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { public_id, url } = await uploadImage(buffer, "journey/projects");

  const result = await execute(
    "INSERT INTO project_images (project_id, filename, original_name, url) VALUES (?, ?, ?, ?)",
    [projectId, public_id, file.name, url]
  );
  const row = await execute("SELECT * FROM project_images WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  const result = await execute("SELECT filename FROM project_images WHERE id = ?", [id]);
  if (result.rows.length > 0) {
    await deleteImage(result.rows[0].filename as string);
    await execute("DELETE FROM project_images WHERE id = ?", [id]);
  }
  return Response.json({ ok: true });
}
