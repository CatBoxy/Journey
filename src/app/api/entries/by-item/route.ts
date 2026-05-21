import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if (!type || !id || !["book", "equipment"].includes(type)) {
    return Response.json({ error: "type (book|equipment) and id are required" }, { status: 400 });
  }

  const joinTable = type === "book" ? "entry_books" : "entry_equipment";
  const fkColumn = type === "book" ? "book_id" : "equipment_id";

  const result = await execute(
    `SELECT te.*, t.name as technique_name
     FROM technique_entries te
     JOIN ${joinTable} j ON j.entry_id = te.id
     JOIN techniques t ON t.id = te.technique_id
     WHERE j.${fkColumn} = ?
     ORDER BY te.created_at DESC`,
    [id]
  );

  return Response.json(result.rows);
}
