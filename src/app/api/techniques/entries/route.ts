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
  const entries = db
    .prepare("SELECT * FROM technique_entries WHERE technique_id = ? ORDER BY created_at DESC")
    .all(techniqueId) as Array<{ id: number; technique_id: number; text: string; created_at: string }>;

  const result = entries.map((entry) => {
    const images = db
      .prepare("SELECT * FROM entry_images WHERE entry_id = ? ORDER BY created_at ASC")
      .all(entry.id);
    const books = db
      .prepare(
        `SELECT b.* FROM books b
         JOIN entry_books eb ON eb.book_id = b.id
         WHERE eb.entry_id = ?`
      )
      .all(entry.id);
    const equipment = db
      .prepare(
        `SELECT e.* FROM equipment e
         JOIN entry_equipment ee ON ee.equipment_id = e.id
         WHERE ee.entry_id = ?`
      )
      .all(entry.id);
    return { ...entry, images, books, equipment };
  });

  return Response.json(result);
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

  const db = getDb();

  // Create entry
  const result = db
    .prepare("INSERT INTO technique_entries (technique_id, text) VALUES (?, ?)")
    .run(techniqueId, text);
  const entryId = result.lastInsertRowid;

  // Save images
  if (files.length > 0) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const insertImage = db.prepare(
      "INSERT INTO entry_images (entry_id, filename, original_name) VALUES (?, ?, ?)"
    );
    for (const file of files) {
      if (file.size === 0) continue;
      const ext = path.extname(file.name) || ".jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(UPLOAD_DIR, filename), buffer);
      insertImage.run(entryId, filename, file.name);
    }
  }

  // Link books
  if (bookIds) {
    const ids = JSON.parse(bookIds) as number[];
    const insertLink = db.prepare(
      "INSERT OR IGNORE INTO entry_books (entry_id, book_id) VALUES (?, ?)"
    );
    for (const id of ids) {
      insertLink.run(entryId, id);
    }
  }

  // Link equipment
  if (equipmentIds) {
    const ids = JSON.parse(equipmentIds) as number[];
    const insertLink = db.prepare(
      "INSERT OR IGNORE INTO entry_equipment (entry_id, equipment_id) VALUES (?, ?)"
    );
    for (const id of ids) {
      insertLink.run(entryId, id);
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
  const db = getDb();

  // Delete image files from disk
  const images = db.prepare("SELECT filename FROM entry_images WHERE entry_id = ?").all(id) as Array<{ filename: string }>;
  for (const img of images) {
    try {
      await unlink(path.join(UPLOAD_DIR, img.filename));
    } catch {
      // file may already be gone
    }
  }

  // CASCADE handles entry_images, entry_books, entry_equipment
  db.prepare("DELETE FROM technique_entries WHERE id = ?").run(id);
  return Response.json({ ok: true });
}
