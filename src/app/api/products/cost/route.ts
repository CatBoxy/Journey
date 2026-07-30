import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  if (!productId) {
    return Response.json({ error: "productId is required" }, { status: 400 });
  }

  // Product info
  const productResult = await execute("SELECT * FROM products WHERE id = ?", [productId]);
  if (productResult.rows.length === 0) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }
  const product = productResult.rows[0];

  // BOM materials cost
  const bomResult = await execute(
    `SELECT SUM(pm.quantity * m.unit_cost) as material_cost
     FROM product_materials pm
     JOIN materials m ON m.id = pm.material_id
     WHERE pm.product_id = ?`,
    [productId]
  );
  const materialCost = (bomResult.rows[0]?.material_cost as number) || 0;

  // Work time
  const timeResult = await execute(
    "SELECT COALESCE(SUM(minutes_spent), 0) as total_minutes FROM product_work_entries WHERE product_id = ?",
    [productId]
  );
  const totalMinutes = timeResult.rows[0]?.total_minutes as number || 0;

  // Settings
  const settingsResult = await execute("SELECT key, value FROM settings");
  const settings: Record<string, string> = {};
  for (const row of settingsResult.rows) {
    settings[row.key as string] = row.value as string;
  }

  const hourlyRate = settings.hourly_labor_rate ? Number(settings.hourly_labor_rate) : 0;
  const txFeePct = settings.transaction_fee_pct ? Number(settings.transaction_fee_pct) / 100 : 0;
  const packagingCost = settings.packaging_cost_per_sale ? Number(settings.packaging_cost_per_sale) : 0;
  const shippingCost = settings.shipping_cost_per_sale ? Number(settings.shipping_cost_per_sale) : 0;

  const laborCost = (totalMinutes / 60) * hourlyRate;
  const price = product.price as number | null;
  const txFee = price ? price * txFeePct : 0;

  const cashUnitCost = materialCost + packagingCost + shippingCost + txFee;
  const fullUnitCost = cashUnitCost + laborCost;

  const result: Record<string, unknown> = {
    product_id: Number(productId),
    material_cost: round2(materialCost),
    labor_cost: round2(laborCost),
    total_minutes: totalMinutes,
    hourly_rate: hourlyRate,
    packaging_cost: packagingCost,
    shipping_cost: shippingCost,
    transaction_fee: round2(txFee),
    cash_only: {
      unit_cost: round2(cashUnitCost),
    },
    full_cost: {
      unit_cost: round2(fullUnitCost),
    },
  };

  if (price != null && price > 0) {
    const cashMargin = price - cashUnitCost;
    const fullMargin = price - fullUnitCost;
    result.price = price;
    (result.cash_only as Record<string, unknown>).margin = round2(cashMargin);
    (result.cash_only as Record<string, unknown>).margin_pct = round2((cashMargin / price) * 100);
    (result.full_cost as Record<string, unknown>).margin = round2(fullMargin);
    (result.full_cost as Record<string, unknown>).margin_pct = round2((fullMargin / price) * 100);
  }

  return Response.json(result);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
