import { execute, buildPartialUpdate } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const result = await execute(
    `SELECT s.*, p.name as product_name
     FROM sales s
     LEFT JOIN products p ON s.product_id = p.id
     ORDER BY s.date DESC`
  );
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { description, amount, currency, product_id, customer, notes, date, fx_rate, unit_cost_at_sale } = body;
  if (!description || amount == null) {
    return Response.json({ error: "Description and amount are required" }, { status: 400 });
  }
  // Auto-populate unit_cost_at_sale from product BOM if not explicitly provided
  let resolvedUnitCost = unit_cost_at_sale ?? null;
  if (resolvedUnitCost == null && product_id) {
    const bomResult = await execute(
      `SELECT SUM(pm.quantity * m.unit_cost) as material_cost
       FROM product_materials pm
       JOIN materials m ON m.id = pm.material_id
       WHERE pm.product_id = ?`,
      [product_id]
    );
    const materialCost = (bomResult.rows[0]?.material_cost as number) || 0;
    if (materialCost > 0) {
      // Include packaging, shipping, transaction fee from settings
      const settingsResult = await execute("SELECT key, value FROM settings");
      const settings: Record<string, string> = {};
      for (const row of settingsResult.rows) {
        settings[row.key as string] = row.value as string;
      }
      const packagingCost = settings.packaging_cost_per_sale ? Number(settings.packaging_cost_per_sale) : 0;
      const shippingCost = settings.shipping_cost_per_sale ? Number(settings.shipping_cost_per_sale) : 0;
      const txFeePct = settings.transaction_fee_pct ? Number(settings.transaction_fee_pct) / 100 : 0;
      resolvedUnitCost = materialCost + packagingCost + shippingCost + (txFeePct * amount);
    }
  }
  const result = await execute(
    "INSERT INTO sales (description, amount, currency, product_id, customer, notes, date, fx_rate, unit_cost_at_sale) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [description, amount, currency || "ARS", product_id || null, customer || "", notes || "", date || new Date().toISOString().split("T")[0], fx_rate ?? null, resolvedUnitCost]
  );
  const row = await execute(
    `SELECT s.*, p.name as product_name
     FROM sales s
     LEFT JOIN products p ON s.product_id = p.id
     WHERE s.id = ?`,
    [result.lastInsertRowid!]
  );
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, description, amount, currency, product_id, customer, notes, date, fx_rate, unit_cost_at_sale } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const update = buildPartialUpdate("sales", id, {
    description, amount, currency,
    product_id: product_id !== undefined ? (product_id || null) : undefined,
    customer, notes, date, fx_rate, unit_cost_at_sale,
  });
  if (update) await execute(update.sql, update.args);
  const row = await execute(
    `SELECT s.*, p.name as product_name
     FROM sales s
     LEFT JOIN products p ON s.product_id = p.id
     WHERE s.id = ?`,
    [id]
  );
  return Response.json(row.rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  await execute("DELETE FROM sales WHERE id = ?", [id]);
  return Response.json({ ok: true });
}
