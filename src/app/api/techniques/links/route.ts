import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const techniqueId = searchParams.get("techniqueId");
  if (!techniqueId) {
    return Response.json({ error: "techniqueId is required" }, { status: 400 });
  }
  const books = await execute(
    `SELECT b.* FROM books b
     JOIN technique_books tb ON tb.book_id = b.id
     WHERE tb.technique_id = ?`,
    [techniqueId]
  );
  const equipment = await execute(
    `SELECT e.* FROM equipment e
     JOIN technique_equipment te ON te.equipment_id = e.id
     WHERE te.technique_id = ?`,
    [techniqueId]
  );
  // Cost rollup: split by owned vs to-spend
  const eqRows = equipment.rows as Array<{ purchased: number; price: number | null; priority: string }>;
  const spent = eqRows.filter((e) => e.purchased).reduce((sum, e) => sum + (e.price || 0), 0);
  const toSpend = eqRows.filter((e) => !e.purchased).reduce((sum, e) => sum + (e.price || 0), 0);

  return Response.json({
    books: books.rows,
    equipment: equipment.rows,
    cost: { spent, to_spend: toSpend, total: spent + toSpend },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { techniqueId, type, targetId } = body;
  if (!techniqueId || !type || !targetId) {
    return Response.json({ error: "techniqueId, type, and targetId are required" }, { status: 400 });
  }
  if (type === "book") {
    await execute("INSERT OR IGNORE INTO technique_books (technique_id, book_id) VALUES (?, ?)", [techniqueId, targetId]);
  } else if (type === "equipment") {
    await execute("INSERT OR IGNORE INTO technique_equipment (technique_id, equipment_id) VALUES (?, ?)", [techniqueId, targetId]);
  } else {
    return Response.json({ error: "type must be 'book' or 'equipment'" }, { status: 400 });
  }
  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const techniqueId = searchParams.get("techniqueId");
  const type = searchParams.get("type");
  const targetId = searchParams.get("targetId");
  if (!techniqueId || !type || !targetId) {
    return Response.json({ error: "techniqueId, type, and targetId are required" }, { status: 400 });
  }
  if (type === "book") {
    await execute("DELETE FROM technique_books WHERE technique_id = ? AND book_id = ?", [techniqueId, targetId]);
  } else if (type === "equipment") {
    await execute("DELETE FROM technique_equipment WHERE technique_id = ? AND equipment_id = ?", [techniqueId, targetId]);
  }
  return Response.json({ ok: true });
}
