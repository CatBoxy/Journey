import { execute } from "@/lib/db";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const techniqueId = searchParams.get("techniqueId");
  if (!techniqueId) {
    return Response.json({ error: "techniqueId is required" }, { status: 400 });
  }
  const entriesResult = await execute(
    "SELECT * FROM technique_entries WHERE technique_id = ? ORDER BY created_at DESC",
    [techniqueId]
  );

  const entries = [];
  for (const entry of entriesResult.rows) {
    const images = await execute(
      "SELECT * FROM entry_images WHERE entry_id = ? ORDER BY created_at ASC",
      [entry.id as number]
    );
    const books = await execute(
      `SELECT b.* FROM books b
       JOIN entry_books eb ON eb.book_id = b.id
       WHERE eb.entry_id = ?`,
      [entry.id as number]
    );
    const equipment = await execute(
      `SELECT e.* FROM equipment e
       JOIN entry_equipment ee ON ee.equipment_id = e.id
       WHERE ee.entry_id = ?`,
      [entry.id as number]
    );
    entries.push({
      ...entry,
      images: images.rows,
      books: books.rows,
      equipment: equipment.rows,
    });
  }

  return Response.json(entries);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const techniqueId = formData.get("techniqueId") as string;
  const text = (formData.get("text") as string) || "";
  const bookIds = formData.get("bookIds") as string;
  const equipmentIds = formData.get("equipmentIds") as string;
  const files = formData.getAll("files") as File[];

  if (!techniqueId) {
    return Response.json({ error: "techniqueId is required" }, { status: 400 });
  }

  const result = await execute(
    "INSERT INTO technique_entries (technique_id, text) VALUES (?, ?)",
    [techniqueId, text]
  );
  const entryId = result.lastInsertRowid!;

  // Upload images to Cloudinary
  for (const file of files) {
    if (file.size === 0) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { public_id, url } = await uploadImage(buffer, "journey/entries");
    await execute(
      "INSERT INTO entry_images (entry_id, filename, original_name, url) VALUES (?, ?, ?, ?)",
      [entryId, public_id, file.name, url]
    );
  }

  // Link books
  if (bookIds) {
    const ids = JSON.parse(bookIds) as number[];
    for (const id of ids) {
      await execute("INSERT OR IGNORE INTO entry_books (entry_id, book_id) VALUES (?, ?)", [entryId, id]);
    }
  }

  // Link equipment
  if (equipmentIds) {
    const ids = JSON.parse(equipmentIds) as number[];
    for (const id of ids) {
      await execute("INSERT OR IGNORE INTO entry_equipment (entry_id, equipment_id) VALUES (?, ?)", [entryId, id]);
    }
  }

  return Response.json({ id: entryId }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  // Delete images from Cloudinary
  const images = await execute("SELECT filename FROM entry_images WHERE entry_id = ?", [id]);
  for (const img of images.rows) {
    try {
      await deleteImage(img.filename as string);
    } catch {
      // image may already be gone
    }
  }

  // CASCADE handles entry_images, entry_books, entry_equipment
  await execute("DELETE FROM technique_entries WHERE id = ?", [id]);
  return Response.json({ ok: true });
}
