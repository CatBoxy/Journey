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
  const entriesResult = await client.execute({
    sql: "SELECT * FROM technique_entries WHERE technique_id = ? ORDER BY created_at DESC",
    args: [techniqueId],
  });

  const entries = [];
  for (const entry of entriesResult.rows) {
    const images = await client.execute({
      sql: "SELECT * FROM entry_images WHERE entry_id = ? ORDER BY created_at ASC",
      args: [entry.id],
    });
    const books = await client.execute({
      sql: `SELECT b.* FROM books b
            JOIN entry_books eb ON eb.book_id = b.id
            WHERE eb.entry_id = ?`,
      args: [entry.id],
    });
    const equipment = await client.execute({
      sql: `SELECT e.* FROM equipment e
            JOIN entry_equipment ee ON ee.equipment_id = e.id
            WHERE ee.entry_id = ?`,
      args: [entry.id],
    });
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

  const client = db();

  const result = await client.execute({
    sql: "INSERT INTO technique_entries (technique_id, text) VALUES (?, ?)",
    args: [techniqueId, text],
  });
  const entryId = result.lastInsertRowid!;

  // Upload images to Cloudinary
  for (const file of files) {
    if (file.size === 0) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { public_id, url } = await uploadImage(buffer, "journey/entries");
    await client.execute({
      sql: "INSERT INTO entry_images (entry_id, filename, original_name, url) VALUES (?, ?, ?, ?)",
      args: [entryId, public_id, file.name, url],
    });
  }

  // Link books
  if (bookIds) {
    const ids = JSON.parse(bookIds) as number[];
    for (const id of ids) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO entry_books (entry_id, book_id) VALUES (?, ?)",
        args: [entryId, id],
      });
    }
  }

  // Link equipment
  if (equipmentIds) {
    const ids = JSON.parse(equipmentIds) as number[];
    for (const id of ids) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO entry_equipment (entry_id, equipment_id) VALUES (?, ?)",
        args: [entryId, id],
      });
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
  const client = db();

  // Delete images from Cloudinary
  const images = await client.execute({
    sql: "SELECT filename FROM entry_images WHERE entry_id = ?",
    args: [id],
  });
  for (const img of images.rows) {
    try {
      await deleteImage(img.filename as string);
    } catch {
      // image may already be gone
    }
  }

  // CASCADE handles entry_images, entry_books, entry_equipment
  await client.execute({ sql: "DELETE FROM technique_entries WHERE id = ?", args: [id] });
  return Response.json({ ok: true });
}
