import { execute } from "@/lib/db";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }
  const entriesResult = await execute(
    "SELECT * FROM project_entries WHERE project_id = ? ORDER BY created_at DESC",
    [projectId]
  );

  const entries = [];
  for (const entry of entriesResult.rows) {
    const images = await execute(
      "SELECT * FROM project_entry_images WHERE entry_id = ? ORDER BY created_at ASC",
      [entry.id as number]
    );
    entries.push({ ...entry, images: images.rows });
  }

  return Response.json(entries);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const projectId = formData.get("projectId") as string;
  const text = (formData.get("text") as string) || "";
  const files = formData.getAll("files") as File[];

  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const result = await execute(
    "INSERT INTO project_entries (project_id, text) VALUES (?, ?)",
    [projectId, text]
  );
  const entryId = result.lastInsertRowid!;

  for (const file of files) {
    if (file.size === 0) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { public_id, url } = await uploadImage(buffer, "journey/project-entries");
    await execute(
      "INSERT INTO project_entry_images (entry_id, filename, original_name, url) VALUES (?, ?, ?, ?)",
      [entryId, public_id, file.name, url]
    );
  }

  return Response.json({ id: entryId }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const images = await execute("SELECT filename FROM project_entry_images WHERE entry_id = ?", [id]);
  for (const img of images.rows) {
    try { await deleteImage(img.filename as string); } catch { /* already gone */ }
  }

  await execute("DELETE FROM project_entries WHERE id = ?", [id]);
  return Response.json({ ok: true });
}
