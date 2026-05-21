import { execute } from "@/lib/db";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const entryId = formData.get("entryId") as string;
  const files = formData.getAll("files") as File[];
  if (!entryId || files.length === 0) {
    return Response.json({ error: "entryId and files are required" }, { status: 400 });
  }

  const uploaded = [];
  for (const file of files) {
    if (file.size === 0) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { public_id, url } = await uploadImage(buffer, "journey/project-entries");
    await execute(
      "INSERT INTO project_entry_images (entry_id, filename, original_name, url) VALUES (?, ?, ?, ?)",
      [entryId, public_id, file.name, url]
    );
    uploaded.push({ filename: public_id, url });
  }

  return Response.json({ uploaded }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  const result = await execute("SELECT filename FROM project_entry_images WHERE id = ?", [id]);
  if (result.rows.length > 0) {
    try { await deleteImage(result.rows[0].filename as string); } catch { /* already gone */ }
    await execute("DELETE FROM project_entry_images WHERE id = ?", [id]);
  }
  return Response.json({ ok: true });
}
