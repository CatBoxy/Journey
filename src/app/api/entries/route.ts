import { execute } from "@/lib/db";

export async function GET() {
  const entriesResult = await execute(
    `SELECT te.*, t.name as technique_name, t.id as technique_id
     FROM technique_entries te
     JOIN techniques t ON t.id = te.technique_id
     ORDER BY te.created_at DESC`
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
