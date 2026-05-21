import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }
  const techniques = await execute(
    `SELECT t.* FROM techniques t
     JOIN project_techniques pt ON pt.technique_id = t.id
     WHERE pt.project_id = ?`,
    [projectId]
  );
  const books = await execute(
    `SELECT b.* FROM books b
     JOIN project_books pb ON pb.book_id = b.id
     WHERE pb.project_id = ?`,
    [projectId]
  );
  const equipment = await execute(
    `SELECT e.* FROM equipment e
     JOIN project_equipment pe ON pe.equipment_id = e.id
     WHERE pe.project_id = ?`,
    [projectId]
  );
  const eqRows = equipment.rows as Array<{ purchased: number; price: number | null }>;
  const spent = eqRows.filter((e) => e.purchased).reduce((sum, e) => sum + (e.price || 0), 0);
  const toSpend = eqRows.filter((e) => !e.purchased).reduce((sum, e) => sum + (e.price || 0), 0);

  return Response.json({
    techniques: techniques.rows,
    books: books.rows,
    equipment: equipment.rows,
    cost: { spent, to_spend: toSpend, total: spent + toSpend },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, type, targetId } = body;
  if (!projectId || !type || !targetId) {
    return Response.json({ error: "projectId, type, and targetId are required" }, { status: 400 });
  }
  if (type === "technique") {
    await execute("INSERT OR IGNORE INTO project_techniques (project_id, technique_id) VALUES (?, ?)", [projectId, targetId]);
  } else if (type === "book") {
    await execute("INSERT OR IGNORE INTO project_books (project_id, book_id) VALUES (?, ?)", [projectId, targetId]);
  } else if (type === "equipment") {
    await execute("INSERT OR IGNORE INTO project_equipment (project_id, equipment_id) VALUES (?, ?)", [projectId, targetId]);
  } else {
    return Response.json({ error: "type must be 'technique', 'book', or 'equipment'" }, { status: 400 });
  }
  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const type = searchParams.get("type");
  const targetId = searchParams.get("targetId");
  if (!projectId || !type || !targetId) {
    return Response.json({ error: "projectId, type, and targetId are required" }, { status: 400 });
  }
  if (type === "technique") {
    await execute("DELETE FROM project_techniques WHERE project_id = ? AND technique_id = ?", [projectId, targetId]);
  } else if (type === "book") {
    await execute("DELETE FROM project_books WHERE project_id = ? AND book_id = ?", [projectId, targetId]);
  } else if (type === "equipment") {
    await execute("DELETE FROM project_equipment WHERE project_id = ? AND equipment_id = ?", [projectId, targetId]);
  }
  return Response.json({ ok: true });
}
