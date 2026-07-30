import { execute, buildPartialUpdate } from "@/lib/db";
import { NextRequest } from "next/server";

const VALID_UNITS = ["g", "ml", "unit", "cm"];

export async function GET() {
  const result = await execute("SELECT * FROM materials ORDER BY name");
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, unit, unit_cost, currency, supplier } = body;
  if (!name || !unit || unit_cost == null) {
    return Response.json({ error: "name, unit, and unit_cost are required" }, { status: 400 });
  }
  if (!VALID_UNITS.includes(unit)) {
    return Response.json({ error: `unit must be one of: ${VALID_UNITS.join(", ")}` }, { status: 400 });
  }
  const result = await execute(
    "INSERT INTO materials (name, unit, unit_cost, currency, supplier) VALUES (?, ?, ?, ?, ?)",
    [name, unit, unit_cost, currency || "ARS", supplier || ""]
  );
  // Record initial price in history
  await execute(
    "INSERT INTO material_price_history (material_id, unit_cost, currency) VALUES (?, ?, ?)",
    [result.lastInsertRowid!, unit_cost, currency || "ARS"]
  );
  const row = await execute("SELECT * FROM materials WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, unit, unit_cost, currency, supplier } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  if (unit !== undefined && !VALID_UNITS.includes(unit)) {
    return Response.json({ error: `unit must be one of: ${VALID_UNITS.join(", ")}` }, { status: 400 });
  }
  const update = buildPartialUpdate("materials", id, {
    name, unit, unit_cost, currency, supplier,
    updated_at: new Date().toISOString().replace("T", " ").substring(0, 19),
  });
  if (update) await execute(update.sql, update.args);

  // If unit_cost changed, write price history
  if (unit_cost !== undefined) {
    const current = await execute("SELECT currency FROM materials WHERE id = ?", [id]);
    const cur = currency || (current.rows[0]?.currency as string) || "ARS";
    await execute(
      "INSERT INTO material_price_history (material_id, unit_cost, currency) VALUES (?, ?, ?)",
      [id, unit_cost, cur]
    );
  }

  const row = await execute("SELECT * FROM materials WHERE id = ?", [id]);
  return Response.json(row.rows[0]);
}
