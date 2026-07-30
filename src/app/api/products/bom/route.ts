import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  if (!productId) {
    return Response.json({ error: "productId is required" }, { status: 400 });
  }
  const result = await execute(
    `SELECT pm.material_id, pm.quantity, m.name, m.unit, m.unit_cost, m.currency
     FROM product_materials pm
     JOIN materials m ON m.id = pm.material_id
     WHERE pm.product_id = ?`,
    [productId]
  );
  return Response.json(result.rows);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { product_id, items } = body;
  if (!product_id || !Array.isArray(items)) {
    return Response.json({ error: "product_id and items array are required" }, { status: 400 });
  }
  // Replace all BOM entries
  await execute("DELETE FROM product_materials WHERE product_id = ?", [product_id]);
  for (const item of items) {
    if (!item.material_id || item.quantity == null) continue;
    await execute(
      "INSERT INTO product_materials (product_id, material_id, quantity) VALUES (?, ?, ?)",
      [product_id, item.material_id, item.quantity]
    );
  }
  // Return the updated BOM
  const result = await execute(
    `SELECT pm.material_id, pm.quantity, m.name, m.unit, m.unit_cost, m.currency
     FROM product_materials pm
     JOIN materials m ON m.id = pm.material_id
     WHERE pm.product_id = ?`,
    [product_id]
  );
  return Response.json(result.rows);
}
