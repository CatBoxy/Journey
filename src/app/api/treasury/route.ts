import { execute } from "@/lib/db";
import { computeTreasury, type Settings } from "@/lib/treasury";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const months = searchParams.get("months");

  const [expenseResult, salesResult, contribResult, settingsResult, productsResult, bomResult, workResult] = await Promise.all([
    execute("SELECT amount, currency, date, recurrence, is_capital, useful_life_months, fx_rate FROM expenses"),
    execute("SELECT amount, currency, date, fx_rate, product_id, unit_cost_at_sale FROM sales"),
    execute("SELECT amount, currency, fx_rate FROM contributions"),
    execute("SELECT key, value FROM settings"),
    execute("SELECT id, price, currency FROM products"),
    execute(
      `SELECT pm.product_id, SUM(pm.quantity * m.unit_cost) as material_cost
       FROM product_materials pm
       JOIN materials m ON m.id = pm.material_id
       GROUP BY pm.product_id`
    ),
    execute(
      `SELECT product_id, COALESCE(SUM(minutes_spent), 0) as total_minutes
       FROM product_work_entries
       GROUP BY product_id`
    ),
  ]);

  const settings: Settings = {};
  for (const row of settingsResult.rows) {
    (settings as Record<string, string>)[row.key as string] = row.value as string;
  }

  const expenses = expenseResult.rows.map(r => ({
    amount: r.amount as number,
    currency: (r.currency as string) || "ARS",
    date: (r.date as string) || "",
    recurrence: (r.recurrence as string) || "none",
    is_capital: (r.is_capital as number) || 0,
    useful_life_months: r.useful_life_months as number | null,
    fx_rate: r.fx_rate as number | null,
  }));

  const sales = salesResult.rows.map(r => ({
    amount: r.amount as number,
    currency: (r.currency as string) || "ARS",
    date: (r.date as string) || "",
    fx_rate: r.fx_rate as number | null,
    product_id: r.product_id as number | null,
    unit_cost_at_sale: r.unit_cost_at_sale as number | null,
  }));

  const contributions = contribResult.rows.map(r => ({
    amount: r.amount as number,
    currency: (r.currency as string) || "ARS",
    fx_rate: r.fx_rate as number | null,
  }));

  const products = productsResult.rows.map(r => ({
    id: r.id as number,
    price: r.price as number | null,
    currency: (r.currency as string) || "ARS",
  }));

  const productBoms = bomResult.rows.map(r => ({
    product_id: r.product_id as number,
    material_cost: (r.material_cost as number) || 0,
  }));

  const productWorkMinutes = workResult.rows.map(r => ({
    product_id: r.product_id as number,
    total_minutes: (r.total_minutes as number) || 0,
  }));

  const result = computeTreasury(
    expenses,
    sales,
    contributions,
    settings,
    new Date(),
    months ? Number(months) : undefined,
    products,
    productBoms,
    productWorkMinutes,
  );

  return Response.json(result);
}
